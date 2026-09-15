import { ref, computed } from 'vue';
import { useChatSocket, onMessageNew, onThreadUpdated } from './useChatSocket';
import { useConversations } from './useConversations';
import { useAuth } from './useAuth';
import { getChatServerUrl } from '../services/socket';
import type { ChatMessage } from '../types/message';
import type { ConversationThread } from '../types/conversation';

export function useChat(conversationId: string, initialThreadId = 'general') {
  const {
    initSocket,
    joinConversation,
    joinThread,
    leaveThread,
    leaveConversation,
    sendMessage,
    getConversationMessages,
    getThreads,
    emitTypingStart,
    emitTypingStop
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

  const loadThreads = async () => {
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
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useChat] Failed to load threads:', err);
      }
    }
  };

  const loadHistory = async (targetThreadId?: string) => {
    const threadToLoad = targetThreadId || activeThreadId.value || 'general';
    isMessagesLoading.value = true;
    messageMap.clear();
    messages.value = [];

    try {
      let history: ChatMessage[] = [];
      try {
        history = await getConversationMessages(conversationId, threadToLoad);
      } catch {
        // Fallback to REST API
        const serverUrl = getChatServerUrl();
        if (serverUrl) {
          const res = await fetch(`${serverUrl}/api/messages/${conversationId}/${threadToLoad}`);
          if (res.ok) {
            const data = await res.json();
            history = data.messages || [];
          }
        }
      }

      history.forEach((m) => {
        if (m && m.id) {
          messageMap.set(m.id, m);
        }
      });
      sortAndSyncMessages();
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

    const oldThreadId = activeThreadId.value;
    leaveThread(conversationId, oldThreadId);

    activeThreadId.value = newThreadId;
    await joinThread(conversationId, newThreadId);

    // Clear unread for new thread locally
    const target = threads.value.find((t) => t.id === newThreadId);
    const myUid = sessionUid.value;
    if (target && target.unreadCounts && myUid) {
      target.unreadCounts[myUid] = 0;
    }

    markAsRead(conversationId, newThreadId);
    await loadHistory(newThreadId);
  };

  const setupSocketListeners = async () => {
    try {
      const socket = await initSocket();

      // Join conversation and thread rooms
      await joinConversation(conversationId, activeThreadId.value);
      await joinThread(conversationId, activeThreadId.value);

      // Listen for thread updates
      unregisterThreadListener = onThreadUpdated((updatedThread: ConversationThread) => {
        if (updatedThread.conversationId === conversationId) {
          const idx = threads.value.findIndex((t) => t.id === updatedThread.id);
          if (idx !== -1) {
            threads.value[idx] = { ...updatedThread };
          } else {
            threads.value.push({ ...updatedThread });
          }
        }
      });

      // Listen for incoming messages in real-time
      unregisterMessageListener = onMessageNew((msg: ChatMessage) => {
        if (!msg || msg.conversationId !== conversationId) return;

        const msgThreadId = msg.threadId || 'general';

        if (msgThreadId === activeThreadId.value) {
          // Message belongs to currently open thread
          messageMap.set(msg.id, msg);
          sortAndSyncMessages();
          markAsRead(conversationId, activeThreadId.value);
        } else {
          // Message belongs to another thread in this conversation:
          // Update thread list badge
          const t = threads.value.find((th) => th.id === msgThreadId);
          const myUid = sessionUid.value;
          if (t && myUid) {
            if (!t.unreadCounts) t.unreadCounts = {};
            t.unreadCounts[myUid] = (t.unreadCounts[myUid] || 0) + 1;
            t.lastMessage = msg.text;
            t.lastMessageAt = msg.createdAt;
          }
        }
      });

      // Ephemeral typing indicators
      socket.on(
        'typing:start',
        (data: { conversationId: string; threadId?: string; uid: string }) => {
          if (
            data.conversationId === conversationId &&
            (!data.threadId || data.threadId === activeThreadId.value) &&
            data.uid !== sessionUid.value
          ) {
            isOtherTyping.value = true;
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
              isOtherTyping.value = false;
            }, 3000);
          }
        }
      );

      socket.on(
        'typing:stop',
        (data: { conversationId: string; threadId?: string; uid: string }) => {
          if (
            data.conversationId === conversationId &&
            (!data.threadId || data.threadId === activeThreadId.value) &&
            data.uid !== sessionUid.value
          ) {
            isOtherTyping.value = false;
            clearTimeout(typingTimer);
          }
        }
      );
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useChat] Socket listener setup warning:', err);
      }
    }
  };

  const sendText = async (text: string): Promise<ChatMessage> => {
    const threadId = activeThreadId.value || 'general';
    const msg = await sendMessage(conversationId, text, threadId);

    messageMap.set(msg.id, msg);
    sortAndSyncMessages();

    // Update active thread lastMessage locally
    const curThread = threads.value.find((t) => t.id === threadId);
    if (curThread) {
      curThread.lastMessage = text;
      curThread.lastMessageAt = msg.createdAt;
    }

    emitTypingStop(conversationId, threadId);
    return msg;
  };

  const handleTyping = () => {
    emitTypingStart(conversationId, activeThreadId.value);
  };

  const cleanup = () => {
    if (unregisterMessageListener) {
      unregisterMessageListener();
      unregisterMessageListener = null;
    }
    if (unregisterThreadListener) {
      unregisterThreadListener();
      unregisterThreadListener = null;
    }
    leaveThread(conversationId, activeThreadId.value);
    leaveConversation(conversationId);
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
    sendText,
    handleTyping,
    cleanup
  };
}
