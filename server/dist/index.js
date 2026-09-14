"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_js_1 = require("./socket/auth.js");
const conversations_js_1 = require("./socket/conversations.js");
const messages_js_1 = require("./socket/messages.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:8100', 'http://localhost'];
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps or curl)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in dev
    },
    credentials: true
}));
app.use(express_1.default.json());
// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'lostandfound-chat-server',
        time: new Date().toISOString()
    });
});
// Socket.IO
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 25000
});
// Socket Authentication Middleware
io.use(auth_js_1.socketAuthMiddleware);
// Socket Event Registration
io.on('connection', (socket) => {
    const uid = socket.data.uid;
    console.log(`[Socket Connected] Socket ID: ${socket.id} (UID: ${uid})`);
    (0, conversations_js_1.registerConversationHandlers)(io, socket);
    (0, messages_js_1.registerMessageHandlers)(io, socket);
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
