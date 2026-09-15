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
      try {
        list = await getThreads(conversationId);
      } catch {
        const serverUrl = getChatServerUrl();
        if (serverUrl) {
          const res = await fetch(`${serverUrl}/api/conversations/${conversationId}/threads`);
          if (res.ok) {
            const data = await res.json();
            list = data.threads || [];
          }
        }
      }

      // Check Firebase RTDB for threads if empty
      if (!list || list.length === 0) {
        try {
          const snap = await get(dbRef(db, `conversationThreads/${conversationId}`));
          if (snap.exists()) {
            snap.forEach((c) => {
              const val = c.val();
              if (val) list.push({ ...val, id: c.key || val.id });
            });
          }
        } catch {}
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
      return [];
    }
  };

  const loadHistory = async (targetThreadId = 'all') => {
    isMessagesLoading.value = true;
    messageMap.clear();
    messages.value = [];

    try {
      // 1. Ensure threads are loaded first
      const currentThreads = await loadThreads();

      // 2. Fetch from socket server (all conversation messages)
      let history: ChatMessage[] = [];
      try {
        history = await getConversationMessages(conversationId, targetThreadId);
      } catch {
        // Fallback to REST API
        const serverUrl = getChatServerUrl();
        if (serverUrl) {
          try {
            const endpoint =
              targetThreadId === 'all'
                ? `${serverUrl}/api/messages/${conversationId}`
                : `${serverUrl}/api/messages/${conversationId}/${targetThreadId}`;
            const res = await fetch(endpoint);
            if (res.ok) {
              const data = await res.json();
              history = data.messages || [];
            }
          } catch {}
        }
      }

      history.forEach((m) => {
        if (m && m.id) {
          messageMap.set(m.id, {
            ...m,
            threadId: m.threadId || 'general'
          });
        }
      });

      // 3. Also query each known thread if history was sparse
      if (currentThreads.length > 1 && messageMap.size === 0) {
        for (const t of currentThreads) {
          try {
            const tMsgs = await getConversationMessages(conversationId, t.id);
            tMsgs.forEach((m) => {
              if (m && m.id) {
                messageMap.set(m.id, {
                  ...m,
                  threadId: m.threadId || t.id
                });
              }
            });
          } catch {}
        }
      }

      // 4. Query Firebase RTDB directly (handles both 2-level and 3-level message paths)
      try {
        const snap = await get(dbRef(db, `messages/${conversationId}`));
        if (snap.exists()) {
          snap.forEach((childSnap) => {
            const val = childSnap.val();
            if (!val) return;
            if (typeof val.text === 'string' || val.senderId) {
              // Legacy flat message: messages/{conversationId}/{messageId}
              const mId = childSnap.key || val.id;
              if (mId && !messageMap.has(mId)) {
                messageMap.set(mId, {
                  id: mId,
                  conversationId,
                  threadId: val.threadId || 'general',
                  senderId: val.senderId,
                  text: val.text,
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
                if (mVal && mId && !messageMap.has(mId)) {
                  messageMap.set(mId, {
                    id: mId,
                    conversationId,
                    threadId: mVal.threadId || threadKey,
                    senderId: mVal.senderId,
                    text: mVal.text,
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
      } catch (rtdbErr) {
        if (import.meta.env.DEV) {
          console.warn('[useChat] RTDB message fetch note:', rtdbErr);
        }
      }

      sortAndSyncMessages();

      if (import.meta.env.DEV) {
        console.log(
          `[Chat] conversation: ${conversationId} | threads loaded: ${currentThreads.length} | merged messages: ${messages.value.length}`
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
