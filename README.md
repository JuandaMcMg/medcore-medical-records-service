# MedCore Medical Records Service

Este microservicio gestiona los registros médicos de pacientes en el sistema MedCore, incluyendo historiales clínicos, prescripciones y resultados de laboratorio.

## Características

- Gestión completa de historiales clínicos
- Registro de consultas médicas
- Prescripciones médicas
- Resultados de laboratorio
- Búsqueda avanzada en historial clínico

## Tecnologías

- Node.js
- Express
- MongoDB (con Prisma ORM)
- JWT para verificación de identidad

## Requisitos

- Node.js 14.x o superior
- MongoDB
- NPM o Yarn

## Instalación

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd medical-records-service
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar Prisma:
```bash
npx prisma generate
```

4. Crear archivo `.env` con las siguientes variables:
```
PORT=3005
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
USER_SERVICE_URL=http://localhost:3003
ORGANIZATION_SERVICE_URL=http://localhost:3004
AUDIT_SERVICE_URL=http://localhost:3006
```

5. Iniciar el servicio:
```bash
npm run dev
```

## Despliegue en Vercel

1. Asegúrate de tener una cuenta en [Vercel](https://vercel.com/) y el CLI instalado:
```bash
npm i -g vercel
```

2. Iniciar sesión en Vercel:
```bash
vercel login
```

3. Configurar variables de entorno en Vercel:
   - Ve a la configuración de tu proyecto en Vercel
   - Añade las variables de entorno mencionadas en el archivo `.env`

4. Desplegar el servicio:
```bash
vercel --prod
```

## Estructura del Proyecto

- `src/index.js`: Punto de entrada de la aplicación
- `src/controllers/`: Controladores para registros médicos, prescripciones y resultados
- `src/routes/`: Definiciones de rutas
- `src/middlewares/`: Middleware de autenticación, validación, etc.
- `prisma/`: Esquemas de Prisma para la base de datos

## API Endpoints

- `GET/POST/PUT/DELETE /api/v1/medical-records`: CRUD de registros médicos
- `GET/POST/PUT/DELETE /api/v1/prescriptions`: CRUD de prescripciones
- `GET/POST/PUT/DELETE /api/v1/lab-results`: CRUD de resultados de laboratorio
- `GET /health`: Estado del servicio