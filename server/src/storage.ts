import fs from 'fs';
import path from 'path';
import type { Conversation, ConversationThread, Message, AppNotification } from './types/chat.js';
import { adminDb } from './firebaseAdmin.js';

// Data directory for persistent storage
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'chat_storage.json');

interface ChatStorageData {
  conversations: Record<string, Conversation>;
  threads: Record<string, Record<string, ConversationThread>>; // conversationId -> { threadId: ConversationThread }
  messages: Record<string, Record<string, Record<string, Message>>>; // conversationId -> { threadId: { messageId: Message } }
  profiles: Record<
    string,
    {
      id: string;
      name: string;
      username: string;
      email?: string;
      phone?: string;
      avatarUrl?: string | null;
    }
  >;
  notifications: Record<string, Record<string, AppNotification>>; // userId -> { notifId: AppNotification }
}

let store: ChatStorageData = {
  conversations: {},
  threads: {},
  messages: {},
  profiles: {},
  notifications: {}
};

let saveTimeout: NodeJS.Timeout | null = null;

// Ensure storage file exists and load data with migrations
function initStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        store = {
          conversations: parsed.conversations || {},
          threads: parsed.threads || {},
          messages: {},
          profiles: parsed.profiles || {},
          notifications: parsed.notifications || {}
        };

        // 1. Migrate raw messages to 3-level structure (convId -> threadId -> msgId)
        const rawMessages = parsed.messages || {};
        for (const [convId, inner] of Object.entries<any>(rawMessages)) {
          store.messages[convId] = store.messages[convId] || {};
          if (!inner || typeof inner !== 'object') continue;

          for (const [key, val] of Object.entries<any>(inner)) {
            if (!val || typeof val !== 'object') continue;

            // If val has 'text', this is an old 2-level message (key = messageId)
            if (typeof val.text === 'string') {
              const threadId = val.threadId || 'general';
              store.messages[convId][threadId] = store.messages[convId][threadId] || {};
              store.messages[convId][threadId][val.id || key] = {
                id: val.id || key,
                conversationId: convId,
                threadId,
                senderId: val.senderId,
                text: val.text,
                createdAt: val.createdAt || Date.now(),
                status: val.status || 'sent'
              };
            } else {
              // This is already a 3-level thread bucket (key = threadId, val = { msgId: Message })
              store.messages[convId][key] = store.messages[convId][key] || {};
              for (const [mId, mObj] of Object.entries<any>(val)) {
                if (mObj && typeof mObj === 'object') {
                  store.messages[convId][key][mId] = {
                    ...mObj,
                    id: mObj.id || mId,
                    conversationId: convId,
                    threadId: key
                  };
                }
              }
            }
          }
        }

        // 2. Ensure each conversation has at least a general thread
        for (const [convId, conv] of Object.entries(store.conversations)) {
          if (!store.threads[convId]) {
            store.threads[convId] = {};
          }
          if (!store.threads[convId]['general']) {
            store.threads[convId]['general'] = {
              id: 'general',
              conversationId: convId,
              type: 'general',
              title: 'General',
              createdAt: conv.createdAt || Date.now(),
              updatedAt: conv.updatedAt || Date.now(),
              lastMessage: conv.lastMessage,
              lastMessageAt: conv.lastMessageAt,
              lastMessageSenderId: conv.lastMessageSenderId,
              unreadCounts: { ...(conv.unreadCounts || {}) }
            };
          }
        }

        // 3. Deduplicate / merge conversations by user pair so there is exactly ONE per pair
        const pairMap = new Map<string, Conversation[]>();
        for (const conv of Object.values(store.conversations)) {
          if (Array.isArray(conv.participantIds) && conv.participantIds.length >= 2) {
            const pairKey = [...conv.participantIds].sort().join('__');
            const list = pairMap.get(pairKey) || [];
            list.push(conv);
            pairMap.set(pairKey, list);
          }
        }

        for (const [, convList] of pairMap.entries()) {
          if (convList.length > 1) {
            // Sort so direct or oldest conversation is primary
            convList.sort((a, b) => {
              if (a.type === 'direct' && b.type !== 'direct') return -1;
              if (b.type === 'direct' && a.type !== 'direct') return 1;
              return a.createdAt - b.createdAt;
            });

            const primary = convList[0];
            store.threads[primary.id] = store.threads[primary.id] || {};
            store.messages[primary.id] = store.messages[primary.id] || {};

            for (let i = 1; i < convList.length; i++) {
              const dup = convList[i];
              // Map dup's threads/messages into primary
              if (dup.postId) {
                const threadId = `post_${dup.postId}`;
                store.threads[primary.id][threadId] = {
                  id: threadId,
                  conversationId: primary.id,
                  type: 'post',
                  postId: dup.postId,
                  title: dup.postId,
                  createdAt: dup.createdAt,
                  updatedAt: dup.updatedAt,
                  lastMessage: dup.lastMessage,
                  lastMessageAt: dup.lastMessageAt,
                  lastMessageSenderId: dup.lastMessageSenderId,
                  unreadCounts: dup.unreadCounts || {}
                };

                // Migrate messages into this post thread
                store.messages[primary.id][threadId] = store.messages[primary.id][threadId] || {};
                const dupMsgs = store.messages[dup.id] || {};
                for (const threadBucket of Object.values(dupMsgs)) {
                  for (const [mId, m] of Object.entries(threadBucket)) {
                    store.messages[primary.id][threadId][mId] = {
                      ...m,
                      conversationId: primary.id,
                      threadId
                    };
                  }
                }
              } else {
                // Merge direct messages into primary's general thread
                store.messages[primary.id]['general'] = store.messages[primary.id]['general'] || {};
                const dupMsgs = store.messages[dup.id] || {};
                for (const threadBucket of Object.values(dupMsgs)) {
                  for (const [mId, m] of Object.entries(threadBucket)) {
                    store.messages[primary.id]['general'][mId] = {
                      ...m,
                      conversationId: primary.id,
                      threadId: 'general'
                    };
                  }
                }
              }

              // Remove duplicate conversation
              delete store.conversations[dup.id];
              delete store.threads[dup.id];
              delete store.messages[dup.id];
            }

            // Recalculate unread counts on primary
            recalculateConversationUnread(primary.id);
          }
        }

        console.log(
          `[Persistent Storage] Loaded ${Object.keys(store.conversations).length} user-pair conversations, ` +
            `${Object.keys(store.threads).length} thread groups from ${STORAGE_FILE}`
        );
        persistToDiskNow();
        return;
      }
    }

    // Initialize fresh file
    persistToDiskNow();
  } catch (err) {
    console.error('[Persistent Storage] Initialization error:', err);
  }
}

function persistToDiskNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${STORAGE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tempFile, STORAGE_FILE);
  } catch (err) {
    console.error('[Persistent Storage] Failed to write to disk:', err);
  }
}

function schedulePersist() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    persistToDiskNow();
    saveTimeout = null;
  }, 100);
}

function recalculateConversationUnread(convId: string): void {
  const conv = store.conversations[convId];
  if (!conv) return;

  const convThreads = store.threads[convId] || {};
  const sumUnread: Record<string, number> = {};

  for (const pId of conv.participantIds) {
    sumUnread[pId] = 0;
  }

  for (const thread of Object.values(convThreads)) {
    if (thread.unreadCounts) {
      for (const [pId, count] of Object.entries(thread.unreadCounts)) {
        sumUnread[pId] = (sumUnread[pId] || 0) + (typeof count === 'number' ? count : 0);
      }
    }
  }

  conv.unreadCounts = sumUnread;
}

// Initialize on module import
initStorage();

/**
 * Save or update a conversation.
 */
export async function saveConversation(conv: Conversation): Promise<void> {
  store.conversations[conv.id] = { ...conv };
  schedulePersist();

  // Background sync to Firebase RTDB
  try {
    if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
      const updates: Record<string, any> = {};
      updates[`conversations/${conv.id}`] = {
        id: conv.id,
        participantIds: conv.participantIds,
        participantDetails: conv.participantDetails || {},
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastMessage: conv.lastMessage || null,
        lastMessageAt: conv.lastMessageAt || null,
        lastMessageSenderId: conv.lastMessageSenderId || null,
        lastMessageThreadId: conv.lastMessageThreadId || null,
        lastMessageThreadTitle: conv.lastMessageThreadTitle || null,
        unreadCounts: conv.unreadCounts || {}
      };

      conv.participantIds.forEach((uid) => {
        updates[`userConversations/${uid}/${conv.id}`] = {
          updatedAt: conv.updatedAt,
          lastMessageAt: conv.lastMessageAt || conv.updatedAt
        };
      });

      adminDb.ref().update(updates).catch(() => {});
    }
  } catch {}
}

/**
 * Retrieve a conversation by ID, populated with its threads.
 */
export async function getConversation(convId: string): Promise<Conversation | null> {
  const conv = store.conversations[convId];
  if (!conv) return null;
  return {
    ...conv,
    threads: { ...(store.threads[convId] || {}) }
  };
}

/**
 * Find the single conversation between two users regardless of post.
 */
export async function findConversationForPair(
  userA: string,
  userB: string
): Promise<Conversation | null> {
  for (const conv of Object.values(store.conversations)) {
    if (
      Array.isArray(conv.participantIds) &&
      conv.participantIds.includes(userA) &&
      conv.participantIds.includes(userB)
    ) {
      return {
        ...conv,
        threads: { ...(store.threads[conv.id] || {}) }
      };
    }
  }
  return null;
}

