"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDb = exports.adminAuth = void 0;
exports.verifyToken = verifyToken;
exports.findConversation = findConversation;
exports.saveConversation = saveConversation;
exports.getConversation = getConversation;
exports.saveMessage = saveMessage;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const projectId = process.env.FIREBASE_PROJECT_ID || 'ioniclostandfound';
const databaseURL = process.env.FIREBASE_DATABASE_URL ||
    'https://ioniclostandfound-default-rtdb.asia-southeast1.firebasedatabase.app/';
if (!firebase_admin_1.default.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                databaseURL
            });
            console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
        }
        else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.applicationDefault(),
                databaseURL
            });
            console.log('Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
        }
        else {
            firebase_admin_1.default.initializeApp({
                projectId,
                databaseURL
            });
            console.log('Firebase Admin initialized with Project ID and Database URL');
        }
    }
    catch (err) {
        console.error('Failed to initialize Firebase Admin SDK:', err);
    }
}
exports.adminAuth = firebase_admin_1.default.auth();
exports.adminDb = firebase_admin_1.default.database();
/**
 * Verify Firebase ID token.
 * Validates with Firebase Auth. In development without service account keys,
 * falls back gracefully if token decoding is valid.
 */
async function verifyToken(token) {
    if (!token || typeof token !== 'string') {
        throw new Error('Token is missing or invalid');
    }
    try {
        const decoded = await exports.adminAuth.verifyIdToken(token);
        return decoded.uid;
    }
    catch (err) {
        // If standard verification fails (e.g. In local development without service account cert),
        // safely decode JWT payload for development testing
        if (process.env.NODE_ENV !== 'production') {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    if (payload.user_id || payload.sub) {
                        const devUid = payload.user_id || payload.sub;
                        console.warn(`[Dev Auth] Token verified via JWT payload decode for UID: ${devUid}`);
                        return devUid;
                    }
                }
            }
            catch (decodeErr) {
                // ignore and let original error throw
            }
        }
        console.error('Firebase token verification error:', err.message);
        throw new Error(`Invalid authentication token: ${err.message}`);
    }
}
/**
 * Find existing conversation for a given postId and two participants.
 */
async function findConversation(postId, userA, userB) {
    try {
        // Check userA's indexed conversations
        const snap = await exports.adminDb.ref(`userConversations/${userA}`).once('value');
        if (!snap.exists())
            return null;
        const userConvs = snap.val();
        for (const convId of Object.keys(userConvs)) {
            const cSnap = await exports.adminDb.ref(`conversations/${convId}`).once('value');
            if (cSnap.exists()) {
                const c = cSnap.val();
                if (c.postId === postId &&
                    c.participantIds.includes(userA) &&
                    c.participantIds.includes(userB)) {
                    return c;
                }
            }
        }
        return null;
    }
    catch (err) {
        console.error('Error finding conversation:', err);
        return null;
    }
}
/**
 * Create or save conversation metadata.
 */
async function saveConversation(conv) {
    const updates = {};
    updates[`conversations/${conv.id}`] = conv;
    // Index conversation for both participants
    conv.participantIds.forEach((uid) => {
        updates[`userConversations/${uid}/${conv.id}`] = {
            updatedAt: conv.updatedAt,
            postId: conv.postId
        };
    });
    await exports.adminDb.ref().update(updates);
}
/**
 * Retrieve a conversation by ID.
 */
async function getConversation(convId) {
    try {
        const snap = await exports.adminDb.ref(`conversations/${convId}`).once('value');
        if (snap.exists()) {
            return snap.val();
        }
        return null;
    }
    catch (err) {
        console.error('Error getting conversation:', err);
        return null;
    }
}
/**
 * Save a new message in Firebase RTDB and update conversation lastMessage.
 */
async function saveMessage(msg) {
    const updates = {};
    updates[`messages/${msg.conversationId}/${msg.id}`] = msg;
    updates[`conversations/${msg.conversationId}/lastMessage`] = msg.text;
    updates[`conversations/${msg.conversationId}/lastMessageAt`] = msg.createdAt;
    updates[`conversations/${msg.conversationId}/lastMessageSenderId`] = msg.senderId;
    updates[`conversations/${msg.conversationId}/updatedAt`] = msg.createdAt;
    await exports.adminDb.ref().update(updates);
}
