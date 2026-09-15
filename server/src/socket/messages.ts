import type { Server, Socket } from 'socket.io';
import {
  getConversation,
  getThread,
  saveMessage,
  getThreadMessages
} from '../storage.js';
import type { Message, SendMessagePayload } from '../types/chat.js';

export function registerMessageHandlers(io: Server, socket: Socket) {
  const currentUid = socket.data.uid;

  /**
   * Send a new message inside a specific conversation thread.
   */
  socket.on(
    'message:send',
    async (
      payload: SendMessagePayload,
      callback?: (res: { success: boolean; message?: Message; error?: string }) => void
    ) => {
      try {
        const { conversationId, threadId: rawThreadId, text } = payload;
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId is required' });
        }

        const threadId = rawThreadId || 'general';

        const trimmed = (text || '').trim();
        if (!trimmed) {
          return callback?.({ success: false, error: 'Message cannot be empty' });
        }

        if (trimmed.length > 1000) {
          return callback?.({
            success: false,
            error: 'Message exceeds maximum limit of 1000 characters'
          });
        }

        // Verify conversation membership
        const conv = await getConversation(conversationId);
        if (!conv) {
          return callback?.({ success: false, error: 'Conversation not found' });
        }

        if (!conv.participantIds.includes(currentUid)) {
          return callback?.({
            success: false,
            error: 'Unauthorized: You are not a participant in this conversation'
          });
        }

        const now = Date.now();
        const messageId = `msg_${now}_${Math.random().toString(36).substring(2, 7)}`;
        const message: Message = {
          id: messageId,
          conversationId,
          threadId,
          senderId: currentUid,
          text: trimmed,
          createdAt: now,
          status: 'sent'
        };

        // Persist message and update thread/conversation unread counts
        await saveMessage(message);

        // Fetch updated thread and conversation state
        const updatedThread = await getThread(conversationId, threadId);
        const updatedConv = await getConversation(conversationId);

        // 1. Broadcast message:new to the thread room (for viewers in this active thread)
        io.to(`conversation:${conversationId}:thread:${threadId}`).emit('message:new', message);

        // 2. Broadcast message:new to parent conversation room (for thread selector badge updates)
        io.to(`conversation:${conversationId}`).emit('message:new', message);

        // 3. Broadcast thread:updated to conversation room
        if (updatedThread) {
          io.to(`conversation:${conversationId}`).emit('thread:updated', updatedThread);
        }

        // 4. Broadcast conversation:updated to participant user rooms
        if (updatedConv) {
          for (const pId of updatedConv.participantIds) {
            io.to(`user:${pId}`).emit('conversation:updated', updatedConv);
          }
        }

        callback?.({ success: true, message });
      } catch (err: any) {
        console.error('[message:send error]:', err);
        callback?.({ success: false, error: err.message || 'Failed to send message' });
      }
    }
  );

  /**
   * Retrieve message history for a conversation thread.
   */
  socket.on(
    'messages:list',
    async (
      payload: { conversationId: string; threadId?: string },
      callback?: (res: { success: boolean; messages?: Message[]; error?: string }) => void
    ) => {
      try {
        const { conversationId, threadId: rawThreadId } = payload || {};
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId is required' });
        }

        const threadId = rawThreadId || 'general';

        const conv = await getConversation(conversationId);
        if (!conv || !conv.participantIds.includes(currentUid)) {
          return callback?.({
            success: false,
            error: 'Unauthorized or conversation not found'
          });
        }

        const messages = await getThreadMessages(conversationId, threadId);
        callback?.({ success: true, messages });
      } catch (err: any) {
        console.error('[messages:list error]:', err);
        callback?.({ success: false, error: err.message || 'Failed to load messages' });
      }
    }
  );

  /**
   * Ephemeral Typing indicators (per thread).
   */
  socket.on('typing:start', (payload: { conversationId: string; threadId?: string }) => {
    if (payload?.conversationId) {
      const threadId = payload.threadId || 'general';
      socket.to(`conversation:${payload.conversationId}:thread:${threadId}`).emit('typing:start', {
        conversationId: payload.conversationId,
        threadId,
        uid: currentUid
      });
    }
  });

  socket.on('typing:stop', (payload: { conversationId: string; threadId?: string }) => {
    if (payload?.conversationId) {
      const threadId = payload.threadId || 'general';
      socket.to(`conversation:${payload.conversationId}:thread:${threadId}`).emit('typing:stop', {
        conversationId: payload.conversationId,
        threadId,
        uid: currentUid
      });
    }
  });
}
