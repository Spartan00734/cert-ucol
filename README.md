# CERT UCOL

Sistema web desarrollado como proyecto universitario para apoyar la gestión de servicios, pacientes y recursos de Protección Civil de la Universidad de Colima.

## Descripción

CERT UCOL centraliza información operativa relacionada con la atención de servicios de emergencia. El sistema permite administrar usuarios y roles, registrar pacientes y signos vitales, gestionar materiales y ambulancias, mantener catálogos configurables y generar documentos PDF con snapshots de la información registrada.

El proyecto fue desarrollado de forma colaborativa como parte de la formación en Ingeniería en Tecnologías de Internet de la Universidad de Colima.

## Funcionalidades principales

- Inicio de sesión y control de acceso por roles (`admin` y `viewer`).
- Administración de usuarios.
- Registro y consulta de pacientes.
- Gestión de materiales utilizados.
- Registro de servicios de ambulancia.
- Catálogos configurables de lesiones y otros datos operativos.
- Generación y consulta de snapshots en PDF.
- Persistencia de datos mediante MongoDB y Mongoose.

## Tecnologías

- Node.js
- Express.js
- MongoDB
- Mongoose
- EJS
- JavaScript
- HTML
- CSS
- Puppeteer
- bcryptjs

## Mi participación

Participé principalmente en el desarrollo backend y en la integración de la aplicación con MongoDB, además de colaborar en módulos frontend y funcionalidades relacionadas con usuarios, sesiones, consulta y registro de información y generación de reportes.

## Instalación local

1. Clona o descarga el repositorio.
2. Instala las dependencias:

```bash
npm install
```

3. Copia `.env.example` como `.env` y configura tus variables locales:

```env
MONGODB_URI=tu_uri_de_mongodb
SESSION_SECRET=una_clave_larga_y_aleatoria
PORT=4000
NODE_ENV=development
```

4. Inicia la aplicación:

```bash
npm start
```

5. Abre en el navegador:

```text
http://localhost:4000
```

## Seguridad

- Las contraseñas nuevas se almacenan utilizando bcrypt.
- Las credenciales y secretos se cargan desde variables de entorno y no deben publicarse en el repositorio.
- Los usuarios sin un rol definido se tratan como `viewer` por defecto.

## Contexto académico

Proyecto desarrollado de manera colaborativa en la Universidad de Colima como parte de la Ingeniería en Tecnologías de Internet.

> Este repositorio se publica con fines de portafolio académico y profesional. No incluye credenciales, bases de datos, información personal ni documentos operativos reales.
