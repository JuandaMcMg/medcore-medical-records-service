const fs = require("fs");
const path = require("path");
const { createDocument, listByPatient, getById, softDelete } = require("../services/document.service");
const { ensurePatientExists, auditLog } = require("../services/integrations");

// (opcional) validador rápido de ObjectId para rutas con :id
const isObjectId = id => /^[0-9a-fA-F]{24}$/.test(String(id || ""))
async function upload(req, res) {
  try {
    console.log('[DOC][upload] req.body:', req.body);
    console.log('[DOC][upload] req.file:', req.file ? 'Present' : 'Missing');
    console.log('[DOC][upload] patientId from body:', req.body.patientId);
    
    // Validar paciente contra monolito/MS
    const ok = await ensurePatientExists(req.body.patientId, req.headers.authorization || "");
    if (!ok) return res.status(404).json({ message: "Paciente no existe" });

    const doc = await createDocument({ userId: req.user.id, body: req.body, file: req.file });

    await auditLog({
      actorId: req.user.id, actorRole: req.user.role,
      action: "DOCUMENT_UPLOAD",
      entity: "Document",
      entityId: doc.id,
      metadata: { patientId: doc.patientId, medicalRecordId: doc.medicalRecordId, diagnosisId: doc.diagnosisId }
    }, req.headers.authorization || "");

    res.status(201).json(doc);
  } catch (err) {
    if (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ message: "El archivo excede 10MB" });
    res.status(err.status || 500).json({ message: err.message || "Error subiendo documento" });
  }
}

async function list(req, res) {
  if (!isObjectId(req.params.patientId)) {
    return res.status(400).json({ message: "patientId inválido" });
  }
  const data = await listByPatient(req.params.patientId, req.query);
  res.json(data);
}

async function download(req, res) {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  const doc = await getById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
  
  // Construir el path completo desde la raíz del proyecto
  const fullPath = path.resolve(__dirname, '../../', doc.filePath);
  console.log('[DOWNLOAD] Document path from DB:', doc.filePath);
  console.log('[DOWNLOAD] Full resolved path:', fullPath);
  console.log('[DOWNLOAD] File exists:', fs.existsSync(fullPath));
  
  if (!fs.existsSync(fullPath)) {
    console.log('[DOWNLOAD] File not found at:', fullPath);
    return res.status(404).json({ message: "Archivo no existe en el servidor" });
  }

  try {
    // Configurar headers para descarga
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Length", String(doc.fileSize));
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.filename)}"`);
    
    // Crear stream y manejar errores
    const stream = fs.createReadStream(fullPath);
    stream.on("error", (error) => {
      console.error('[DOWNLOAD] Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error al leer el archivo" });
      }
    });
    
    stream.pipe(res);
  } catch (error) {
    console.error('[DOWNLOAD] Error:', error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}


async function remove(req, res) {
  // (opcional) valida id
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  const doc = await getById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  const isOwner = doc.uploadedBy === req.user.id;
  const isAdmin = req.user.role === "ADMINISTRADOR";
  if (!isOwner && !isAdmin) return res.status(403).json({ message: "No autorizado" });

  await softDelete(doc.id);

  await auditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: "DOCUMENT_DELETE",
    entity: "Document",
    entityId: doc.id,
    metadata: { patientId: doc.patientId, medicalRecordId: doc.medicalRecordId, diagnosticId: doc.diagnosticId }
  }, req.headers.authorization || "");

  res.json({ message: "Documento eliminado" });
}

module.exports = { upload, list, download, remove };
