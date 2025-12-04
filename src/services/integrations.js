// src/services/integrations.js
const { makeClient } = require("./http");

const USER_SERVICE_URL       = process.env.USER_SERVICE_URL || "";
const AUTH_SERVICE_URL       = process.env.AUTH_SERVICE_URL || "";
const AUDIT_SERVICE_URL      = process.env.AUDIT_SERVICE_URL || "";
const APPOINTMENT_SERVICE_URL = process.env.APPOINTMENT_SERVICE_URL || "";

// Rutas de endpoints para servicios de autenticación
const AUTH_USER_PATH = process.env.AUTH_USER_PATH || "/api/v1/users/{id}";
const AUTH_PATIENT_PATH = process.env.AUTH_PATIENT_PATH || "/api/v1/patients/{id}";        

// Rutas para el servicio de citas
const APPOINTMENT_BY_ID_PATH = process.env.APPOINTMENT_BY_ID_PATH || "/api/v1/appointments/by-id/{id}";

const VALIDATE_PATIENT   = (process.env.VALIDATE_PATIENT ?? "true").toLowerCase() !== "false";
const VALIDATE_DOCTOR    = (process.env.VALIDATE_DOCTOR  ?? "true").toLowerCase() !== "false";

const userClient = USER_SERVICE_URL  ? makeClient(USER_SERVICE_URL)  : null;
const authClient = AUTH_SERVICE_URL ? makeClient(AUTH_SERVICE_URL) : null;
const auditClient = AUDIT_SERVICE_URL ? makeClient(AUDIT_SERVICE_URL) : null;
const appointmentClient = APPOINTMENT_SERVICE_URL ? makeClient(APPOINTMENT_SERVICE_URL) : null;

function fillId(tmpl, id) {
  return (tmpl || "").replace("{id}", encodeURIComponent(id));
}

async function tryGet(client, path, authHeader) {
  if (!client) {
    console.log('[tryGet] Cliente HTTP no disponible');
    return null;
  }
  
  try {
    console.log('[tryGet] GET', client.defaults.baseURL + path);
    console.log('[tryGet] Headers de autenticación:', authHeader ? 'Presente' : 'No presente');
    
    const r = await client.get(path, {
      meta: { forwardAuth: true, forwardAuthToken: authHeader },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || ''
      }
    });
    
    console.log('[tryGet] Respuesta exitosa:', r.status);
    
    // Verificar si la respuesta contiene datos
    if (r.data) {
      console.log('[tryGet] Datos recibidos:', typeof r.data, Array.isArray(r.data) ? `[Array: ${r.data.length}]` : (typeof r.data === 'object' ? '{Object}' : r.data));
      return r.data;
    } else {
      console.log('[tryGet] Respuesta sin datos');
      return null;
    }
  } catch(e) {
    console.error('[tryGet] ERROR', client.defaults.baseURL + path);
    
    if (e.response) {
      console.error('[tryGet] Respuesta de error:', e.response.status, e.response.data);
    } else if (e.request) {
      console.error('[tryGet] No se recibió respuesta del servidor');
    } else {
      console.error('[tryGet] Error al configurar la solicitud:', e.message);
    }
    
    return null;
  }
}

/** PACIENTE: usa medcore-users-mangment */
async function ensurePatientExists(patientId, authHeader) {
  if (!VALIDATE_PATIENT) return true;
  
  console.log('[ensurePatientExists] Verificando existencia del paciente:', patientId);
  console.log('[ensurePatientExists] Token de autenticación presente:', !!authHeader);

  // Intentar obtener directamente por el ID de usuario desde el servicio de usuarios
  if (userClient) {
    console.log('[ensurePatientExists] Intentando verificar en USER_SERVICE_URL:', USER_SERVICE_URL);
    
    // Intentar con la ruta directa de usuarios
    const userPath = `/api/v1/users/${patientId}`;
    const userData = await tryGet(userClient, userPath, authHeader);
    
    if (userData) {
      console.log('[ensurePatientExists] Paciente encontrado en servicio de usuarios');
      return true;
    }
    
    // Intentar con la ruta específica de pacientes
    const patientPath = `/api/v1/users/patients/${patientId}`;
    const patientData = await tryGet(userClient, patientPath, authHeader);
    
    if (patientData) {
      console.log('[ensurePatientExists] Paciente encontrado en servicio de usuarios (ruta PACIENTE)');
      return true;
    }
  }
  
  // Fallback al servicio de autenticación si está configurado
  if (authClient) {
    console.log('[ensurePatientExists] Intentando verificar en AUTH_SERVICE_URL:', AUTH_SERVICE_URL);
    
    // Intentar con la ruta directa de usuarios en el servicio de autenticación
    const authUserPath = fillId(AUTH_USER_PATH, patientId);
    const authUserData = await tryGet(authClient, authUserPath, authHeader);
    
    if (authUserData) {
      console.log('[ensurePatientExists] Paciente encontrado en servicio de autenticación (ruta usuarios)');
      return true;
    }
    
    // Intentar con la ruta específica de pacientes en el servicio de autenticación
    const authPatientPath = fillId(AUTH_PATIENT_PATH, patientId);
    const authPatientData = await tryGet(authClient, authPatientPath, authHeader);
    
    if (authPatientData) {
      console.log('[ensurePatientExists] Paciente encontrado en servicio de autenticación (ruta pacientes)');
      return true;
    }
  }
  
  console.log('[ensurePatientExists] Paciente NO encontrado en ningún servicio');
  return false;
}

