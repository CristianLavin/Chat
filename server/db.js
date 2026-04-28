const mongoose = require('mongoose');

const { Schema } = mongoose;

const MONGODB_URI = process.env.MONGODB_URI || '';

let connectionPromise = null;

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: null },
    description: { type: String, default: '' },
    status: { type: String, default: 'online' }
  },
  { versionKey: false }
);

const friendshipSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    addresseeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending'
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, versionKey: false }
);

const roomSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, default: 'group' },
    password: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    avatar: { type: String, default: null },
    description: { type: String, default: '' },
    maxMembers: { type: Number, default: 0 },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { versionKey: false }
);

const reactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true }
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    type: { type: String, default: 'text' },
    fileUrl: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    hiddenFor: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reactions: [reactionSchema],
    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Friendship =
  mongoose.models.Friendship || mongoose.model('Friendship', friendshipSchema);
const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('Falta la variable MONGODB_URI para conectar con MongoDB Atlas.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(MONGODB_URI)
      .then(conn => {
        console.log('Connected to MongoDB Atlas.');
        return conn;
      })
      .catch(err => {
        connectionPromise = null;
        throw err;
      });
  }

  return connectionPromise;
}

module.exports = {
  connectDB,
  mongoose,
  User,
  Friendship,
  Room,
  Message
};
