const express = require('express')
const router = express.Router();
const labResultRoutes = require("./labResultRoutes")
const medicalRecordRoues = require("./medicalRecordRoutes")
const prescriptionRoutes = require("./prescriptionRoutes")
const diagnosticsRoutes = require("./diagnosticsRoutes")
const diagnosisRoutes = require("./diagnosisRoutes")
const documentRoutes = require("./documentRoutes")
const patientSearchRoutes = require("./patientSearchRoutes")

//http://localhost:3005/api/v1/

router.use('/medical-records', medicalRecordRoues);
router.use('/prescriptions', prescriptionRoutes);
router.use('/lab-results', labResultRoutes);
router.use("/diagnostics", diagnosticsRoutes);
router.use("/diagnosis", diagnosisRoutes);
router.use("/documents", documentRoutes);
router.use("/patients", patientSearchRoutes);
module.exports = router;
