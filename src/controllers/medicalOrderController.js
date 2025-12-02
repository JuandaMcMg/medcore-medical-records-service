const { PrismaClient } = require('../generated/prisma');
const { ensurePatientExists, ensureDoctorExists, auditLog } = require('../services/integrations');
const prisma = new PrismaClient();

const LAB_TESTS_ALLOWED = ['Hemograma', 'Química sanguínea', 'Orina'];
const RADIOLOGY_EXAMS_ALLOWED = ['Rayos X', 'TAC', 'Resonancia', 'Ecografía'];
const PRIORITIES = ['ROUTINE', 'URGENT', 'STAT'];
const STATUSES = ['DRAFT', 'ORDERED', 'COMPLETED', 'CANCELLED'];

const normalizeList = (arr) => (Array.isArray(arr) ? arr : [])
  .map((s) => String(s || '').trim())
  .filter(Boolean);

const badReq = (res, message, extra = {}) => res.status(400).json({ ok: false, message, ...extra });

exports.getTemplates = async (_req, res) => {
  return res.json({
    ok: true,
    data: {
      laboratory: LAB_TESTS_ALLOWED,
      radiology: RADIOLOGY_EXAMS_ALLOWED,
      priorities: PRIORITIES,
      statuses: STATUSES
    }
  });
};

exports.createLabOrder = async (req, res) => {
  try {
    const { patientId, doctorId, medicalRecordId, tests, notes, priority } = req.body;
    if (!patientId || !doctorId) return badReq(res, 'patientId y doctorId son requeridos');
    const auth = req.headers.authorization || '';

    // Validar existencia de paciente/doctor vía servicios externos
    const okPatient = await ensurePatientExists(String(patientId), auth);
    if (!okPatient) return res.status(404).json({ ok:false, message: 'Paciente no existe' });
    const okDoctor = await ensureDoctorExists(String(doctorId), auth);
    if (!okDoctor) return res.status(404).json({ ok:false, message: 'El doctor no existe' });

    // Validar existencia y pertenencia de la historia clínica
    if (!medicalRecordId) return badReq(res, 'medicalRecordId es requerido para la orden');
    const mr = await prisma.medicalRecord.findUnique({ where: { id: String(medicalRecordId) } });
    if (!mr) return badReq(res, 'Historia clínica no existe');
    if (String(mr.patientId) !== String(patientId)) {
      return badReq(res, 'La historia clínica no pertenece al paciente indicado');
    }

    const prio = String(priority || 'ROUTINE').toUpperCase();
    if (!PRIORITIES.includes(prio)) return badReq(res, 'Prioridad inválida', { allowed: PRIORITIES });

    const picked = normalizeList(tests);
    if (!picked.length) return badReq(res, 'Debe seleccionar al menos un examen de laboratorio');
    const invalid = picked.filter((t) => !LAB_TESTS_ALLOWED.includes(t));
    if (invalid.length) return badReq(res, 'Exámenes de laboratorio inválidos', { invalid });

    const order = await prisma.medicalOrder.create({
      data: {
        patientId: String(patientId),
        doctorId: String(doctorId),
        medicalRecordId: String(medicalRecordId),
        type: 'LABORATORY',
        priority: prio,
        status: 'ORDERED',
        labTests: picked,
        radiologyExams: [],
        notes: notes || null,
      },
    });

    try { await auditLog({ action:'MEDICAL_ORDER_CREATE', entity:'MedicalOrder', entityId: order.id, actorId: String(doctorId) }, auth); } catch {}

    return res.status(201).json({ ok: true, data: order });
  } catch (err) {
    console.error('createLabOrder error:', err);
    return res.status(500).json({ ok: false, message: 'Error creando orden de laboratorio' });
  }
};

exports.createRadiologyOrder = async (req, res) => {
  try {
    const { patientId, doctorId, medicalRecordId, exams, notes, priority } = req.body;
    if (!patientId || !doctorId) return badReq(res, 'patientId y doctorId son requeridos');
    const auth = req.headers.authorization || '';

    // Validar existencia de paciente/doctor vía servicios externos
    const okPatient = await ensurePatientExists(String(patientId), auth);
    if (!okPatient) return res.status(404).json({ ok:false, message: 'Paciente no existe' });
    const okDoctor = await ensureDoctorExists(String(doctorId), auth);
    if (!okDoctor) return res.status(404).json({ ok:false, message: 'El doctor no existe' });

    // Validar existencia y pertenencia de la historia clínica
    if (!medicalRecordId) return badReq(res, 'medicalRecordId es requerido para la orden');
    const mr = await prisma.medicalRecord.findUnique({ where: { id: String(medicalRecordId) } });
    if (!mr) return badReq(res, 'Historia clínica no existe');
    if (String(mr.patientId) !== String(patientId)) {
      return badReq(res, 'La historia clínica no pertenece al paciente indicado');
    }

    const prio = String(priority || 'ROUTINE').toUpperCase();
    if (!PRIORITIES.includes(prio)) return badReq(res, 'Prioridad inválida', { allowed: PRIORITIES });

    const picked = normalizeList(exams);
    if (!picked.length) return badReq(res, 'Debe seleccionar al menos un estudio de radiología');
    const invalid = picked.filter((t) => !RADIOLOGY_EXAMS_ALLOWED.includes(t));
    if (invalid.length) return badReq(res, 'Estudios de radiología inválidos', { invalid });

    const order = await prisma.medicalOrder.create({
      data: {
        patientId: String(patientId),
        doctorId: String(doctorId),
        medicalRecordId: String(medicalRecordId),
        type: 'RADIOLOGY',
        priority: prio,
        status: 'ORDERED',
        labTests: [],
        radiologyExams: picked,
        notes: notes || null,
      },
    });

    try { await auditLog({ action:'MEDICAL_ORDER_CREATE', entity:'MedicalOrder', entityId: order.id, actorId: String(doctorId) }, auth); } catch {}

    return res.status(201).json({ ok: true, data: order });
  } catch (err) {
    console.error('createRadiologyOrder error:', err);
    return res.status(500).json({ ok: false, message: 'Error creando orden de radiología' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.medicalOrder.findUnique({ where: { id: String(id) } });
    if (!order) return res.status(404).json({ ok: false, message: 'Orden no encontrada' });
    return res.json({ ok: true, data: order });
  } catch (err) {
    console.error('getOrderById error:', err);
    return res.status(500).json({ ok: false, message: 'Error obteniendo orden' });
  }
};

exports.getOrdersByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { type, status } = req.query;

    const where = { patientId: String(patientId) };
    if (type) {
      const t = String(type).toUpperCase();
      if (['LABORATORY', 'RADIOLOGY'].includes(t)) where.type = t;
    }
    if (status) {
      const s = String(status).toUpperCase();
      if (STATUSES.includes(s)) where.status = s;
    }

    const items = await prisma.medicalOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error('getOrdersByPatient error:', err);
    return res.status(500).json({ ok: false, message: 'Error listando órdenes del paciente' });
  }
};
