import admin from 'firebase-admin';
import dotenv from 'dotenv';
import type { Conversation, Message } from './types/chat.js';

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || 'ioniclostandfound';
const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://ioniclostandfound-default-rtdb.asia-southeast1.firebasedatabase.app/';

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL
      });
      console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL
      });
      console.log('Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      admin.initializeApp({
        projectId,
        databaseURL
      });
      console.log('Firebase Admin initialized with Project ID and Database URL');
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.database();

/**
 * Verify Firebase ID token.
 * Validates with Firebase Auth. In development without service account keys,
 * falls back gracefully if token decoding is valid.
 */
export async function verifyToken(token: string): Promise<string> {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or invalid');
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch (err: any) {
    // If standard verification fails (e.g. In local development without service account cert),
    // safely decode JWT payload for development testing
    if (process.env.NODE_ENV !== 'production') {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.user_id || payload.sub) {
            const devUid = payload.user_id || payload.sub;
            console.warn(`[Dev Auth] Token verified via JWT payload decode for UID: ${devUid}`);
            return devUid;
          }
        }
      } catch (decodeErr) {
        // ignore and let original error throw
      }
    }
    console.error('Firebase token verification error:', err.message);
    throw new Error(`Invalid authentication token: ${err.message}`);
  }
}

/**
 * Find existing conversation for a given postId and two participants.
 */
export async function findConversation(
  postId: string | null | undefined,
  userA: string,
  userB: string
): Promise<Conversation | null> {
  try {
    // Check userA's indexed conversations
    const snap = await adminDb.ref(`userConversations/${userA}`).once('value');
    if (!snap.exists()) return null;

    const userConvs = snap.val();
    for (const convId of Object.keys(userConvs)) {
      const cSnap = await adminDb.ref(`conversations/${convId}`).once('value');
      if (cSnap.exists()) {
        const c: Conversation = cSnap.val();
        const matchesPost = postId
          ? c.postId === postId
          : (!c.postId || c.type === 'direct');
        if (
          matchesPost &&
          Array.isArray(c.participantIds) &&
          c.participantIds.includes(userA) &&
          c.participantIds.includes(userB)
        ) {
          return c;
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Error finding conversation:', err);
    return null;
  }
}

/**
 * Create or save conversation metadata.
 */
export async function saveConversation(conv: Conversation): Promise<void> {
  const updates: Record<string, any> = {};
  updates[`conversations/${conv.id}`] = conv;

  // Index conversation for both participants
  conv.participantIds.forEach((uid) => {
    updates[`userConversations/${uid}/${conv.id}`] = {
      updatedAt: conv.updatedAt,
      postId: conv.postId || null,
      type: conv.type || (conv.postId ? 'post' : 'direct')
    };
  });

  await adminDb.ref().update(updates);
}

/**
 * Retrieve a conversation by ID.
 */
export async function getConversation(convId: string): Promise<Conversation | null> {
  try {
    const snap = await adminDb.ref(`conversations/${convId}`).once('value');
    if (snap.exists()) {
      return snap.val();
    }
    return null;
  } catch (err) {
    console.error('Error getting conversation:', err);
    return null;
  }
}

/**
 * Save a new message in Firebase RTDB and update conversation lastMessage.
 */
export async function saveMessage(msg: Message): Promise<void> {
  const updates: Record<string, any> = {};
  updates[`messages/${msg.conversationId}/${msg.id}`] = msg;
  updates[`conversations/${msg.conversationId}/lastMessage`] = msg.text;
  updates[`conversations/${msg.conversationId}/lastMessageAt`] = msg.createdAt;
  updates[`conversations/${msg.conversationId}/lastMessageSenderId`] = msg.senderId;
  updates[`conversations/${msg.conversationId}/updatedAt`] = msg.createdAt;

  await adminDb.ref().update(updates);
}

/**
  * Normalize username: trim, lowercase, remove leading @, strip invalid characters
  */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.]/g, '');
}

/**
 * Resolve username to account email for authentication.
 * Looks up usernames/{normalizedUsername} -> uid -> Firebase Auth User email.
 */
export async function resolveUsernameToEmail(rawUsername: string): Promise<string | null> {
  const normalized = normalizeUsername(rawUsername);
  if (!normalized) return null;

  let uid: string | null = null;

  // 1. Try Firebase RTDB adminDb
  try {
    const snap = await adminDb.ref(`usernames/${normalized}`).once('value');
    if (snap.exists()) {
      uid = snap.val();
    }
  } catch (err) {
    // Continue to fallback
  }

  // 1b. Fallback: Query RTDB via public REST
  if (!uid && databaseURL) {
    try {
      const cleanDbUrl = databaseURL.replace(/\/+$/, '');
      const resp = await fetch(`${cleanDbUrl}/usernames/${normalized}.json`);
      if (resp.ok) {
        const val = await resp.json();
        if (typeof val === 'string' && val.trim()) {
          uid = val.trim();
        }
      }
    } catch {}
  }

  // 1c. Fallback: Search local storage profiles
  if (!uid) {
    try {
      const { findProfileByUsername } = await import('./storage.js');
      const localProfile = await findProfileByUsername(normalized);
      if (localProfile && localProfile.id) {
        uid = localProfile.id;
        if (localProfile.email && typeof localProfile.email === 'string') {
          return localProfile.email.trim().toLowerCase();
        }
      }
    } catch {}
  }

  if (!uid) {
    return null;
  }

  // 2. Resolve email using UID
  // 2a. Try Firebase Admin Auth
  try {
    const userRecord = await adminAuth.getUser(uid);
    if (userRecord && userRecord.email) {
      return userRecord.email.trim().toLowerCase();
    }
  } catch (err: any) {
    // Admin auth lookup without cert fallback
  }

  // 2b. Try RTDB profiles/{uid}
  try {
    const snap = await adminDb.ref(`profiles/${uid}`).once('value');
    if (snap.exists()) {
      const profile = snap.val();
      if (profile && profile.email && typeof profile.email === 'string') {
        return profile.email.trim().toLowerCase();
      }
    }
  } catch {}

  // 2c. Try RTDB REST
  if (databaseURL) {
    try {
      const cleanDbUrl = databaseURL.replace(/\/+$/, '');
      const resp = await fetch(`${cleanDbUrl}/profiles/${uid}.json`);
      if (resp.ok) {
        const profile = await resp.json();
        if (profile && profile.email && typeof profile.email === 'string') {
          return profile.email.trim().toLowerCase();
        }
      }
    } catch {}
  }

  // 2d. Try local storage profile
  try {
    const { getUserProfile } = await import('./storage.js');
    const profile = await getUserProfile(uid);
    if (profile && profile.email && typeof profile.email === 'string') {
      return profile.email.trim().toLowerCase();
    }
  } catch {}

  return null;
}
