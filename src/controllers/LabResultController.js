// controllers/LabResultController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Crear un nuevo resultado de laboratorio
 */
const createLabResult = async (req, res) => {
  try {
    const { 
      medicalRecordId,
      testType,
      result,
      referenceRange,
      labName,
      testDate,
      comments
    } = req.body;

    // Validaciones básicas
    if (!medicalRecordId || !testType || !result || !testDate) {
      return res.status(400).json({
        message: "Se requieren medicalRecordId, testType, result y testDate",
        service: "medical-records-service"
      });
    }

    // Verificar que el registro médico existe
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId }
    });

    if (!medicalRecord) {
      return res.status(404).json({
        message: "Registro médico no encontrado",
        service: "medical-records-service"
      });
    }

    // Crear el resultado de laboratorio
    const labResult = await prisma.labResult.create({
      data: {
        medicalRecordId,
        testType,
        result,
        referenceRange,
        labName,
        testDate: new Date(testDate),
        comments
      }
    });

    return res.status(201).json({
      message: "Resultado de laboratorio creado exitosamente",
      data: labResult,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al crear resultado de laboratorio:", error);
    return res.status(500).json({
      message: "Error al crear el resultado de laboratorio",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Obtener un resultado de laboratorio por ID
 */
const getLabResultById = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar el resultado de laboratorio
    const labResult = await prisma.labResult.findUnique({
      where: { id },
      include: {
        medicalRecord: true
      }
    });

    if (!labResult) {
      return res.status(404).json({
        message: "Resultado de laboratorio no encontrado",
        service: "medical-records-service"
      });
    }

    return res.status(200).json({
      data: labResult,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al obtener resultado de laboratorio:", error);
    return res.status(500).json({
      message: "Error al obtener el resultado de laboratorio",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Listar resultados de laboratorio con filtros opcionales
 */
const listLabResults = async (req, res) => {
  try {
    const { medicalRecordId, testType, fromDate, toDate } = req.query;

    // Construir el objeto de filtros
    const where = {};
    
    if (medicalRecordId) where.medicalRecordId = medicalRecordId;
    if (testType) where.testType = { contains: testType };
    
    // Filtrado por rango de fechas
    if (fromDate || toDate) {
      where.testDate = {};
      if (fromDate) where.testDate.gte = new Date(fromDate);
      if (toDate) where.testDate.lte = new Date(toDate);
    }

    // Obtener los resultados paginados
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Contar total de resultados que coinciden con el filtro
    const totalCount = await prisma.labResult.count({ where });

    // Obtener los resultados
    const labResults = await prisma.labResult.findMany({
      where,
      skip,
      take: limit,
      orderBy: { testDate: 'desc' }
    });

    return res.status(200).json({
      data: labResults,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        page,
        limit
      },
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al listar resultados de laboratorio:", error);
    return res.status(500).json({
      message: "Error al listar los resultados de laboratorio",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Actualizar un resultado de laboratorio
 */
const updateLabResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      testType,
      result,
      referenceRange,
      labName,
      testDate,
      comments
    } = req.body;

    // Verificar que el resultado existe
    const existingLabResult = await prisma.labResult.findUnique({
      where: { id }
    });

    if (!existingLabResult) {
      return res.status(404).json({
        message: "Resultado de laboratorio no encontrado",
        service: "medical-records-service"
      });
    }

    // Actualizar el resultado
    const updatedLabResult = await prisma.labResult.update({
      where: { id },
      data: {
        testType: testType ?? existingLabResult.testType,
        result: result ?? existingLabResult.result,
        referenceRange: referenceRange ?? existingLabResult.referenceRange,
        labName: labName ?? existingLabResult.labName,
        testDate: testDate ? new Date(testDate) : existingLabResult.testDate,
        comments: comments ?? existingLabResult.comments
      }
    });

    return res.status(200).json({
      message: "Resultado de laboratorio actualizado exitosamente",
      data: updatedLabResult,
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al actualizar resultado de laboratorio:", error);
    return res.status(500).json({
      message: "Error al actualizar el resultado de laboratorio",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

/**
 * Eliminar un resultado de laboratorio
 */
const deleteLabResult = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el resultado existe
    const existingLabResult = await prisma.labResult.findUnique({
      where: { id }
    });

    if (!existingLabResult) {
      return res.status(404).json({
        message: "Resultado de laboratorio no encontrado",
        service: "medical-records-service"
      });
    }

    // Eliminar el resultado
    await prisma.labResult.delete({
      where: { id }
    });

    return res.status(200).json({
      message: "Resultado de laboratorio eliminado exitosamente",
      service: "medical-records-service"
    });
  } catch (error) {
    console.error("Error al eliminar resultado de laboratorio:", error);
    return res.status(500).json({
      message: "Error al eliminar el resultado de laboratorio",
      error: process.env.NODE_ENV === "production" ? {} : error.message,
      service: "medical-records-service"
    });
  }
};

module.exports = {
  createLabResult,
  getLabResultById,
  listLabResults,
  updateLabResult,
  deleteLabResult
};