// MEDICO : Endpoint de doctor
async function ensureDoctorExists(doctorId, authHeader) {
  if (!VALIDATE_DOCTOR) return true;

  console.log('[ensureDoctorExists] Verificando existencia del doctor:', doctorId);
  
  if (userClient) {
    const d = await tryGet(userClient, `/api/v1/users/${doctorId}`, authHeader);
    if (d) {
      console.log('[ensureDoctorExists] Doctor encontrado en servicio de usuarios');
      return true;
    }
  }
  if (authClient) {
    const d = await tryGet(authClient, fillId(AUTH_USER_PATH, doctorId), authHeader);
    if (d) {
      console.log('[ensureDoctorExists] Doctor encontrado en servicio de autenticación');
      return true;
    }
  }
  
  console.log('[ensureDoctorExists] Doctor NO encontrado en ningún servicio');
  return false;
}

async function auditLog(event, authHeader) {
  try {
    if (!auditClient) return;
    await auditClient.post(`/api/audit`, event, {
      meta: { forwardAuth: true, forwardAuthToken: authHeader }
    });
  } catch {}
}

/**
 * Obtiene detalles del usuario (paciente) desde el servicio de usuarios
 * @param {string} userId ID del usuario a consultar
 * @param {string} authHeader Token de autenticación para el servicio
 * @returns {Object|null} Datos del usuario o null si no se encuentra
 */
async function getUserDetails(userId, authHeader) {
  // 1) Intentar desde el microservicio de usuarios si existe
  if (userClient) {
    const userData = await tryGet(userClient, `/api/v1/users/${userId}`, authHeader);
    if (userData) return userData;
  }
  
  // 2) Fallback al monolito
  if (authClient) {
    const userData = await tryGet(authClient, fillId(AUTH_USER_PATH, userId), authHeader);
    if (userData) return userData;
  }
  
  return null;
}

/**
 * Devuelve la información del paciente (no solo true/false)
 * prioriza el microservicio de usuarios y luego el monolito/auth
 */
async function getPatientInfo(patientId, authHeader) {
  // 1) Microservicio de usuarios
  if (userClient) {
    // ruta específica de pacientes
    const patientPath = `/api/v1/users/patients/${patientId}`;
    const p1 = await tryGet(userClient, patientPath, authHeader);
    if (p1) return p1;

    // fallback: ruta genérica de usuarios
    const userPath = `/api/v1/users/by-user/${patientId}`;
    const p2 = await tryGet(userClient, userPath, authHeader);
    if (p2) return p2;
  }

  // 2) Monolito / servicio de auth
  if (authClient) {
    const authPatientPath = fillId(AUTH_PATIENT_PATH, patientId);
    const p3 = await tryGet(authClient, authPatientPath, authHeader);
    if (p3) return p3;

    const authUserPath = fillId(AUTH_USER_PATH, patientId);
    const p4 = await tryGet(authClient, authUserPath, authHeader);
    if (p4) return p4;
  }

  return null;
}

/**
 * Obtiene una cita por ID desde el servicio de citas
 */
async function getAppointmentById(appointmentId, authHeader) {
  if (!appointmentClient || !appointmentId) {
    console.log('❌ [getAppointmentById] No hay cliente o appointmentId:', {
      hasClient: !!appointmentClient,
      appointmentId
    });
    return null;
  }

  const path = fillId(APPOINTMENT_BY_ID_PATH, appointmentId);
  
  // ✅ AGREGAR ESTE LOG
  console.log('🔍 [getAppointmentById] Intentando buscar cita:', {
    appointmentId,
    APPOINTMENT_BY_ID_PATH,
    path,
    baseURL: appointmentClient?.defaults?.baseURL,
    fullURL: (appointmentClient?.defaults?.baseURL || '') + path
  });
  
  const data = await tryGet(appointmentClient, path, authHeader);

  // ✅ AGREGAR ESTE LOG
  console.log('📦 [getAppointmentById] Resultado:', data);

  if (data && data.data) return data.data;
  return data || null;
}
/**
 * Valida que una cita:
 * - exista
 * - pertenezca a ese paciente
 * - no esté en estado cancelado / no show
 */
async function validateAppointmentForPatient(appointmentId, patientId, authHeader) {
  if (!appointmentId) {
    return { ok: false, reason: "NO_APPOINTMENT" };
  }

  const appt = await getAppointmentById(appointmentId, authHeader);

  if (!appt) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (String(appt.patientId) !== String(patientId)) {
    return { ok: false, reason: "PATIENT_MISMATCH", appointment: appt };
  }

  if (["CANCELLED", "NO_SHOW"].includes(appt.status)) {
    return { ok: false, reason: "INVALID_STATUS", appointment: appt };
  }

  return { ok: true, appointment: appt };
}


module.exports = { 
  ensurePatientExists, 
  ensureDoctorExists, 
  auditLog,
  getUserDetails,
  getPatientInfo,
  getAppointmentById,
  validateAppointmentForPatient
};
