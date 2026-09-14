"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = socketAuthMiddleware;
const firebaseAdmin_js_1 = require("../firebaseAdmin.js");
async function socketAuthMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication failed: No token provided'));
        }
        const uid = await (0, firebaseAdmin_js_1.verifyToken)(token);
        socket.data.uid = uid;
        console.log(`[Socket Auth] Socket connected: ${socket.id} (UID: ${uid})`);
        next();
    }
    catch (err) {
        console.error(`[Socket Auth Error] Handshake rejected for ${socket.id}:`, err.message);
        next(new Error(`Authentication failed: ${err.message}`));
    }
}
