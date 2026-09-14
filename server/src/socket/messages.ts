import type { Server, Socket } from 'socket.io';
import { getConversation, saveMessage } from '../firebaseAdmin.js';
import type { Message, SendMessagePayload } from '../types/chat.js';

export function registerMessageHandlers(io: Server, socket: Socket) {
  const currentUid = socket.data.uid;

  /**
   * Send a new message.
   */
  socket.on(
    'message:send',
    async (
      payload: SendMessagePayload,
      callback?: (res: { success: boolean; message?: Message; error?: string }) => void
    ) => {
      try {
        const { conversationId, text } = payload;
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId is required' });
        }

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

        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const message: Message = {
          id: messageId,
          conversationId,
          senderId: currentUid, // derived strictly from verified socket session
          text: trimmed,
          createdAt: Date.now(),
          status: 'sent'
        };

        // Persist in Firebase RTDB
        await saveMessage(message);

        // Broadcast to conversation room
        const room = `conversation:${conversationId}`;
        io.to(room).emit('message:new', message);

        callback?.({ success: true, message });
      } catch (err: any) {
        console.error('[message:send error]:', err);
        callback?.({ success: false, error: err.message || 'Failed to send message' });
      }
    }
  );

  /**
   * Ephemeral Typing indicators (not persisted).
   */
  socket.on('typing:start', (conversationId: string) => {
    if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        uid: currentUid
      });
    }
  });

  socket.on('typing:stop', (conversationId: string) => {
    if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        uid: currentUid
      });
    }
  });
}