/**
 * Legacy findConversation for backward compatibility.
 */
export async function findConversation(
  postId: string | null | undefined,
  userA: string,
  userB: string
): Promise<Conversation | null> {
  return findConversationForPair(userA, userB);
}

/**
 * Retrieve all threads for a conversation, sorted by updatedAt descending.
 */
export async function getThreads(conversationId: string): Promise<ConversationThread[]> {
  const threadMap = store.threads[conversationId] || {};
  const list = Object.values(threadMap);
  list.sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt));
  return list.map((t) => ({ ...t }));
}

/**
 * Retrieve a specific thread by conversation ID and thread ID.
 */
export async function getThread(
  conversationId: string,
  threadId: string
): Promise<ConversationThread | null> {
  const threadMap = store.threads[conversationId];
  if (!threadMap || !threadMap[threadId]) return null;
  return { ...threadMap[threadId] };
}

/**
 * Save or update a conversation thread.
 */
export async function saveThread(thread: ConversationThread): Promise<void> {
  if (!store.threads[thread.conversationId]) {
    store.threads[thread.conversationId] = {};
  }
  store.threads[thread.conversationId][thread.id] = { ...thread };
  recalculateConversationUnread(thread.conversationId);
  schedulePersist();

  try {
    if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
      adminDb
        .ref(`conversationThreads/${thread.conversationId}/${thread.id}`)
        .set(thread)
        .catch(() => {});
    }
  } catch {}
}

/**
 * Retrieve all conversations for a specific user ID, sorted by most recent activity.
 */
export async function getUserConversations(uid: string): Promise<Conversation[]> {
  const results = Object.values(store.conversations).filter(
    (c) => Array.isArray(c.participantIds) && c.participantIds.includes(uid)
  );

  results.sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt));

  return results.map((c) => ({
    ...c,
    threads: { ...(store.threads[c.id] || {}) }
  }));
}

/**
 * Save a new message inside a specific conversation thread.
 */
export async function saveMessage(msg: Message): Promise<void> {
  const { conversationId, threadId, id } = msg;

  if (!store.messages[conversationId]) {
    store.messages[conversationId] = {};
  }
  if (!store.messages[conversationId][threadId]) {
    store.messages[conversationId][threadId] = {};
  }
  store.messages[conversationId][threadId][id] = { ...msg };

  // Update thread metadata & unread counts
  if (!store.threads[conversationId]) {
    store.threads[conversationId] = {};
  }
  let thread = store.threads[conversationId][threadId];
  if (!thread) {
    thread = {
      id: threadId,
      conversationId,
      type: threadId === 'general' ? 'general' : 'post',
      postId: threadId.startsWith('post_') ? threadId.replace('post_', '') : null,
      title: threadId === 'general' ? 'General' : 'Post Discussion',
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
      unreadCounts: {}
    };
    store.threads[conversationId][threadId] = thread;
  }

  const summary = (msg.text || '').trim() || (msg.imageUrl ? 'Sent a photo' : '');

  thread.lastMessage = summary;
  thread.lastMessageAt = msg.createdAt;
  thread.lastMessageSenderId = msg.senderId;
  thread.updatedAt = msg.createdAt;

  if (!thread.unreadCounts) thread.unreadCounts = {};
  thread.unreadCounts[msg.senderId] = 0;

  const conv = store.conversations[conversationId];
  if (conv) {
    conv.lastMessage = summary;
    conv.lastMessageAt = msg.createdAt;
    conv.lastMessageSenderId = msg.senderId;
    conv.lastMessageThreadId = threadId;
    conv.lastMessageThreadTitle = thread.title;
    conv.updatedAt = msg.createdAt;

    // Increment thread unread count for other participants
    for (const pId of conv.participantIds) {
      if (pId !== msg.senderId) {
        thread.unreadCounts[pId] = (thread.unreadCounts[pId] || 0) + 1;
      }
    }

    recalculateConversationUnread(conversationId);
  }

  schedulePersist();

  // Sync to Firebase RTDB in background
  try {
    if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
      const updates: Record<string, any> = {};
      updates[`messages/${conversationId}/${threadId}/${msg.id}`] = msg;
      updates[`conversationThreads/${conversationId}/${threadId}`] = thread;
      if (conv) {
        updates[`conversations/${conversationId}`] = {
          id: conv.id,
          participantIds: conv.participantIds,
          participantDetails: conv.participantDetails || {},
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          lastMessageSenderId: conv.lastMessageSenderId,
          lastMessageThreadId: conv.lastMessageThreadId,
          lastMessageThreadTitle: conv.lastMessageThreadTitle,
          unreadCounts: conv.unreadCounts || {}
        };
      }
      adminDb.ref().update(updates).catch(() => {});
    }
  } catch {}
}

