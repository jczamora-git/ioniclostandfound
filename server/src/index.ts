import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { socketAuthMiddleware } from './socket/auth.js';
import { registerConversationHandlers } from './socket/conversations.js';
import { registerMessageHandlers } from './socket/messages.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:8100', 'http://localhost'];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev
    },
    credentials: true
  })
);
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'lostandfound-chat-server',
    time: new Date().toISOString()
  });
});

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 25000
});

// Socket Authentication Middleware
io.use(socketAuthMiddleware);

// Socket Event Registration
io.on('connection', (socket) => {
  const uid = socket.data.uid;
  console.log(`[Socket Connected] Socket ID: ${socket.id} (UID: ${uid})`);

  registerConversationHandlers(io, socket);
  registerMessageHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket Disconnected] Socket ID: ${socket.id} (Reason: ${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Lost & Found Socket.IO Chat Server`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🔒 Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`=========================================`);
});
