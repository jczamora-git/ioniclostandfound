import { ref, onUnmounted } from 'vue';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import { useChatSocket } from './useChatSocket';
import type { ChatMessage } from '../types/message';

export function useChat(conversationId: string) {
  const { initSocket, joinConversation, leaveConversation, sendMessage, emitTypingStart, emitTypingStop } =
    useChatSocket();

  const messages = ref<ChatMessage[]>([]);
  const loading = ref(true);
  const isOtherTyping = ref(false);
  let typingTimer: any = null;
  const messageMap = new Map<string, ChatMessage>();

  const loadHistory = async () => {
    loading.value = true;
    try {
      const snap = await get(dbRef(db, `messages/${conversationId}`));
      if (snap.exists()) {
        const val = snap.val();
        Object.values(val).forEach((m: any) => {
          if (m && m.id) {
            messageMap.set(m.id, m);
          }
        });
      }
      sortAndSyncMessages();
    } catch (err) {
      console.error('Failed to load message history from Firebase:', err);
    } finally {
      loading.value = false;
    }
  };

  const sortAndSyncMessages = () => {
    messages.value = Array.from(messageMap.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  };

  const setupSocketListeners = async () => {
    const socket = await initSocket();

    // Join room
    await joinConversation(conversationId);

    // Listen for new messages
    socket.on('message:new', (msg: ChatMessage) => {
      if (msg && msg.conversationId === conversationId) {
        messageMap.set(msg.id, msg);
        sortAndSyncMessages();
      }
    });

    // Listen for typing events
    socket.on('typing:start', (data: { conversationId: string; uid: string }) => {
      if (data.conversationId === conversationId) {
        isOtherTyping.value = true;
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          isOtherTyping.value = false;
        }, 3000);
      }
    });

    socket.on('typing:stop', (data: { conversationId: string; uid: string }) => {
      if (data.conversationId === conversationId) {
        isOtherTyping.value = false;
        clearTimeout(typingTimer);
      }
    });
  };

  const sendText = async (text: string): Promise<ChatMessage> => {
    const msg = await sendMessage(conversationId, text);
    messageMap.set(msg.id, msg);
    sortAndSyncMessages();
    emitTypingStop(conversationId);
    return msg;
  };

  const handleTyping = () => {
    emitTypingStart(conversationId);
  };

  const cleanup = () => {
    leaveConversation(conversationId);
    clearTimeout(typingTimer);
  };

  return {
    messages,
    loading,
    isOtherTyping,
    loadHistory,
    setupSocketListeners,
    sendText,
    handleTyping,
    cleanup
  };
}
