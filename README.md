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
- SQLite
- Multer
- JWT
- bcryptjs
- dotenv
- Google Generative AI SDK

## Arquitectura

El proyecto esta dividido en dos partes:

- `client/`: interfaz web del chat.
- `server/`: API REST, sockets, persistencia en SQLite y logica de IA.

La base de datos se crea automaticamente en `server/chat.db`.

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

Crea un archivo `.env` en la raiz del proyecto con valores como estos:

```env
GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_MODEL=gemini-2.5-flash

CF_ACCOUNT_ID=tu_account_id_de_cloudflare
CF_AI_API_TOKEN=tu_token_de_cloudflare
```

Notas:

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
node server.js
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

## Estructura del proyecto

```text
Chat/
├─ client/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ context/
│  │  ├─ App.jsx
│  │  └─ main.jsx
│  └─ package.json
├─ server/
│  ├─ db.js
│  ├─ server.js
│  └─ package.json
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

