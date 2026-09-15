import { findConversationForPair, getConversation, saveConversation, getUserConversations, getThreads, getThread, saveThread, markConversationRead, saveUserProfile } from '../storage.js';
export function registerConversationHandlers(io, socket) {
    const currentUid = socket.data.uid;
    /**
     * Get or create a 1-to-1 conversation between currentUid and otherUserId,
     * supporting multiple threads (General and Post-based).
     */
    socket.on('conversation:get-or-create', async (payload, callback) => {
        try {
            const { postId, threadId: requestedThreadId, postTitle, postSubtitle, postLocation, otherUserId, senderProfile, otherUserProfile } = payload;
            if (!otherUserId) {
                return callback?.({ success: false, error: 'otherUserId is required' });
            }
            if (otherUserId === currentUid) {
                return callback?.({
                    success: false,
                    error: 'Cannot create a conversation with yourself'
                });
            }
            // Save participant profiles if provided
            if (senderProfile) {
                await saveUserProfile({ id: currentUid, ...senderProfile });
            }
            if (otherUserProfile) {
                await saveUserProfile({ id: otherUserId, ...otherUserProfile });
            }
            // 1. Find or create the single conversation for this user pair
            let conv = await findConversationForPair(currentUid, otherUserId);
            let isNewConv = false;
            const now = Date.now();
            if (!conv) {
                isNewConv = true;
                // Deterministic or clean unique pair ID
                const sortedUids = [currentUid, otherUserId].sort();
                const convId = `conv_${sortedUids.join('_')}`;
                conv = {
                    id: convId,
                    participantIds: [currentUid, otherUserId],
                    participantDetails: {},
                    unreadCounts: {
                        [currentUid]: 0,
                        [otherUserId]: 0
                    },
                    createdAt: now,
                    updatedAt: now
                };
                if (senderProfile) {
                    conv.participantDetails[currentUid] = senderProfile;
                }
                if (otherUserProfile) {
                    conv.participantDetails[otherUserId] = otherUserProfile;
                }
                await saveConversation(conv);
                console.log(`[Conversation Created] ID: ${conv.id} between ${currentUid} and ${otherUserId}`);
            }
            else {
                // Update profile details if needed
                let needsUpdate = false;
                if (!conv.participantDetails)
                    conv.participantDetails = {};
                if (senderProfile && !conv.participantDetails[currentUid]) {
                    conv.participantDetails[currentUid] = senderProfile;
                    needsUpdate = true;
                }
                if (otherUserProfile && !conv.participantDetails[otherUserId]) {
                    conv.participantDetails[otherUserId] = otherUserProfile;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    await saveConversation(conv);
                }
            }
            // 2. Ensure default General thread exists
            let generalThread = await getThread(conv.id, 'general');
            if (!generalThread) {
                generalThread = {
                    id: 'general',
                    conversationId: conv.id,
                    type: 'general',
                    title: 'General',
                    createdAt: now,
                    updatedAt: now,
                    unreadCounts: {
                        [currentUid]: 0,
                        [otherUserId]: 0
                    }
                };
                await saveThread(generalThread);
            }
            // 3. Resolve target thread (General or Post-specific)
            let targetThread = null;
            if (postId) {
                const threadId = requestedThreadId || `post_${postId.trim()}`;
                targetThread = await getThread(conv.id, threadId);
                if (!targetThread) {
                    targetThread = {
                        id: threadId,
                        conversationId: conv.id,
                        type: 'post',
                        postId: postId.trim(),
                        title: postTitle ? postTitle.trim() : 'Post Discussion',
                        postSubtitle: postSubtitle ? postSubtitle.trim() : undefined,
                        postLocation: postLocation ? postLocation.trim() : undefined,
                        createdAt: now,
                        updatedAt: now,
                        unreadCounts: {
                            [currentUid]: 0,
                            [otherUserId]: 0
                        }
                    };
                    await saveThread(targetThread);
                }
                else if (postTitle && (!targetThread.title || targetThread.title === 'Post Discussion')) {
                    targetThread.title = postTitle.trim();
                    if (postSubtitle)
                        targetThread.postSubtitle = postSubtitle.trim();
                    await saveThread(targetThread);
                }
            }
            else {
                targetThread = generalThread;
            }
            // 4. Join socket to rooms
            socket.join(`conversation:${conv.id}`);
            if (targetThread) {
                socket.join(`conversation:${conv.id}:thread:${targetThread.id}`);
            }
            // 5. Emit conversation:updated if brand new conversation or thread
            if (isNewConv) {
                io.to(`user:${currentUid}`).emit('conversation:updated', conv);
                io.to(`user:${otherUserId}`).emit('conversation:updated', conv);
            }
            const threads = await getThreads(conv.id);
            callback?.({
                success: true,
                conversation: conv,
                thread: targetThread,
                threads
            });
        }
        catch (err) {
            console.error('[conversation:get-or-create error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to create conversation' });
        }
    });
    /**
     * Retrieve all conversations for the current user.
     */
    socket.on('conversation:list', async (callback) => {
        try {
            const list = await getUserConversations(currentUid);
            callback?.({ success: true, conversations: list });
        }
        catch (err) {
            console.error('[conversation:list error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to list conversations' });
        }
    });
    /**
     * Retrieve all threads for a specific conversation.
     */
    socket.on('thread:list', async (payload, callback) => {
        try {
            const { conversationId } = payload || {};
            if (!conversationId) {
                return callback?.({ success: false, error: 'conversationId required' });
            }
            const conv = await getConversation(conversationId);
            if (!conv || !conv.participantIds.includes(currentUid)) {
                return callback?.({ success: false, error: 'Unauthorized or not found' });
            }
            const threads = await getThreads(conversationId);
            callback?.({ success: true, threads });
        }
        catch (err) {
            console.error('[thread:list error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to list threads' });
        }
    });
    /**
     * Join an existing conversation and thread room.
     */
    socket.on('conversation:join', async (payload, callback) => {
        try {
            const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
            const threadId = typeof payload === 'object' ? payload?.threadId : undefined;
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
            socket.join(`conversation:${conversationId}`);
            if (threadId) {
                socket.join(`conversation:${conversationId}:thread:${threadId}`);
            }
            const threads = await getThreads(conversationId);
            callback?.({ success: true, conversation: conv, threads });
        }
        catch (err) {
            console.error('[conversation:join error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to join conversation' });
        }
    });
    /**
     * Join a specific thread room.
     */
    socket.on('thread:join', (payload) => {
        if (payload?.conversationId && payload?.threadId) {
            socket.join(`conversation:${payload.conversationId}:thread:${payload.threadId}`);
        }
    });
    /**
     * Leave a specific thread room.
     */
    socket.on('thread:leave', (payload) => {
        if (payload?.conversationId && payload?.threadId) {
            socket.leave(`conversation:${payload.conversationId}:thread:${payload.threadId}`);
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
    /**
     * Mark a thread or entire conversation as read by the current user.
     */
    socket.on('conversation:read', async (payload, callback) => {
        try {
            const { conversationId, threadId } = payload || {};
            if (!conversationId) {
                return callback?.({ success: false, error: 'conversationId is required' });
            }
            const updatedConv = await markConversationRead(conversationId, currentUid, threadId);
            if (updatedConv) {
                // Notify user's personal room of unread count update
                io.to(`user:${currentUid}`).emit('conversation:updated', updatedConv);
                // If threadId provided, also emit thread:updated to conversation room
                if (threadId) {
                    const thread = await getThread(conversationId, threadId);
                    if (thread) {
                        io.to(`conversation:${conversationId}`).emit('thread:updated', thread);
                    }
                }
                callback?.({ success: true, conversation: updatedConv });
            }
            else {
                callback?.({ success: false, error: 'Conversation not found' });
            }
        }
        catch (err) {
            console.error('[conversation:read error]:', err);
            callback?.({ success: false, error: err.message || 'Failed to mark conversation as read' });
        }
    });
}
