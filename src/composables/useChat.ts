import { ref, onUnmounted } from 'vue';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import { useChatSocket } from './useChatSocket';
import { useAuth } from './useAuth';
import { isDevChatActive, getDevMessages, saveDevMessage } from '../services/devChatStorage';
import type { ChatMessage } from '../types/message';

export function useChat(conversationId: string) {
  const { initSocket, joinConversation, leaveConversation, sendMessage, emitTypingStart, emitTypingStop } =
    useChatSocket();
  const { sessionUid } = useAuth();

  const messages = ref<ChatMessage[]>([]);
  const loading = ref(true);
  const isOtherTyping = ref(false);
  let typingTimer: any = null;
  let devMessageHandler: ((e: any) => void) | null = null;
  const messageMap = new Map<string, ChatMessage>();

  const loadHistory = async () => {
    loading.value = true;

    // DEV BYPASS MODE: Load local messages
    if (isDevChatActive()) {
      const devMsgs = getDevMessages(conversationId);
      devMsgs.forEach((m) => {
        if (m && m.id) {
          messageMap.set(m.id, m);
        }
      });
      sortAndSyncMessages();
      loading.value = false;
      return;
    }

    // REAL FIREBASE MODE
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
    // DEV BYPASS MODE
    if (isDevChatActive()) {
      console.warn('[DEV] Chat is using development bypass session.');
      devMessageHandler = (e: any) => {
        const msg = e.detail;
        if (msg && msg.conversationId === conversationId) {
          messageMap.set(msg.id, msg);
          sortAndSyncMessages();
        }
      };
      window.addEventListener('laf:dev-message-new', devMessageHandler);
      // Attempt socket connection softly in background; do not throw or break if unavailable
      try {
        await initSocket();
      } catch (err) {
        console.warn('[DEV] Real-time socket unavailable for dev session:', err);
      }
      return;
    }

    // REAL SOCKET.IO MODE
    try {
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
    } catch (err) {
      console.warn('[useChat] Socket listener setup warning:', err);
    }
  };

  const sendText = async (text: string): Promise<ChatMessage> => {
    // DEV BYPASS MODE: Local simulated message dispatch
    if (isDevChatActive()) {
      const currentSenderId = sessionUid.value || 'dev_user';
      const devMsg: ChatMessage = {
        id: `msg_dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        conversationId,
        senderId: currentSenderId,
        text,
        createdAt: Date.now()
      };

      saveDevMessage(conversationId, devMsg);
      messageMap.set(devMsg.id, devMsg);
      sortAndSyncMessages();
      return devMsg;
    }

    // REAL SOCKET.IO MODE
    const msg = await sendMessage(conversationId, text);
    messageMap.set(msg.id, msg);
    sortAndSyncMessages();
    emitTypingStop(conversationId);
    return msg;
  };

  const handleTyping = () => {
    if (!isDevChatActive()) {
      emitTypingStart(conversationId);
    }
  };

  const cleanup = () => {
    if (devMessageHandler) {
      window.removeEventListener('laf:dev-message-new', devMessageHandler);
      devMessageHandler = null;
    }
    if (!isDevChatActive()) {
      leaveConversation(conversationId);
    }
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
