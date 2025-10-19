// routes/prescriptionRoutes.js
const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const { sanitizeInputs } = require("../middlewares/sanitizeMiddleware");
const {
  createPrescription,
  getPrescriptionById,
  listPrescriptions,
  updatePrescription,
  deletePrescription
} = require("../controllers/PrescriptionController");

const router = express.Router();

/**
 * @route POST /api/v1/prescriptions
 * @desc Crear una nueva prescripción
 * @access Privado - Requiere autenticación
 */
router.post("/", [verifyToken, sanitizeInputs], createPrescription);

/**
 * @route GET /api/v1/prescriptions/:id
 * @desc Obtener una prescripción por ID
 * @access Privado - Requiere autenticación
 */
router.get("/:id", verifyToken, getPrescriptionById);

/**
 * @route GET /api/v1/prescriptions
 * @desc Listar prescripciones con filtros
 * @access Privado - Requiere autenticación
 */
router.get("/", verifyToken, listPrescriptions);

/**
 * @route PUT /api/v1/prescriptions/:id
 * @desc Actualizar una prescripción
 * @access Privado - Requiere autenticación
 */
router.put("/:id", [verifyToken, sanitizeInputs], updatePrescription);

/**
 * @route DELETE /api/v1/prescriptions/:id
 * @desc Eliminar una prescripción
 * @access Privado - Requiere autenticación
 */
router.delete("/:id", verifyToken, deletePrescription);

module.exports = router;