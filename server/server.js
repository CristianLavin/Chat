const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  connectDB,
  mongoose,
  User,
  Friendship,
  Room,
  Message
} = require('./db');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'supersecretkey';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_AI_API_TOKEN = process.env.CF_AI_API_TOKEN || '';
const CF_IMAGE_MODEL =
  process.env.CF_IMAGE_MODEL || '@cf/stabilityai/stable-diffusion-xl-base-1.0';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || '';

const userSockets = {};
const allowedOrigins = CLIENT_URL
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : '*',
    methods: ['GET', 'POST']
  }
});

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true
  })
);
app.use(express.json({ limit: '10mb' }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const safeOriginalName = file.originalname.replace(/\s+/g, '-');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  }
});
const upload = multer({ storage });

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), username: user.username }, SECRET_KEY);
}

function toUserResponse(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    avatar: user.avatar || null,
    description: user.description || '',
    status: user.status || 'online'
  };
}

function toRoomResponse(room) {
  return {
    id: room._id.toString(),
    name: room.name,
    type: room.type,
    password: room.password ? 'protected' : null,
    created_by: room.createdBy.toString(),
    avatar: room.avatar || null,
    description: room.description || '',
    max_members: Number(room.maxMembers || 0)
  };
}

function toMessageResponse(message, senderOverride) {
  const sender = senderOverride || message.senderId;
  const senderId = sender && sender._id ? sender._id.toString() : message.senderId.toString();

  return {
    id: message._id.toString(),
    room_id: message.roomId.toString(),
    sender_id: senderId,
    content: message.content || '',
    type: message.type,
    file_url: message.fileUrl || null,
    created_at: message.createdAt,
    username: sender && sender.username ? sender.username : '',
    avatar: sender && sender.avatar ? sender.avatar : null,
    is_deleted: message.isDeleted ? 1 : 0,
    reactions: (message.reactions || []).map(reaction => ({
      user_id: reaction.userId.toString(),
      emoji: reaction.emoji
    }))
  };
}

async function findFriendshipBetween(userA, userB) {
  return Friendship.findOne({
    $or: [
      { requesterId: userA, addresseeId: userB },
      { requesterId: userB, addresseeId: userA }
    ]
  });
}

