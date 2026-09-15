import { io, Socket } from 'socket.io-client';
import { auth } from '../firebase';
import { getAuthenticatedUser } from '../composables/useAuth';

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;

const SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || 'http://localhost:3000';

/**
 * Retrieve current Firebase ID token.
 */
async function getIdToken(): Promise<string> {
  let user = auth.currentUser;
  if (!user) {
    user = await getAuthenticatedUser();
  }
  if (user && typeof user.getIdToken === 'function') {
    try {
      return await user.getIdToken();
    } catch (err) {
      console.warn('[Socket] Failed to fetch ID token:', err);
    }
  }

  return 'unauthenticated';
}

/**
 * Get or initialize the shared Socket.IO connection.
 */
export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) {
    return socket;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = new Promise(async (resolve, reject) => {
    try {
      const token = await getIdToken();

      if (socket) {
        socket.disconnect();
      }

      socket = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      socket.on('connect', () => {
        console.log('[Socket Service] Connected to chat server:', SERVER_URL, socket?.id);
        resolve(socket!);
      });

      socket.on('connect_error', (err) => {
        console.warn('[Socket Service] Connection error:', err.message);
        // If connecting for the first time, still resolve or reject
        if (!socket?.connected) {
          // Keep attempting in background
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket Service] Disconnected:', reason);
      });

      // Timeout fallback to avoid blocking permanently
      setTimeout(() => {
        if (socket) {
          resolve(socket);
        }
      }, 3000);
    } catch (err) {
      console.error('[Socket Service] Initialization failed:', err);
      reject(err);
    } finally {
      connectPromise = null;
    }
  });

  return connectPromise;
}

/**
 * Disconnect socket cleanly.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check socket connection status.
 */
export function isSocketConnected(): boolean {
  return Boolean(socket && socket.connected);
}
