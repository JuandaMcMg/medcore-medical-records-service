// src/controllers/diseaseCatalogController.js
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

/**
 * GET /api/v1/diseases
 * Listar enfermedades (con filtro opcional ?q= y ?isActive=)
 */
const listDiseases = async (req, res) => {
  try {
    const { q, isActive } = req.query;
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit || "20", 10))
    );

    const where = {};

    // Filtrar por estado (activo/inactivo) si se manda
    if (typeof isActive !== "undefined") {
      if (isActive === "true" || isActive === "1") where.isActive = true;
      else if (isActive === "false" || isActive === "0") where.isActive = false;
    }

    // Filtro de búsqueda por texto (code o name)
    if (q && q.trim() !== "") {
      const query = String(q).trim();

      where.OR = [
        { code: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ];
    }

    const items = await prisma.diseaseCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      items,
      total: items.length,
      query: q || null,
    });
  } catch (error) {
    console.error("[DiseaseCatalog][listDiseases] Error:", error);
    return res.status(500).json({
      message: "Error al listar enfermedades",
    });
  }
};

/**
 * GET /api/v1/diseases/:id
 * Obtener enfermedad por ID (ObjectId)
 */
const getDiseaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const disease = await prisma.diseaseCatalog.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!disease) {
      return res.status(404).json({
        message: "Enfermedad no encontrada",
      });
    }

    return res.status(200).json(disease);
  } catch (error) {
    console.error("[DiseaseCatalog][getDiseaseById] Error:", error);
    return res.status(500).json({
      message: "Error al obtener enfermedad",
    });
  }
};

/**
 * GET /api/v1/diseases/code/:code
 * Obtener enfermedad por su código (ej: J00, E11)
 */
const getDiseaseByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ message: "code es requerido" });
    }

    const disease = await prisma.diseaseCatalog.findUnique({
      where: { code: String(code) },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!disease) {
      return res.status(404).json({
        message: "Enfermedad no encontrada",
        code,
      });
    }

    return res.status(200).json(disease);
  } catch (error) {
    console.error("[DiseaseCatalog][getDiseaseByCode] Error:", error);
    return res.status(500).json({
      message: "Error al obtener enfermedad por código",
    });
  }
};

/**
 * POST /api/v1/diseases
 * Crear nueva enfermedad en el catálogo
 * Body: { code, name, description?, isActive? }
 */
const createDisease = async (req, res) => {
  try {
    const { code, name, description, isActive } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        message: "code y name son obligatorios",
        required: ["code", "name"],
      });
    }

    const trimmedCode = String(code).trim();
    const trimmedName = String(name).trim();

    // Verificar si ya existe el código
    const existing = await prisma.diseaseCatalog.findUnique({
      where: { code: trimmedCode },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({
        message: "Ya existe una enfermedad con ese código",
        code: trimmedCode,
      });
    }

    const disease = await prisma.diseaseCatalog.create({
      data: {
        code: trimmedCode,
        name: trimmedName,
        description: description || null,
        isActive:
          typeof isActive === "boolean"
            ? isActive
            : true, // por defecto activa
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      message: "Enfermedad creada exitosamente",
      data: disease,
    });
  } catch (error) {
    console.error("[DiseaseCatalog][createDisease] Error:", error);
    return res.status(500).json({
      message: "Error al crear enfermedad",
    });
  }
};

/**
 * PUT /api/v1/diseases/:id
 * Actualizar enfermedad
 * Body: { code?, name?, description?, isActive? }
 */
const updateDisease = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, isActive } = req.body;

    const existing = await prisma.diseaseCatalog.findUnique({
      where: { id: String(id) },
    });

    if (!existing) {
      return res.status(404).json({
        message: "Enfermedad no encontrada",
      });
    }

    const data = {};

    if (typeof code === "string" && code.trim() !== "") {
      data.code = code.trim();
    }

    if (typeof name === "string" && name.trim() !== "") {
      data.name = name.trim();
    }

    if (typeof description !== "undefined") {
      data.description = description || null;
    }

    if (typeof isActive === "boolean") {
      data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: "No hay campos para actualizar",
      });
    }

    // Si cambia code, Prisma validará el unique; si explota, devolvemos 409
    let updated;
    try {
      updated = await prisma.diseaseCatalog.update({
        where: { id: String(id) },
        data,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      // error de unique constraint
      if (err.code === "P2002") {
        return res.status(409).json({
          message: "Ya existe otra enfermedad con ese código",
          field: "code",
        });
      }
      throw err;
    }

    return res.status(200).json({
      message: "Enfermedad actualizada exitosamente",
      data: updated,
    });
  } catch (error) {
    console.error("[DiseaseCatalog][updateDisease] Error:", error);
    return res.status(500).json({
      message: "Error al actualizar enfermedad",
    });
  }
};

/**
 * DELETE /api/v1/diseases/:id
 * "Eliminar" una enfermedad → soft delete: isActive = false
 */
const deleteDisease = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.diseaseCatalog.findUnique({
      where: { id: String(id) },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      return res.status(404).json({
        message: "Enfermedad no encontrada",
      });
    }

    if (!existing.isActive) {
      // ya estaba desactivada
      return res.status(200).json({
        message: "La enfermedad ya estaba inactiva",
      });
    }

    await prisma.diseaseCatalog.update({
      where: { id: String(id) },
      data: { isActive: false },
    });

    return res.status(200).json({
      message: "Enfermedad marcada como inactiva",
    });
  } catch (error) {
    console.error("[DiseaseCatalog][deleteDisease] Error:", error);
    return res.status(500).json({
      message: "Error al eliminar enfermedad",
    });
  }
};

module.exports = {
  listDiseases,
  getDiseaseById,
  getDiseaseByCode,
  createDisease,
  updateDisease,
  deleteDisease,
};
