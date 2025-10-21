// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    // Obtener el token del header
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        message: "No se proporcionó token de autenticación",
        service: "medical-records-service"
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const normalizedId = decoded.id || decoded._id || decoded.userId || decoded.sub || null;
    if (!normalizedId) return res.status(400).json({ message: "El token no contiene un identificador de usuario" });


    
    // Añadir la información del usuario decodificada al request
    req.user = {...decoded, id: String(normalizedId)};
    
    return next();
  } catch (error) {
    console.error("Error de autenticación:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expirado",
        service: "medical-records-service"
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Token inválido",
        service: "medical-records-service"
      });
    }
    
    return res.status(500).json({
      message: "Error al procesar la autenticación",
      service: "medical-records-service"
    });
  }
};

const authorizeRoles = (...rolesPermitidos) => (req, res, next) => {
  const role = req.user?.role;
  if (!role || !rolesPermitidos.includes(role)) {
    return res.status(403).json({ message: "Forbidden (role)" });
  }
  next();
};

/*const { hasPermission } = require("./permissions");
const permission = (permName) => (req, res, next) => {
  if (!hasPermission(req.user?.role, permName)) {
    return res.status(403).json({ message: `Forbidden (permission: ${permName})` });
  }
  next();
};*/

module.exports = {
  verifyToken,
  authorizeRoles
};