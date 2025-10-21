// src/services/integrations.js
const { makeClient } = require("./http");

const USER_SERVICE_URL   = process.env.USER_SERVICE_URL || "";           // microservicio (si existe)
const AUTH_SERVICE_URL  = process.env.AUTH_SERVICE_URL || "";          // monolito que sí funciona
const AUTH_PATIENT_PATH  = process.env.AUTH_PATIENT_LOOKUP || "/api/v1/patients/{id}";
const AUTH_USER_PATH     = process.env.AUTH_USER_LOOKUP    || "/api/v1/users/{id}";

const VALIDATE_PATIENT   = (process.env.VALIDATE_PATIENT ?? "true").toLowerCase() !== "false";
const VALIDATE_DOCTOR    = (process.env.VALIDATE_DOCTOR  ?? "true").toLowerCase() !== "false";

const userClient = USER_SERVICE_URL  ? makeClient(USER_SERVICE_URL)  : null;
const authClient = AUTH_SERVICE_URL ? makeClient(AUTH_SERVICE_URL) : null;

function fillId(tmpl, id) {
  return (tmpl || "").replace("{id}", encodeURIComponent(id));
}

async function tryGet(client, path, authHeader) {
  if (!client) return null;
  try {
    console.log('[integrations] GET', client.defaults.baseURL + path);
    const r = await client.get(path, {
      meta: { forwardAuth: true, forwardAuthToken: authHeader }
    });
    return r.data || null;
  } catch(e) {
    console.log('[integrations] FAIL', client.defaults.baseURL + path, e?.response?.status || e.message);
    return null;
  }
}

async function ensurePatientExists(patientId, authHeader) {
  if (!VALIDATE_PATIENT) return true;

  // 1) si mañana existe ms-user-service:
  if (userClient) {
    const d = await tryGet(userClient, `/api/patients/${patientId}`, authHeader);
    if (d) return true;
  }
  // 2) fallback al monolito actual:
  if (authClient) {
    const d = await tryGet(authClient, fillId(AUTH_PATIENT_PATH, patientId), authHeader);
    if (d) return true;
  }
  return false;
}

async function ensureDoctorExists(doctorId, authHeader) {
  if (!VALIDATE_DOCTOR) return true;

  if (userClient) {
    const d = await tryGet(userClient, `/api/users/${doctorId}`, authHeader);
    if (d) return true;
  }
  if (authClient) {
    const d = await tryGet(authClient, fillId(AUTH_USER_PATH, doctorId), authHeader);
    if (d) return true;
  }
  return false;
}

// Auditoría (opcional; no rompe si no hay servicio)
const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || "";
const auditClient = AUDIT_SERVICE_URL ? makeClient(AUDIT_SERVICE_URL) : null;

async function auditLog(event, authHeader) {
  try {
    if (!auditClient) return;
    await auditClient.post(`/api/audit`, event, {
      meta: { forwardAuth: true, forwardAuthToken: authHeader }
    });
  } catch {}
}

module.exports = { ensurePatientExists, ensureDoctorExists, auditLog };
