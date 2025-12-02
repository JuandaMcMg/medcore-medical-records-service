// src/routes/diseaseCatalogRoutes.js
const express = require("express");
const router = express.Router();
const diseaseController = require("../controllers/diseaseCatalogController");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

// Todas las rutas requieren usuario autenticado (médico / admin / enfermero / etc.)
router.use(verifyToken);

//POST http://localhost:3005/api/v1/diseases/:code
//Crear una enfermedad
router.post( "/", authorizeRoles("ADMINISTRADOR"), diseaseController.createDisease);

//GET http://localhost:3005/api/v1/diseases
//Listar enfermedades (catálogo) con filtro opcional ?q=
router.get( "/", authorizeRoles("MEDICO", "ADMINISTRADOR", "ENFERMERO"), diseaseController.listDiseases);

//GET http://localhost:3005/api/v1/diseases/code/:code
//Obtener una enfermedad específica por su código
router.get("/code/:code",authorizeRoles("MEDICO", "ADMINISTRADOR", "ENFERMERO"), diseaseController.getDiseaseByCode);

//GET http://localhost:3005/api/v1/diseases/:id
//Obtener una enfermedad por ID
router.get( "/:id", authorizeRoles("MEDICO", "ADMINISTRADOR", "ENFERMERO"), diseaseController.getDiseaseById);

//PUT http://localhost:3005/api/v1/diseases/:id
//Actualizar una enfermedad específica 
router.put( "/:id", authorizeRoles("ADMINISTRADOR"), diseaseController.updateDisease);

//DELETE http://localhost:3005/api/v1/diseases/:id
//Eliminar una enfermedad 
router.delete( "/:id", authorizeRoles("ADMINISTRADOR"), diseaseController.deleteDisease);

module.exports = router;