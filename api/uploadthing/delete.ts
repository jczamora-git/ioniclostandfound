import type { IncomingMessage, ServerResponse } from 'http';
import { utapi } from '../../server/src/uploadthing.js';
import { handleCors } from '../../server/src/cors.js';

export default async function handler(
  req: IncomingMessage & { method?: string; headers: any; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any; end: (data?: any) => any; setHeader: (name: string, value: any) => any }
) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    if (typeof res.status === 'function') {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
  }

  try {
    const { key, keys } = req.body || {};
    const targetKeys: string[] = Array.isArray(keys)
      ? keys.filter(Boolean)
      : key && typeof key === 'string'
      ? [key]
      : [];

    if (targetKeys.length === 0) {
      if (typeof res.status === 'function') {
        return res.status(400).json({ success: false, error: 'No file key provided for deletion.' });
      }
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'No file key provided for deletion.' }));
    }

    if (process.env.UPLOADTHING_TOKEN) {
      await utapi.deleteFiles(targetKeys);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('[UploadThing Mock Delete] Deleted keys:', targetKeys);
    }

    if (typeof res.status === 'function') {
      return res.status(200).json({ success: true, deleted: targetKeys });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, deleted: targetKeys }));
  } catch (err: any) {
    console.warn('[UploadThing Delete Warning]:', err.message);
    if (typeof res.status === 'function') {
      return res.status(200).json({ success: false, error: err.message });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: err.message }));
  }
}
