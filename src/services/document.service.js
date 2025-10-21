const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

async function createDocument({ userId, body, file }) {
  if (!file) { const e = new Error("Archivo requerido en campo 'document'"); e.status=400; throw e; }

  const { patientId, encounterId, diagnosisId=null, description=null, tags="" , category="GENERAL" } = body;
  if (!patientId || !encounterId) { const e = new Error("patientId y encounterId son obligatorios"); e.status=400; throw e; }

  const tagList = Array.isArray(tags) ? tags :
    String(tags||"").split(",").map(s=>s.trim()).filter(Boolean);

  const doc = await prisma.document.create({
    data: {
      patientId: String(patientId),
      encounterId: String(encounterId),
      diagnosisId: diagnosisId ? String(diagnosisId) : null,
      category: category in {GENERAL:1,DIAGNOSTIC_ATTACHMENT:1,LAB:1,ADMIN:1} ? category : "GENERAL",
      fileName: file.originalname,
      storeFilename: file.filename,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
      description,
      tags: tagList,
      uploadedBy: String(userId)
    }
  });
  return doc;
}

async function listByPatient(patientId, q) {
  const { page=1, pageSize=20, encounterId, diagnosisId, category, mime } = q||{};
  const take = Math.min(Number(pageSize), 100);
  const skip = (Number(page)-1)*take;

  const where = {
    deletedAt: null,
    patientId: String(patientId),
    ...(encounterId ? { encounterId: String(encounterId) } : {}),
    ...(diagnosisId ? { diagnosisId: String(diagnosisId) } : {}),
    ...(category ? { category } : {}),
    ...(mime ? { mimeType: { contains: String(mime), mode:'insensitive' } } : {}),
    ...(q?.q ? { fileName: { contains: String(q.q), mode:'insensitive' } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.document.count({ where })
  ]);

  return { items, total, page: Number(page), pageSize: take };
}

async function getById(id) {
  const d = await prisma.document.findUnique({ where: { id } });
  return d && !d.deletedAt ? d : null;
}

async function softDelete(id) {
  const d = await prisma.document.findUnique({ where: { id } });
  if (!d || d.deletedAt) return null;
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return d;
}

module.exports = { createDocument, listByPatient, getById, softDelete };
