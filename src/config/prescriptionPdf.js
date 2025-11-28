// src/config/prescriptionPdf.js
const PDFDocument = require("pdfkit");
const { PrismaClient } = require("../generated/prisma");
const { getUserDetails, getPatientInfo } = require("../services/integrations");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

/**
 * Calcula edad a partir de una fecha de nacimiento (string ISO o Date)
 */
function calculateAge(birthDate) {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

/**
 * Genera el PDF de una prescripción, lo guarda en
 * uploads/patients/prescriptions y lo envía en la respuesta HTTP.
 */
async function generatePrescriptionPdf({ prescriptionId, res, authHeader, currentUser }) {
  if (!prescriptionId) {
    const err = new Error("prescriptionId es requerido para generar el PDF");
    err.status = 400;
    throw err;
  }

  // 1) Cargar la prescripción con su MedicalRecord y diagnósticos
  const prescription = await prisma.prescription.findUnique({
    where: { id: String(prescriptionId) },
    include: {
      medicalRecord: {
        include: {
          diagnostic: {
            where: { state: "ACTIVE" },
            orderBy: { createdAt: "desc" }
          }
        }
      }
    }
  });

  if (!prescription) {
    const err = new Error("Prescripción no encontrada");
    err.status = 404;
    throw err;
  }

  const mr = prescription.medicalRecord;

  // 2) Traer datos del paciente y del médico del microservicio de usuarios
  const [patientData, doctorData] = await Promise.all([
    mr?.patientId ? getPatientInfo(mr.patientId, authHeader) : null,
    mr?.physicianId ? getUserDetails(mr.physicianId, authHeader) : null
  ]);

  // 3) Normalizar campos de paciente
  const patientName =
    patientData?.user.fullName ||
    [patientData?.firstName, patientData?.middleName, patientData?.lastName]
      .filter(Boolean)
      .join(" ") ||
    "N/A";

  const patientDocType = patientData?.documentType || patientData?.docType || "";
  const patientDocNumber = patientData?.documentNumber || patientData?.docNumber || "";
  const patientAddress = patientData?.address || patientData?.direccion || "N/A";
  const patientPhone = patientData?.phone || patientData?.phoneNumber || "N/A";
  const patientBirthDate = patientData?.dateOfBirth || patientData?.birthDate;
  const patientAge = calculateAge(patientBirthDate);

  // 4) Normalizar campos de médico
  const doctorName =
    doctorData?.fullName ||
    [doctorData?.firstName, doctorData?.middleName, doctorData?.lastName]
      .filter(Boolean)
      .join(" ") ||
    "N/A";

  const doctorDocNumber = doctorData?.documentNumber || doctorData?.docNumber || "";
  const doctorProfId =
    doctorData?.professionalCard ||
    doctorData?.licenseNumber ||
    doctorData?.registroMedico ||
    "";

  // 5) Diagnóstico principal (o el último activo)
  let mainDiagnosis = null;
  if (mr?.diagnostic && mr.diagnostic.length > 0) {
    mainDiagnosis =
      mr.diagnostic.find((d) => d.type === "PRIMARY") || mr.diagnostic[0];
  }

  // 6) Preparar carpeta y ruta para guardar el PDF
  const uploadsRoot = path.join(
    process.cwd(),
    "uploads",
    "patients",
    "prescriptions"
  );
  await fs.promises.mkdir(uploadsRoot, { recursive: true });

  const baseName =
    patientName === "N/A"
      ? "paciente"
      : patientName
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "_")
          .toLowerCase();

  const fileName = `prescripcion_${prescription.id}_${baseName}.pdf`;
  const filePath = path.join(uploadsRoot, fileName);

  console.log("[PDF] Guardando prescripción en:", filePath);

  // 7) Crear el PDF
  const doc = new PDFDocument({
    margin: 50,
    size: "A4"
  });

  // Encabezados HTTP para el navegador / cliente
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${fileName}"`
  );

  // Pipe a archivo en disco Y a la respuesta HTTP
  const fileStream = fs.createWriteStream(filePath);
  doc.pipe(fileStream);
  doc.pipe(res);

  // Logs opcionales para saber si se guardó bien
  fileStream.on("finish", () => {
    console.log("[PDF] Archivo de prescripción guardado correctamente:", filePath);
  });

  fileStream.on("error", (err) => {
    console.error("[PDF] Error guardando el archivo de prescripción:", err);
  });

  // --- HEADER CLÍNICA / SISTEMA ---
  doc
    .fontSize(18)
    .text("Sistema MedCore - Prescripción Médica", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .text("Generada por MedCore Medical Records Service", { align: "center" })
    .moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  // --- DATOS PACIENTE ---
  doc.moveDown(1);
  doc.fontSize(13).text("Datos del Paciente", { underline: true }).moveDown(0.5);

  doc.fontSize(11);
  doc.text(`Nombre: ${patientName}`);
  doc.text(
    `Documento: ${[patientDocType, patientDocNumber].filter(Boolean).join(" ")}`
  );
  doc.text(`Edad: ${patientAge !== null ? patientAge + " años" : "N/A"}`);
  doc.text(`Dirección: ${patientAddress}`);
  doc.text(`Teléfono: ${patientPhone}`);
  doc.moveDown(0.5);
  doc.text(`ID Paciente (sistema): ${mr?.patientId || "N/A"}`);

  // --- DATOS MÉDICO ---
  doc.moveDown(1);
  doc.fontSize(13).text("Datos del Médico", { underline: true }).moveDown(0.5);

  doc.fontSize(11);
  doc.text(`Nombre: ${doctorName}`);
  if (doctorDocNumber) {
    doc.text(`Documento: ${doctorDocNumber}`);
  }
  if (doctorProfId) {
    doc.text(`Registro profesional: ${doctorProfId}`);
  }
  doc.text(`ID Médico (sistema): ${mr?.physicianId || "N/A"}`);

  // --- DATOS DE LA CONSULTA / HISTORIA ---
  doc.moveDown(1);
  doc
    .fontSize(13)
    .text("Datos de la Historia Clínica", { underline: true })
    .moveDown(0.5);

  const fechaReceta = new Date(
    prescription.prescriptionDate || mr?.date || new Date()
  );
  doc.fontSize(11);
  doc.text(`Fecha de la prescripción: ${fechaReceta.toLocaleString()}`);
  if (mr?.appointmentId) {
    doc.text(`Cita asociada: ${mr.appointmentId}`);
  }
  if (mainDiagnosis) {
    doc.moveDown(0.3);
    doc.text(
      `Diagnóstico principal: ${mainDiagnosis.diseaseCode} - ${mainDiagnosis.diseaseName}`
    );
    if (mainDiagnosis.diagnosis) {
      doc.text(`Detalle diagnóstico: ${mainDiagnosis.diagnosis}`);
    }
  } else {
    doc.text("Diagnóstico principal: N/A");
  }

  if (mr?.notes) {
    doc.moveDown(0.3);
    doc.text(`Notas de la consulta: ${mr.notes}`, {
      width: 480
    });
  }

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  // --- DETALLE DE LA PRESCRIPCIÓN ---
  doc.moveDown(1);
  doc
    .fontSize(13)
    .text("Detalle de la Prescripción", { underline: true })
    .moveDown(0.5);

  doc.fontSize(11);
  doc.text(`Medicamento: ${prescription.medication}`);
  doc.text(`Dosis: ${prescription.dosage}`);
  doc.text(`Frecuencia: ${prescription.frequency}`);
  doc.text(`Duración: ${prescription.duration}`);

  if (prescription.instructions) {
    doc.moveDown(0.3);
    doc.text(`Instrucciones: ${prescription.instructions}`, {
      width: 480
    });
  }

  doc.moveDown(2);
  doc.text("Firma del médico:", { align: "left" });
  doc.moveDown(2);
  doc.text("______________________________", { align: "left" });
  doc.text(doctorName, { align: "left" });
  if (doctorProfId) {
    doc.text(`Reg. Prof.: ${doctorProfId}`, { align: "left" });
  }

  doc.end();
}

module.exports = {
  generatePrescriptionPdf
};
