import { ref, computed } from 'vue';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import { useAuth, getSessionUser, sessionUid } from './useAuth';
import { usePosts } from './usePosts';
import { getChatServerUrl } from '../services/socket';
import {
  useChatSocket,
  onConversationUpdated,
  onMessageNew
} from './useChatSocket';
import type { Conversation, ConversationThread, ConversationWithMeta } from '../types/conversation';
import type { Profile } from '../types/profile';

const conversations = ref<ConversationWithMeta[]>([]);
const isConversationsLoading = ref(false);
const hasConnectionError = ref(false);
let globalListenerInitialized = false;

export interface CreateConversationOptions {
  otherUserId: string;
  postId?: string | null;
  postTitle?: string;
  postSubtitle?: string;
  postLocation?: string;
  threadId?: string;
}

/**
 * Total unread messages count for current active user across all conversations.
 * Consumed by AppDock and page headers.
 */
export const totalUnreadCount = computed<number>(() => {
  const myUid = sessionUid.value;
  if (!myUid) return 0;

  return conversations.value.reduce((total, conv) => {
    const count =
      typeof conv.unreadCounts?.[myUid] === 'number'
        ? conv.unreadCounts[myUid]
        : conv.unread
        ? 1
        : 0;
    return total + count;
  }, 0);
});

/**
 * Shared helper to get or create a 1-to-1 conversation and target thread.
 * Guarantees ONE conversation per pair of users.
 */
export async function createOrGetConversation(
  arg1: CreateConversationOptions | string,
  arg2?: string | null
): Promise<Conversation & { thread?: ConversationThread; threadsList?: ConversationThread[] }> {
  let otherUserId = '';
  let postId: string | null | undefined = null;
  let postTitle: string | undefined = undefined;
  let postSubtitle: string | undefined = undefined;
  let postLocation: string | undefined = undefined;
  let threadId: string | undefined = undefined;

  if (typeof arg1 === 'object' && arg1 !== null) {
    otherUserId = arg1.otherUserId;
    postId = arg1.postId;
    postTitle = arg1.postTitle;
    postSubtitle = arg1.postSubtitle;
    postLocation = arg1.postLocation;
    threadId = arg1.threadId;
  } else if (typeof arg1 === 'string') {
    if (arg1.startsWith('post_') && arg2) {
      postId = arg1;
      otherUserId = arg2;
    } else {
      otherUserId = arg1;
      postId = arg2;
    }
  }

  const session = await getSessionUser();
  if (!session?.uid || (session.isAnonymous && !session.isDevAccount)) {
    throw new Error('You must be signed in to send messages.');
  }
  const currentUid = session.uid;

  if (!otherUserId || typeof otherUserId !== 'string' || otherUserId.trim() === '') {
    throw new Error('Unable to start conversation. Invalid recipient.');
  }
  if (otherUserId === currentUid) {
    throw new Error('Cannot start a conversation with yourself.');
  }

  const normalizedPostId =
    postId && typeof postId === 'string' && postId.trim() !== '' ? postId.trim() : null;

  const senderProfile = {
    name: session.name || 'Member',
    username: session.username || 'user',
    avatarUrl: null
  };

  const { createOrGetConversation: socketCreateOrGet } = useChatSocket();
  const res = await socketCreateOrGet(
    normalizedPostId,
    otherUserId,
    senderProfile,
    undefined,
    {
      threadId,
      postTitle,
      postSubtitle,
      postLocation
    }
  );

  return {
    ...res.conversation,
    thread: res.thread,
    threadsList: res.threads,
    id: res.conversation.id
  };
}

export const createOrGetDirectConversation = (
  otherUserId: string,
  postId?: string | null
): Promise<Conversation & { thread?: ConversationThread }> =>
  createOrGetConversation({ otherUserId, postId });

