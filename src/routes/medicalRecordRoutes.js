// routes/medicalRecordRoutes.js
const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const { sanitizeInputs } = require("../middlewares/sanitizeMiddleware");
const {
  createMedicalRecord,
  getMedicalRecordById,
  listMedicalRecords,
  updateMedicalRecord,
  archiveMedicalRecord
} = require("../controllers/MedicalRecordController");

const router = express.Router();

/**
 * @route POST /api/v1/medical-records
 * @desc Crear un nuevo registro médico
 * @access Privado - Requiere autenticación
 */
router.post("/", [verifyToken, sanitizeInputs], createMedicalRecord);

/**
 * @route GET /api/v1/medical-records/:id
 * @desc Obtener un registro médico por ID
 * @access Privado - Requiere autenticación
 */
router.get("/:id", verifyToken, getMedicalRecordById);

/**
 * @route GET /api/v1/medical-records
 * @desc Listar registros médicos con filtros
 * @access Privado - Requiere autenticación
 */
router.get("/", verifyToken, listMedicalRecords);

/**
 * @route PUT /api/v1/medical-records/:id
 * @desc Actualizar un registro médico
 * @access Privado - Requiere autenticación
 */
router.put("/:id", [verifyToken, sanitizeInputs], updateMedicalRecord);

/**
 * @route DELETE /api/v1/medical-records/:id
 * @desc Archivar un registro médico (soft delete)
 * @access Privado - Requiere autenticación
 */
router.delete("/:id", verifyToken, archiveMedicalRecord);

module.exports = router;