import type { IncomingMessage, ServerResponse } from 'http';
import { resolveUsernameToEmail } from '../../server/src/firebaseAdmin.js';
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

  // Parse body if not pre-parsed
  let body = req.body;
  if (!body && typeof (req as any).on === 'function') {
    try {
      const buffers = [];
      for await (const chunk of req as any) {
        buffers.push(chunk);
      }
      const raw = Buffer.concat(buffers).toString();
      if (raw) body = JSON.parse(raw);
    } catch {}
  }

  try {
    const { username } = body || {};
    if (!username || typeof username !== 'string' || !username.trim()) {
      if (typeof res.status === 'function') {
        return res.status(400).json({ success: false, error: 'Username is required.' });
      }
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Username is required.' }));
    }

    const email = await resolveUsernameToEmail(username);
    if (!email) {
      if (typeof res.status === 'function') {
        return res.status(404).json({ success: false, error: 'Account not found.' });
      }
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Account not found.' }));
    }

    if (typeof res.status === 'function') {
      return res.status(200).json({ success: true, email });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, email }));
  } catch (err: any) {
    console.warn('[resolve-username error]:', err.message);
    if (typeof res.status === 'function') {
      return res.status(404).json({ success: false, error: 'Account not found.' });
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'Account not found.' }));
  }
}
