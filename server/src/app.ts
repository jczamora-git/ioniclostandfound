import express from 'express';
import cors from 'cors';
import { isOriginAllowed } from './cors.js';
import { createRouteHandler } from 'uploadthing/express';
import { uploadRouter, utapi } from './uploadthing.js';
import { resolveUsernameToEmail } from './firebaseAdmin.js';
import {
  getUserConversations,
  getConversationMessages,
  getThreads,
  getThreadMessages,
  saveUserProfile,
  getUserProfile,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from './storage.js';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, origin || true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  })
);

app.use(express.json());

// Health Check
app.get(['/api/health', '/health'], (req, res) => {
  const isConfigured = Boolean(process.env.UPLOADTHING_TOKEN);
  if (!isConfigured) {
    console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
  }
  res.json({
    ok: true,
    uploadthingConfigured: isConfigured
  });
});

// UploadThing Upload Route Handler
app.use(
  '/api/uploadthing',
  (req, res, next) => {
    // If delete subpath called through uploadthing middleware
    if (req.path === '/delete') {
      return next();
    }
    if (!process.env.UPLOADTHING_TOKEN) {
      console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
      return res.status(500).json({
        error: 'Missing token. Please set the UPLOADTHING_TOKEN environment variable'
      });
    }
    next();
  },
  createRouteHandler({
    router: uploadRouter,
    config: {
      token: process.env.UPLOADTHING_TOKEN
    }
  })
);

// UploadThing File Deletion Endpoint
app.post('/api/uploadthing/delete', async (req, res) => {
  try {
    const { key, keys } = req.body || {};
    const targetKeys: string[] = Array.isArray(keys)
      ? keys.filter(Boolean)
      : key && typeof key === 'string'
      ? [key]
      : [];

    if (targetKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'No file key provided for deletion.' });
    }

    if (process.env.UPLOADTHING_TOKEN) {
      await utapi.deleteFiles(targetKeys);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('[UploadThing Mock Delete] Deleted keys:', targetKeys);
    }

    return res.json({ success: true, deleted: targetKeys });
  } catch (err: any) {
    console.warn('[UploadThing Delete Warning]:', err.message);
    return res.json({ success: false, error: err.message });
  }
});

// Username resolution endpoint for login (email/username + password)
app.post('/api/auth/resolve-username', async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Username is required.' });
    }

    const email = await resolveUsernameToEmail(username);
    if (!email) {
      return res.status(404).json({ success: false, error: 'Account not found.' });
    }

    return res.json({ success: true, email });
  } catch (err: any) {
    console.warn('[resolve-username error]:', err.message);
    return res.status(404).json({ success: false, error: 'Account not found.' });
  }
});

// REST Endpoints
app.get('/api/conversations/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const convs = await getUserConversations(uid);
    res.json({ success: true, conversations: convs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversations/:conversationId/threads', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const threads = await getThreads(conversationId);
    res.json({ success: true, threads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/messages/:conversationId/:threadId', async (req, res) => {
  try {
    const { conversationId, threadId } = req.params;
    const msgs = await getThreadMessages(conversationId, threadId);
    res.json({ success: true, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const msgs = await getConversationMessages(conversationId);
    res.json({ success: true, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    const profile = req.body;
    if (profile && profile.id) {
      await saveUserProfile(profile);
      return res.json({ success: true, profile });
    }
    res.status(400).json({ success: false, error: 'Invalid profile data' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/profiles/:uid', async (req, res) => {
  try {
    const profile = await getUserProfile(req.params.uid);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/notifications/:uid', async (req, res) => {
  try {
    const list = await getUserNotifications(req.params.uid);
    res.json({ success: true, notifications: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/:uid/read/:notifId', async (req, res) => {
  try {
    const updated = await markNotificationRead(req.params.uid, req.params.notifId);
    res.json({ success: true, notification: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/:uid/read-all', async (req, res) => {
  try {
    await markAllNotificationsRead(req.params.uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default app;
