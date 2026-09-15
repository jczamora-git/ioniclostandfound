import type { IncomingMessage, ServerResponse } from 'http';
import { createRouteHandler } from 'uploadthing/express';
import { uploadRouter, utapi } from '../server/src/uploadthing.js';
import { handleCors } from '../server/src/cors.js';

const uploadRouteHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN
  }
});

export default async function handler(
  req: IncomingMessage & { method?: string; headers: any; body?: any; url?: string; query?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any; end: (data?: any) => any; setHeader: (name: string, value: any) => any }
) {
  if (handleCors(req, res)) return;

  const url = req.url || '';

  // Support file deletion via /api/uploadthing?action=delete or /api/uploadthing/delete
  if (url.includes('/delete') || req.query?.action === 'delete') {
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

  if (!process.env.UPLOADTHING_TOKEN) {
    console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
    if (typeof res.status === 'function') {
      return res.status(500).json({
        error: 'Missing token. Please set the UPLOADTHING_TOKEN environment variable'
      });
    }
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Missing token. Please set the UPLOADTHING_TOKEN environment variable'
      })
    );
  }

  return (uploadRouteHandler as any)(req, res);
}
