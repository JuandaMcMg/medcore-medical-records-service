// routes/medicalRecordRoutes.js
const express = require("express");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");
const { sanitizeInputs } = require("../middlewares/sanitizeMiddleware");
const {
  createMedicalRecord,
  getMedicalRecordById,
  listMedicalRecords,
  updateMedicalRecord,
  archiveMedicalRecord, 
  listByPatient
} = require("../controllers/MedicalRecordController");

const router = express.Router();

router.use(verifyToken)

// POST http://localhost:3005/api/v1//medical-records/ Crear Historia
router.post("/", authorizeRoles("MEDICO", "ADMINISTRADOR"),sanitizeInputs, createMedicalRecord);

// GET http://localhost:3005/api/v1//medical-records/:id Ver Historia
// IMPORTANTE: Colocar rutas más específicas ANTES de rutas genéricas con parámetros.
// Si "/:id" va antes, Express capturará "/by-patient/:patientId" como id = "by-patient".
router.get("/by-patient/:patientId",
  authorizeRoles("MEDICO","ADMINISTRADOR","ENFERMERO"),
  listByPatient
);

router.get("/:id", authorizeRoles("MEDICO", "ADMINISTRADOR"), getMedicalRecordById);




// GET http://localhost:3005/api/v1//medical-records/ Listar Historias
router.get("/", authorizeRoles("MEDICO", "ADMINISTRADOR"), listMedicalRecords);

// PUT http://localhost:3005/api/v1//medical-records/:Id
router.put("/:id", authorizeRoles("MEDICO", "ADMINISTRADOR"),sanitizeInputs, updateMedicalRecord);

// DELETE http://localhost:3005/api/v1//medical-records/:id Archivar Historia 
router.delete("/:id", authorizeRoles("MEDICO", "ADMINISTRADOR"), archiveMedicalRecord);

module.exports = router;