const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/medicalOrderController');

// Auth para todas las rutas
router.use(verifyToken);

// Plantillas (todos roles clínicos)
router.get('/templates', authorizeRoles('MEDICO','ENFERMERO','ADMINISTRADOR'), ctrl.getTemplates);

// Listar por paciente (médico, enfermero, admin)
router.get('/patient/:patientId', authorizeRoles('MEDICO','ENFERMERO','ADMINISTRADOR'), ctrl.getOrdersByPatient);

// Crear órdenes (solo médico / admin)
router.post('/laboratory', authorizeRoles('MEDICO','ADMINISTRADOR'), ctrl.createLabOrder);
router.post('/radiology', authorizeRoles('MEDICO','ADMINISTRADOR'), ctrl.createRadiologyOrder);

// Obtener orden por id (médico, enfermero, admin)
router.get('/:id', authorizeRoles('MEDICO','ENFERMERO','ADMINISTRADOR'), ctrl.getOrderById);

module.exports = router;
