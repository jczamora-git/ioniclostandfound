import { ref, computed } from 'vue';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import { useAuth, getSessionUser, sessionUid } from './useAuth';
import { usePosts } from './usePosts';
import { useProfiles } from './useProfiles';
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
let inFlightConversationsPromise: Promise<ConversationWithMeta[]> | null = null;

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
  const { loadProfile } = useProfiles();
  const {
    getConversationList,
    markConversationAsRead
  } = useChatSocket();

  /**
   * Helper to resolve participant profile from cache, conversation details, or RTDB.
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

    // 2. Check profile via shared cached loader
    const loaded = await loadProfile(otherUid);
    if (loaded) return loaded;

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
   * Sets unread count to 0 immediately in local state and updates Firebase RTDB.
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

    // Update in RTDB
    markConversationAsRead(conversationId, threadId).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[useConversations] markConversationAsRead warning:', err);
      }
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
   * Handle incoming conversation update.
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
   * Load conversation list on-demand from Firebase Realtime Database.
   */
  const subscribeToConversations = async (): Promise<ConversationWithMeta[]> => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    if (!myUid) return [];

    if (inFlightConversationsPromise) {
      return inFlightConversationsPromise;
    }

    if (conversations.value.length === 0) {
      isConversationsLoading.value = true;
    }
    hasConnectionError.value = false;

    const startTime = performance.now();

    inFlightConversationsPromise = (async () => {
      try {
        const rawList = await getConversationList();

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

        // Batch load all participant profiles and posts in parallel
        const otherUids = deduplicatedList.map((c) => (c.participantIds || []).find((id) => id !== myUid));
        const postIds = deduplicatedList.map((c) => c.postId).filter(Boolean) as string[];

        await Promise.all([
          useProfiles().loadProfiles(otherUids),
          Promise.all(postIds.map((pid) => getPostById(pid)))
        ]);

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
        hasConnectionError.value = false;

        if (import.meta.env.DEV) {
          const elapsed = (performance.now() - startTime).toFixed(1);
          console.log(`[Perf] Messages: ${elapsed} ms (${loaded.length} conversations)`);
        }

        return loaded;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[useConversations] Failed to load conversations:', err);
        }
        if (conversations.value.length === 0) {
          hasConnectionError.value = true;
        }
        return conversations.value;
      } finally {
        isConversationsLoading.value = false;
        inFlightConversationsPromise = null;
      }
    })();

    return inFlightConversationsPromise;
  };

  const stopConversationSubscription = () => {};

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
