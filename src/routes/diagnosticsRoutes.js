const express = require('express');
const router = express.Router();
const diagnosticsController = require('../controllers/diagnosticsController');
const { uploadMultiple } = require('../config/multer');
const {verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken)

// POST http://localhost:3005/api/v1/diagnostics/:patientId
router.post(
  '/:patientId', authorizeRoles("MEDICO","ADMINISTRADOR"), uploadMultiple, diagnosticsController.createDiagnostic
);
/*
router.get('/:patientId',
    authorizeRoles("MEDICO","ADMINISTRADOR"),               // 3) luego: valida permisos
    uploadMultiple,                                     // 3) luego: multer
    diagnosticsController.getById                   // 4) por último: controller
);

router.get('/:patientId',
    authorizeRoles("MEDICO","ADMINISTRADOR"),               // 3) luego: valida permisos
    uploadMultiple,                                     // 3) luego: multer
    diagnosticsController.ListByPatient                   // 4) por último: controller
);

router.delete(
    '/documents/:docId',
    authorizeRoles("MEDICO","ADMINISTRADOR","ENFERMERO"),
    diagnosticsController.deleteDocument
)
*/
module.exports = router;