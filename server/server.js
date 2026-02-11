const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'supersecretkey';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// --- Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Routes ---

// Auth: Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, 
    [username, email, hashedPassword], 
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'User already exists or invalid data' });
      }
      const token = jwt.sign({ id: this.lastID, username }, SECRET_KEY);
      res.json({ token, user: { id: this.lastID, username, email, avatar: null, description: '', status: 'online' } });
    }
  );
});

// Auth: Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'User not found' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, description: user.description, status: user.status } });
  });
});

// Auth: Get Current User (Me)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, username, email, avatar, description, status FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    });
});

// User: Update Profile (Avatar, Username, Description, Status)
app.put('/api/user/profile', authenticateToken, upload.single('avatar'), (req, res) => {
  const { username, description, status } = req.body;
  let avatarUrl = req.body.avatarUrl; // If not updating image
  
  if (req.file) {
    avatarUrl = `/uploads/${req.file.filename}`;
  }

  const userId = req.user.id;
  
  // Update username, description, status, and avatar
  // Using explicit values instead of COALESCE for username to ensure it updates if provided
  const sql = `UPDATE users SET 
    username = ?, 
    description = ?, 
    status = ?, 
    avatar = COALESCE(?, avatar) 
    WHERE id = ?`;
  
    console.log(`[PROFILE_UPDATE] Attempting update for user ID: ${userId} with data:`, { username, description, status, avatarUrl });

    db.run(sql, [username, description, status, avatarUrl, userId], function(err) {
        if (err) {
          console.error("[PROFILE_UPDATE] Database error:", err.message);
          if (err.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(400).json({ error: 'Este nombre de usuario ya está en uso.' });
          }
          return res.status(500).json({ error: 'Error al actualizar base de datos' });
        }
        
        console.log(`[PROFILE_UPDATE] Success. Rows changed: ${this.changes}`);
        
        if (this.changes === 0) {
          console.warn(`[PROFILE_UPDATE] Warning: No rows were updated for user ID: ${userId}`);
          return res.status(404).json({ error: 'Usuario no encontrado para actualizar' });
        }
        
        db.get(`SELECT id, username, email, avatar, description, status FROM users WHERE id = ?`, [userId], (err, user) => {
          if (err) return res.status(500).json({ error: err.message });
          console.log("[PROFILE_UPDATE] Returning refreshed user data:", user);
          
          const newToken = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
          res.json({ user, token: newToken });
        });
      }
    );
});

// User: Get User by ID (Public Profile)
app.get('/api/users/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT id, username, email, avatar, description, status FROM users WHERE id = ?`, [id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Check friendship status
        db.get(`SELECT status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
            [req.user.id, id, id, req.user.id],
            (err, friendship) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ ...user, friendshipStatus: friendship ? friendship.status : null });
            }
        );
    });
});

// User: Get All Users (for finding friends) - MODIFIED: Search by email
app.get('/api/users/search', authenticateToken, (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  db.get(`SELECT id, username, email, avatar, description, status FROM users WHERE email = ? AND id != ?`, [email, req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// Friends: Send Request
app.post('/api/friends/request', authenticateToken, (req, res) => {
  const { addresseeId } = req.body;
  const requesterId = req.user.id;

  // Check if friendship already exists
  db.get(`SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`, 
    [requesterId, addresseeId, addresseeId, requesterId], 
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) {
        if (row.status === 'blocked') return res.status(400).json({ error: 'Cannot send request' });
        if (row.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
        if (row.status === 'pending') return res.status(400).json({ error: 'Request already pending' });
      }

      db.run(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`, 
        [requesterId, addresseeId], 
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Friend request sent' });
        }
      );
    }
  );
});

