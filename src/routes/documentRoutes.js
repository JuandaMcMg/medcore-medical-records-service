const router = require("express").Router();
const ctrl = require("../controllers/documentController");
const { uploadDocumentSingle } = require("../config/multer");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(verifyToken);

// POST http://localhost:3005/api/v1/documents/upload (form-data: document + patientId + encounterId [+ diagnosisId] [+ description,tags,category])
router.post(
  "/upload",
  authorizeRoles("MEDICO","ENFERMERO","ADMINISTRADOR"),
  uploadDocumentSingle,
  ctrl.upload
);

// GET http://localhost:3005/api/v1/documents/patient/:patientId
router.get(
  "/patient/:patientId",
  authorizeRoles("MEDICO","ENFERMERO","ADMINISTRADOR"),
  ctrl.list
);

// GET http://localhost:3005/api/v1/documents/:id  (descargar)
router.get(
  "/:id",
  authorizeRoles("MEDICO","ENFERMERO","ADMINISTRADOR"),
  ctrl.download
);

// DELETE http://localhost:3005/api/v1/documents/:id
router.delete(
  "/:id",
  authorizeRoles("MEDICO","ADMINISTRADOR"),
  ctrl.remove
);

module.exports = router;
