# Chat App 🚀

Aplicación de chat Full Stack en tiempo real con inteligencia artificial integrada. Desplegada y operativa en producción.

🔗 Demo en vivo: [https://chat.cristian-lavin.dev](https://chat.cristian-lavin.dev)

---

## 🧪 Cuentas de Prueba (Testing)
Para probar la funcionalidad de amigos y chat en tiempo real sin registrarte, puedes usar estas dos cuentas en ventanas diferentes (o modo incógnito):

| Usuario | Email | Contraseña |
| :--- | :--- | :--- |
| Admin 1 | `admin@gmail.com` | admin |
| Admin 2 | `admin2@gmail.com` | admin2 |

---

## 🌟 Características

- Autenticación: Registro, login y manejo de sesiones seguras con JWT.
- Perfiles Personalizables: Edición de avatar, descripción y estados de usuario en tiempo real.
- Comunicación en Tiempo Real: Implementación robusta de `Socket.IO` para mensajes instantáneos.
- Salas Grupales: Creación de salas con avatares, descripciones, límites de miembros y protección por contraseña.
- Sistema Social Completo: Búsqueda de usuarios por email, gestión de solicitudes de amistad y bloqueo de usuarios.
- Mensajería Multimedia: Soporte para texto, imágenes, videos, audios, archivos y stickers.
- Control de Mensajes: Funcionalidad de "Eliminar para todos" u ocultar mensajes localmente.
- Interacción: Reacciones con emojis sincronizadas.
- Llamadas: Soporte para llamadas de voz y videollamadas.
- IA Integrada: - Texto: Generación de respuestas inteligentes mediante Google Gemini API.
  - Imágenes: Generación de imágenes desde el chat usando Cloudflare Workers AI.

## 🛠️ Tecnologías

### Frontend
- React 19 & Vite
- Tailwind CSS (Estilizado)
- Socket.IO Client (Tiempo real)
- React Router & Axios

### Backend
- Node.js & Express
- Mongoose (Modelado de datos)
- MongoDB Atlas (Base de datos en la nube)
- JWT & Bcryptjs (Seguridad)
- Multer (Gestión de archivos)

## 🏗️ Arquitectura y Despliegue

El proyecto sigue una arquitectura de monorepositorio con despliegue continuo (CI/CD):

- Frontend: Alojado en Vercel con redirección de dominio personalizada.
- Backend: Servidor Express en Render (Web Service).
- Base de Datos: Cluster global en MongoDB Atlas.
- DNS & Seguridad: Gestionado a través de Cloudflare con subdominio `chat.cristian-lavin.dev`.

## ⚙️ Configuración de Entorno

### Backend (`server/.env`)
```env
MONGODB_URI=mongodb+srv://...
SECRET_KEY=...
CLIENT_URL=[https://chat.cristian-lavin.dev](https://chat.cristian-lavin.dev)
GEMINI_API_KEY=...
CF_ACCOUNT_ID=...
CF_AI_API_TOKEN=...

Frontend (client/.env)
VITE_API_URL=[https://chat-7qt8.onrender.com](https://chat-7qt8.onrender.com)
VITE_SOCKET_URL=[https://chat-7qt8.onrender.com](https://chat-7qt8.onrender.com)

🚀 Instalación y Ejecución Local
1. Clonar el repositorio:
git clone [https://github.com/CristianLavin/Chat.git](https://github.com/CristianLavin/Chat.git)

2. Backend:
cd server
npm install
npm start

3. Frontend:
cd client
npm install
npm run dev

📂 Estructura del Proyecto
Plaintext:
Chat/
├─ client/      # Frontend en React (Vercel)
├─ server/      # API y Sockets (Render)
├─ render.yaml  # Configuración de Blueprint para Render
└─ README.md    # Documentación del proyecto

Proyecto desarrollado por Cristian Lavín - Ingeniería Informática.