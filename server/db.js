const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chat.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      description TEXT,
      status TEXT DEFAULT 'online'
    )`);

    // Rooms table
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT DEFAULT 'group', -- 'group' or 'direct'
      password TEXT, -- For encrypted/locked rooms
      created_by INTEGER,
      avatar TEXT,
      description TEXT,
      max_members INTEGER DEFAULT 0, -- 0 means unlimited
      FOREIGN KEY(created_by) REFERENCES users(id)
    )`);

    // Check columns for existing table (simple migration for dev)
    db.all("PRAGMA table_info(rooms)", (err, rows) => {
        if (err) console.error(err);
        const columns = rows.map(r => r.name);
        if (!columns.includes('avatar')) db.run("ALTER TABLE rooms ADD COLUMN avatar TEXT");
        if (!columns.includes('description')) db.run("ALTER TABLE rooms ADD COLUMN description TEXT");
        if (!columns.includes('max_members')) db.run("ALTER TABLE rooms ADD COLUMN max_members INTEGER DEFAULT 0");
    });

    // Room members
    db.run(`CREATE TABLE IF NOT EXISTS room_members (
      room_id INTEGER,
      user_id INTEGER,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY(room_id) REFERENCES rooms(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      sender_id INTEGER,
      content TEXT, -- For text messages or file descriptions
      type TEXT DEFAULT 'text', -- text, image, video, audio, file, sticker, gif
      file_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      FOREIGN KEY(room_id) REFERENCES rooms(id),
      FOREIGN KEY(sender_id) REFERENCES users(id)
    )`);

    // Check columns for existing table (simple migration for dev)
    db.all("PRAGMA table_info(messages)", (err, rows) => {
        if (err) console.error(err);
        const columns = rows.map(r => r.name);
        if (!columns.includes('is_deleted')) db.run("ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT 0");
    });

    // Friendships table
    db.run(`CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER,
      addressee_id INTEGER,
      status TEXT DEFAULT 'pending', -- pending, accepted, blocked
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(requester_id) REFERENCES users(id),
      FOREIGN KEY(addressee_id) REFERENCES users(id),
      UNIQUE(requester_id, addressee_id)
    )`);

    // Hidden messages table (Delete for me)
    db.run(`CREATE TABLE IF NOT EXISTS hidden_messages (
      user_id INTEGER,
      message_id INTEGER,
      PRIMARY KEY (user_id, message_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(message_id) REFERENCES messages(id)
    )`);
  });
}

module.exports = db;
