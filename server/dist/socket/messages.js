import { getConversation, getThread, saveMessage, getThreadMessages, getConversationMessages } from '../storage.js';
export function registerMessageHandlers(io, socket) {
    const currentUid = socket.data.uid;
    /**
     * Send a new message inside a specific conversation thread.
     */
    socket.on('message:send', async (payload, callback) => {
        try {
            const { conversationId, threadId: rawThreadId, text, imageUrl, imageKey } = payload;
            if (!conversationId) {
                return callback?.({ success: false, error: 'conversationId is required' });
            }
            const threadId = rawThreadId || 'general';
            const trimmed = (text || '').trim();
            const cleanImageUrl = imageUrl && typeof imageUrl === 'string' ? imageUrl.trim() : null;
            const cleanImageKey = imageKey && typeof imageKey === 'string' ? imageKey.trim() : null;
            if (!trimmed && !cleanImageUrl) {
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
            const message = {
                id: messageId,
                conversationId,
                threadId,
                senderId: currentUid,
                text: trimmed,
                ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
                ...(cleanImageKey ? { imageKey: cleanImageKey } : {}),
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
        }
        catch (err) {
            console.error('[message:send error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to send message' });
        }
    });
    /**
     * Retrieve message history for a conversation thread.
     */
    socket.on('messages:list', async (payload, callback) => {
        try {
            const { conversationId, threadId: rawThreadId } = payload || {};
            if (!conversationId) {
                return callback?.({ success: false, error: 'conversationId is required' });
            }
            const messages = !rawThreadId || rawThreadId === 'all'
                ? await getConversationMessages(conversationId)
                : await getThreadMessages(conversationId, rawThreadId);
            callback?.({ success: true, messages });
        }
        catch (err) {
            console.error('[messages:list error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to load messages' });
        }
    });
    /**
     * Ephemeral Typing indicators (per thread).
     */
    socket.on('typing:start', (payload) => {
        if (payload?.conversationId) {
            const threadId = payload.threadId || 'general';
            socket.to(`conversation:${payload.conversationId}:thread:${threadId}`).emit('typing:start', {
                conversationId: payload.conversationId,
                threadId,
                uid: currentUid
            });
        }
    });
    socket.on('typing:stop', (payload) => {
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
