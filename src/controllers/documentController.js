const fs = require("fs");
const path = require("path");
const { createDocument, listByPatient, getById, softDelete } = require("../services/document.service");
const { ensurePatientExists, auditLog } = require("../services/integrations");

async function upload(req, res) {
  try {
    // Validar paciente contra monolito/MS
    const ok = await ensurePatientExists(req.body.patientId, req.headers.authorization || "");
    if (!ok) return res.status(404).json({ message: "Paciente no existe" });

    const doc = await createDocument({ userId: req.user.id, body: req.body, file: req.file });

    await auditLog({
      actorId: req.user.id, actorRole: req.user.role,
      action: "DOCUMENT_UPLOAD",
      entity: "Document",
      entityId: doc.id,
      metadata: { patientId: doc.patientId, encounterId: doc.encounterId, diagnosisId: doc.diagnosisId }
    }, req.headers.authorization || "");

    res.status(201).json(doc);
  } catch (err) {
    if (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ message: "El archivo excede 10MB" });
    res.status(err.status || 500).json({ message: err.message || "Error subiendo documento" });
  }
}

async function list(req, res) {
  const data = await listByPatient(req.params.patientId, req.query);
  res.json(data);
}

async function download(req, res) {
  const doc = await getById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
  if (!fs.existsSync(doc.filePath)) return res.status(404).json({ message: "Archivo no existe" });

  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Length", String(doc.fileSize));
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  fs.createReadStream(path.resolve(doc.filePath)).pipe(res);
}

async function remove(req, res) {
  const doc = await getById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  const isOwner = doc.uploadedBy === req.user.id;
  const isAdmin = req.user.role === "ADMINISTRADOR";
  if (!isOwner && !isAdmin) return res.status(403).json({ message: "No autorizado" });

  await softDelete(doc.id);

  await auditLog({
    actorId: req.user.id, actorRole: req.user.role,
    action: "DOCUMENT_DELETE",
    entity: "Document",
    entityId: doc.id,
    metadata: { patientId: doc.patientId, encounterId: doc.encounterId, diagnosisId: doc.diagnosisId }
  }, req.headers.authorization || "");

  res.json({ message: "Documento eliminado" });
}

module.exports = { upload, list, download, remove };
