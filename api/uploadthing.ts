import type { IncomingMessage, ServerResponse } from 'http';
import {
  createUploadthing,
  createRouteHandler,
  UTApi,
  UploadThingError,
  type FileRouter
} from 'uploadthing/server';

const f = createUploadthing();

const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN
});

// Define isolated UploadThing router directly in the serverless function
const uploadRouter = {
  avatarUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1
    }
  })
    .middleware(async ({ req }) => {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
      const devUid = req.headers.get('x-dev-uid') || req.headers.get('x-auth-token') || '';
      const userId = devUid.replace(/^dev_/, '') || authHeader.replace(/^Bearer (dev_)?/, '') || 'anonymous_user';
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      console.log(`[UploadThing] Avatar uploaded by ${metadata.userId} -> Key: ${file.key}`);
      return {
        uploadedBy: metadata.userId,
        fileKey: file.key,
        fileUrl
      };
    }),

  postImageUploader: f({
    image: {
      maxFileSize: '8MB',
      maxFileCount: 1
    }
  })
    .middleware(async ({ req }) => {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
      const devUid = req.headers.get('x-dev-uid') || req.headers.get('x-auth-token') || '';
      const userId = devUid.replace(/^dev_/, '') || authHeader.replace(/^Bearer (dev_)?/, '') || 'anonymous_user';
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      console.log(`[UploadThing] Post image uploaded by ${metadata.userId} -> Key: ${file.key}`);
      return {
        uploadedBy: metadata.userId,
        fileKey: file.key,
        fileUrl
      };
    }),

  messageImageUploader: f({
    image: {
      maxFileSize: '8MB',
      maxFileCount: 1
    }
  })
    .middleware(async ({ req }) => {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
      const devUid = req.headers.get('x-dev-uid') || req.headers.get('x-auth-token') || '';
      const userId = devUid.replace(/^dev_/, '') || authHeader.replace(/^Bearer (dev_)?/, '') || 'anonymous_user';
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      console.log(`[UploadThing] Message image uploaded by ${metadata.userId} -> Key: ${file.key}`);
      return {
        uploadedBy: metadata.userId,
        fileKey: file.key,
        fileUrl
      };
    })
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

const uploadRouteHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN
  }
});

function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-uploadthing-version, x-uploadthing-package, x-auth-token, x-dev-uid'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export default async function handler(
  req: IncomingMessage & { method?: string; headers: any; body?: any; url?: string; query?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any; end: (data?: any) => any; setHeader: (name: string, value: any) => any }
) {
  if (handleCors(req, res)) return;

  const rawUrl = req.url || '';
  const urlObj = new URL(rawUrl, 'https://localhost');
  const slug = urlObj.searchParams.get('slug') || '';
  const actionType = urlObj.searchParams.get('actionType') || '';

  console.log(`[UploadThing] request ${slug || actionType || 'handler'} (actionType: ${actionType})`);
  console.log(`[UploadThing] configured: ${Boolean(process.env.UPLOADTHING_TOKEN)}`);

  // Handle file deletion endpoint: /api/uploadthing?action=delete or body.action === 'delete'
  if (rawUrl.includes('/delete') || urlObj.searchParams.get('action') === 'delete' || req.query?.action === 'delete') {
    try {
      let body = req.body;
      if (!body && typeof (req as any).on === 'function') {
        const buffers: Buffer[] = [];
        for await (const chunk of req as any) {
          buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const text = Buffer.concat(buffers).toString('utf-8');
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {}
        }
      }

      const { key, keys } = body || {};
      const targetKeys: string[] = Array.isArray(keys)
        ? keys.filter(Boolean)
        : key && typeof key === 'string'
        ? [key]
        : [];

      if (targetKeys.length === 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: false, error: 'No file key provided for deletion.' }));
      }

      if (process.env.UPLOADTHING_TOKEN) {
        await utapi.deleteFiles(targetKeys);
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, deleted: targetKeys }));
    } catch (err: any) {
      console.warn('[UploadThing] Delete warning:', err.message);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  if (!process.env.UPLOADTHING_TOKEN) {
    console.error('[UploadThing] UPLOADTHING_TOKEN is missing from environment');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Missing token. Please set the UPLOADTHING_TOKEN environment variable'
      })
    );
  }

  try {
    // Build standard Web Request for UploadThing v7 server handler
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const fullUrl = new URL(rawUrl, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    let body: any = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req as any) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      body = Buffer.concat(chunks);
    }

    const webReq = new Request(fullUrl.toString(), {
      method: req.method || 'GET',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && body && body.length > 0 ? body : undefined
    });

    const webRes = await uploadRouteHandler(webReq);

    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const resText = await webRes.text();
    return res.end(resText);
  } catch (err: any) {
    console.error('[UploadThing] Handler execution error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: err.message || 'Internal UploadThing Server Error'
      })
    );
  }
}
