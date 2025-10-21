// controllers/PrescriptionController.js
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

/**
 * Crear una nueva prescripción
 */
const createPrescription = async (req, res) => {
  try {
    const { 
      medicalRecordId,
      medication,
      dosage,
      frequency,
      duration,
      instructions,
      expirationDate
    } = req.body;

    // Validaciones básicas
    if (!medicalRecordId || !medication || !dosage || !frequency || !duration) {
      return res.status(400).json({
        message: "Se requieren medicalRecordId, medication, dosage, frequency y duration",
        service: "medical-records-service"
      });
    }

    // Verificar que el registro médico existe
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId }
    });

    if (!medicalRecord) {
      return res.status(404).json({
        message: "Registro médico no encontrado",
        service: "medical-records-service"
      });
    }

    // Crear la prescripción
    const prescription = await prisma.prescription.create({
      data: {
        medicalRecordId,
        medication,
        dosage,
        frequency,
        duration,
        instructions,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined
      }
    });

    return res.status(201).json({
      message: "Prescripción creada exitosamente",
      data: prescription,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al crear prescripción:", error);
    return res.status(500).json({
      message: "Error al crear la prescripción",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Obtener una prescripción por ID
 */
const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar la prescripción
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        medicalRecord: true
      }
    });

    if (!prescription) {
      return res.status(404).json({
        message: "Prescripción no encontrada",
        service: "medical-records-service"
      });
    }

    return res.status(200).json({
      data: prescription,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al obtener prescripción:", error);
    return res.status(500).json({
      message: "Error al obtener la prescripción",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Listar prescripciones con filtros opcionales
 */
const listPrescriptions = async (req, res) => {
  try {
    const { medicalRecordId, medication } = req.query;

    // Construir el objeto de filtros
    const where = {};
    
    if (medicalRecordId) where.medicalRecordId = medicalRecordId;
    if (medication) where.medication = { contains: medication };

    // Obtener las prescripciones paginadas
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Contar total de prescripciones que coinciden con el filtro
    const totalCount = await prisma.prescription.count({ where });

    // Obtener las prescripciones
    const prescriptions = await prisma.prescription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { prescriptionDate: 'desc' }
    });

    return res.status(200).json({
      data: prescriptions,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        page,
        limit
      },
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al listar prescripciones:", error);
    return res.status(500).json({
      message: "Error al listar las prescripciones",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Actualizar una prescripción
 */
const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      medication,
      dosage,
      frequency,
      duration,
      instructions,
      expirationDate
    } = req.body;

    // Verificar que la prescripción existe
    const existingPrescription = await prisma.prescription.findUnique({
      where: { id }
    });

    if (!existingPrescription) {
      return res.status(404).json({
        message: "Prescripción no encontrada",
        service: "medical-records-service"
      });
    }

    // Actualizar la prescripción
    const updatedPrescription = await prisma.prescription.update({
      where: { id },
      data: {
        medication: medication ?? existingPrescription.medication,
        dosage: dosage ?? existingPrescription.dosage,
        frequency: frequency ?? existingPrescription.frequency,
        duration: duration ?? existingPrescription.duration,
        instructions: instructions ?? existingPrescription.instructions,
        expirationDate: expirationDate ? new Date(expirationDate) : existingPrescription.expirationDate
      }
    });

    return res.status(200).json({
      message: "Prescripción actualizada exitosamente",
      data: updatedPrescription,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al actualizar prescripción:", error);
    return res.status(500).json({
      message: "Error al actualizar la prescripción",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Eliminar una prescripción
 */
const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la prescripción existe
    const existingPrescription = await prisma.prescription.findUnique({
      where: { id }
    });

    if (!existingPrescription) {
      return res.status(404).json({
        message: "Prescripción no encontrada",
        service: "medical-records-service"
      });
    }

    // Eliminar la prescripción
    await prisma.prescription.delete({
      where: { id }
    });

    return res.status(200).json({
      message: "Prescripción eliminada exitosamente",
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al eliminar prescripción:", error);
    return res.status(500).json({
      message: "Error al eliminar la prescripción",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

module.exports = {
  createPrescription,
  getPrescriptionById,
  listPrescriptions,
  updatePrescription,
  deletePrescription
};