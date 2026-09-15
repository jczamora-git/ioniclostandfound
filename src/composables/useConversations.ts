import { ref, computed } from 'vue';
import { ref as dbRef, onValue, off, get, update } from 'firebase/database';
import { db, auth } from '../firebase';
import { useAuth, getAuthenticatedUser } from './useAuth';
import { usePosts } from './usePosts';
import type { Conversation, ConversationWithMeta } from '../types/conversation';

const conversations = ref<ConversationWithMeta[]>([]);
const loading = ref(false);
let listenerActive = false;

export interface CreateConversationOptions {
  otherUserId: string;
  postId?: string | null;
}

/**
 * Shared helper to get or create a 1-to-1 conversation (post-based or direct user).
 * Implements strict validation, duplicate prevention, and atomic Firebase RTDB persistence.
 */
export async function createOrGetConversation(
  arg1: CreateConversationOptions | string,
  arg2?: string | null
): Promise<Conversation> {
  let otherUserId = '';
  let postId: string | null | undefined = null;

  if (typeof arg1 === 'object' && arg1 !== null) {
    otherUserId = arg1.otherUserId;
    postId = arg1.postId;
  } else if (typeof arg1 === 'string') {
    if (arg1.startsWith('post_') && arg2) {
      postId = arg1;
      otherUserId = arg2;
    } else {
      otherUserId = arg1;
      postId = arg2;
    }
  }

  // 1. Verify currentUser
  let currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    currentUser = await getAuthenticatedUser();
  }
  if (!currentUser?.uid) {
    throw new Error('You must be signed in to send messages.');
  }
  const currentUid = currentUser.uid;

  // 2. Verify target user
  if (!otherUserId || typeof otherUserId !== 'string' || otherUserId.trim() === '') {
    throw new Error('Unable to start conversation. Invalid recipient.');
  }
  if (otherUserId === currentUid) {
    throw new Error('Cannot start a conversation with yourself.');
  }

  // 3. Verify target user exists in Firebase profiles
  try {
    const targetSnap = await get(dbRef(db, `profiles/${otherUserId}`));
    if (!targetSnap.exists()) {
      throw new Error('Unable to start conversation. Target user does not exist.');
    }
  } catch (err: any) {
    if (err.message?.includes('Target user does not exist')) {
      throw err;
    }
    console.warn('[createOrGetConversation] Target profile check warning:', err);
  }

  const normalizedPostId =
    postId && typeof postId === 'string' && postId.trim() !== '' ? postId.trim() : null;
  const conversationType: 'post' | 'direct' = normalizedPostId ? 'post' : 'direct';

  // 4. Duplicate prevention: Check userConversations/${currentUid}
  try {
    const userConvsSnap = await get(dbRef(db, `userConversations/${currentUid}`));
    if (userConvsSnap.exists()) {
      const userConvs = userConvsSnap.val();
      for (const convId of Object.keys(userConvs)) {
        const cSnap = await get(dbRef(db, `conversations/${convId}`));
        if (cSnap.exists()) {
          const c: Conversation = cSnap.val();
          if (
            Array.isArray(c.participantIds) &&
            c.participantIds.includes(currentUid) &&
            c.participantIds.includes(otherUserId)
          ) {
            // If post-based: must match the same postId
            if (normalizedPostId) {
              if (c.postId === normalizedPostId) {
                console.log(`[createOrGetConversation] Found existing post conversation: ${convId}`);
                return c;
              }
            } else {
              // If direct chat: matches if type === 'direct' or no postId
              if (!c.postId || c.type === 'direct') {
                console.log(`[createOrGetConversation] Found existing direct conversation: ${convId}`);
                return c;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[createOrGetConversation] Error checking existing conversations:', err);
  }

  // 5. Create new conversation with clean unique ID
  const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const newConv: Conversation = {
    id: convId,
    type: conversationType,
    postId: normalizedPostId,
    participantIds: [currentUid, otherUserId],
    createdAt: now,
    updatedAt: now
  };

  // 6. Save to Firebase RTDB with atomic multi-path update
  const updates: Record<string, any> = {};
  updates[`conversations/${convId}`] = newConv;
  updates[`userConversations/${currentUid}/${convId}`] = {
    updatedAt: now,
    postId: normalizedPostId,
    type: conversationType
  };
  updates[`userConversations/${otherUserId}/${convId}`] = {
    updatedAt: now,
    postId: normalizedPostId,
    type: conversationType
  };

  await update(dbRef(db), updates);
  console.log(`[createOrGetConversation] Created and saved new conversation: ${convId} (${conversationType})`);

  return newConv;
}

export const createOrGetDirectConversation = (
  otherUserId: string,
  postId?: string | null
): Promise<Conversation> => createOrGetConversation({ otherUserId, postId });

export function useConversations() {
  const { currentProfile } = useAuth();
  const { getPostById } = usePosts();

  const totalUnreadCount = computed(() => {
    return conversations.value.filter((c) => c.unread).length;
  });

  const markAsRead = (conversationId: string) => {
    localStorage.setItem(`laf_read_${conversationId}`, String(Date.now()));
    const target = conversations.value.find((c) => c.id === conversationId);
    if (target) {
      target.unread = false;
    }
  };

  const isUnread = (conv: Conversation): boolean => {
    if (!conv.lastMessageAt || !conv.lastMessageSenderId) return false;
    // Don't mark as unread if the current user was the sender
    if (conv.lastMessageSenderId === currentProfile.value?.id) return false;

    const lastRead = Number(localStorage.getItem(`laf_read_${conv.id}`) || 0);
    return conv.lastMessageAt > lastRead;
  };

  const subscribeToConversations = () => {
    const uid = currentProfile.value?.id;
    if (!uid) return;

    if (listenerActive) return;
    listenerActive = true;
    loading.value = true;

    const userConvsRef = dbRef(db, `userConversations/${uid}`);
    onValue(userConvsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        conversations.value = [];
        loading.value = false;
        return;
      }

      const convIds = Object.keys(snapshot.val());
      const loaded: ConversationWithMeta[] = [];

      for (const convId of convIds) {
        try {
          const convSnap = await get(dbRef(db, `conversations/${convId}`));
          if (convSnap.exists()) {
            const rawConv: Conversation = convSnap.val();
            const otherUid = rawConv.participantIds.find((id) => id !== uid);

            // Fetch other participant profile
            let otherProfile = null;
            if (otherUid) {
              const profileSnap = await get(dbRef(db, `profiles/${otherUid}`));
              if (profileSnap.exists()) {
                otherProfile = {
                  id: otherUid,
                  name: profileSnap.val().name || 'Community Member',
                  username: profileSnap.val().username || 'user',
                  phone: '',
                  avatarUrl: profileSnap.val().avatarUrl || null,
                  createdAt: profileSnap.val().createdAt || 0,
                  updatedAt: profileSnap.val().updatedAt || 0
                };
              }
            }

            // Fetch associated post if present
            let post = null;
            if (rawConv.postId) {
              post = await getPostById(rawConv.postId);
            }

            loaded.push({
              ...rawConv,
              otherParticipant: otherProfile,
              post,
              unread: isUnread(rawConv)
            });
          }
        } catch (err) {
          console.warn(`Failed to resolve conversation ${convId}:`, err);
        }
      }

      // Sort by latest message / update
      loaded.sort((a, b) => (b.lastMessageAt || b.updatedAt) - (a.lastMessageAt || a.updatedAt));
      conversations.value = loaded;
      loading.value = false;
    });
  };

  const stopConversationSubscription = () => {
    const uid = currentProfile.value?.id;
    if (uid) {
      const userConvsRef = dbRef(db, `userConversations/${uid}`);
      off(userConvsRef);
      listenerActive = false;
    }
  };

  return {
    conversations,
    loading,
    totalUnreadCount,
    subscribeToConversations,
    stopConversationSubscription,
    markAsRead,
    createOrGetConversation,
    createOrGetDirectConversation
  };
}
