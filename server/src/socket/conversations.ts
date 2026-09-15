import type { Server, Socket } from 'socket.io';
import {
  findConversation,
  getConversation,
  saveConversation
} from '../firebaseAdmin.js';
import type { Conversation, CreateConversationPayload } from '../types/chat.js';

export function registerConversationHandlers(io: Server, socket: Socket) {
  const currentUid = socket.data.uid;

  /**
   * Get or create a 1-to-1 conversation for a post between currentUser and otherUser.
   */
  socket.on(
    'conversation:get-or-create',
    async (
      payload: CreateConversationPayload,
      callback?: (res: { success: boolean; conversation?: Conversation; error?: string }) => void
    ) => {
      try {
        const { postId, otherUserId } = payload;
        if (!otherUserId) {
          return callback?.({ success: false, error: 'otherUserId is required' });
        }

        if (otherUserId === currentUid) {
          return callback?.({ success: false, error: 'Cannot create a conversation with yourself' });
        }

        const normalizedPostId = postId && typeof postId === 'string' && postId.trim() !== '' ? postId.trim() : null;
        const convType: 'post' | 'direct' = normalizedPostId ? 'post' : 'direct';

        // Check if conversation already exists
        let conv = await findConversation(normalizedPostId, currentUid, otherUserId);
        if (!conv) {
          // Create new conversation
          const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const now = Date.now();
          conv = {
            id: convId,
            postId: normalizedPostId,
            type: convType,
            participantIds: [currentUid, otherUserId],
            createdAt: now,
            updatedAt: now
          };
          await saveConversation(conv);
          console.log(`[Conversation Created] ID: ${conv.id} (${convType}) for post: ${normalizedPostId}`);
        }

        // Join room
        socket.join(`conversation:${conv.id}`);
        callback?.({ success: true, conversation: conv });
      } catch (err: any) {
        console.error('[conversation:get-or-create error]:', err);
        callback?.({ success: false, error: err.message || 'Failed to create conversation' });
      }
    }
  );

  /**
   * Join an existing conversation room with membership validation.
   */
  socket.on(
    'conversation:join',
    async (
      conversationId: string,
      callback?: (res: { success: boolean; conversation?: Conversation; error?: string }) => void
    ) => {
      try {
        if (!conversationId) {
          return callback?.({ success: false, error: 'conversationId required' });
        }

        const conv = await getConversation(conversationId);
        if (!conv) {
          return callback?.({ success: false, error: 'Conversation not found' });
        }

        // Validate membership
        if (!conv.participantIds.includes(currentUid)) {
          return callback?.({
            success: false,
            error: 'Unauthorized: You are not a participant in this conversation'
          });
        }

        const room = `conversation:${conversationId}`;
        socket.join(room);
        console.log(`[Socket Join] UID ${currentUid} joined room ${room}`);
        callback?.({ success: true, conversation: conv });
      } catch (err: any) {
        console.error('[conversation:join error]:', err);
        callback?.({ success: false, error: err.message || 'Failed to join conversation' });
      }
    }
  );

  /**
   * Leave conversation room.
   */
  socket.on('conversation:leave', (conversationId: string) => {
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
    }
  });
}
