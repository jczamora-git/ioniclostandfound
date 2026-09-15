import { ref } from 'vue';
import { ref as dbRef, get, update } from 'firebase/database';
import { db } from '../firebase';
import { getApiServerUrl } from '../services/socket';
import { getSessionUser } from './useAuth';
import type { ChatMessage } from '../types/message';
import type { Conversation, ConversationThread } from '../types/conversation';

const isConnected = ref(true);

type ConversationUpdatedCallback = (conv: Conversation) => void;
type ThreadUpdatedCallback = (thread: ConversationThread) => void;
type MessageNewCallback = (msg: ChatMessage) => void;

const conversationUpdatedCallbacks = new Set<ConversationUpdatedCallback>();
const threadUpdatedCallbacks = new Set<ThreadUpdatedCallback>();
const messageNewCallbacks = new Set<MessageNewCallback>();

export function onConversationUpdated(cb: ConversationUpdatedCallback) {
  conversationUpdatedCallbacks.add(cb);
  return () => {
    conversationUpdatedCallbacks.delete(cb);
  };
}

export function onThreadUpdated(cb: ThreadUpdatedCallback) {
  threadUpdatedCallbacks.add(cb);
  return () => {
    threadUpdatedCallbacks.delete(cb);
  };
}

export function onMessageNew(cb: MessageNewCallback) {
  messageNewCallbacks.add(cb);
  return () => {
    messageNewCallbacks.delete(cb);
  };
}

/**
 * Shared stateless chat composable providing one-time reads and writes
 * via Firebase Realtime Database and backend HTTP REST fallback.
 */