// Friends: Get Requests (Incoming)
app.get('/api/friends/requests', authenticateToken, (req, res) => {
  db.all(`
    SELECT f.id, u.id as user_id, u.username, u.email, u.avatar 
    FROM friendships f
    JOIN users u ON f.requester_id = u.id
    WHERE f.addressee_id = ? AND f.status = 'pending'
  `, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Friends: Respond to Request (Accept/Reject)
app.put('/api/friends/respond', authenticateToken, (req, res) => {
  const { friendshipId, action } = req.body; // action: 'accept' or 'reject'
  
  if (action === 'reject') {
    db.run(`DELETE FROM friendships WHERE id = ? AND addressee_id = ?`, [friendshipId, req.user.id], function(err) {
       if (err) return res.status(500).json({ error: err.message });
       res.json({ message: 'Request rejected' });
    });
  } else if (action === 'accept') {
    db.run(`UPDATE friendships SET status = 'accepted' WHERE id = ? AND addressee_id = ?`, [friendshipId, req.user.id], function(err) {
       if (err) return res.status(500).json({ error: err.message });
       res.json({ message: 'Request accepted' });
    });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// Friends: Get Friends List (Accepted)
app.get('/api/friends', authenticateToken, (req, res) => {
  const sql = `
    SELECT u.id, u.username, u.email, u.avatar, u.description, u.status
    FROM friendships f
    JOIN users u ON (f.requester_id = u.id OR f.addressee_id = u.id)
    WHERE (f.requester_id = ? OR f.addressee_id = ?) 
    AND f.status = 'accepted'
    AND u.id != ?
  `;
  db.all(sql, [req.user.id, req.user.id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Friends: Block User
app.post('/api/friends/block', authenticateToken, (req, res) => {
  const { userId } = req.body;
  const myId = req.user.id;

  // Check if friendship exists to update, or insert new block
  db.get(`SELECT id FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
    [myId, userId, userId, myId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (row) {
        // Update existing relationship to blocked
        // We need to ensure I am the one blocking.
        // For simplicity in this schema, 'blocked' status just blocks interaction. 
        // A better schema would allow A blocks B independently of B blocks A.
        // For now, we'll just set status to 'blocked' and maybe assume whoever did the action blocked it.
        // OR better: delete and re-insert as me -> him (blocked)
        db.run(`UPDATE friendships SET status = 'blocked', requester_id = ?, addressee_id = ? WHERE id = ?`, 
            [myId, userId, row.id], // Make me the requester of the block
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'User blocked' });
            }
        );
      } else {
        db.run(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'blocked')`,
            [myId, userId],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'User blocked' });
            }
        );
      }
    }
  );
});

// Rooms: Create Room
app.post('/api/rooms', authenticateToken, upload.single('avatar'), (req, res) => {
  const { name, type, password, description, max_members } = req.body;
  let members = req.body.members;
  let avatarUrl = null;

  if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
  }

  // Handle members if sent as JSON string (common with FormData)
  if (typeof members === 'string') {
      try {
          members = JSON.parse(members);
      } catch (e) {
          members = [];
      }
  }

  db.run(`INSERT INTO rooms (name, type, password, created_by, avatar, description, max_members) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, type, password || null, req.user.id, avatarUrl, description, max_members || 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const roomId = this.lastID;
      
      // Add creator
      db.run(`INSERT INTO room_members (room_id, user_id) VALUES (?, ?)`, [roomId, req.user.id], (err) => {
        if (err) console.error("Error adding creator to room:", err.message);
        
        // Add other members
        if (members && Array.isArray(members)) {
          members.forEach(memberId => {
             db.run(`INSERT INTO room_members (room_id, user_id) VALUES (?, ?)`, [roomId, memberId], (err) => {
               if (err) console.error(`Error adding member ${memberId} to room:`, err.message);
             });
          });
        }
        
        // Send response AFTER adding the creator at least
        res.json({ id: roomId, name, type, created_by: req.user.id, avatar: avatarUrl, description, max_members });
      });
    }
  );
});

// Rooms: Get Room Details & Members
app.get('/api/rooms/:roomId/details', authenticateToken, (req, res) => {
    const { roomId } = req.params;
    
    db.get(`SELECT * FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        db.all(`
            SELECT u.id, u.username, u.email, u.avatar, u.status 
            FROM room_members rm
            JOIN users u ON rm.user_id = u.id
            WHERE rm.room_id = ?
        `, [roomId], (err, members) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...room, members });
        });
    });
});

// Rooms: Add Member to Room
app.post('/api/rooms/:roomId/members', authenticateToken, (req, res) => {
    const { roomId } = req.params;
    const { userId } = req.body;
    const requesterId = req.user.id;

    db.get(`SELECT * FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        // Check if requester is admin/creator (optional restriction, user asked for admin limit control)
        // User said: "que el chat no tenga limites... a menos que el administrador... lo delimite"
        // Implicitly, usually admins add people or people join. Let's allow adding if room is not full.
        
        // Check current member count
        db.get(`SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`, [roomId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (room.max_members > 0 && row.count >= room.max_members) {
                return res.status(400).json({ error: 'Room is full' });
            }

            // Check if already member
            db.get(`SELECT * FROM room_members WHERE room_id = ? AND user_id = ?`, [roomId, userId], (err, member) => {
                if (member) return res.status(400).json({ error: 'User already in room' });

                db.run(`INSERT INTO room_members (room_id, user_id) VALUES (?, ?)`, [roomId, userId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Member added' });
                });
            });
        });
    });
});

// Rooms: Update Room Details
app.put('/api/rooms/:roomId', authenticateToken, upload.single('avatar'), (req, res) => {
    const { roomId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;
    let avatarUrl = req.body.avatarUrl; // If not updating image
    
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    }

    // Check if user is creator/admin
    db.get(`SELECT * FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        
        if (room.created_by !== userId) {
            return res.status(403).json({ error: 'Only admin can update room details' });
        }

        db.run(`UPDATE rooms SET name = ?, description = ?, avatar = COALESCE(?, avatar) WHERE id = ?`,
            [name, description, avatarUrl, roomId],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // Emit event to all users in the room
                io.to(roomId).emit('room_updated', {
                    id: parseInt(roomId),
                    name,
                    description,
                    avatar: avatarUrl
                });

                res.json({ message: 'Room updated successfully', avatar: avatarUrl });
            }
        );
    });
});

