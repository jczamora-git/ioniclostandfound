import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
// Support loading from both cwd and server/.env locations
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
import { socketAuthMiddleware } from './socket/auth.js';
import { registerConversationHandlers } from './socket/conversations.js';
import { registerMessageHandlers } from './socket/messages.js';
import { getUserConversations, getConversationMessages, getThreads, getThreadMessages, saveUserProfile, getUserProfile, saveNotification, getUserNotifications, markNotificationRead, markAllNotificationsRead } from './storage.js';
import { createRouteHandler } from 'uploadthing/express';
import { uploadRouter, utapi } from './uploadthing.js';
import { resolveUsernameToEmail } from './firebaseAdmin.js';
if (!process.env.UPLOADTHING_TOKEN) {
    console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
}
console.log('[UploadThing]', {
    configured: Boolean(process.env.UPLOADTHING_TOKEN)
});
const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 3000);
const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8100',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost'
];
const customOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : [];
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...customOrigins]));
const isOriginAllowed = (origin) => {
    if (!origin)
        return true; // Mobile apps / native WebViews often send no Origin header
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))
        return true;
    if (process.env.NODE_ENV !== 'production') {
        // In dev, permit local IP origins (e.g. http://192.168.x.x:*)
        if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
            return true;
        }
    }
    return false;
};
// Middleware
app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            return callback(null, origin || true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
}));
app.use(express.json());
// Health Check
app.get('/health', (req, res) => {
    res.json({
        ok: true,
        status: 'ok',
        service: 'lostandfound-chat-server',
        time: new Date().toISOString()
    });
});
// UploadThing Upload Route Handler
app.use('/api/uploadthing', (req, res, next) => {
    if (!process.env.UPLOADTHING_TOKEN) {
        console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
        return res.status(500).json({
            error: 'Missing token. Please set the UPLOADTHING_TOKEN environment variable'
        });
    }
    next();
}, createRouteHandler({
    router: uploadRouter,
    config: {
        token: process.env.UPLOADTHING_TOKEN
    }
}));
// UploadThing File Deletion Endpoint
app.post('/api/uploadthing/delete', async (req, res) => {
    try {
        const { key, keys } = req.body || {};
        const targetKeys = Array.isArray(keys)
            ? keys.filter(Boolean)
            : key && typeof key === 'string'
                ? [key]
                : [];
        if (targetKeys.length === 0) {
            return res.status(400).json({ success: false, error: 'No file key provided for deletion.' });
        }
        if (process.env.UPLOADTHING_TOKEN) {
            await utapi.deleteFiles(targetKeys);
        }
        else if (process.env.NODE_ENV !== 'production') {
            console.log('[UploadThing Mock Delete] Deleted keys:', targetKeys);
        }
        return res.json({ success: true, deleted: targetKeys });
    }
    catch (err) {
        console.warn('[UploadThing Delete Warning]:', err.message);
        return res.json({ success: false, error: err.message });
    }
});
// Username resolution endpoint for login (email/username + password)
app.post('/api/auth/resolve-username', async (req, res) => {
    try {
        const { username } = req.body || {};
        if (!username || typeof username !== 'string' || !username.trim()) {
            return res.status(400).json({ success: false, error: 'Username is required.' });
        }
        const email = await resolveUsernameToEmail(username);
        if (!email) {
            return res.status(404).json({ success: false, error: 'Account not found.' });
        }
        return res.json({ success: true, email });
    }
    catch (err) {
        console.warn('[resolve-username error]:', err.message);
        return res.status(404).json({ success: false, error: 'Account not found.' });
    }
});
// REST Fallback Endpoints
app.get('/api/conversations/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const convs = await getUserConversations(uid);
        res.json({ success: true, conversations: convs });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.get('/api/conversations/:conversationId/threads', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const threads = await getThreads(conversationId);
        res.json({ success: true, threads });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.get('/api/messages/:conversationId/:threadId', async (req, res) => {
    try {
        const { conversationId, threadId } = req.params;
        const msgs = await getThreadMessages(conversationId, threadId);
        res.json({ success: true, messages: msgs });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.get('/api/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const msgs = await getConversationMessages(conversationId);
        res.json({ success: true, messages: msgs });
    }
    catch (err) {
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.get('/api/profiles/:uid', async (req, res) => {
    try {
        const profile = await getUserProfile(req.params.uid);
        res.json({ success: true, profile });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Notification REST Endpoints
app.get('/api/notifications/:uid', async (req, res) => {
    try {
        const list = await getUserNotifications(req.params.uid);
        res.json({ success: true, notifications: list });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.post('/api/notifications/:uid/read/:notifId', async (req, res) => {
    try {
        const updated = await markNotificationRead(req.params.uid, req.params.notifId);
        res.json({ success: true, notification: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
app.post('/api/notifications/:uid/read-all', async (req, res) => {
    try {
        await markAllNotificationsRead(req.params.uid);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                return callback(null, origin || true);
            }
            return callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
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
    socket.on('notification:send', async (payload, callback) => {
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
        }
        catch (err) {
            console.error('[notification:send error]:', err);
            callback?.({ success: false, error: err.message });
        }
    });
    socket.on('notification:list', async (callback) => {
        try {
            const notifs = await getUserNotifications(uid);
            callback?.({ success: true, notifications: notifs });
        }
        catch (err) {
            callback?.({ success: false, error: err.message });
        }
    });
    socket.on('notification:read', async (payload, callback) => {
        try {
            const updated = await markNotificationRead(uid, payload.notificationId);
            io.to(`user:${uid}`).emit('notification:read', { notificationId: payload.notificationId });
            callback?.({ success: true, notification: updated });
        }
        catch (err) {
            callback?.({ success: false, error: err.message });
        }
    });
    socket.on('notification:read-all', async (callback) => {
        try {
            await markAllNotificationsRead(uid);
            io.to(`user:${uid}`).emit('notification:read-all', { uid });
            callback?.({ success: true });
        }
        catch (err) {
            callback?.({ success: false, error: err.message });
        }
    });
    socket.on('disconnect', (reason) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Socket Disconnected] Socket ID: ${socket.id} (Reason: ${reason})`);
        }
    });
});
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] listening on 0.0.0.0:${PORT}`);
    console.log(`=========================================`);
    console.log(`🚀 Lost & Found Socket.IO Chat Server`);
    console.log(`📡 Listening on: http://0.0.0.0:${PORT} (LAN reachable)`);
    console.log(`🔒 Allowed Origins: ${allowedOrigins.join(', ')}`);
    console.log(`=========================================`);
});
