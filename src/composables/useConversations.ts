import { ref, computed } from 'vue';
import { ref as dbRef, onValue, off, get } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { usePosts } from './usePosts';
import type { Conversation, ConversationWithMeta } from '../types/conversation';

const conversations = ref<ConversationWithMeta[]>([]);
const loading = ref(false);
let listenerActive = false;

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
                  createdAt: profileSnap.val().createdAt || 0,
                  updatedAt: profileSnap.val().updatedAt || 0
                };
              }
            }

            // Fetch associated post
            const post = await getPostById(rawConv.postId);

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
    markAsRead
  };
}
