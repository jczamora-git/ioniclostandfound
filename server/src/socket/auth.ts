import type { Socket } from 'socket.io';
import { verifyToken } from '../firebaseAdmin.js';

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication failed: No token provided'));
    }

    const uid = await verifyToken(token);
    socket.data.uid = uid;
    console.log(`[Socket Auth] Socket connected: ${socket.id} (UID: ${uid})`);
    next();
  } catch (err: any) {
    console.error(`[Socket Auth Error] Handshake rejected for ${socket.id}:`, err.message);
    next(new Error(`Authentication failed: ${err.message}`));
  }
}
