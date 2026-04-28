# Chat App

Aplicacion de chat en tiempo real con frontend en React + Vite y backend en Express + Socket.IO, con autenticacion, salas, archivos, llamadas y funciones de IA.

## Caracteristicas

- Autenticacion de usuarios con registro, login y sesion protegida mediante JWT.
- Perfil de usuario editable con avatar, descripcion y estado.
- Chat en tiempo real con `Socket.IO`.
- Salas grupales con:
  - nombre, descripcion y avatar,
  - password opcional,
  - limite de miembros,
  - alta de miembros al crear la sala.
- Sistema de amigos:
  - buscar usuarios por email,
  - enviar solicitudes,
  - aceptar o rechazar solicitudes,
  - bloquear usuarios.
- Mensajeria con distintos tipos de contenido:
  - texto,
  - imagenes,
  - videos,
  - audios,
  - archivos,
  - stickers.
- Eliminacion de mensajes:
  - eliminar para todos,
  - ocultar solo para ti.
- Reacciones a mensajes con emojis.
- Llamadas de voz y videollamadas entre usuarios.
- Personalizacion visual del chat, incluyendo fondo personalizado.
- Sala especial "Chat con IA".
- IA de texto con Gemini.
- IA de imagen integrada desde el backend usando Cloudflare Workers AI.

## Tecnologias

### Frontend

- React 19
- Vite
- React Router
- Axios
- Socket.IO Client
- Tailwind CSS
- Lucide React
- Emoji Picker React

### Backend

- Node.js
- Express
- Socket.IO
- MongoDB Atlas
- Multer
- JWT
- bcryptjs
- dotenv
- Mongoose

## Arquitectura

El proyecto esta dividido en dos partes:

- `client/`: interfaz web del chat.
- `server/`: API REST, sockets, persistencia en MongoDB Atlas y logica de IA.

La persistencia usa colecciones en MongoDB Atlas a traves de Mongoose.

## Funcionalidades principales

### Autenticacion

- Registro de usuario con email y password.
- Inicio de sesion.
- Persistencia del token en el cliente.
- Ruta principal protegida.

### Salas y conversacion

- Carga de salas del usuario autenticado.
- Creacion de salas desde modal.
- Actualizacion y eliminacion de salas.
- Consulta de mensajes por sala.
- Soporte para salas protegidas por password.

### Mensajes en tiempo real

- Envio de mensajes por socket.
- Sincronizacion en vivo al entrar a una sala.
- Renderizado de contenido segun el tipo del mensaje.
- Soporte para reacciones y borrado.

### Archivos y multimedia

- Subida de archivos al servidor.
- Visualizacion de imagenes, video y audio en el chat.
- Descarga de archivos compartidos.
- Stickers predefinidos y personalizados.

### IA

- `POST /api/ai/chat`: genera respuestas de texto.
- `POST /api/ai/image`: genera imagenes a partir de prompts.
- La imagen se procesa en el backend y se entrega lista para mostrarse en el frontend.

## Variables de entorno

### Backend (`server/.env`)

Puedes copiar `server/.env.example` y completarlo:

```env
PORT=3000
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/chat-app?retryWrites=true&w=majority
SECRET_KEY=cambia-esta-clave-en-produccion
CLIENT_URL=http://localhost:5173,https://tu-frontend.vercel.app

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

CF_ACCOUNT_ID=
CF_AI_API_TOKEN=
CF_IMAGE_MODEL=@cf/stabilityai/stable-diffusion-xl-base-1.0
```

### Frontend (`client/.env`)

Puedes copiar `client/.env.example`:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

Notas:

- `MONGODB_URI` apunta a tu cluster de MongoDB Atlas.
- `CLIENT_URL` controla los origenes permitidos por CORS y Socket.IO.
- `VITE_API_URL` y `VITE_SOCKET_URL` permiten que Vercel apunte al backend desplegado en Render.
- `GEMINI_API_KEY` se usa para el chat con IA.
- `CF_ACCOUNT_ID` y `CF_AI_API_TOKEN` se usan para generar imagenes con Cloudflare Workers AI.

## Instalacion

### 1. Instalar dependencias del cliente

```bash
cd client
npm install
```

### 2. Instalar dependencias del servidor

```bash
cd ../server
npm install
```

## Ejecucion

### Iniciar backend

Desde `server/`:

```bash
npm start
```

El backend corre por defecto en:

```text
http://localhost:3000
```

### Iniciar frontend

Desde `client/`:

```bash
npm run dev
```

El frontend corre normalmente en:

```text
http://localhost:5173
```

## Despliegue

### Backend en Render

- El repositorio incluye `render.yaml` con la configuracion base del servicio.
- Crea un Web Service en Render apuntando a este repositorio o usa Blueprint deploy.
- Render debe usar `server/` como `rootDir`.
- Configura en Render las variables:
  - `MONGODB_URI`
  - `SECRET_KEY`
  - `CLIENT_URL`
  - `GEMINI_API_KEY` si quieres IA de texto
  - `CF_ACCOUNT_ID` y `CF_AI_API_TOKEN` si quieres IA de imagen
- El healthcheck queda disponible en `GET /api/health`.
- Las subidas de archivos siguen usando disco local con `multer`, asi que en Render los archivos pueden perderse tras reinicios o redeploys. Para persistencia real en produccion conviene mover `uploads` a Cloudinary, S3 o similar.

### Frontend en Vercel

- Despliega la carpeta `client/` como proyecto de Vercel.
- El archivo `client/vercel.json` deja la SPA lista para recargar rutas.
- Configura estas variables en Vercel:
  - `VITE_API_URL=https://tu-backend.onrender.com`
  - `VITE_SOCKET_URL=https://tu-backend.onrender.com`

### MongoDB Atlas

- Crea un cluster en MongoDB Atlas.
- Crea un usuario de base de datos y habilita acceso de red para Render.
- Copia el connection string y usalo como valor de `MONGODB_URI`.
- La app crea automaticamente las colecciones necesarias al iniciar.

## Estructura del proyecto

```text
Chat/
├─ client/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ context/
│  │  ├─ App.jsx
│  │  └─ main.jsx
│  ├─ .env.example
│  ├─ vercel.json
│  └─ package.json
├─ server/
│  ├─ .env.example
│  ├─ db.js
│  ├─ server.js
│  └─ package.json
├─ render.yaml
└─ README.md
```

## Endpoints principales

- `POST /api/register`
- `POST /api/login`
- `GET /api/auth/me`
- `PUT /api/user/profile`
- `GET /api/users/search`
- `POST /api/friends/request`
- `GET /api/friends/requests`
- `PUT /api/friends/respond`
- `GET /api/friends`
- `POST /api/rooms`
- `PUT /api/rooms/:roomId`
- `DELETE /api/rooms/:roomId`
- `GET /api/rooms`
- `GET /api/messages/:roomId`
- `POST /api/upload`
- `POST /api/ai/chat`
- `POST /api/ai/image`

## Eventos de socket destacados

- `register_user`
- `join_room`
- `send_message`
- `delete_message`
- `hide_message`
- `add_reaction`
- `remove_reaction`
- `call_user`
- `call_offer`
- `call_answer`
- `call_ice_candidate`
- `call_hangup`

## Estado actual

El proyecto ya implementa una base funcional de chat moderno con tiempo real, multimedia, sistema social e integracion de IA tanto para texto como para imagen.

