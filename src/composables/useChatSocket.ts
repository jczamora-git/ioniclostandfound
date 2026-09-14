import { ref, onUnmounted } from 'vue';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import type { ChatMessage } from '../types/message';
import type { Conversation } from '../types/conversation';

const isConnected = ref(false);

export function useChatSocket() {
  const socketRef = ref<Socket | null>(null);

  const initSocket = async (): Promise<Socket> => {
    const socket = await getSocket();
    socketRef.value = socket;
    isConnected.value = socket.connected;

    socket.on('connect', () => {
      isConnected.value = true;
    });

    socket.on('disconnect', () => {
      isConnected.value = false;
    });

    return socket;
  };

  /**
   * Request backend to create or get existing 1-to-1 conversation.
   */
  const createOrGetConversation = async (
    postId: string,
    otherUserId: string
  ): Promise<Conversation> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'conversation:get-or-create',
        { postId, otherUserId },
        (res: { success: boolean; conversation?: Conversation; error?: string }) => {
          if (res.success && res.conversation) {
            resolve(res.conversation);
          } else {
            reject(new Error(res.error || 'Failed to get/create conversation'));
          }
        }
      );
    });
  };

  /**
   * Join conversation room.
   */
  const joinConversation = async (conversationId: string): Promise<Conversation> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'conversation:join',
        conversationId,
        (res: { success: boolean; conversation?: Conversation; error?: string }) => {
          if (res.success && res.conversation) {
            resolve(res.conversation);
          } else {
            reject(new Error(res.error || 'Failed to join conversation'));
          }
        }
      );
    });
  };

  /**
   * Leave conversation room.
   */
  const leaveConversation = async (conversationId: string) => {
    const socket = await initSocket();
    socket.emit('conversation:leave', conversationId);
  };

  /**
   * Send message via socket.
   */
  const sendMessage = async (
    conversationId: string,
    text: string
  ): Promise<ChatMessage> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'message:send',
        { conversationId, text },
        (res: { success: boolean; message?: ChatMessage; error?: string }) => {
          if (res.success && res.message) {
            resolve(res.message);
          } else {
            reject(new Error(res.error || 'Failed to send message'));
          }
        }
      );
    });
  };

  /**
   * Typing indicators.
   */
  const emitTypingStart = async (conversationId: string) => {
    const socket = await initSocket();
    socket.emit('typing:start', conversationId);
  };

  const emitTypingStop = async (conversationId: string) => {
    const socket = await initSocket();
    socket.emit('typing:stop', conversationId);
  };

  return {
    isConnected,
    initSocket,
    createOrGetConversation,
    joinConversation,
    leaveConversation,
    sendMessage,
    emitTypingStart,
    emitTypingStop
  };
}
