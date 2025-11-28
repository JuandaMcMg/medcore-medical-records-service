// routes/prescriptionRoutes.js
const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const { sanitizeInputs } = require("../middlewares/sanitizeMiddleware");
const PrescriptionController = require("../controllers/PrescriptionController");

const router = express.Router();

router.use(verifyToken)

//POST http://localhost:3005/api/v1/prescriptions
//Crear una nueva prescipcion
router.post("/", [verifyToken,sanitizeInputs], PrescriptionController.createPrescription);

//GET http://localhost:3005/api/v1/prescriptions/patient/patientID
//Historial de prescripciones por paciente
router.get("/patient/:patientId", PrescriptionController.prescriptionByPatient);

//GET http://localhost:3005/api/v1/prescriptions/:id
//Obtener prescripcion por id
router.get("/:id", PrescriptionController.getPrescriptionById);

//GET http://localhost:3005/api/v1/prescriptions
//Lista de prescipciones
router.get("/", PrescriptionController.listPrescriptions);

//GET http://localhost:3005/api/v1/prescriptions/:id/pdf
//Obtener PDF de una prescripcion
router.get("/:id/pdf", verifyToken, PrescriptionController.getPrescriptionById);

//PUT http://localhost:3005/api/v1/prescriptions/:id
//Actualizar una prescripcion por id
router.put("/:id", [verifyToken, sanitizeInputs], PrescriptionController.updatePrescription);

//DELETE http://localhost:3005/api/v1/prescriptions/:id
//Eliminar una prescripcion
router.delete("/:id", PrescriptionController.deletePrescription);

module.exports = router;