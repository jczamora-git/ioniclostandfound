"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConversationHandlers = registerConversationHandlers;
const firebaseAdmin_js_1 = require("../firebaseAdmin.js");
function registerConversationHandlers(io, socket) {
    const currentUid = socket.data.uid;
    /**
     * Get or create a 1-to-1 conversation for a post between currentUser and otherUser.
     */
    socket.on('conversation:get-or-create', async (payload, callback) => {
        try {
            const { postId, otherUserId } = payload;
            if (!postId || !otherUserId) {
                return callback?.({ success: false, error: 'postId and otherUserId are required' });
            }
            if (otherUserId === currentUid) {
                return callback?.({ success: false, error: 'Cannot create a conversation with yourself' });
            }
            // Check if conversation already exists
            let conv = await (0, firebaseAdmin_js_1.findConversation)(postId, currentUid, otherUserId);
            if (!conv) {
                // Create new conversation
                const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const now = Date.now();
                conv = {
                    id: convId,
                    postId,
                    participantIds: [currentUid, otherUserId],
                    createdAt: now,
                    updatedAt: now
                };
                await (0, firebaseAdmin_js_1.saveConversation)(conv);
                console.log(`[Conversation Created] ID: ${conv.id} for post: ${postId}`);
            }
            // Join room
            socket.join(`conversation:${conv.id}`);
            callback?.({ success: true, conversation: conv });
        }
        catch (err) {
            console.error('[conversation:get-or-create error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to create conversation' });
        }
    });
    /**
     * Join an existing conversation room with membership validation.
     */
    socket.on('conversation:join', async (conversationId, callback) => {
        try {
            if (!conversationId) {
                return callback?.({ success: false, error: 'conversationId required' });
            }
            const conv = await (0, firebaseAdmin_js_1.getConversation)(conversationId);
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
        }
        catch (err) {
            console.error('[conversation:join error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to join conversation' });
        }
    });
    /**
     * Leave conversation room.
     */
    socket.on('conversation:leave', (conversationId) => {
        if (conversationId) {
            socket.leave(`conversation:${conversationId}`);
        }
    });
}
