import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server/src/app.js';
import { handleCors } from '../server/src/cors.js';

export default function handler(
  req: IncomingMessage & { method?: string; headers: any; body?: any; url?: string; query?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any; end: (data?: any) => any; setHeader: (name: string, value: any) => any }
) {
  if (handleCors(req, res)) return;
  return (app as any)(req, res);
}
