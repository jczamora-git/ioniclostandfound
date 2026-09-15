import { ref } from 'vue';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket, isSocketConnected } from '../services/socket';
import type { ChatMessage } from '../types/message';
import type { Conversation, ConversationThread } from '../types/conversation';

const isConnected = ref(false);
let globalSocket: Socket | null = null;
let listenersInitialized = false;

type ConversationUpdatedCallback = (conv: Conversation) => void;
type ThreadUpdatedCallback = (thread: ConversationThread) => void;
type MessageNewCallback = (msg: ChatMessage) => void;

const conversationUpdatedCallbacks = new Set<ConversationUpdatedCallback>();
const threadUpdatedCallbacks = new Set<ThreadUpdatedCallback>();
const messageNewCallbacks = new Set<MessageNewCallback>();

/**
 * Register a listener for global conversation:updated events.
 */
export function onConversationUpdated(cb: ConversationUpdatedCallback) {
  conversationUpdatedCallbacks.add(cb);
  return () => {
    conversationUpdatedCallbacks.delete(cb);
  };
}

/**
 * Register a listener for thread:updated events.
 */
export function onThreadUpdated(cb: ThreadUpdatedCallback) {
  threadUpdatedCallbacks.add(cb);
  return () => {
    threadUpdatedCallbacks.delete(cb);
  };
}

/**
 * Register a listener for message:new events.
 */
export function onMessageNew(cb: MessageNewCallback) {
  messageNewCallbacks.add(cb);
  return () => {
    messageNewCallbacks.delete(cb);
  };
}

/**
 * Shared global chat socket composable.
 */
