import { verifyToken } from '../firebaseAdmin.js';
export async function socketAuthMiddleware(socket, next) {
    try {
        const authData = socket.handshake.auth || {};
        const token = authData.token;
        const devUid = authData.devUid;
        // DEV BYPASS SUPPORT:
        // Strictly allowed ONLY when server is running in non-production mode
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev && devUid && (token === `dev_${devUid}` || token === 'dev_bypass')) {
            socket.data.uid = devUid;
            socket.data.isDev = true;
            console.log(`[Socket Auth] Dev session authorized: ${socket.id} (UID: ${devUid})`);
            return next();
        }
        if (!token) {
            return next(new Error('Authentication failed: No token provided'));
        }
        const uid = await verifyToken(token);
        socket.data.uid = uid;
        socket.data.isDev = false;
        if (isDev) {
            console.log(`[Socket Auth] Socket connected: ${socket.id} (UID: ${uid})`);
        }
        next();
    }
    catch (err) {
        console.error(`[Socket Auth Error] Handshake rejected for ${socket.id}:`, err.message);
        next(new Error(`Authentication failed: ${err.message}`));
    }
}
