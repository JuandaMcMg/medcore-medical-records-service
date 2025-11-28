// controllers/MedicalRecordController.js
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const integrations = require("../services/integrations")

/**
 * Crear un nuevo registro médico
 */
const createMedicalRecord = async (req, res) => {
  try {
    const { patientId, symptoms, diagnosis, treatment, notes, appointmentId } = req.body;
    const physicianId = req.user.id;
    const auth = req.headers.authorization || "";

    // Validaciones
    if (!patientId || !symptoms) {
      return res.status(400).json({
        message: "Se requieren patientId, y symptoms",
        service: "medical-records-service"
      });
    }

    // Valida paciente por HTTP (ID = frontera entre MS)
    const okPatient = await integrations.ensurePatientExists(patientId, auth);
    if (!okPatient) return res.status(404).json({ message: "Paciente no existe" });

    // Valida Doctor por HTTP (ID = frontera entre MS)
    const okDoct = await integrations.ensureDoctorExists(physicianId, auth);
    
    if (!okDoct) {
      return res.status(404).json({ 
        message: "El usuario autenticado no es médico", 
        patientId: patientId,
        tip: "Verifica que el ID sea correcto y que el servicio de usuarios esté disponible."
      });
    }

    //Validar citas
    let appointmentInfo = null;
    if (appointmentId) {
      const validation = await integrations.validateAppointmentForPatient(
        appointmentId,
        patientId,
        auth
      );

      if (!validation.ok) {
        return res.status(400).json({
          message: "La cita no es válida para este paciente",
          reason: validation.reason,
          appointment: validation.appointment || null
        });
      }
      appointmentInfo = validation.appointment;
    }
    
    // 4) Obtener info del paciente para retornarla al front
    const patientInfo = await integrations.getPatientInfo(patientId, auth);

    // Crear el registro médico
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId: String(patientId),
        physicianId: String(physicianId),
        appointmentId: String(appointmentId),
        symptoms,
        diagnosis: diagnosis?? null,
        treatment: treatment?? null,
        notes: notes ?? null,
        status: "active"
      }
    });

    //AuditLog
    await integrations.auditLog({ action:"MEDICAL_RECORD_CREATE", entity:"MedicalRecord", entityId: medicalRecord.id, actorId: req.user.id }, auth);
    
    return res.status(201).json({
      message: "Registro médico creado exitosamente",
      data: medicalRecord,
      patient: patientInfo || null,
      appointmentId: appointmentInfo || null,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al crear registro médico:", error);
    return res.status(500).json({
      message: "Error al crear el registro médico",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Obtener un registro médico por ID
 */
const getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar el registro médico con prescripciones y resultados de laboratorio
    // NOTA: Se removió 'documents: true' porque el cliente Prisma activo no reconoce
    // la relación 'documents' en MedicalRecord, generando PrismaClientValidationError.
    // Solución raíz: ejecutar 'npx prisma generate' en el microservicio para actualizar el cliente.
    // Mientras tanto retornamos el registro sin esa relación para evitar 500.
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        prescriptions: true,
        labResults: true,
        diagnostic: { include: { documents: true } }
      }
    });

    // Cargar órdenes médicas asociadas a esta historia (lab/radiología)
    const orders = await prisma.medicalOrder.findMany({
      where: { medicalRecordId: id },
      orderBy: { createdAt: 'desc' }
    });

    if (!medicalRecord) {
      return res.status(404).json({
        message: "Registro médico no encontrado",
        service: "medical-records-service"
      });
    }

    return res.status(200).json({
      data: medicalRecord,
      orders,
      medicalRecordId: id,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al obtener registro médico:", error);
    return res.status(500).json({
      message: "Error al obtener el registro médico",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Listar registros médicos con filtros opcionales
 */
const listMedicalRecords = async (req, res) => {
  try {
    const { patientId, physicianId, status, fromDate, toDate } = req.query;

    // Construir el objeto de filtros dinámicamente
    const where = {};
    
    if (patientId) where.patientId = patientId;
    if (physicianId) where.physicianId = physicianId;
    if (status) where.status = status;
    
    // Filtrado por rango de fechas
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
    }

    // Obtener los registros médicos paginados
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Contar total de registros que coinciden con el filtro
    const totalCount = await prisma.medicalRecord.count({ where });

    // Obtener los registros médicos
    const medicalRecords = await prisma.medicalRecord.findMany({
      where,
      include: {
        prescriptions: true,
        labResults: true
      },
      skip,
      take: limit,
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({
      data: medicalRecords,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        page,
        limit
      },
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al listar registros médicos:", error);
    return res.status(500).json({
      message: "Error al listar los registros médicos",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Actualizar un registro médico
 */
const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { symptoms, diagnosis, treatment, notes, status } = req.body;

    // Verificar que el registro existe
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id }
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: "Registro médico no encontrado",
        service: "medical-records-service"
      });
    }

    // Actualizar el registro
    const updatedRecord = await prisma.medicalRecord.update({
      where: { id },
      data: {
        symptoms: symptoms ?? existingRecord.symptoms,
        diagnosis: diagnosis ?? existingRecord.diagnosis,
        treatment: treatment ?? existingRecord.treatment,
        notes: notes ?? existingRecord.notes,
        status: status ?? existingRecord.status
      }
    });

    return res.status(200).json({
      message: "Registro médico actualizado exitosamente",
      data: updatedRecord,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al actualizar registro médico:", error);
    return res.status(500).json({
      message: "Error al actualizar el registro médico",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Archivar un registro médico (soft delete)
 */
const archiveMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el registro existe
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id }
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: "Registro médico no encontrado",
        service: "medical-records-service"
      });
    }

    // Actualizar el estado a "archived"
    const archivedRecord = await prisma.medicalRecord.update({
      where: { id },
      data: { status: "archived" }
    });

    return res.status(200).json({
      message: "Registro médico archivado exitosamente",
      data: archivedRecord,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al archivar registro médico:", error);
    return res.status(500).json({
      message: "Error al archivar el registro médico",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

// GET /api/v1/medical-records/by-patient/:patientId
const listByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        symptoms: true,
        diagnosis: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      items: records,
      total: records.length,
      patientId,
    });
  } catch (e) {
    console.error("listByPatient", e);
    return res.status(500).json({ message: "Error listando historias del paciente" });
  }
};

//GET http://localhost:3005/api/v1//medical-records/:appointmentId
//Obtener Historia medica por cita 
const getByAppointmentId = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const record = await prisma.medicalRecord.findFirst({
      where: { appointmentId },
      include: {
        prescriptions: true,
        labResults: true,
        diagnostic: { include: { documents: true } },
      },
      orderBy: { date: "desc" },
    });

    if (!record) {
      return res.status(404).json({
        message: "No hay registro médico asociado a esta cita",
        service: "medical-records-service",
      });
    }

    return res.json({
      data: record,
      service: "medical-records-service",
    });
  } catch (e) {
    console.error("getByAppointmentId", e);
    return res.status(500).json({
      message: "Error obteniendo historia por cita",
      service: "medical-records-service",
    });
  }
};

module.exports = {
  createMedicalRecord,
  getMedicalRecordById,
  listMedicalRecords,
  updateMedicalRecord,
  archiveMedicalRecord,
  listByPatient,
  getByAppointmentId
};