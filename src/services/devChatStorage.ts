import type { Conversation } from '../types/conversation';
import type { ChatMessage } from '../types/message';
import { isDevBypassEnabled, getDevSession } from '../composables/useAuth';

const DEV_CONVERSATIONS_KEY = 'dev_conversations';
const DEV_MESSAGES_PREFIX = 'dev_messages_';

/**
 * Checks if local dev chat is active.
 * Strictly limited to DEV mode with VITE_DEV_BYPASS_AUTH enabled and a saved dev session.
 * Always returns false in production builds.
 */
export function isDevChatActive(): boolean {
  return isDevBypassEnabled() && !!getDevSession();
}

/**
 * Retrieve all local dev conversations from localStorage.
 */
export function getDevConversations(): Conversation[] {
  if (!isDevChatActive()) return [];
  try {
    const raw = localStorage.getItem(DEV_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save dev conversations list to localStorage.
 */
export function saveDevConversations(convs: Conversation[]): void {
  if (!isDevChatActive()) return;
  try {
    localStorage.setItem(DEV_CONVERSATIONS_KEY, JSON.stringify(convs));
    window.dispatchEvent(new CustomEvent('laf:dev-conversations-updated'));
  } catch (e) {
    console.warn('[DEV] Failed to save dev conversations:', e);
  }
}

/**
 * Find a dev conversation by ID.
 */
export function getDevConversationById(id: string): Conversation | null {
  const convs = getDevConversations();
  return convs.find((c) => c.id === id) || null;
}

/**
 * Create or return existing local dev conversation for testing.
 */
export function createOrGetDevConversation(
  currentUid: string,
  otherUserId: string,
  postId?: string | null
): Conversation {
  console.warn('[DEV] Chat is using development bypass session.');
  const convs = getDevConversations();
  const normalizedPostId =
    postId && typeof postId === 'string' && postId.trim() !== '' ? postId.trim() : null;
  const conversationType: 'post' | 'direct' = normalizedPostId ? 'post' : 'direct';

  // Check if conversation between these participants already exists
  const existing = convs.find((c) => {
    const hasBoth =
      c.participantIds &&
      c.participantIds.includes(currentUid) &&
      c.participantIds.includes(otherUserId);
    if (!hasBoth) return false;
    if (normalizedPostId) return c.postId === normalizedPostId;
    return !c.postId || c.type === 'direct';
  });

  if (existing) {
    return existing;
  }

  const now = Date.now();
  const newConv: Conversation = {
    id: `conv_dev_${now}_${Math.random().toString(36).substring(2, 7)}`,
    type: conversationType,
    postId: normalizedPostId,
    participantIds: [currentUid, otherUserId],
    createdAt: now,
    updatedAt: now
  };

  convs.unshift(newConv);
  saveDevConversations(convs);
  return newConv;
}

/**
 * Retrieve messages for a given dev conversation.
 */
export function getDevMessages(conversationId: string): ChatMessage[] {
  if (!isDevChatActive()) return [];
  try {
    const raw = localStorage.getItem(`${DEV_MESSAGES_PREFIX}${conversationId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save a message to a dev conversation in localStorage.
 */
export function saveDevMessage(conversationId: string, message: ChatMessage): void {
  if (!isDevChatActive()) return;
  try {
    const msgs = getDevMessages(conversationId);
    msgs.push(message);
    localStorage.setItem(`${DEV_MESSAGES_PREFIX}${conversationId}`, JSON.stringify(msgs));

    // Update conversation metadata
    const convs = getDevConversations();
    const target = convs.find((c) => c.id === conversationId);
    if (target) {
      target.lastMessage = message.text;
      target.lastMessageAt = message.createdAt;
      target.lastMessageSenderId = message.senderId;
      target.updatedAt = message.createdAt;
      saveDevConversations(convs);
    }

    window.dispatchEvent(new CustomEvent('laf:dev-message-new', { detail: message }));
  } catch (e) {
    console.warn('[DEV] Failed to save dev message:', e);
  }
}
