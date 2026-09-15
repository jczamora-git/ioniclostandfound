import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { socketAuthMiddleware } from './socket/auth.js';
import { registerConversationHandlers } from './socket/conversations.js';
import { registerMessageHandlers } from './socket/messages.js';
import {
  getUserConversations,
  getConversationMessages,
  getThreads,
  getThreadMessages,
  saveUserProfile,
  getUserProfile,
  saveNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from './storage.js';
import type { AppNotification } from './types/chat.js';

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

// REST Fallback Endpoints
app.get('/api/conversations/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const convs = await getUserConversations(uid);
    res.json({ success: true, conversations: convs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversations/:conversationId/threads', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const threads = await getThreads(conversationId);
    res.json({ success: true, threads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/messages/:conversationId/:threadId', async (req, res) => {
  try {
    const { conversationId, threadId } = req.params;
    const msgs = await getThreadMessages(conversationId, threadId);
    res.json({ success: true, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const msgs = await getConversationMessages(conversationId);
    res.json({ success: true, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const profile = req.body;
    if (profile && profile.id) {
      await saveUserProfile(profile);
      return res.json({ success: true, profile });
    }
    res.status(400).json({ success: false, error: 'Invalid profile data' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/profiles/:uid', async (req, res) => {
  try {
    const profile = await getUserProfile(req.params.uid);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Notification REST Endpoints
app.get('/api/notifications/:uid', async (req, res) => {
  try {
    const list = await getUserNotifications(req.params.uid);
    res.json({ success: true, notifications: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/:uid/read/:notifId', async (req, res) => {
  try {
    const updated = await markNotificationRead(req.params.uid, req.params.notifId);
    res.json({ success: true, notification: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/:uid/read-all', async (req, res) => {
  try {
    await markAllNotificationsRead(req.params.uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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
  if (uid) {
    // Put user into personal user room for global events
    socket.join(`user:${uid}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Socket Connected] Socket ID: ${socket.id} (user:${uid})`);
    }
  }

  registerConversationHandlers(io, socket);
  registerMessageHandlers(io, socket);

  // Notification Event Handlers
  socket.on(
    'notification:send',
    async (
      payload: { targetUserId: string; notification: AppNotification },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const { targetUserId, notification } = payload;
        if (!targetUserId || !notification) {
          return callback?.({ success: false, error: 'targetUserId and notification required' });
        }
        await saveNotification(targetUserId, notification);
        // Realtime delivery to target user personal room
        io.to(`user:${targetUserId}`).emit('notification:new', notification);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Socket] notification:new emitted to user:${targetUserId}:`, notification.text);
        }
        callback?.({ success: true });
      } catch (err: any) {
        console.error('[notification:send error]:', err);
        callback?.({ success: false, error: err.message });
      }
    }
  );

  socket.on(
    'notification:list',
    async (
      callback?: (res: { success: boolean; notifications?: AppNotification[]; error?: string }) => void
    ) => {
      try {
        const notifs = await getUserNotifications(uid);
        callback?.({ success: true, notifications: notifs });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  socket.on(
    'notification:read',
    async (
      payload: { notificationId: string },
      callback?: (res: { success: boolean; notification?: AppNotification | null; error?: string }) => void
    ) => {
      try {
        const updated = await markNotificationRead(uid, payload.notificationId);
        io.to(`user:${uid}`).emit('notification:read', { notificationId: payload.notificationId });
        callback?.({ success: true, notification: updated });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  socket.on(
    'notification:read-all',
    async (callback?: (res: { success: boolean; error?: string }) => void) => {
      try {
        await markAllNotificationsRead(uid);
        io.to(`user:${uid}`).emit('notification:read-all', { uid });
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Socket Disconnected] Socket ID: ${socket.id} (Reason: ${reason})`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Lost & Found Socket.IO Chat Server`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🔒 Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`=========================================`);
});