/**
 * Get all messages for a given thread, sorted chronologically.
 */
export async function getThreadMessages(
  conversationId: string,
  threadId: string
): Promise<Message[]> {
  const threadMsgs = store.messages[conversationId]?.[threadId] || {};
  const list = Object.values(threadMsgs);
  list.sort((a, b) => a.createdAt - b.createdAt);
  return list.map((m) => ({ ...m }));
}

/**
 * Fallback for legacy calls: gets messages for all threads or general.
 */
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const convMsgs = store.messages[conversationId] || {};
  const list: Message[] = [];
  for (const threadBucket of Object.values(convMsgs)) {
    list.push(...Object.values(threadBucket));
  }
  list.sort((a, b) => a.createdAt - b.createdAt);
  return list;
}

/**
 * Mark an entire conversation (or specific thread) as read for a given user.
 */
export async function markConversationRead(
  conversationId: string,
  uid: string,
  threadId?: string
): Promise<Conversation | null> {
  const conv = store.conversations[conversationId];
  if (!conv) return null;

  const convThreads = store.threads[conversationId] || {};

  if (threadId && convThreads[threadId]) {
    if (!convThreads[threadId].unreadCounts) {
      convThreads[threadId].unreadCounts = {};
    }
    convThreads[threadId].unreadCounts[uid] = 0;
  } else {
    // Mark all threads read for this user
    for (const t of Object.values(convThreads)) {
      if (!t.unreadCounts) t.unreadCounts = {};
      t.unreadCounts[uid] = 0;
    }
  }

  recalculateConversationUnread(conversationId);
  schedulePersist();

  // Sync to RTDB
  try {
    if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
      const updates: Record<string, any> = {};
      updates[`conversations/${conversationId}/unreadCounts/${uid}`] =
        conv.unreadCounts?.[uid] || 0;
      if (threadId) {
        updates[`conversationThreads/${conversationId}/${threadId}/unreadCounts/${uid}`] = 0;
      }
      adminDb.ref().update(updates).catch(() => {});
    }
  } catch {}

  return {
    ...conv,
    threads: { ...convThreads }
  };
}

/**
 * Store user profile information for cross-client participant rendering.
 */
export async function saveUserProfile(profile: {
  id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
}): Promise<void> {
  if (!profile || !profile.id) return;
  store.profiles[profile.id] = { ...profile };
  schedulePersist();
}

/**
 * Retrieve user profile information.
 */
export async function getUserProfile(uid: string) {
  return store.profiles[uid] || null;
}

/**
 * Search user profile by normalized username.
 */
export async function findProfileByUsername(rawUsername: string) {
  const norm = rawUsername.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.]/g, '');
  if (!norm) return null;
  for (const profile of Object.values(store.profiles)) {
    if (profile.username && profile.username.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.]/g, '') === norm) {
      return profile;
    }
  }
  return null;
}

/**
 * Save a notification for a user.
 */
export async function saveNotification(userId: string, notif: AppNotification): Promise<void> {
  if (!store.notifications[userId]) {
    store.notifications[userId] = {};
  }
  store.notifications[userId][notif.id] = { ...notif };
  schedulePersist();

  try {
    if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
      adminDb.ref(`notifications/${userId}/${notif.id}`).set(notif).catch(() => {});
    }
  } catch {}
}

/**
 * Get all notifications for a given user, newest first.
 */
export async function getUserNotifications(userId: string): Promise<AppNotification[]> {
  const userNotifs = store.notifications[userId] || {};
  const list = Object.values(userNotifs);
  list.sort((a, b) => b.createdAt - a.createdAt);
  return list.map((n) => ({ ...n }));
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(
  userId: string,
  notifId: string
): Promise<AppNotification | null> {
  if (store.notifications[userId] && store.notifications[userId][notifId]) {
    store.notifications[userId][notifId].read = true;
    schedulePersist();

    try {
      if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
        adminDb.ref(`notifications/${userId}/${notifId}/read`).set(true).catch(() => {});
      }
    } catch {}

    return { ...store.notifications[userId][notifId] };
  }
  return null;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (store.notifications[userId]) {
    Object.values(store.notifications[userId]).forEach((n) => {
      n.read = true;
    });
    schedulePersist();

    try {
      if (adminDb && process.env.FIREBASE_SERVICE_ACCOUNT) {
        const updates: Record<string, any> = {};
        Object.keys(store.notifications[userId]).forEach((id) => {
          updates[`notifications/${userId}/${id}/read`] = true;
        });
        adminDb.ref().update(updates).catch(() => {});
      }
    } catch {}
  }
}
