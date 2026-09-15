// Determine backend API URL with priority:
// 1. Explicit VITE_API_SERVER_URL or VITE_CHAT_SERVER_URL from .env
// 2. Fallback in local dev: http://localhost:3000
const rawServerUrl =
  import.meta.env.VITE_API_SERVER_URL ||
  import.meta.env.VITE_CHAT_SERVER_URL;

export const SERVER_URL: string =
  rawServerUrl && rawServerUrl.trim() !== ''
    ? rawServerUrl.trim().replace(/\/+$/, '')
    : import.meta.env.DEV
    ? 'http://localhost:3000'
    : '';

if (import.meta.env.DEV) {
  console.log('[API Server Config]', SERVER_URL);
}

export function getApiServerUrl(): string {
  return SERVER_URL;
}

export const getChatServerUrl = getApiServerUrl;

/**
 * Socket.IO has been retired in favor of stateless manual-refresh messaging.
 * Stub functions are retained for backward compatibility without socket connections.
 */
export async function getSocket(): Promise<any> {
  return null;
}

export function disconnectSocket() {
  // No-op in stateless mode
}

export function isSocketConnected(): boolean {
  return false;
}
