import type { IncomingMessage, ServerResponse } from 'http';

const defaultAllowedOrigins = [
  'https://ioniclostandfound.vercel.app',
  'http://localhost:5173',
  'http://localhost:8100',
  'http://localhost:3000',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost'
];

export function getCustomOrigins(): string[] {
  const custom = process.env.CLIENT_ORIGIN;
  if (!custom) return [];
  return custom.split(',').map((o) => o.trim()).filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  return Array.from(new Set([...defaultAllowedOrigins, ...getCustomOrigins()]));
}

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // Native mobile Capacitor apps often omit Origin
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin) || allowed.includes('*')) return true;
  if (origin.endsWith('.vercel.app')) return true;

  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return true;
    }
  }
  return false;
}

/**
 * Sets CORS headers on incoming HTTP serverless / API requests.
 * Returns true if the request was an OPTIONS preflight request (and terminates the response).
 */
export function handleCors(req: IncomingMessage & { method?: string; headers: any }, res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any; end: (data?: any) => any; setHeader: (name: string, value: any) => any }): boolean {
  const origin = req.headers.origin || req.headers.Origin || '';

  if (isOriginAllowed(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-auth-token, x-dev-uid, x-uploadthing-version, x-uploadthing-fe-package, baggage, sentry-trace'
  );

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204).end();
    } else {
      res.statusCode = 204;
      res.end();
    }
    return true;
  }

  return false;
}
