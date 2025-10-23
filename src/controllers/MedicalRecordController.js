// controllers/MedicalRecordController.js
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const {ensurePatientExists, ensureDoctorExists, auditLog} = require("../services/integrations")

/**
 * Crear un nuevo registro médico
 */
const createMedicalRecord = async (req, res) => {
  try {
    const { patientId, symptoms, diagnosis, treatment, notes } = req.body;
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
    console.log('[createMedicalRecord] Validando paciente:', patientId);
    console.log('[createMedicalRecord] Authorization header presente:', !!req.headers.authorization);
    
    const okPatient = await ensurePatientExists(patientId, auth);
    if (!okPatient) return res.status(404).json({ message: "Paciente no existe" });

    // Valida Doctor por HTTP (ID = frontera entre MS)
    const okDoct = await ensureDoctorExists(physicianId, auth);
    
    if (!okDoct) {
      console.error('[createMedicalRecord] Paciente no encontrado en la validación');
      return res.status(404).json({ 
        message: "El usuario autenticado no es médico", 
        patientId: patientId,
        tip: "Verifica que el ID sea correcto y que el servicio de usuarios esté disponible."
      });
    }
    
    console.log('[createMedicalRecord] Paciente validado correctamente');
    

    // Crear el registro médico
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId: String(patientId),
        physicianId: String(physicianId),
        symptoms,
        diagnosis: diagnosis?? null,
        treatment: treatment?? null,
        notes: notes ?? null,
        status: "active"
      }
    });

    //AuditLog
    await auditLog({ action:"MEDICAL_RECORD_CREATE", entity:"MedicalRecord", entityId: medicalRecord.id, actorId: req.user.id }, auth);
    
    return res.status(201).json({
      message: "Registro médico creado exitosamente",
      data: medicalRecord,
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
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        prescriptions: true,
        labResults: true
      }
    });

    if (!medicalRecord) {
      return res.status(404).json({
        message: "Registro médico no encontrado",
        service: "medical-records-service"
      });
    }
    // Trae documentos del encounter (tabla unificada Document)
    const documents = await prisma.document.findMany({
      where: { encounterId: String(id), patientId: String(medicalRecord.patientId), deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    return res.status(200).json({data: medicalRecord, documents, encounterId: id,});
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

module.exports = {
  createMedicalRecord,
  getMedicalRecordById,
  listMedicalRecords,
  updateMedicalRecord,
  archiveMedicalRecord
};