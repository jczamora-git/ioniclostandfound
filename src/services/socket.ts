import { io, Socket } from 'socket.io-client';
import { App } from '@capacitor/app';
import { auth } from '../firebase';
import { getAuthenticatedUser, isDevBypassEnabled, getDevSession } from '../composables/useAuth';

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;
let lifecycleListenersRegistered = false;

// Determine backend API / Socket server URL with priority:
// 1. Explicit VITE_API_SERVER_URL or VITE_CHAT_SERVER_URL from .env
// 2. In browser development only: http://localhost:3000
const rawServerUrl =
  import.meta.env.VITE_API_SERVER_URL ||
  import.meta.env.VITE_CHAT_SERVER_URL;

export const SERVER_URL: string =
  rawServerUrl && rawServerUrl.trim() !== ''
    ? rawServerUrl.trim()
    : import.meta.env.DEV
    ? 'http://localhost:3000'
    : '';

if (import.meta.env.DEV) {
  console.log('[Server Config]', SERVER_URL);
}

export function getApiServerUrl(): string {
  return SERVER_URL;
}

export const getChatServerUrl = getApiServerUrl;

/**
 * Retrieve socket auth payload:
 * - Real Firebase Auth: returns ID token
 * - Dev Bypass (development only): returns devUid and dev token
 */
async function getSocketAuth(): Promise<{ token?: string; devUid?: string }> {
  // 1. DEV bypass mode check
  if (isDevBypassEnabled()) {
    const devSession = getDevSession();
    if (devSession && devSession.uid) {
      return {
        devUid: devSession.uid,
        token: `dev_${devSession.uid}`
      };
    }
  }

  // 2. Real Firebase Auth
  let user = auth.currentUser;
  if (!user) {
    user = await getAuthenticatedUser();
  }
  if (user && typeof user.getIdToken === 'function') {
    try {
      const token = await user.getIdToken();
      return { token };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[Socket] Failed to fetch Firebase ID token:', err);
      }
    }
  }

  return {};
}

/**
 * Register lifecycle listeners once to handle reconnects cleanly when returning from background
 * or recovering network connectivity on mobile and web.
 */
function setupLifecycleListeners() {
  if (lifecycleListenersRegistered) return;
  lifecycleListenersRegistered = true;

  try {
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive && socket && !socket.connected) {
        if (import.meta.env.DEV) {
          console.log('[Socket] reconnect');
        }
        try {
          const authPayload = await getSocketAuth();
          socket.auth = authPayload;
          socket.connect();
        } catch {
          socket.connect();
        }
      }
    }).catch(() => {
      // Ignore if running in pure browser where Capacitor native bridge is absent
    });
  } catch {
    // Graceful fallback
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      if (socket && !socket.connected) {
        if (import.meta.env.DEV) {
          console.log('[Socket] reconnect');
        }
        try {
          const authPayload = await getSocketAuth();
          socket.auth = authPayload;
          socket.connect();
        } catch {
          socket.connect();
        }
      }
    });
  }
}

/**
 * Get or initialize the shared Socket.IO connection.
 * Guarantees a single active socket instance per user session.
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
      const authPayload = await getSocketAuth();

      // If socket exists but disconnected, update auth and reconnect
      if (socket) {
        socket.auth = authPayload;
        if (!socket.connected) {
          socket.connect();
        }
        resolve(socket);
        return;
      }

      socket = io(SERVER_URL, {
        auth: authPayload,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      setupLifecycleListeners();

      socket.on('connect', () => {
        if (import.meta.env.DEV) {
          console.log('[Socket] connected');
        }
        resolve(socket!);
      });

      socket.on('connect_error', (err: any) => {
        if (import.meta.env.DEV) {
          const errorContext = err?.description || err?.context || err?.data || '';
          console.warn('[Socket] connect_error', err.message, errorContext);
        }
      });

      socket.on('disconnect', (reason) => {
        if (import.meta.env.DEV) {
          console.log('[Socket] disconnected', reason);
        }
      });

      socket.io.on('reconnect', (attempt) => {
        if (import.meta.env.DEV) {
          console.log('[Socket] reconnect', attempt);
        }
      });

      // Avoid hanging indefinitely if server is starting
      setTimeout(() => {
        if (socket) {
          resolve(socket);
        }
      }, 3000);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Socket] Initialization failed:', err);
      }
      reject(err);
    } finally {
      connectPromise = null;
    }
  });

  return connectPromise;
}

/**
 * Cleanly disconnect and tear down socket on sign-out.
 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    connectPromise = null;
    if (import.meta.env.DEV) {
      console.log('[Socket] disconnected');
    }
  }
}

/**
 * Returns current socket connection status.
 */
export function isSocketConnected(): boolean {
  return Boolean(socket && socket.connected);
}
