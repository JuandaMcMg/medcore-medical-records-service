const diagnosticService = require("../services/diagnostic.service");
const { ensurePatientExists, ensureDoctorExists, auditLog } = require("../services/integrations");
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

/**
 * POST /diagnostics/:patientId
 * Body: { title, description, diagnosis, treatment, observations?, nextAppointment?, medicalRecordId }
 * Files: req.files (multer)  -> campo "documents" (hasta 5)
 */
const createDiagnostic = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user?.id;        // asumimos que auth middleware setea req.user
    const files = req.files || [];         // array de archivos de multer
    const authHeader = req.headers.authorization || "";

    // ---- Validación de campos requeridos ----
    const { medicalRecordId, diseaseCode,type, title, description, diagnosis:diagnosisText, treatment, nextAppointment } = req.body;

    //Validar campos requeridos mínimos
    if (!medicalRecordId || !diseaseCode || !title || !description || !treatment) {
      // si ya subió archivos, los eliminamos
      if (files.length > 0) {
        const fs = require("fs").promises;
        for (const file of files) {
          try { 
            await fs.unlink(file.path); 
        } catch (error) {
            console.error(`Error eliminando archivo ${file.path}:`, error);
        }
        }
      }
      return res.status(400).json({
        message: "Faltan campos obligatorios",
        required: ["medicalRecordId", "diseaseCode", "title", "description", "treatment"],
      });
    }

    //Validar paciente y doctor
    const [okP, okD] = await Promise.all([
      ensurePatientExists(patientId, authHeader),
      ensureDoctorExists(doctorId,  authHeader),
    ]);
    if (!okP) return res.status(404).json({ message: "Paciente no existe" });
    if (!okD) return res.status(404).json({ message: "Doctor no existe" });

    //Validar que la historia existe y pertenece a ese paciente y doctor
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: String(medicalRecordId) },
    });

    if (!medicalRecord) {
      return res.status(404).json({ message: "Historia clínica no existe" });
    }

    if (String(medicalRecord.patientId) !== String(patientId)) {
      return res.status(400).json({
        message: "La historia clínica no pertenece a este paciente",
      });
    }

    if (String(medicalRecord.physicianId) !== String(doctorId)) {
      return res.status(403).json({
        message: "La historia clínica no pertenece a este médico",
      });
    }

    //Validar que el diseaseCode existe en el catálogo
    const disease = await prisma.diseaseCatalog.findUnique({
      where: { code: String(diseaseCode) },
    });

    if (!disease || !disease.isActive) {
      return res.status(400).json({
        message: "El código de enfermedad no existe o está inactivo",
        diseaseCode,
      });
    }
    
    //Si viene type=PRIMARY, validar que no haya ya uno PRIMARY para esta historia
    const diagnosisType = type && type.toUpperCase() === "PRIMARY" ? "PRIMARY" : "SECONDARY";

    if (diagnosisType === "PRIMARY") {
      const existingPrimary = await prisma.diagnostics.findFirst({
        where: {
          medicalRecordId: String(medicalRecordId),
          type: "PRIMARY",
          state: "ACTIVE",
        },
      });
      if (existingPrimary) {
        return res.status(400).json({
          message: "Ya existe un diagnóstico principal para esta historia clínica",
        });
      }
    }
    // ---- Crear diagnóstico (servicio maneja verificación de paciente/doctor y transacción) ----
    const diagnostic = await diagnosticService.createDiagnostic(
      patientId,
      doctorId,
      {
        ...req.body,
        medicalRecordId: String(medicalRecordId),
        diseaseCode: disease.code,
        diseaseName: disease.name,
        type: diagnosisType,
        diagnosis:
        (diagnosisText && diagnosisText.trim()) ||
        `${disease.code} - ${disease.name}`,
      },
      files
    );

    //Auditoría
    await auditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "DIAGNOSIS_CREATE",
      entity: "Diagnostics",
      entityId: diagnostic.id,
      metadata: {
        patientId,
        documentIds: (diagnostic.documents || []).map(d => d.id)
      }
    }, authHeader);

    return res.status(201).json({
      message: "Diagnóstico creado exitosamente",
      data: diagnostic,
    });
  } catch (error) {
    console.error("Error creando diagnóstico:", error);
    // Nota: el servicio ya limpia archivos si falla dentro del proceso.
    return res.status(400).json({
      message: error.message || "Error al crear diagnóstico",
    });
  }
};

/**
 * GET /diagnosis/medical-record/:medicalRecordId
 * Obtiene todos los diagnósticos asociados a una historia clínica
 */
const getByMedicalRecord = async (req, res) => {
  try {
    const { medicalRecordId } = req.params;
    
    if (!medicalRecordId) {
      return res.status(400).json({ message: "medicalRecordId es requerido" });
    }

    // Obtener diagnósticos del servicio
    const diagnostics = await diagnosticService.getByMedicalRecord(medicalRecordId);

    return res.status(200).json({
      message: "Diagnósticos obtenidos exitosamente",
      data: diagnostics,
    });
  } catch (error) {
    console.error("Error obteniendo diagnósticos por medical record:", error);
    return res.status(500).json({
      message: error.message || "Error al obtener diagnósticos",
    });
  }
};

module.exports = {
  createDiagnostic,
  getByMedicalRecord,
};
