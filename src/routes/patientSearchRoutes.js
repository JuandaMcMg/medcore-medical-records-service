// src/routes/patientSearchRoutes.js
const express = require('express');
const router = express.Router();
const patientSearchController = require('../controllers/patientSearchController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

/**
 * @route GET /api/v1/patients/search/advanced
 * @desc Búsqueda avanzada de pacientes por diagnóstico y rango de fechas
 * @access Privado - Solo roles autorizados (MEDICO, ADMINISTRADOR)
 */
router.get(
  '/search/advanced',
  authorizeRoles('MEDICO', 'ADMINISTRADOR', 'ENFERMERO'),
  patientSearchController.searchPatients
);

module.exports = router;