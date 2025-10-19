// middlewares/sanitizeMiddleware.js
const xss = require("xss");

// Lista de propiedades a ignorar en la sanitización (IDs, fechas, booleanos)
const ignoredProps = [
  'id', '_id', 'createdAt', 'updatedAt', 'isActive', 'isVerified', 
  'isDeleted', 'isAdmin', 'isDefault', 'isRequired'
];

// Sanitizar un valor
const sanitizeValue = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'string') {
    return xss(value);
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }
  
  if (typeof value === 'object') {
    return sanitizeObject(value);
  }
  
  return value;
};

// Sanitizar un objeto
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Ignorar ciertas propiedades
    if (ignoredProps.some(prop => key.toLowerCase().includes(prop.toLowerCase()))) {
      sanitized[key] = value;
      continue;
    }
    
    sanitized[key] = sanitizeValue(value);
  }
  
  return sanitized;
};

// Middleware para sanitizar las entradas
const sanitizeInputs = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

module.exports = {
  sanitizeInputs,
  sanitizeObject,
  sanitizeValue
};