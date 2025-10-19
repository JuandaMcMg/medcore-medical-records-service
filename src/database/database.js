// database/database.js
const mongoose = require("mongoose");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Configuración de conexión a MongoDB
const connectDatabase = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      throw new Error("Variable de entorno MONGODB_URI no definida");
    }

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Conexión a MongoDB establecida correctamente");

    // Verificar la conexión a Prisma
    await prisma.$connect();
    console.log("Conexión a Prisma establecida correctamente");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error.message);
    process.exit(1);
  }
};

// Función para cerrar la conexión (útil para pruebas)
const closeDatabase = async () => {
  try {
    await mongoose.disconnect();
    await prisma.$disconnect();
    console.log("Conexión a la base de datos cerrada correctamente");
  } catch (error) {
    console.error("Error al cerrar la conexión a la base de datos:", error.message);
  }
};

module.exports = {
  connectDatabase,
  closeDatabase,
  prisma
};