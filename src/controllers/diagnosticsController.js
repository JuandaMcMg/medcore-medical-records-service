// src/controllers/diagnosticsController.js
const diagnosticService = require("../services/diagnostic.service");
const { ensurePatientExists, ensureDoctorExists, auditLog } = require("../services/integrations");

/**
 * POST /diagnostics/:patientId
 * Body: { title, description, diagnosis, treatment, observations?, nextAppointment?, medicalRecordId }
 * Files: req.files (multer)  -> campo "documents" (hasta 5)
 */
const createDiagnostic = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user?.id;        // asumimos que auth middleware setea req.user
    console.log('[controller] doctorId:', doctorId); // debug 1 vez
    const files = req.files || [];         // array de archivos de multer
    const authHeader = req.headers.authorization || "";

    // ---- Validación de campos requeridos ----
    const { title, description, diagnosis, treatment } = req.body;

    if (!title || !description ||  !diagnosis || !treatment) {
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
        required: ["title", "description", "diagnosis", "treatment"],
      });
    }

    //Validar cross-MS por HTTP
    const [okP, okD] = await Promise.all([
      ensurePatientExists(patientId, authHeader),
      ensureDoctorExists(doctorId,  authHeader),
    ]);
    if (!okP) return res.status(404).json({ message: "Paciente no existe" });
    if (!okD) return res.status(404).json({ message: "Doctor no existe" });

    // ---- Crear diagnóstico (servicio maneja verificación de paciente/doctor y transacción) ----
    const diagnostic = await diagnosticService.createDiagnostic(
      patientId,
      doctorId,
      req.body,
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

module.exports = {
  createDiagnostic,
};
