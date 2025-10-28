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
  // diagnosticId es opcional para documentos generales
  if (diagnosticId && !isObjectId(diagnosticId)) {
    const e = new Error("diagnosticId inválido"); e.status = 400; throw e;
  }
  // medicalRecordId es opcional para documentos generales del paciente
  if (medicalRecordId && !isObjectId(medicalRecordId)) {
    const e = new Error("medicalRecordId inválido"); e.status = 400; throw e;
  }

  // Validar que existan medicalRecordId y diagnosticId
  if (!medicalRecordId || !isObjectId(medicalRecordId)) {
    const e = new Error("medicalRecordId es obligatorio y debe ser válido"); e.status = 400; throw e;
  }
  if (!diagnosticId || !isObjectId(diagnosticId)) {
    const e = new Error("diagnosticId es obligatorio y debe ser válido"); e.status = 400; throw e;
  }

  // Verificar que el diagnóstico existe y pertenece al paciente
  const diagnostic = await prisma.diagnostics.findFirst({
    where: {
      id: String(diagnosticId),
      patientId: String(patientId),
      medicalRecordId: String(medicalRecordId)
    }
  });

  if (!diagnostic) {
    const e = new Error("El diagnóstico no existe o no pertenece al paciente especificado"); e.status = 404; throw e;
  }

  const cat = isDocCategory(category) ? category : "GENERAL";
  const normalizedPath = path.normalize(file.path)

  const documentData = {
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
    category: cat,
    uploadedBy: String(userId)
  };

  const doc = await prisma.document.create({
    data: documentData
  });

  return doc;
}

async function listByPatient(patientId, q) {
  const { page=1, pageSize=20, medicalRecordId, diagnosticId, category, mime, q:search } = q||{};
  const take = Math.min(Number(pageSize), 100);
  const skip = (Number(page)-1)*take;

  const where = {
    patientId: String(patientId),
    
    ...(medicalRecordId ? { medicalRecordId: String(medicalRecordId) } : {}),
    ...(diagnosticId   ? { diagnosticId:   String(diagnosticId)   } : {}),
    ...(category       ? { category:       String(category)        } : {}),
    ...(mime           ? { mimeType: { contains: String(mime), mode:'insensitive' } } : {}),
    ...(search         ? { filename: { contains: String(search), mode:'insensitive' } } : {}),
  };



  const [allItems, allTotal] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.document.count({ where })
  ]);

  // Filtrar documentos no eliminados manualmente (más confiable con MongoDB)
  const activeItems = allItems.filter(item => !item.deleteAt);
  
  // Aplicar paginación después del filtrado
  const total = activeItems.length;
  const items = activeItems.slice(skip, skip + take);

  return { items, total, page: Number(page), pageSize: take };
}

async function getById(id) {
  const d = await prisma.document.findUnique({ where: { id } });
  
  // Retornar null si el documento está eliminado
  return (d && !d.deleteAt) ? d : null;
}


async function softDelete(id) {
  const d = await prisma.document.findUnique({ where: { id } });
  if (!d || d.deleteAt) return null;
  await prisma.document.update({ where: { id }, data: { deleteAt: new Date() } });
  return d;
}

module.exports = { createDocument, listByPatient, getById, softDelete };
