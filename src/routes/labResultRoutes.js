// routes/labResultRoutes.js
const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const { sanitizeInputs } = require("../middlewares/sanitizeMiddleware");
const {
  createLabResult,
  getLabResultById,
  listLabResults,
  updateLabResult,
  deleteLabResult
} = require("../controllers/LabResultController");

const router = express.Router();

/**
 * @route POST /api/v1/lab-results
 * @desc Crear un nuevo resultado de laboratorio
 * @access Privado - Requiere autenticación
 */
router.post("/", [verifyToken, sanitizeInputs], createLabResult);

/**
 * @route GET /api/v1/lab-results/:id
 * @desc Obtener un resultado de laboratorio por ID
 * @access Privado - Requiere autenticación
 */
router.get("/:id", verifyToken, getLabResultById);

/**
 * @route GET /api/v1/lab-results
 * @desc Listar resultados de laboratorio con filtros
 * @access Privado - Requiere autenticación
 */
router.get("/", verifyToken, listLabResults);

/**
 * @route PUT /api/v1/lab-results/:id
 * @desc Actualizar un resultado de laboratorio
 * @access Privado - Requiere autenticación
 */
router.put("/:id", [verifyToken, sanitizeInputs], updateLabResult);

/**
 * @route DELETE /api/v1/lab-results/:id
 * @desc Eliminar un resultado de laboratorio
 * @access Privado - Requiere autenticación
 */
router.delete("/:id", verifyToken, deleteLabResult);

module.exports = router;