// Rooms: Delete or Leave Room
app.delete('/api/rooms/:roomId', authenticateToken, (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;

    db.get(`SELECT * FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        if (room.created_by === userId) {
            // User is creator: Delete everything
            db.serialize(() => {
                db.run(`DELETE FROM messages WHERE room_id = ?`, [roomId]);
                db.run(`DELETE FROM room_members WHERE room_id = ?`, [roomId]);
                db.run(`DELETE FROM rooms WHERE id = ?`, [roomId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Room deleted successfully' });
                });
            });
        } else {
            // User is just a member: Leave the room
            db.run(`DELETE FROM room_members WHERE room_id = ? AND user_id = ?`, [roomId, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Left the room successfully' });
            });
        }
    });
});

// Rooms: Get My Rooms
app.get('/api/rooms', authenticateToken, (req, res) => {
  const sql = `
    SELECT r.* FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = ?
  `;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Messages: Get Messages for Room
app.get('/api/messages/:roomId', authenticateToken, (req, res) => {
    const { roomId } = req.params;
    const { password } = req.query; // If room is password protected

    // Check room password if exists
    db.get(`SELECT password FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err || !room) return res.status(404).json({error: "Room not found"});
        
        if (room.password && room.password !== password) {
            return res.status(403).json({error: "Incorrect password"});
        }

        db.all(`
            SELECT m.*, u.username, u.avatar 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            LEFT JOIN hidden_messages hm ON m.id = hm.message_id AND hm.user_id = ?
            WHERE m.room_id = ? AND hm.message_id IS NULL
            ORDER BY m.created_at ASC`, 
            [req.user.id, roomId], 
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            }
        );
    });
});

// File Upload Endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({error: "No file uploaded"});
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ fileUrl, type: req.file.mimetype });
});


// --- Socket.io ---

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send_message', (data) => {
    // data: { roomId, senderId, content, type, fileUrl }
    const { roomId, senderId, content, type, fileUrl } = data;
    
    db.run(`INSERT INTO messages (room_id, sender_id, content, type, file_url) VALUES (?, ?, ?, ?, ?)`,
      [roomId, senderId, content, type, fileUrl],
      function(err) {
        if (err) return console.error(err);
        
        // Fetch sender info to broadcast back
        db.get(`SELECT username, avatar FROM users WHERE id = ?`, [senderId], (err, user) => {
            const messageData = {
                id: this.lastID,
                room_id: roomId,
                sender_id: senderId,
                content,
                type,
                file_url: fileUrl,
                created_at: new Date(), // approximate
                username: user.username,
                avatar: user.avatar,
                is_deleted: 0
            };
            io.to(roomId).emit('receive_message', messageData);
        });
      }
    );
  });

  socket.on('delete_message', ({ messageId, roomId }) => {
      db.get(`SELECT is_deleted FROM messages WHERE id = ?`, [messageId], (err, row) => {
          if (err || !row) return;

          if (row.is_deleted) {
              // Hard delete if already soft deleted
              db.run(`DELETE FROM messages WHERE id = ?`, [messageId], function(err) {
                  if (err) {
                      console.error("Error deleting message", err);
                      return;
                  }
                  io.to(roomId).emit('message_gone', messageId);
              });
          } else {
              // Soft delete
              db.run(`UPDATE messages SET is_deleted = 1 WHERE id = ?`, [messageId], function(err) {
                  if (err) {
                      console.error("Error soft deleting message", err);
                      return;
                  }
                  io.to(roomId).emit('message_deleted', messageId);
              });
          }
      });
  });

  socket.on('hide_message', ({ messageId, userId }) => {
      db.run(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`, [userId, messageId], (err) => {
          if (err) console.error("Error hiding message", err);
          // Only emit to the specific user's socket (or let client handle optimistic update)
          // We don't broadcast this
      });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
