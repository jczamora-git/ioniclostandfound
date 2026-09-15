import type { IncomingMessage, ServerResponse } from 'http';
import { handleCors } from '../server/src/cors.js';

export default function handler(
  req: IncomingMessage & { method?: string; headers: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any; end: (data?: any) => any; setHeader: (name: string, value: any) => any }
) {
  if (handleCors(req, res)) return;

  const isConfigured = Boolean(process.env.UPLOADTHING_TOKEN);
  if (!isConfigured) {
    console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
  }

  const payload = JSON.stringify({
    ok: true,
    uploadthingConfigured: isConfigured
  });

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json({
      ok: true,
      uploadthingConfigured: isConfigured
    });
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(payload);
}
