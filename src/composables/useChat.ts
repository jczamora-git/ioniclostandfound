import { ref, computed } from 'vue';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import { useChatSocket } from './useChatSocket';
import { useConversations } from './useConversations';
import { useAuth } from './useAuth';
import { getChatServerUrl } from '../services/socket';
import type { ChatMessage } from '../types/message';
import type { ConversationThread } from '../types/conversation';

export function useChat(conversationId: string, initialThreadId = 'general') {
  const {
    sendMessage,
    getConversationMessages,
    getThreads
  } = useChatSocket();
  const { markAsRead } = useConversations();
  const { sessionUid } = useAuth();

  const activeThreadId = ref<string>(initialThreadId || 'general');
  const threads = ref<ConversationThread[]>([]);
  const messages = ref<ChatMessage[]>([]);
  const isMessagesLoading = ref(true);
  const isOtherTyping = ref(false);

  let typingTimer: any = null;
  let unregisterMessageListener: (() => void) | null = null;
  let unregisterThreadListener: (() => void) | null = null;
  const messageMap = new Map<string, ChatMessage>();

  const activeThread = computed<ConversationThread | undefined>(() => {
    return (
      threads.value.find((t) => t.id === activeThreadId.value) || {
        id: activeThreadId.value,
        conversationId,
        type: activeThreadId.value === 'general' ? 'general' : 'post',
        title: activeThreadId.value === 'general' ? 'General' : 'Post Discussion',
        createdAt: 0,
        updatedAt: 0
      }
    );
  });

  const sortAndSyncMessages = () => {
    messages.value = Array.from(messageMap.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  };

  const loadThreads = async (): Promise<ConversationThread[]> => {
    try {
      let list: ConversationThread[] = [];
      const snap = await get(dbRef(db, `conversationThreads/${conversationId}`));
      if (snap.exists()) {
        snap.forEach((c) => {
          const val = c.val();
          if (val) list.push({ ...val, id: c.key || val.id });
        });
      }

      // Ensure General thread is present
      if (!list.some((t) => t.id === 'general')) {
        list.unshift({
          id: 'general',
          conversationId,
          type: 'general',
          title: 'General',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      threads.value = list;
      return list;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useChat] Failed to load threads:', err);
      }
      return threads.value.length > 0 ? threads.value : [
        {
          id: 'general',
          conversationId,
          type: 'general',
          title: 'General',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];
    }
  };

  const loadHistory = async (targetThreadId = 'all', isRefresh = false) => {
    if (messages.value.length === 0 && !isRefresh) {
      isMessagesLoading.value = true;
    }

    const startTime = performance.now();

    try {
      // 1. Ensure threads are loaded in parallel with messages
      const [currentThreads, snap] = await Promise.all([
        loadThreads(),
        get(dbRef(db, `messages/${conversationId}`))
      ]);

      const newMap = new Map<string, ChatMessage>();

      if (snap.exists()) {
        snap.forEach((childSnap) => {
          const val = childSnap.val();
          if (!val) return;
          if (typeof val.text === 'string' || val.senderId) {
            // Legacy flat message: messages/{conversationId}/{messageId}
            const mId = childSnap.key || val.id;
            if (mId) {
              newMap.set(mId, {
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
            }
          } else if (typeof val === 'object') {
            // 3-level thread bucket: messages/{conversationId}/{threadId}/{messageId}
            const threadKey = childSnap.key || 'general';
            childSnap.forEach((msgSnap) => {
              const mVal = msgSnap.val();
              const mId = msgSnap.key || mVal?.id;
              if (mVal && mId) {
                newMap.set(mId, {
                  id: mId,
                  conversationId,
                  threadId: mVal.threadId || threadKey,
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
      }

      // Update messageMap and sort
      messageMap.clear();
      newMap.forEach((v, k) => messageMap.set(k, v));
      sortAndSyncMessages();

      if (import.meta.env.DEV) {
        const elapsed = (performance.now() - startTime).toFixed(1);
        console.log(
          `[Perf] Chat: ${elapsed} ms (conversation: ${conversationId} | threads: ${currentThreads.length} | messages: ${messages.value.length})`
        );
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useChat] Failed to load message history:', err);
      }
    } finally {
      isMessagesLoading.value = false;
    }
  };

  const switchThread = async (newThreadId: string) => {
    if (newThreadId === activeThreadId.value) return;

    activeThreadId.value = newThreadId;
    markAsRead(conversationId, newThreadId);
    await loadHistory('all');
  };

  const setupSocketListeners = async () => {
    // Stateless mode: No socket listeners needed
  };

  const sendChatMessage = async (
    text?: string,
    imageUrl?: string | null,
    imageKey?: string | null,
    targetThreadId?: string
  ): Promise<ChatMessage> => {
    const threadId = targetThreadId || activeThreadId.value || 'general';
    const msg = await sendMessage(conversationId, text || '', threadId, imageUrl, imageKey);

    messageMap.set(msg.id, msg);
    sortAndSyncMessages();

    return msg;
  };

  const sendText = async (text: string): Promise<ChatMessage> => {
    return sendChatMessage(text);
  };

  const handleTyping = () => {
    // Stateless mode: No-op
  };

  const cleanup = () => {
    clearTimeout(typingTimer);
  };

  return {
    messages,
    threads,
    activeThreadId,
    activeThread,
    loading: isMessagesLoading,
    isMessagesLoading,
    isOtherTyping,
    loadThreads,
    loadHistory,
    switchThread,
    setupSocketListeners,
    sendChatMessage,
    sendText,
    handleTyping,
    cleanup
  };
}