export function useChatSocket() {
  const initSocket = async () => {
    return null;
  };

  /**
   * Create or retrieve existing 1-to-1 conversation and target thread.
   */
  const createOrGetConversation = async (
    postId: string | null | undefined,
    otherUserId: string,
    senderProfile?: { name: string; username: string; avatarUrl?: string | null },
    otherUserProfile?: { name: string; username: string; avatarUrl?: string | null },
    extra?: {
      threadId?: string;
      postTitle?: string;
      postSubtitle?: string;
      postLocation?: string;
    }
  ): Promise<{ conversation: Conversation; thread: ConversationThread; threads: ConversationThread[] }> => {
    const session = await getSessionUser();
    const myUid = session?.uid;
    if (!myUid) {
      throw new Error('You must be signed in to access conversations.');
    }

    // Deterministic conversation ID for user pair
    const pairKey = [myUid, otherUserId].sort().join('__');
    const convId = `conv_${pairKey}`;
    const now = Date.now();

    const targetThreadId =
      extra?.threadId || (postId ? `post_${postId}` : 'general');
    const targetThreadTitle =
      extra?.postTitle || (postId ? 'Post Discussion' : 'General');

    // 1. Try reading existing conversation from RTDB
    let existingConv: Conversation | null = null;
    try {
      const snap = await get(dbRef(db, `conversations/${convId}`));
      if (snap.exists()) {
        existingConv = snap.val();
      }
    } catch {}

    const participantDetails: Record<string, any> = {
      ...(existingConv?.participantDetails || {})
    };

    if (senderProfile) {
      participantDetails[myUid] = {
        name: senderProfile.name,
        username: senderProfile.username,
        avatarUrl: senderProfile.avatarUrl || null
      };
    }
    if (otherUserProfile) {
      participantDetails[otherUserId] = {
        name: otherUserProfile.name,
        username: otherUserProfile.username,
        avatarUrl: otherUserProfile.avatarUrl || null
      };
    }

    const conversation: Conversation = {
      id: convId,
      participantIds: [myUid, otherUserId],
      participantDetails,
      type: 'direct',
      createdAt: existingConv?.createdAt || now,
      updatedAt: now,
      lastMessage: existingConv?.lastMessage || undefined,
      lastMessageAt: existingConv?.lastMessageAt || undefined,
      lastMessageSenderId: existingConv?.lastMessageSenderId || undefined,
      unreadCounts: existingConv?.unreadCounts || { [myUid]: 0, [otherUserId]: 0 }
    };

    const thread: ConversationThread = {
      id: targetThreadId,
      conversationId: convId,
      type: targetThreadId === 'general' ? 'general' : 'post',
      postId: postId || undefined,
      title: targetThreadTitle,
      postSubtitle: extra?.postSubtitle,
      postLocation: extra?.postLocation,
      createdAt: now,
      updatedAt: now
    };

    // Save to RTDB
    try {
      const updates: Record<string, any> = {};
      updates[`conversations/${convId}`] = conversation;
      updates[`userConversations/${myUid}/${convId}`] = {
        updatedAt: now,
        lastMessageAt: conversation.lastMessageAt || now
      };
      updates[`userConversations/${otherUserId}/${convId}`] = {
        updatedAt: now,
        lastMessageAt: conversation.lastMessageAt || now
      };
      updates[`conversationThreads/${convId}/${targetThreadId}`] = thread;
      updates[`conversationThreads/${convId}/general`] = {
        id: 'general',
        conversationId: convId,
        type: 'general',
        title: 'General',
        createdAt: existingConv?.createdAt || now,
        updatedAt: now
      };

      await update(dbRef(db), updates);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useChatSocket] Firebase RTDB update note:', err);
      }
    }

    const threadsList: ConversationThread[] = [
      {
        id: 'general',
        conversationId: convId,
        type: 'general',
        title: 'General',
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    ];
    if (targetThreadId !== 'general') {
      threadsList.push(thread);
    }

    return {
      conversation,
      thread,
      threads: threadsList
    };
  };

  /**
   * Fetch all conversations for active user directly from Firebase RTDB.
   */
  const getConversationList = async (): Promise<Conversation[]> => {
    const session = await getSessionUser();
    const myUid = session?.uid;
    if (!myUid) return [];

    try {
      // 1. Check userConversations index
      const userConvsSnap = await get(dbRef(db, `userConversations/${myUid}`));
      if (userConvsSnap.exists()) {
        const convIds = Object.keys(userConvsSnap.val() || {});
        if (convIds.length > 0) {
          const snaps = await Promise.all(
            convIds.map((cid) => get(dbRef(db, `conversations/${cid}`)))
          );
          const list: Conversation[] = [];
          for (const s of snaps) {
            if (s.exists()) {
              list.push(s.val());
            }
          }
          if (list.length > 0) return list;
        }
      }

      // 2. Direct conversations scan fallback
      const allConvsSnap = await get(dbRef(db, 'conversations'));
      if (allConvsSnap.exists()) {
        const val = allConvsSnap.val();
        const list: Conversation[] = [];
        Object.values(val).forEach((c: any) => {
          if (c && Array.isArray(c.participantIds) && c.participantIds.includes(myUid)) {
            list.push(c);
          }
        });
        return list;
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useChatSocket] RTDB conversation fetch note:', err);
      }
    }

    return [];
  };

  /**
   * Fetch all threads for a specific conversation directly from Firebase RTDB.
   */
  const getThreads = async (conversationId: string): Promise<ConversationThread[]> => {
    try {
      const snap = await get(dbRef(db, `conversationThreads/${conversationId}`));
      if (snap.exists()) {
        const threads: ConversationThread[] = [];
        snap.forEach((c) => {
          const val = c.val();
          if (val) threads.push({ ...val, id: c.key || val.id });
        });
        if (threads.length > 0) return threads;
      }
    } catch {}

    return [
      {
        id: 'general',
        conversationId,
        type: 'general',
        title: 'General',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  };

  /**
   * Fetch message history for a conversation directly from Firebase RTDB.
   */
  const getConversationMessages = async (
    conversationId: string,
    threadId = 'all'
  ): Promise<ChatMessage[]> => {
    const list: ChatMessage[] = [];

    try {
      const snap = await get(dbRef(db, `messages/${conversationId}`));
      if (snap.exists()) {
        snap.forEach((childSnap) => {
          const val = childSnap.val();
          if (!val) return;
          if (typeof val.text === 'string' || val.senderId) {
            // Flat message: messages/{conversationId}/{messageId}
            const mId = childSnap.key || val.id;
            list.push({
              id: mId,
              conversationId,
              threadId: val.threadId || 'general',
              senderId: val.senderId,
              text: val.text || '',
              imageUrl: val.imageUrl || null,
              imageKey: val.imageKey || null,
              createdAt: val.createdAt || Date.now(),
              status: val.status || 'sent'
            });
          } else if (typeof val === 'object') {
            // 3-level thread bucket: messages/{conversationId}/{threadId}/{messageId}
            const tKey = childSnap.key || 'general';
            childSnap.forEach((mSnap) => {
              const mVal = mSnap.val();
              const mId = mSnap.key || mVal?.id;
              if (mVal && mId) {
                list.push({
                  id: mId,
                  conversationId,
                  threadId: mVal.threadId || tKey,
                  senderId: mVal.senderId,
                  text: mVal.text || '',
                  imageUrl: mVal.imageUrl || null,
                  imageKey: mVal.imageKey || null,
                  createdAt: mVal.createdAt || Date.now(),
                  status: mVal.status || 'sent'
                });
              }
            });
          }
        });

        if (list.length > 0) {
          if (threadId !== 'all') {
            return list.filter((m) => m.threadId === threadId);
          }
          return list;
        }
      }
    } catch {}

    return list;
  };

  /**
   * Send message via Firebase RTDB writes.
   */
  const sendMessage = async (
    conversationId: string,
    text: string,
    threadId = 'general',
    imageUrl?: string | null,
    imageKey?: string | null
  ): Promise<ChatMessage> => {
    const session = await getSessionUser();
    const myUid = session?.uid;
    if (!myUid) {
      throw new Error('You must be signed in to send messages.');
    }

    const now = Date.now();
    const messageId = `msg_${now}_${Math.random().toString(36).substring(2, 8)}`;

    const message: ChatMessage = {
      id: messageId,
      conversationId,
      threadId,
      senderId: myUid,
      text: text || '',
      imageUrl: imageUrl || null,
      imageKey: imageKey || null,
      createdAt: now,
      status: 'sent'
    };

    try {
      const updates: Record<string, any> = {};
      // Save in both flat and thread paths for maximum compatibility
      updates[`messages/${conversationId}/${messageId}`] = message;
      updates[`messages/${conversationId}/${threadId}/${messageId}`] = message;

      // Update conversation metadata
      updates[`conversations/${conversationId}/lastMessage`] = text || (imageUrl ? '📷 Photo' : 'Message');
      updates[`conversations/${conversationId}/lastMessageAt`] = now;
      updates[`conversations/${conversationId}/lastMessageSenderId`] = myUid;
      updates[`conversations/${conversationId}/lastMessageThreadId`] = threadId;
      updates[`conversations/${conversationId}/updatedAt`] = now;

      // Update userConversations timestamp
      updates[`userConversations/${myUid}/${conversationId}/updatedAt`] = now;
      updates[`userConversations/${myUid}/${conversationId}/lastMessageAt`] = now;

      await update(dbRef(db), updates);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useChatSocket] Message persistence note:', err);
      }
    }

    return message;
  };

  /**
   * Mark conversation as read.
   */
  const markConversationAsRead = async (
    conversationId: string,
    threadId?: string
  ): Promise<Conversation | null> => {
    const session = await getSessionUser();
    const myUid = session?.uid;
    if (!myUid) return null;

    try {
      const updates: Record<string, any> = {};
      updates[`conversations/${conversationId}/unreadCounts/${myUid}`] = 0;
      if (threadId) {
        updates[`conversationThreads/${conversationId}/${threadId}/unreadCounts/${myUid}`] = 0;
      }
      await update(dbRef(db), updates);
    } catch {}

    return null;
  };

  // Safe typed helpers for lifecycle compatibility
  const joinConversation = async (_conversationId?: string, _threadId?: string) => {};
  const joinThread = async (_conversationId?: string, _threadId?: string) => {};
  const leaveThread = async (_conversationId?: string, _threadId?: string) => {};
  const leaveConversation = async (_conversationId?: string) => {};
  const emitTypingStart = async (_conversationId?: string, _threadId?: string) => {};
  const emitTypingStop = async (_conversationId?: string, _threadId?: string) => {};
  const disconnectSocket = () => {};

  return {
    isConnected,
    initSocket,
    createOrGetConversation,
    getConversationList,
    getThreads,
    getConversationMessages,
    joinConversation,
    joinThread,
    leaveThread,
    leaveConversation,
    sendMessage,
    markConversationAsRead,
    emitTypingStart,
    emitTypingStop,
    disconnectSocket
  };
}
