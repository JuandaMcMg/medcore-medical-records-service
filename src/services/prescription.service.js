// services/prescription.service.js
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const { ensurePatientExists, ensureDoctorExists, use } = require("./integrations");
const axios = require("axios");

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3003";

// Reglas sencillas por tipo de medicación
const DEFAULT_DURATIONS = {
  ANTIBIOTIC: "7 días",
  ANALGESIC: "3 días",
  ANTIINFLAMMATORY: "5 días",
};

async function getPatientAllergies(patientId, authHeader) {
  try {
    const { data } = await axios.get(
      `${USER_SERVICE_URL}/patients/${patientId}/allergies`,
      authHeader ? { headers: { Authorization: authHeader } } : {}
    );
    return data?.allergies || [];
  } catch (e) {
    console.warn("[getPatientAllergies] fallo, se asume sin alergias", e.message);
    return [];
  }
}

function inferDuration(medicationType, explicitDuration) {
  if (explicitDuration) return explicitDuration;
  if (!medicationType) return null;
  const key = medicationType.toUpperCase();
  return DEFAULT_DURATIONS[key] || null;
}

async function createPrescription({
  authHeader,
  doctorId,
  patientId,
  medicalRecordId,
  medication,
  dosage,
  frequency,
  duration,
  instructions,
  medicationType,
}) {
  if (!patientId || !medicalRecordId || !medication || !dosage || !frequency) {
    const err = new Error("Faltan campos obligatorios");
    err.status = 400;
    throw err;
  }

  // Validar paciente y doctor
  const [okP, okD] = await Promise.all([
    ensurePatientExists(patientId, authHeader),
    ensureDoctorExists(doctorId, authHeader),
  ]);
  if (!okP) {
    const e = new Error("Paciente no existe");
    e.status = 404;
    throw e;
  }
  if (!okD) {
    const e = new Error("Doctor no existe");
    e.status = 404;
    throw e;
  }

  // Cargar historia y verificar diagnósticos
  const mr = await prisma.medicalRecord.findUnique({
    where: { id: String(medicalRecordId) },
    include: {
      diagnostic: {
        where: { state: "ACTIVE" },
      },
    },
  });

  if (!mr) {
    const e = new Error("Historia clínica no existe");
    e.status = 404;
    throw e;
  }

  if (!mr.diagnostic || mr.diagnostic.length === 0) {
    const e = new Error(
      "Debe registrar al menos un diagnóstico antes de prescribir medicamentos"
    );
    e.status = 400;
    throw e;
  }

  const hasPrimary = mr.diagnostic.some((d) => d.type === "PRIMARY");
  if (!hasPrimary) {
    const e = new Error(
      "Debe existir un diagnóstico principal antes de crear una prescripción"
    );
    e.status = 400;
    throw e;
  }

  // Verificar alergias del paciente
  const allergies = await getPatientAllergies(patientId, authHeader);
  const hasAllergy = allergies.some((a) =>
    String(a.name || a).toLowerCase().includes(medication.toLowerCase())
  );
  if (hasAllergy) {
    const e = new Error(
      "El paciente presenta alergia registrada a este medicamento"
    );
    e.status = 409;
    e.code = "ALLERGY_CONFLICT";
    throw e;
  }

  const finalDuration = inferDuration(medicationType, duration);

  const prescription = await prisma.prescription.create({
    data: {
      medicalRecordId: String(medicalRecordId),
      patientId: String(patientId),
      doctorId: String(doctorId),
      diagnosticId: mr.diagnostic[0]?.id || null,
      medication,
      dosage,
      frequency,
      duration: finalDuration || "sin duración definida",
      instructions: instructions || null,
    },
    include: {
      medicalRecord: true,
    },
  });

  return prescription;
}

async function listPrescriptionsByPatient(patientId) {
  // filtro por paciente usando la relación con MedicalRecord
  const items = await prisma.prescription.findMany({
    where: {
      medicalRecord: {
        patientId: String(patientId),
      },
    },
    include: {
      medicalRecord: {
        select: {
          id: true,
          date: true,
          physicianId: true,
        },
      },
    },
    orderBy: {
      prescriptionDate: "desc",
    },
  });

  return items;
}

async function getById(id) {
    return prisma.prescription.findUnique({
      where: { id: String(id) },
      include: {
        medicalRecord: true,
      },
    });
}

async  function listByPatient(patientId) {
    return prisma.prescription.findMany({
      where: { patientId: String(patientId) },
      orderBy: { date: "desc" },
    });
  }

async function listAll(filters = {}) {
    const { patientId, doctorId, medicalRecordId } = filters;
    return prisma.prescription.findMany({
      where: {
        ...(patientId ? { patientId: String(patientId) } : {}),
        ...(doctorId ? { doctorId: String(doctorId) } : {}),
        ...(medicalRecordId ? { medicalRecordId: String(medicalRecordId) } : {}),
      },
      orderBy: { date: "desc" },
    });
  }

async function update(id, data) {
    return prisma.prescription.update({
      where: { id: String(id) },
      data,
    });
  }

module.exports = {
  createPrescription,
  listPrescriptionsByPatient,
  getById,
  listByPatient,
  listAll,
  update,
};
