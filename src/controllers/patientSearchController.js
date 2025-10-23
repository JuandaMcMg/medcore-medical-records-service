// src/controllers/patientSearchController.js
const patientSearchService = require('../services/patientSearch.service');
const { auditLog } = require('../services/integrations');

/**
 * Controlador para búsqueda avanzada de pacientes
 * GET /api/v1/patients/search/advanced
 * Query params:
 * - diagnostic: string - texto a buscar en diagnósticos
 * - dateFrom: date - fecha inicial para filtrar
 * - dateTo: date - fecha final para filtrar
 * - page: number - página actual (default: 1)
 * - limit: number - resultados por página (default: 10)
 */
const searchPatients = async (req, res) => {
  try {
    const { diagnostic, dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const authHeader = req.headers.authorization || '';
    
    // Validaciones básicas
    if (!diagnostic && !dateFrom && !dateTo) {
      return res.status(400).json({
        message: 'Debe proporcionar al menos un criterio de búsqueda (diagnostic, dateFrom, dateTo)',
        service: 'medical-records-service'
      });
    }
    
    // Validar formato de fechas
    if (dateFrom && isNaN(Date.parse(dateFrom))) {
      return res.status(400).json({
        message: 'Formato de fecha inicial inválido. Use YYYY-MM-DD',
        service: 'medical-records-service'
      });
    }
    
    if (dateTo && isNaN(Date.parse(dateTo))) {
      return res.status(400).json({
        message: 'Formato de fecha final inválido. Use YYYY-MM-DD',
        service: 'medical-records-service'
      });
    }
    
    // Construir filtros para el servicio
    const filters = {
      diagnostic,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null
    };
    
    // Realizar búsqueda
    const results = await patientSearchService.searchPatientsByDiagnostic(
      filters,
      page,
      limit,
      authHeader
    );
    
    // Registrar la actividad en auditoría
    if (req.user) {
      await auditLog({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'ADVANCED_SEARCH',
        entity: 'Patient',
        entityId: null,
        metadata: {
          filters,
          resultsCount: results.data.length,
          page,
          limit
        }
      }, authHeader);
    }
    
    return res.status(200).json({
      message: 'Búsqueda completada exitosamente',
      ...results,
      service: 'medical-records-service'
    });
    
  } catch (error) {
    console.error('Error en búsqueda avanzada de pacientes:', error);
    return res.status(500).json({
      message: 'Error al procesar la búsqueda avanzada',
      error: process.env.NODE_ENV === 'production' ? {} : error.message,
      service: 'medical-records-service'
    });
  }
};

module.exports = {
  searchPatients
};