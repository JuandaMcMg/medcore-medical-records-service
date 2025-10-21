const express = require('express')
const router = express.Router();
const labResultRoutes = require("./labResultRoutes")
const medicalRecordRoues = require("./medicalRecordRoutes")
const prescriptionRoutes = require("./prescriptionRoutes")
const diagnosisroutes = require("./diagnosisRoutes")
const documentRoutes = require("./documentRoutes")

//http://localhost:3005/api/v1/

router.use('/medical-records', medicalRecordRoues);
router.use('/prescriptions', prescriptionRoutes);
router.use('/lab-results', labResultRoutes);
router.use("/diagnosis", diagnosisroutes);
router.use("/documents", documentRoutes);
module.exports = router;