async function serializeRoomWithMembers(room) {
  const members = await User.find({ _id: { $in: room.members } })
    .select('username email avatar status')
    .lean();

  return {
    ...toRoomResponse(room),
    members: members.map(member => ({
      id: member._id.toString(),
      username: member.username,
      email: member.email,
      avatar: member.avatar || null,
      status: member.status || 'online'
    }))
  };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    }).lean();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists or invalid data' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    res.json({
      token: signToken(user),
      user: toUserResponse(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    res.json({
      token: signToken(user),
      user: toUserResponse(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: toUserResponse(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/profile', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { username, description, status } = req.body;
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : req.body.avatarUrl;

    const duplicateUsername = await User.findOne({
      username,
      _id: { $ne: req.user.id }
    }).lean();

    if (duplicateUsername) {
      return res.status(400).json({ error: 'Este nombre de usuario ya está en uso.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        username,
        description,
        status,
        ...(avatarUrl ? { avatar: avatarUrl } : {})
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado para actualizar' });
    }

    res.json({
      user: toUserResponse(user),
      token: signToken(user)
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Error al actualizar base de datos' });
  }
});
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user.id }
    }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toUserResponse(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendship = await findFriendshipBetween(req.user.id, id);
    res.json({
      ...toUserResponse(user),
      friendshipStatus: friendship ? friendship.status : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const { addresseeId } = req.body;
    if (!isValidObjectId(addresseeId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const row = await findFriendshipBetween(req.user.id, addresseeId);
    if (row) {
      if (row.status === 'blocked') return res.status(400).json({ error: 'Cannot send request' });
      if (row.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
      if (row.status === 'pending') return res.status(400).json({ error: 'Request already pending' });
    }

    await Friendship.create({
      requesterId: req.user.id,
      addresseeId,
      status: 'pending'
    });

    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await Friendship.find({
      addresseeId: req.user.id,
      status: 'pending'
    }).populate('requesterId', 'username email avatar');

    res.json(
      requests.map(request => ({
        id: request._id.toString(),
        user_id: request.requesterId._id.toString(),
        username: request.requesterId.username,
        email: request.requesterId.email,
        avatar: request.requesterId.avatar || null
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/friends/respond', authenticateToken, async (req, res) => {
  try {
    const { friendshipId, action } = req.body;
    if (!isValidObjectId(friendshipId)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (action === 'reject') {
      await Friendship.deleteOne({ _id: friendshipId, addresseeId: req.user.id });
      return res.json({ message: 'Request rejected' });
    }

    if (action === 'accept') {
      await Friendship.updateOne(
        { _id: friendshipId, addresseeId: req.user.id },
        { $set: { status: 'accepted' } }
      );
      return res.json({ message: 'Request accepted' });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      status: 'accepted',
      $or: [{ requesterId: req.user.id }, { addresseeId: req.user.id }]
    }).lean();

    const friendIds = friendships.map(friendship =>
      friendship.requesterId.toString() === req.user.id
        ? friendship.addresseeId
        : friendship.requesterId
    );

    const friends = await User.find({ _id: { $in: friendIds } })
      .select('username email avatar description status')
      .lean();

    res.json(friends.map(friend => toUserResponse(friend)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/friends/block', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const existing = await findFriendshipBetween(req.user.id, userId);
    if (existing) {
      existing.requesterId = req.user.id;
      existing.addresseeId = userId;
      existing.status = 'blocked';
      await existing.save();
    } else {
      await Friendship.create({
        requesterId: req.user.id,
        addresseeId: userId,
        status: 'blocked'
      });
    }

    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { name, type, password, description, max_members } = req.body;
    let members = req.body.members;
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (error) {
        members = [];
      }
    }

    const uniqueMembers = Array.from(
      new Set([req.user.id, ...(Array.isArray(members) ? members : [])].filter(isValidObjectId))
    );

    const room = await Room.create({
      name,
      type,
      password: password || null,
      createdBy: req.user.id,
      avatar: avatarUrl,
      description: description || '',
      maxMembers: Number(max_members || 0),
      members: uniqueMembers
    });

    res.json(toRoomResponse(room));
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:roomId/details', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!isValidObjectId(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(await serializeRoomWithMembers(room));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms/:roomId/members', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!isValidObjectId(roomId) || !isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid room or user' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.maxMembers > 0 && room.members.length >= room.maxMembers) {
      return res.status(400).json({ error: 'Room is full' });
    }

    const alreadyMember = room.members.some(memberId => memberId.toString() === userId);
    if (alreadyMember) {
      return res.status(400).json({ error: 'User already in room' });
    }

    room.members.push(userId);
    await room.save();
    res.json({ message: 'Member added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rooms/:roomId', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, description } = req.body;
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : req.body.avatarUrl;

    if (!isValidObjectId(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only admin can update room details' });
    }

    room.name = name;
    room.description = description || '';
    if (avatarUrl) {
      room.avatar = avatarUrl;
    }
    await room.save();

    const roomPayload = {
      id: room._id.toString(),
      name: room.name,
      description: room.description,
      avatar: room.avatar || null
    };

    io.to(roomId).emit('room_updated', roomPayload);
    res.json({ message: 'Room updated successfully', avatar: room.avatar || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!isValidObjectId(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy.toString() === req.user.id) {
      await Message.deleteMany({ roomId });
      await Room.deleteOne({ _id: roomId });
      return res.json({ message: 'Room deleted successfully' });
    }

    room.members = room.members.filter(memberId => memberId.toString() !== req.user.id);
    await room.save();
    res.json({ message: 'Left the room successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user.id }).sort({ name: 1 });
    res.json(rooms.map(room => toRoomResponse(room)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.query;

    if (!isValidObjectId(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.password && room.password !== password) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    const messages = await Message.find({
      roomId,
      hiddenFor: { $ne: req.user.id }
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username avatar');

    res.json(messages.map(message => toMessageResponse(message)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl, type: req.file.mimetype });
});

app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  if (!GEMINI_API_KEY) {
    return res.json({
      answer: 'La IA no está configurada (falta GEMINI_API_KEY en el servidor), pero el chat funciona.'
    });
  }
  if (typeof fetch !== 'function') {
    return res.json({
      answer: 'El entorno de servidor no soporta fetch, no puedo contactar con la IA real.'
    });
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
        GEMINI_MODEL
      )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: message }]
            }
          ]
        })
      }
    );
    const data = await response.json();
    let answer = 'No he podido generar una respuesta.';
    if (data && data.error && data.error.message) {
      console.error('Gemini API error (chat):', data.error);
      answer = `Error de Gemini: ${data.error.message}`;
    } else if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text
    ) {
      answer = data.candidates[0].content.parts[0].text.trim();
    } else {
      console.error('Gemini API respuesta inesperada (chat):', data);
    }
    res.json({ answer });
  } catch (err) {
    console.error('Error en /api/ai/chat', err);
    res.json({
      answer: 'Ha habido un problema al contactar con la IA real, pero puedes seguir chateando aquí.'
    });
  }
});

app.post('/api/ai/image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Descripción requerida' });
  }
  if (!CF_ACCOUNT_ID || !CF_AI_API_TOKEN) {
    return res.json({
      imageUrl: null,
      error:
        'La IA de imágenes de Cloudflare Workers AI no está configurada (faltan CF_ACCOUNT_ID o CF_AI_API_TOKEN en el servidor).'
    });
  }
  if (typeof fetch !== 'function') {
    return res.json({
      imageUrl: null,
      error: 'El entorno de servidor no soporta fetch, no puedo generar imágenes reales.'
    });
  }
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      CF_ACCOUNT_ID
    )}/ai/run/${encodeURIComponent(CF_IMAGE_MODEL)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CF_AI_API_TOKEN}`
      },
      body: JSON.stringify({ prompt })
    });

    let imageUrl = null;
    let errorText = null;
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let errText = '';
      try {
        if (contentType.includes('application/json')) {
          errText = JSON.stringify(await response.json());
        } else {
          errText = await response.text();
        }
      } catch (error) {
        errText = response.statusText || 'Error desconocido de Cloudflare Workers AI.';
      }
      console.error(`Cloudflare Workers AI error (status ${response.status}):`, errText);
      errorText = 'Cloudflare Workers AI devolvió un error al generar la imagen.';
    } else if (contentType.includes('application/json')) {
      const data = await response.json();
      const base64 =
        (data.result && data.result.image) ||
        data.image ||
        (data.images && data.images[0]);
      if (base64) {
        imageUrl = `data:image/png;base64,${base64}`;
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      imageUrl = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    }

    if (!imageUrl) {
      return res.json({
        imageUrl: null,
        error:
          errorText ||
          'No se pudo generar la imagen con Cloudflare Workers AI (no se recibió ninguna imagen).'
      });
    }

    res.json({ imageUrl });
  } catch (err) {
    console.error('Error en /api/ai/image', err);
    res.json({
      imageUrl: null,
      error: 'Ha habido un problema al generar la imagen con Cloudflare Workers AI.'
    });
  }
});

io.on('connection', socket => {
  console.log('A user connected:', socket.id);

  socket.on('register_user', ({ userId }) => {
    if (!userId) return;
    userSockets[userId] = socket.id;
    socket.userId = userId;
  });

  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send_message', async data => {
    try {
      const { roomId, senderId, content, type, fileUrl } = data;
      if (!isValidObjectId(roomId) || !isValidObjectId(senderId)) {
        return;
      }

      const message = await Message.create({
        roomId,
        senderId,
        content,
        type,
        fileUrl: fileUrl || null
      });
      const sender = await User.findById(senderId).select('username avatar');
      io.to(roomId).emit('receive_message', toMessageResponse(message, sender));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  socket.on('delete_message', async ({ messageId, roomId }) => {
    try {
      if (!isValidObjectId(messageId)) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      if (message.isDeleted) {
        await Message.deleteOne({ _id: messageId });
        io.to(roomId).emit('message_gone', messageId);
      } else {
        message.isDeleted = true;
        await message.save();
        io.to(roomId).emit('message_deleted', messageId);
      }
    } catch (error) {
      console.error('Error deleting message', error);
    }
  });

  socket.on('hide_message', async ({ messageId, userId }) => {
    try {
      if (!isValidObjectId(messageId) || !isValidObjectId(userId)) {
        return;
      }
      await Message.updateOne(
        { _id: messageId },
        { $addToSet: { hiddenFor: userId } }
      );
    } catch (error) {
      console.error('Error hiding message', error);
    }
  });

  socket.on('add_reaction', async ({ messageId, userId, emoji, roomId }) => {
    try {
      if (!isValidObjectId(messageId) || !isValidObjectId(userId) || !emoji) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      const alreadyExists = message.reactions.some(
        reaction =>
          reaction.userId.toString() === userId && reaction.emoji === emoji
      );

      if (!alreadyExists) {
        message.reactions.push({ userId, emoji });
        await message.save();
      }

      io.to(roomId).emit('reaction_updated', {
        messageId,
        reactions: message.reactions.map(reaction => ({
          user_id: reaction.userId.toString(),
          emoji: reaction.emoji
        }))
      });
    } catch (error) {
      console.error('Error adding reaction', error);
    }
  });

  socket.on('remove_reaction', async ({ messageId, userId, emoji, roomId }) => {
    try {
      if (!isValidObjectId(messageId) || !isValidObjectId(userId) || !emoji) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      message.reactions = message.reactions.filter(
        reaction =>
          !(reaction.userId.toString() === userId && reaction.emoji === emoji)
      );
      await message.save();

      io.to(roomId).emit('reaction_updated', {
        messageId,
        reactions: message.reactions.map(reaction => ({
          user_id: reaction.userId.toString(),
          emoji: reaction.emoji
        }))
      });
    } catch (error) {
      console.error('Error removing reaction', error);
    }
  });

  socket.on('call_user', ({ fromUserId, toUserId, roomId, isVideo }) => {
    if (!toUserId || !fromUserId) return;
    const targetSocketId = userSockets[toUserId];
    if (!targetSocketId) {
      if (roomId) {
        io.to(roomId).emit('incoming_call', { fromUserId, roomId, isVideo: !!isVideo });
      }
      return;
    }
    io.to(targetSocketId).emit('incoming_call', { fromUserId, roomId, isVideo: !!isVideo });
  });

  socket.on('call_offer', ({ fromUserId, toUserId, offer, isVideo }) => {
    if (!toUserId || !fromUserId || !offer) return;
    const targetSocketId = userSockets[toUserId];
    if (!targetSocketId) return;
    io.to(targetSocketId).emit('call_offer', { fromUserId, offer, isVideo: !!isVideo });
  });

  socket.on('call_answer', ({ fromUserId, toUserId, answer, isVideo }) => {
    if (!toUserId || !fromUserId || !answer) return;
    const targetSocketId = userSockets[toUserId];
    if (!targetSocketId) return;
    io.to(targetSocketId).emit('call_answer', { fromUserId, answer, isVideo: !!isVideo });
  });

  socket.on('call_ice_candidate', ({ fromUserId, toUserId, candidate }) => {
    if (!toUserId || !fromUserId || !candidate) return;
    const targetSocketId = userSockets[toUserId];
    if (!targetSocketId) return;
    io.to(targetSocketId).emit('call_ice_candidate', { fromUserId, candidate });
  });

  socket.on('call_hangup', ({ fromUserId, toUserId }) => {
    if (!toUserId || !fromUserId) return;
    const targetSocketId = userSockets[toUserId];
    if (!targetSocketId) return;
    io.to(targetSocketId).emit('call_hangup', { fromUserId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId && userSockets[socket.userId] === socket.id) {
      delete userSockets[socket.userId];
    }
  });
});

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Failed to connect to MongoDB Atlas:', error);
    process.exit(1);
  });
