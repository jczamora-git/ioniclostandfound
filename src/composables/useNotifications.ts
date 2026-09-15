import { ref, computed } from 'vue';
import { ref as dbRef, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';
import { useAuth, sessionUid, getSessionUser } from './useAuth';
import { useChatSocket } from './useChatSocket';
import type { AppNotification } from '../types/notification';

const notifications = ref<AppNotification[]>([]);
const loading = ref(false);
let isSubscribed = false;
let socketListenersRegistered = false;

export const unreadNotificationCount = computed<number>(() => {
  return notifications.value.filter((n) => !n.read).length;
});

export function useNotifications() {
  const { currentProfile } = useAuth();
  const { initSocket } = useChatSocket();

  const sortNotifications = () => {
    notifications.value.sort((a, b) => b.createdAt - a.createdAt);
  };

  /**
   * Subscribe to real-time notifications for the active user.
   */
  const subscribeToNotifications = async () => {
    const session = await getSessionUser();
    const myUid = session?.uid || sessionUid.value;
    if (!myUid) return;

    if (isSubscribed) return;
    isSubscribed = true;
    loading.value = true;

    // 1. Setup Socket.IO real-time listener
    try {
      const socket = await initSocket();

      if (!socketListenersRegistered) {
        socketListenersRegistered = true;

        socket.on('notification:new', (notif: AppNotification) => {
          if (notif && !notifications.value.some((n) => n.id === notif.id)) {
            notifications.value.unshift(notif);
            sortNotifications();
          }
        });

        socket.on('notification:read', (payload: { notificationId: string }) => {
          const target = notifications.value.find((n) => n.id === payload.notificationId);
          if (target) {
            target.read = true;
          }
        });

        socket.on('notification:read-all', () => {
          notifications.value.forEach((n) => {
            n.read = true;
          });
        });
      }

      // Initial load via socket / REST
      socket.emit(
        'notification:list',
        (res: { success: boolean; notifications?: AppNotification[] }) => {
          if (res && res.success && Array.isArray(res.notifications)) {
            // Merge with existing avoiding duplicates
            res.notifications.forEach((notif) => {
              if (!notifications.value.some((n) => n.id === notif.id)) {
                notifications.value.push(notif);
              }
            });
            sortNotifications();
            loading.value = false;
          }
        }
      );
    } catch (err) {
      console.warn('[useNotifications] Socket connection warning:', err);
    }

    // 2. Fallback to REST endpoint
    try {
      const SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || 'http://localhost:3000';
      const res = await fetch(`${SERVER_URL}/api/notifications/${myUid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          data.notifications.forEach((notif: AppNotification) => {
            if (!notifications.value.some((n) => n.id === notif.id)) {
              notifications.value.push(notif);
            }
          });
          sortNotifications();
        }
      }
    } catch {}

    // 3. Real Firebase RTDB listener if available
    try {
      const notifsRef = dbRef(db, `notifications/${myUid}`);
      onValue(notifsRef, (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          Object.entries(val).forEach(([id, item]: [string, any]) => {
            const existing = notifications.value.find((n) => n.id === id);
            if (existing) {
              existing.read = Boolean(item.read);
            } else {
              notifications.value.push({
                id,
                type: item.type || 'comment',
                actorId: item.actorId || 'anonymous',
                actorName: item.actorName || 'Community Member',
                actorUsername: item.actorUsername,
                actorAvatarUrl: item.actorAvatarUrl || null,
                postId: item.postId,
                postTitle: item.postTitle,
                commentId: item.commentId,
                text: item.text || '',
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
                read: Boolean(item.read)
              });
            }
          });
          sortNotifications();
        }
        loading.value = false;
      });
    } catch {
      loading.value = false;
    }
  };

  /**
   * Mark a single notification as read.
   */
  const markAsRead = async (notificationId: string) => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    const target = notifications.value.find((n) => n.id === notificationId);
    if (target) {
      target.read = true;
    }

    // Update Firebase RTDB
    if (myUid) {
      try {
        await update(dbRef(db, `notifications/${myUid}/${notificationId}`), { read: true });
      } catch {}

      // Update Socket/Server
      try {
        const socket = await initSocket();
        socket.emit('notification:read', { notificationId });
      } catch {}

      // Fallback REST
      try {
        const SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || 'http://localhost:3000';
        fetch(`${SERVER_URL}/api/notifications/${myUid}/read/${notificationId}`, {
          method: 'POST'
        }).catch(() => {});
      } catch {}
    }
  };

  /**
   * Mark all notifications as read for current user.
   */
  const markAllAsRead = async () => {
    const myUid = sessionUid.value || currentProfile.value?.id;
    notifications.value.forEach((n) => {
      n.read = true;
    });

    if (myUid) {
      // Update Firebase RTDB
      try {
        const updates: Record<string, any> = {};
        notifications.value.forEach((n) => {
          updates[`notifications/${myUid}/${n.id}/read`] = true;
        });
        await update(dbRef(db), updates);
      } catch {}

      // Update Socket
      try {
        const socket = await initSocket();
        socket.emit('notification:read-all');
      } catch {}

      // Fallback REST
      try {
        const SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || 'http://localhost:3000';
        fetch(`${SERVER_URL}/api/notifications/${myUid}/read-all`, {
          method: 'POST'
        }).catch(() => {});
      } catch {}
    }
  };

  /**
   * Create and deliver a comment notification to the post author.
   * Only creates notification if commenter is NOT the post author.
   */
  const createCommentNotification = async (params: {
    postAuthorId: string;
    postId: string;
    postTitle?: string;
    commentId: string;
    commentText: string;
  }) => {
    const session = await getSessionUser();
    const currentUid = session?.uid || currentProfile.value?.id;
    if (!currentUid) return;

    // Do not notify author about their own comment
    if (params.postAuthorId === currentUid) {
      return;
    }

    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notification: AppNotification = {
      id: notifId,
      type: 'comment',
      actorId: currentUid,
      actorName: currentProfile.value?.name || session?.name || 'Community Member',
      actorUsername: currentProfile.value?.username || session?.username || 'user',
      actorAvatarUrl: currentProfile.value?.avatarUrl || null,
      postId: params.postId,
      postTitle: params.postTitle,
      commentId: params.commentId,
      text: params.commentText.trim().slice(0, 100),
      createdAt: Date.now(),
      read: false
    };

    // 1. Try Firebase RTDB
    try {
      await set(dbRef(db, `notifications/${params.postAuthorId}/${notifId}`), notification);
    } catch (err) {
      // Silently continue to socket/REST delivery if RTDB auth fails
    }

    // 2. Deliver via real-time Socket to target user room
    try {
      const socket = await initSocket();
      socket.emit('notification:send', {
        targetUserId: params.postAuthorId,
        notification
      });
    } catch (err) {
      console.warn('[useNotifications] Failed to emit notification via socket:', err);
    }
  };

  return {
    notifications,
    loading,
    unreadCount: unreadNotificationCount,
    subscribeToNotifications,
    markAsRead,
    markAllAsRead,
    createCommentNotification
  };
}