export function useConversations() {
  const { currentProfile } = useAuth();
  const { getPostById } = usePosts();
  const {
    initSocket,
    getConversationList,
    markConversationAsRead
  } = useChatSocket();

  /**
   * Helper to resolve participant profile from cache, conversation details, or RTDB/server.
   */
  const resolveOtherProfile = async (
    otherUid: string,
    conv: Conversation
  ): Promise<Profile> => {
    // 1. Check embedded participantDetails first
    if (conv.participantDetails && conv.participantDetails[otherUid]) {
      const details = conv.participantDetails[otherUid];
      return {
        id: otherUid,
        name: details.name || 'Community Member',
        username: details.username || 'user',
        phone: '',
        avatarUrl: details.avatarUrl || null,
        createdAt: 0,
        updatedAt: 0
      };
    }

    // 2. Check Firebase RTDB profiles
    try {
      const snap = await get(dbRef(db, `profiles/${otherUid}`));
      if (snap.exists()) {
        const val = snap.val();
        return {
          id: otherUid,
          name: val.name || 'Community Member',
          username: val.username || 'user',
          phone: '',
          avatarUrl: val.avatarUrl || null,
          createdAt: val.createdAt || 0,
          updatedAt: val.updatedAt || 0
        };
      }
    } catch {}

    // 3. Fallback to server REST API
    try {
      const serverUrl = getChatServerUrl();
      if (serverUrl) {
        const res = await fetch(`${serverUrl}/api/profiles/${otherUid}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.profile) {
            return {
              id: otherUid,
              name: data.profile.name || 'Community Member',
              username: data.profile.username || 'user',
              phone: '',
              avatarUrl: data.profile.avatarUrl || null,
              createdAt: 0,
              updatedAt: 0
            };
          }
        }
      }
    } catch {}

    return {
      id: otherUid,
      name: 'Community Member',
      username: 'member',
      phone: '',
      avatarUrl: null,
      createdAt: 0,
      updatedAt: 0
    };
  };

  /**
   * Mark a conversation read:
   * Sets unread count to 0 immediately in local state and notifies server via socket.
   */
  const markAsRead = (conversationId: string, threadId?: string) => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    if (!myUid) return;

    localStorage.setItem(`laf_read_${conversationId}`, String(Date.now()));

    const target = conversations.value.find((c) => c.id === conversationId);
    if (target) {
      if (!target.unreadCounts) target.unreadCounts = {};
      if (!threadId) {
        target.unreadCounts[myUid] = 0;
        target.unreadCount = 0;
        target.unread = false;
      } else if (target.threads && target.threads[threadId]) {
        if (target.threads[threadId].unreadCounts) {
          target.threads[threadId].unreadCounts![myUid] = 0;
        }
        // Recalculate sum
        let sum = 0;
        for (const t of Object.values(target.threads)) {
          sum += t.unreadCounts?.[myUid] || 0;
        }
        target.unreadCounts[myUid] = sum;
        target.unreadCount = sum;
        target.unread = sum > 0;
      }
    }

    // Emit to backend socket
    markConversationAsRead(conversationId, threadId).catch((err) => {
      console.warn('[useConversations] markConversationAsRead warning:', err);
    });
  };

  /**
   * Check if a conversation has unread messages for current user.
   */
  const isConversationUnread = (conv: Conversation): boolean => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    if (!myUid) return false;

    if (conv.unreadCounts && typeof conv.unreadCounts[myUid] === 'number') {
      return conv.unreadCounts[myUid] > 0;
    }

    if (!conv.lastMessageAt || !conv.lastMessageSenderId) return false;
    if (conv.lastMessageSenderId === myUid) return false;

    const lastRead = Number(localStorage.getItem(`laf_read_${conv.id}`) || 0);
    return conv.lastMessageAt > lastRead;
  };

  /**
   * Sort conversations by latest activity descending.
   */
  const sortConversations = () => {
    conversations.value.sort(
      (a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt)
    );
  };

  /**
   * Handle incoming conversation:updated socket event globally.
   */
  const handleConversationUpdated = async (rawConv: Conversation) => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    if (!myUid || !rawConv || !rawConv.participantIds?.includes(myUid)) return;

    const unreadCount =
      typeof rawConv.unreadCounts?.[myUid] === 'number'
        ? rawConv.unreadCounts[myUid]
        : isConversationUnread(rawConv)
        ? 1
        : 0;

    const existingIndex = conversations.value.findIndex((c) => c.id === rawConv.id);
    if (existingIndex !== -1) {
      const existing = conversations.value[existingIndex];
      // Update fields in place
      existing.lastMessage = rawConv.lastMessage;
      existing.lastMessageAt = rawConv.lastMessageAt;
      existing.lastMessageSenderId = rawConv.lastMessageSenderId;
      existing.lastMessageThreadId = rawConv.lastMessageThreadId;
      existing.lastMessageThreadTitle = rawConv.lastMessageThreadTitle;
      existing.updatedAt = rawConv.updatedAt;
      existing.unreadCounts = rawConv.unreadCounts;
      existing.unreadCount = unreadCount;
      existing.unread = unreadCount > 0;
      if (rawConv.threads) existing.threads = rawConv.threads;

      if (rawConv.participantDetails) {
        existing.participantDetails = rawConv.participantDetails;
        const otherUid = rawConv.participantIds.find((id) => id !== myUid);
        if (otherUid && rawConv.participantDetails[otherUid]) {
          existing.otherParticipant = {
            id: otherUid,
            name: rawConv.participantDetails[otherUid].name,
            username: rawConv.participantDetails[otherUid].username,
            phone: '',
            avatarUrl: rawConv.participantDetails[otherUid].avatarUrl || null,
            createdAt: 0,
            updatedAt: 0
          };
        }
      }

      sortConversations();
    } else {
      // New conversation arrived: resolve metadata and add to top of list
      const otherUid = rawConv.participantIds.find((id) => id !== myUid);
      const otherProfile = otherUid ? await resolveOtherProfile(otherUid, rawConv) : null;
      let post = null;
      if (rawConv.postId) {
        post = await getPostById(rawConv.postId);
      }

      const newConvMeta: ConversationWithMeta = {
        ...rawConv,
        otherParticipant: otherProfile,
        post,
        unread: unreadCount > 0,
        unreadCount
      };

      conversations.value.unshift(newConvMeta);
      sortConversations();
    }
  };

  /**
   * Subscribe to conversation updates and load initial list from persistent storage.
   */
  const subscribeToConversations = async () => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    if (!myUid) return;

    isConversationsLoading.value = true;
    hasConnectionError.value = false;

    // Connect shared socket
    try {
      await initSocket();
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[useConversations] Socket init warning:', e);
      }
    }

    // Initialize global listeners once
    if (!globalListenerInitialized) {
      globalListenerInitialized = true;
      onConversationUpdated((conv) => {
        handleConversationUpdated(conv);
      });

      onMessageNew((msg) => {
        const target = conversations.value.find((c) => c.id === msg.conversationId);
        if (target) {
          target.lastMessage = msg.text;
          target.lastMessageAt = msg.createdAt;
          target.lastMessageSenderId = msg.senderId;
          target.lastMessageThreadId = msg.threadId;
          target.updatedAt = msg.createdAt;
          const curUid = sessionUid.value || currentProfile.value?.id;
          if (curUid && msg.senderId !== curUid) {
            if (!target.unreadCounts) target.unreadCounts = {};
            target.unreadCounts[curUid] = (target.unreadCounts[curUid] || 0) + 1;
            target.unreadCount = (target.unreadCount || 0) + 1;
            target.unread = true;
          }
          sortConversations();
        }
      });
    }

    // Load initial persistent conversations
    try {
      let rawList: Conversation[] = [];
      let loadSuccess = false;

      try {
        rawList = await getConversationList();
        loadSuccess = true;
      } catch {
        // Fallback to REST endpoint
        const serverUrl = getChatServerUrl();
        if (serverUrl) {
          const res = await fetch(`${serverUrl}/api/conversations/${myUid}`);
          if (res.ok) {
            const data = await res.json();
            rawList = data.conversations || [];
            loadSuccess = true;
          }
        }
      }

      if (!loadSuccess && conversations.value.length === 0) {
        hasConnectionError.value = true;
      } else {
        hasConnectionError.value = false;
      }

      // Deduplicate conversations so only ONE row appears per other participant
      const userPairMap = new Map<string, Conversation>();
      for (const rawConv of rawList) {
        const otherUid = (rawConv.participantIds || []).find((id) => id !== myUid);
        if (!otherUid) continue;

        if (!userPairMap.has(otherUid)) {
          userPairMap.set(otherUid, rawConv);
        } else {
          const current = userPairMap.get(otherUid)!;
          if ((rawConv.lastMessageAt || 0) > (current.lastMessageAt || 0)) {
            userPairMap.set(otherUid, rawConv);
          }
        }
      }

      const deduplicatedList = Array.from(userPairMap.values());
      const loaded: ConversationWithMeta[] = [];

      for (const rawConv of deduplicatedList) {
        const otherUid = (rawConv.participantIds || []).find((id) => id !== myUid);
        const otherProfile = otherUid ? await resolveOtherProfile(otherUid, rawConv) : null;
        let post = null;
        if (rawConv.postId) {
          post = await getPostById(rawConv.postId);
        }

        const unreadCount =
          typeof rawConv.unreadCounts?.[myUid] === 'number'
            ? rawConv.unreadCounts[myUid]
            : isConversationUnread(rawConv)
            ? 1
            : 0;

        loaded.push({
          ...rawConv,
          otherParticipant: otherProfile,
          post,
          unread: unreadCount > 0,
          unreadCount
        });
      }

      loaded.sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt));
      conversations.value = loaded;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useConversations] Failed to load conversations:', err);
      }
      if (conversations.value.length === 0) {
        hasConnectionError.value = true;
      }
    } finally {
      isConversationsLoading.value = false;
    }
  };

  const stopConversationSubscription = () => {
    // Keep global socket active for the session, no-op cleanup
  };

  return {
    conversations,
    loading: isConversationsLoading,
    isConversationsLoading,
    hasConnectionError,
    totalUnreadCount,
    subscribeToConversations,
    stopConversationSubscription,
    markAsRead,
    createOrGetConversation,
    createOrGetDirectConversation
  };
}
