// routes/medicalRecordRoutes.js
const express = require("express");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");
const { sanitizeInputs } = require("../middlewares/sanitizeMiddleware");
const MedicalRecordController = require("../controllers/MedicalRecordController")

const router = express.Router();

router.use(verifyToken)

// POST http://localhost:3005/api/v1//medical-records/ Crear Historia
router.post("/", authorizeRoles("MEDICO", "ADMINISTRADOR"),sanitizeInputs, MedicalRecordController.createMedicalRecord);

// GET http://localhost:3005/api/v1//medical-records/:id Ver Historia
router.get("/by-patient/:patientId", authorizeRoles("MEDICO","ADMINISTRADOR","ENFERMERO"), MedicalRecordController.listByPatient);

router.get("/:id", authorizeRoles("MEDICO", "ADMINISTRADOR"), MedicalRecordController.getMedicalRecordById);

// GET http://localhost:3005/api/v1//medical-records/ Listar Historias
router.get("/", authorizeRoles("MEDICO", "ADMINISTRADOR"), MedicalRecordController.listMedicalRecords);

//GET http://localhost:3005/api/v1//medical-records/:appointmentId
//Obtener Historia medica por cita 
router.get("/:appointmentId", authorizeRoles("MEDICO"), MedicalRecordController.getByAppointmentId)


// PUT http://localhost:3005/api/v1//medical-records/:Id
router.put("/:id", authorizeRoles("MEDICO", "ADMINISTRADOR"),sanitizeInputs, MedicalRecordController.updateMedicalRecord);

// DELETE http://localhost:3005/api/v1//medical-records/:id Archivar Historia 
router.delete("/:id", authorizeRoles("MEDICO", "ADMINISTRADOR"), MedicalRecordController.archiveMedicalRecord);
module.exports = router;