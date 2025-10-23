// src/config/multer.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Crea directorios si no existen
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Tipos permitidos
const allowedMime = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

// Filtro común: PDF/JPG/PNG
const commonFileFilter = (req, file, cb) => {
  const okMime = allowedMime.includes(file.mimetype);
  const okExt  = /\.(pdf|jpe?g|png)$/i.test(file.originalname);
  if (okMime && okExt) return cb(null, true);
  return cb(new Error(`Tipo no permitido. Solo PDF/JPG/PNG. Recibido: ${file.mimetype}`));
};

/** ========= Storage para archivos de DIAGNÓSTICO ========= **/
const diagnosticStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join("uploads", "patients", "diagnostics");
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const rawPid = req.params.patientId || req.body.patientId || "unknown";
    const patientId = String(rawPid).replace(/[^a-zA-Z0-9_-]/g, ""); // <- sanitiza
    const ext = (path.extname(file.originalname) || "").toLowerCase();
    const name = `document-${patientId}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  },
});

/** ========= Storage para DOCUMENTOS GENERALES ========= **/
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join("uploads", "patients", "documents");
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const rawPid = req.params.patientId || req.body.patientId || "unknown";
    const patientId = String(rawPid).replace(/[^a-zA-Z0-9_-]/g, ""); // <- sanitiza
    const ext = (path.extname(file.originalname) || "").toLowerCase();
    const name = `document-${patientId}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  },
});

/** ========= Uploaders ========= **/
// Para DIAGNÓSTICO: múltiples archivos (campo "documents")
const uploadMultiple = multer({
  storage: diagnosticStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: commonFileFilter,
}).array("documents", 5);

// Para DIAGNÓSTICO: un solo archivo (campo "document") — si lo usas
const uploadSingle = multer({
  storage: diagnosticStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: commonFileFilter,
}).single("document");

// Para Document Management: un archivo (campo "document")
const uploadDocumentSingle = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: commonFileFilter,
}).single("document");

module.exports = {
  uploadMultiple,         // POST /diagnosis/:patientId/diagnostics  (campo "documents")
  uploadSingle,           // opcional
  uploadDocumentSingle,   // POST /documents/upload                 (campo "document")
};
