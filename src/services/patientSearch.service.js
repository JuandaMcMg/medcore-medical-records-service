// src/services/patientSearch.service.js
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();
const { getUserDetails } = require("./integrations");

/**
 * Servicio para búsquedas avanzadas de pacientes
 */
class PatientSearchService {
  /**
   * Búsqueda avanzada de pacientes con filtros de diagnóstico y rango de fechas
   * @param {Object} filters Filtros para la búsqueda
   * @param {String} filters.diagnostic Texto a buscar en el campo diagnosis
   * @param {Date} filters.dateFrom Fecha inicial del rango
   * @param {Date} filters.dateTo Fecha final del rango
   * @param {Number} page Número de página
   * @param {Number} limit Límite de resultados por página
   * @param {String} authHeader Token de autenticación para comunicación con otros servicios
   * @returns {Object} Resultados paginados con información de pacientes
   */
  async searchPatientsByDiagnostic(filters, page = 1, limit = 10, authHeader) {
    try {
      // Construir objeto de filtros para Prisma
      const where = {
        state: "ACTIVE" // Solo diagnósticos activos
      };
      
      // Filtro por diagnóstico (texto)
      if (filters.diagnostic) {
        where.diagnosis = {
          contains: filters.diagnostic,
          mode: 'insensitive' // Búsqueda case-insensitive
        };
      }
      
      // Filtro por rango de fechas
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        
        if (filters.dateFrom) {
          // Convertir la fecha a formato ISO y asegurar que comienza a las 00:00:00 UTC
          const startDate = new Date(filters.dateFrom);
          startDate.setUTCHours(0, 0, 0, 0);
          where.createdAt.gte = startDate;
        }
        
        if (filters.dateTo) {
          // Convertir la fecha a formato ISO y asegurar que termina a las 23:59:59 UTC
          const endDate = new Date(filters.dateTo);
          endDate.setUTCHours(23, 59, 59, 999);
          where.createdAt.lte = endDate;
        }
      }

      // Calcular skip para paginación
      const skip = (page - 1) * limit;
      
      // 1. Buscar diagnósticos que cumplan con los filtros
      const diagnostics = await prisma.diagnostics.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          diagnosis: true,
          title: true,
          createdAt: true
        },
        distinct: ['patientId'], // Para no duplicar pacientes
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });
      
      // Obtener el total de pacientes únicos que cumplen con los filtros
      const totalPatients = await prisma.diagnostics.groupBy({
        by: ['patientId'],
        where,
        _count: true
      });
      
      // 2. Enriquecer con datos de pacientes desde el servicio de usuarios
      const patientIds = diagnostics.map(diag => diag.patientId);
      const patientDetailsPromises = patientIds.map(patientId => 
        getUserDetails(patientId, authHeader)
      );
      
      const patientDetailsResults = await Promise.allSettled(patientDetailsPromises);
      
      // Procesar resultados y combinar con diagnósticos
      const enrichedResults = diagnostics.map((diagnostic, index) => {
        const patientResult = patientDetailsResults[index];
        const patientData = patientResult.status === 'fulfilled' ? patientResult.value : null;
        
        return {
          diagnostic: {
            id: diagnostic.id,
            title: diagnostic.title,
            diagnosis: diagnostic.diagnosis,
            createdAt: diagnostic.createdAt
          },
          patient: patientData || { id: diagnostic.patientId, message: 'Información de paciente no disponible' }
        };
      });
      
      return {
        data: enrichedResults,
        pagination: {
          total: totalPatients.length,
          pages: Math.ceil(totalPatients.length / limit),
          page,
          limit
        }
      };
      
    } catch (error) {
      console.error('Error en búsqueda avanzada de pacientes:', error);
      throw new Error(`Error en búsqueda de pacientes: ${error.message}`);
    }
  }

}

module.exports = new PatientSearchService();