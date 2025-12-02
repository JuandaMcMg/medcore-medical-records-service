// src/controllers/PrescriptionController.js
const prescriptionService = require("../services/prescription.service");
const { ensureDoctorExists } = require("../services/integrations");
const { PrismaClient } = require("../generated/prisma");
const { generatePrescriptionPdf } = require("../config/prescriptionPdf");

const prisma = new PrismaClient();

exports.createPrescription = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const doctorId = req.user?.id;

    const {
      medicalRecordId,
      medication,
      dosage,
      frequency,
      duration,
      instructions,
    } = req.body;

    // Validar campos requeridos del body
    if (!medicalRecordId || !medication || !dosage || !frequency || !duration) {
      return res.status(400).json({
        message: "Faltan campos obligatorios",
        required: ["medicalRecordId", "medication", "dosage", "frequency", "duration"],
      });
    }

    //Validar doctor
    const okDoctor = await ensureDoctorExists(doctorId, authHeader);
    if (!okDoctor) {
      return res.status(404).json({ message: "Doctor no existe" });
    }

    //Cargar el MedicalRecord y obtener patientId
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: String(medicalRecordId) },
    });

    if (!medicalRecord) {
      return res.status(404).json({ message: "Historia clínica no existe" });
    }

    const patientId = medicalRecord.patientId;

    //Crear la prescripción usando el servicio
    const prescription = await prescriptionService.createPrescription({
      authHeader,
      doctorId,
      patientId,
      medicalRecordId,
      medication,
      dosage,
      frequency,
      duration,
      instructions,
      medicationType: req.body.medicationType, // opcional
    });

    //Si viene ?pdf=true, generar PDF de una vez
    if (req.query.pdf === "true") {
      await generatePrescriptionPdf({
        prescriptionId: prescription.id,
        res,
        authHeader,
        currentUser: req.user,
      });
      return; // generatePrescriptionPdf ya envía la respuesta
    }

    return res.status(201).json({
      message: "Prescripción creada exitosamente",
      data: prescription,
    });
  } catch (error) {
    console.error("createPrescription error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Error al crear prescripción",
    });
  }
};

// GET /api/v1/prescriptions/:id/pdf
exports.getPrescriptionPdf = async (req, res) => {
  try {
    const { id } = req.params;               // 👈 Asegurarse que el param se llame :id
    const authHeader = req.headers.authorization || "";

    if (!id) {
      return res.status(400).json({ message: "El id de la prescripción es requerido" });
    }

    await generatePrescriptionPdf({
      prescriptionId: id,
      res,
      authHeader,
      currentUser: req.user
    });
  } catch (error) {
    console.error("getPrescriptionPdf error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Error al generar PDF de la prescripción"
    });
  }
};

// GET /api/v1/prescriptions/patient/:patientId
exports.prescriptionByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const items = await prescriptionService.listPrescriptionsByPatient(patientId);
    return res.json({
      patientId,
      total: items.length,
      items,
    });
  } catch (error) {
    console.error("prescriptionByPatient error:", error);
    return res.status(500).json({ message: "Error listando prescripciones del paciente" });
  }
};

// GET /api/v1/prescriptions/:id
exports.getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        medicalRecord: {
          select: {
            id: true,
            date: true,
            patientId: true,
            physicianId: true,
          },
        },
      },
    });

    if (!prescription) {
      return res.status(404).json({ message: "Prescripción no encontrada" });
    }

    return res.json({ data: prescription });
  } catch (error) {
    console.error("getPrescriptionById error:", error);
    return res.status(500).json({ message: "Error obteniendo prescripción" });
  }
};

// GET /api/v1/prescriptions
exports.listPrescriptions = async (req, res) => {
  try {
    const {
      patientId,
      medicalRecordId,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};
    if (medicalRecordId) where.medicalRecordId = String(medicalRecordId);

    // filtro por paciente a través de MedicalRecord
    if (patientId) {
      where.medicalRecord = {
        patientId: String(patientId),
      };
    }

    if (fromDate || toDate) {
      where.prescriptionDate = {};
      if (fromDate) where.prescriptionDate.gte = new Date(fromDate);
      if (toDate) where.prescriptionDate.lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        orderBy: { prescriptionDate: "desc" },
        skip,
        take,
      }),
      prisma.prescription.count({ where }),
    ]);

    return res.json({
      data: items,
      pagination: {
        total,
        pages: Math.ceil(total / take),
        page: parseInt(page),
        limit: take,
      },
    });
  } catch (error) {
    console.error("listPrescriptions error:", error);
    return res.status(500).json({ message: "Error listando prescripciones" });
  }
};

// PUT /api/v1/prescriptions/:id
exports.updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { medication, dosage, frequency, duration, instructions } = req.body;

    const existing = await prisma.prescription.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Prescripción no encontrada" });
    }

    // (opcional) podrías restringir que solo el mismo médico o admin actualice

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        medication: medication ?? existing.medication,
        dosage: dosage ?? existing.dosage,
        frequency: frequency ?? existing.frequency,
        duration: duration ?? existing.duration,
        instructions: instructions ?? existing.instructions,
      },
    });

    return res.json({
      message: "Prescripción actualizada correctamente",
      data: updated,
    });
  } catch (error) {
    console.error("updatePrescription error:", error);
    return res.status(500).json({ message: "Error actualizando prescripción" });
  }
};

// DELETE /api/v1/prescriptions/:id
exports.deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.prescription.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Prescripción no encontrada" });
    }

    await prisma.prescription.delete({ where: { id } });

    return res.json({ message: "Prescripción eliminada correctamente" });
  } catch (error) {
    console.error("deletePrescription error:", error);
    return res.status(500).json({ message: "Error eliminando prescripción" });
  }
};

// GET /api/v1/prescriptions/:id/pdf
exports.getPrescriptionPdf = async (req, res) => {
  try {
    const { id } = req.params;               // 👈 Asegurarse que el param se llame :id
    const authHeader = req.headers.authorization || "";

    if (!id) {
      return res.status(400).json({ message: "El id de la prescripción es requerido" });
    }

    await generatePrescriptionPdf({
      prescriptionId: id,
      res,
      authHeader,
      currentUser: req.user
    });
  } catch (error) {
    console.error("getPrescriptionPdf error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Error al generar PDF de la prescripción"
    });
  }
};