export function useChatSocket() {
  const initSocket = async (): Promise<Socket> => {
    const socket = await getSocket();
    globalSocket = socket;
    isConnected.value = socket.connected;

    if (!listenersInitialized) {
      listenersInitialized = true;

      socket.on('connect', () => {
        isConnected.value = true;
      });

      socket.on('disconnect', () => {
        isConnected.value = false;
      });

      // Global conversation:updated listener
      socket.on('conversation:updated', (conv: Conversation) => {
        if (import.meta.env.DEV) {
          console.log('[Socket] conversation updated', conv?.id, conv?.lastMessage);
        }
        conversationUpdatedCallbacks.forEach((cb) => {
          try {
            cb(conv);
          } catch (err) {
            console.error('[Socket] Error in conversationUpdatedCallback:', err);
          }
        });
      });

      // Global thread:updated listener
      socket.on('thread:updated', (thread: ConversationThread) => {
        if (import.meta.env.DEV) {
          console.log('[Socket] thread updated', thread?.conversationId, thread?.id, thread?.lastMessage);
        }
        threadUpdatedCallbacks.forEach((cb) => {
          try {
            cb(thread);
          } catch (err) {
            console.error('[Socket] Error in threadUpdatedCallback:', err);
          }
        });
      });

      // Global message:new listener
      socket.on('message:new', (msg: ChatMessage) => {
        if (import.meta.env.DEV) {
          console.log('[Socket] message received', msg?.id, msg?.threadId, msg?.text);
        }
        messageNewCallbacks.forEach((cb) => {
          try {
            cb(msg);
          } catch (err) {
            console.error('[Socket] Error in messageNewCallback:', err);
          }
        });
      });
    }

    return socket;
  };

  /**
   * Request backend to create or get existing 1-to-1 conversation and target thread.
   */
  const createOrGetConversation = async (
    postId: string | null | undefined,
    otherUserId: string,
    senderProfile?: { name: string; username: string; avatarUrl?: string | null },
    otherUserProfile?: { name: string; username: string; avatarUrl?: string | null },
    extra?: {
      threadId?: string;
      postTitle?: string;
      postSubtitle?: string;
      postLocation?: string;
    }
  ): Promise<{ conversation: Conversation; thread: ConversationThread; threads: ConversationThread[] }> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'conversation:get-or-create',
        {
          postId: postId || null,
          threadId: extra?.threadId,
          postTitle: extra?.postTitle,
          postSubtitle: extra?.postSubtitle,
          postLocation: extra?.postLocation,
          otherUserId,
          senderProfile,
          otherUserProfile
        },
        (res: {
          success: boolean;
          conversation?: Conversation;
          thread?: ConversationThread;
          threads?: ConversationThread[];
          error?: string;
        }) => {
          if (res && res.success && res.conversation) {
            resolve({
              conversation: res.conversation,
              thread: res.thread || {
                id: 'general',
                conversationId: res.conversation.id,
                type: 'general',
                title: 'General',
                createdAt: Date.now(),
                updatedAt: Date.now()
              },
              threads: res.threads || []
            });
          } else {
            reject(new Error(res?.error || 'Failed to get or create conversation'));
          }
        }
      );
    });
  };

  /**
   * Fetch all conversations for active user from persistent store.
   */
  const getConversationList = async (): Promise<Conversation[]> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'conversation:list',
        (res: { success: boolean; conversations?: Conversation[]; error?: string }) => {
          if (res && res.success && res.conversations) {
            resolve(res.conversations);
          } else {
            reject(new Error(res?.error || 'Failed to list conversations'));
          }
        }
      );
    });
  };

  /**
   * Fetch all threads for a specific conversation.
   */
  const getThreads = async (conversationId: string): Promise<ConversationThread[]> => {
    const socket = await initSocket();
    return new Promise((resolve) => {
      socket.emit(
        'thread:list',
        { conversationId },
        (res: { success: boolean; threads?: ConversationThread[]; error?: string }) => {
          if (res && res.success && res.threads) {
            resolve(res.threads);
          } else {
            resolve([]);
          }
        }
      );
    });
  };

  /**
   * Fetch message history for a conversation thread.
   */
  const getConversationMessages = async (
    conversationId: string,
    threadId = 'general'
  ): Promise<ChatMessage[]> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'messages:list',
        { conversationId, threadId },
        (res: { success: boolean; messages?: ChatMessage[]; error?: string }) => {
          if (res && res.success && res.messages) {
            resolve(res.messages);
          } else {
            reject(new Error(res?.error || 'Failed to load messages'));
          }
        }
      );
    });
  };

  /**
   * Join conversation room.
   */
  const joinConversation = async (
    conversationId: string,
    threadId?: string
  ): Promise<{ conversation: Conversation; threads: ConversationThread[] }> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'conversation:join',
        { conversationId, threadId },
        (res: {
          success: boolean;
          conversation?: Conversation;
          threads?: ConversationThread[];
          error?: string;
        }) => {
          if (res && res.success && res.conversation) {
            resolve({ conversation: res.conversation, threads: res.threads || [] });
          } else {
            reject(new Error(res?.error || 'Failed to join conversation'));
          }
        }
      );
    });
  };

  /**
   * Join thread room.
   */
  const joinThread = async (conversationId: string, threadId: string) => {
    const socket = await initSocket();
    socket.emit('thread:join', { conversationId, threadId });
  };

  /**
   * Leave thread room.
   */
  const leaveThread = async (conversationId: string, threadId: string) => {
    if (globalSocket && globalSocket.connected) {
      globalSocket.emit('thread:leave', { conversationId, threadId });
    }
  };

  /**
   * Leave conversation room.
   */
  const leaveConversation = async (conversationId: string) => {
    if (globalSocket && globalSocket.connected) {
      globalSocket.emit('conversation:leave', conversationId);
    }
  };

  /**
   * Send message via socket into a thread.
   */
  const sendMessage = async (
    conversationId: string,
    text: string,
    threadId = 'general',
    imageUrl?: string | null,
    imageKey?: string | null
  ): Promise<ChatMessage> => {
    const socket = await initSocket();
    return new Promise((resolve, reject) => {
      socket.emit(
        'message:send',
        { conversationId, threadId, text, imageUrl, imageKey },
        (res: { success: boolean; message?: ChatMessage; error?: string }) => {
          if (res && res.success && res.message) {
            resolve(res.message);
          } else {
            reject(new Error(res?.error || 'Failed to send message'));
          }
        }
      );
    });
  };

  /**
   * Mark a conversation (or specific thread) as read by the current user.
   */
  const markConversationAsRead = async (
    conversationId: string,
    threadId?: string
  ): Promise<Conversation | null> => {
    const socket = await initSocket();
    return new Promise((resolve) => {
      socket.emit(
        'conversation:read',
        { conversationId, threadId },
        (res: { success: boolean; conversation?: Conversation; error?: string }) => {
          if (res && res.success && res.conversation) {
            resolve(res.conversation);
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  /**
   * Typing indicators.
   */
  const emitTypingStart = async (conversationId: string, threadId = 'general') => {
    const socket = await initSocket();
    socket.emit('typing:start', { conversationId, threadId });
  };

  const emitTypingStop = async (conversationId: string, threadId = 'general') => {
    const socket = await initSocket();
    socket.emit('typing:stop', { conversationId, threadId });
  };

  return {
    isConnected,
    initSocket,
    createOrGetConversation,
    getConversationList,
    getThreads,
    getConversationMessages,
    joinConversation,
    joinThread,
    leaveThread,
    leaveConversation,
    sendMessage,
    markConversationAsRead,
    emitTypingStart,
    emitTypingStop,
    disconnectSocket
  };
}
