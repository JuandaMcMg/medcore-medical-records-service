// src/services/diagnostic.service.js
const { PrismaClient } = require("../generated/prisma"); // si generaste el cliente en ruta custom, cámbialo por: require("../generated/prisma")
const fs = require("fs").promises;
const prisma = new PrismaClient();

class DiagnosticService {
  /**
   * Crea diagnóstico (y opcionalmente documentos) en una transacción.
   * @param {string} patientId  ID de Pattient
   * @param {string} doctorId   ID de Users (rol MEDICO o ADMINISTRADOR)
   * @param {object} diagnosticData {title, description, diagnosis, treatment, observations, nextAppointment}
   * @param {Array}  files      Archivos de multer (array)
   */
  async createDiagnostic(patientId, doctorId, diagnosticData, files) {
    try{
      const { medicalRecordId } = diagnosticData;

      if (!medicalRecordId) {
        throw new Error("medicalRecordId es obligatorio para crear el diagnóstico");
      }

      // Validar que el registro médico existe
      const medicalRecord = await prisma.medicalRecord.findUnique({
        where: { id: String(medicalRecordId) }
      });

      if (!medicalRecord) {
        throw new Error("El registro médico especificado no existe");
      }

      // Validar que el registro médico pertenece al paciente correcto
      if (medicalRecord.patientId !== String(patientId)) {
        throw new Error("El registro médico no corresponde al paciente especificado");
      }

        //crear diagnóstico + documentos
        const diagnostic = await prisma.$transaction(async (tx) => {
            //1 Crear diagnóstico
            const newDiagnostic = await tx.diagnostics.create({
            data: {
                patientId: String(patientId),
                doctorId: String(doctorId),
                medicalRecordId: String(medicalRecordId),
                title: diagnosticData.title,
                description: diagnosticData.description,
                diagnosis: diagnosticData.diagnosis,
                treatment: diagnosticData.treatment,
                observations: diagnosticData.observations ?? null,
                nextAppointment: diagnosticData.nextAppointment
                ? new Date(diagnosticData.nextAppointment)
                : null,
            },
            });

            //2 Crear documentos (si hay)
            if (files && files.length > 0) {
            const documentRecords = files.map((file) => ({
                patientId: String(patientId),
                diagnosticId: newDiagnostic.id,
                medicalRecordId: String(medicalRecordId),
                filename: file.originalname,
                storeFilename: file.filename,
                filePath: file.path,
                fileType: (file.originalname.split(".").pop() || "").toLowerCase(),
                mimeType: file.mimetype,
                fileSize: file.size,
                description: null,
                uploadedBy: String(doctorId),
            }));
            await tx.Document.createMany({ data: documentRecords });
            }

        //3 Retornar diagnóstico completo
            return await tx.diagnostics.findUnique({
            where: { id: newDiagnostic.id },
            include: {
                documents: true,
            },
            });
        });

      return diagnostic;
    } catch (error) {
      // 4) Si falló, limpiar archivos ya guardados por multer
      if (files && files.length > 0) {
        for (const file of files) {
            try {
                await fs.unlink(file.path);
            } catch (err) {
                console.error("Error al eliminar archivo:", err);
            }
        }
      }
      throw error;
    }
  }

  /**
   * Obtiene todos los diagnósticos asociados a una historia clínica
   * @param {string} medicalRecordId ID del registro médico
   */
  async getByMedicalRecord(medicalRecordId) {
    try {
      const diagnostics = await prisma.diagnostics.findMany({
        where: { 
          medicalRecordId: String(medicalRecordId),
          state: 'ACTIVE' // Solo diagnósticos activos
        },
        include: {
          documents: true // Incluir documentos asociados
        },
        orderBy: {
          createdAt: 'desc' // Más recientes primero
        }
      });

      return diagnostics;
    } catch (error) {
      console.error("Error obteniendo diagnósticos por medical record:", error);
      throw error;
    }
  }
}

module.exports = new DiagnosticService();
