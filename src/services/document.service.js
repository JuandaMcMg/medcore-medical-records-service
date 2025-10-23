const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const path = require("path");

function isObjectId(v) {
  return /^[0-9a-fA-F]{24}$/.test(String(v || ""));
}
function isDocCategory(v) {
  return ["GENERAL", "DIAGNOSTIC_ATTACHMENT", "LAB"].includes(String(v || ""));
}
function extFromMime(mime) {
  // opcional: deriva un fileType simple ("pdf","jpg",...)
  const map = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
  return map[mime] || "";
}

async function createDocument({ userId, body, file }) {
  if (!file) { const e = new Error("Archivo requerido en campo 'document'"); e.status=400; throw e; }

  const { 
    patientId, 
    medicalRecordId, 
    diagnosticId, 
    description=null,  
    category="GENERAL" 
  } = body;
  // Validaciones mínimas según tu schema
  if (!patientId || !isObjectId(patientId)) {
    const e = new Error("patientId inválido"); e.status = 400; throw e;
  }
  if (!diagnosticId || !isObjectId(diagnosticId)) {
    const e = new Error("diagnosticId inválido (requerido)"); e.status = 400; throw e;
  }
  if (!medicalRecordId) {
    const e = new Error("medicalRecordId es obligatorio"); e.status = 400; throw e;
  }

  const cat = isDocCategory(category) ? category : "GENERAL";
  const normalizedPath = path.normalize(file.path)

  const doc = await prisma.document.create({
    data: {
      patientId: String(patientId),
      medicalRecordId: String(medicalRecordId),
      diagnosticId: String(diagnosticId),
      filename: file.originalname,
      storeFilename: file.filename,
      filePath: normalizedPath,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileType: extFromMime(file.mimetype),
      description,
      uploadedBy: String(userId)
    }
  });
  return doc;
}

async function listByPatient(patientId, q) {
  const { page=1, pageSize=20, medicalRecordId, diagnosticId, category, mime, q:search } = q||{};
  const take = Math.min(Number(pageSize), 100);
  const skip = (Number(page)-1)*take;

  const where = {
    patientId: String(patientId),

    // <--- clave: incluir null y "no existe"
    OR: [
      { deleteAt: null },
      { deleteAt: { isSet: false } }
    ],

    ...(medicalRecordId ? { medicalRecordId: String(medicalRecordId) } : {}),
    ...(diagnosticId   ? { diagnosticId:   String(diagnosticId)   } : {}),
    ...(category       ? { category:       String(category)        } : {}),
    ...(mime           ? { mimeType: { contains: String(mime), mode:'insensitive' } } : {}),
    ...(search         ? { filename: { contains: String(search), mode:'insensitive' } } : {}),
  };

  console.log("[DOC][listByPatient] where =", JSON.stringify(where));

  const [items, total] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.document.count({ where })
  ]);

  return { items, total, page: Number(page), pageSize: take };
}

async function getById(id) {
  const d = await prisma.document.findUnique({ where: { id } });
  return d && (d.deleteAt == null) ? d : null; // null o undefined
}


async function softDelete(id) {
  const d = await prisma.document.findUnique({ where: { id } });
  if (!d || d.deleteAt) return null;
  await prisma.document.update({ where: { id }, data: { deleteAt: new Date() } });
  return d;
}

module.exports = { createDocument, listByPatient, getById, softDelete };
