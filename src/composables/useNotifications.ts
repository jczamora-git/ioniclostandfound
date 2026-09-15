import { ref, computed } from 'vue';
import { ref as dbRef, onValue, set, update, get } from 'firebase/database';
import { db } from '../firebase';
import { useAuth, sessionUid, getSessionUser } from './useAuth';
import { getApiServerUrl } from '../services/socket';
import type { AppNotification } from '../types/notification';

const notifications = ref<AppNotification[]>([]);
const loading = ref(false);
let isSubscribed = false;

export const unreadNotificationCount = computed<number>(() => {
  return notifications.value.filter((n) => !n.read).length;
});

export function useNotifications() {
  const { currentProfile } = useAuth();

  const sortNotifications = () => {
    notifications.value.sort((a, b) => b.createdAt - a.createdAt);
  };

  /**
   * Subscribe to notifications for the active user.
   */
  const subscribeToNotifications = async () => {
    const session = await getSessionUser();
    const myUid = session?.uid || sessionUid.value;
    if (!myUid) return;

    if (isSubscribed) return;
    isSubscribed = true;
    loading.value = true;

    // 1. Firebase RTDB listener
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

    // 2. Initial fetch / Fallback via REST
    try {
      const serverUrl = getApiServerUrl();
      if (serverUrl) {
        const res = await fetch(`${serverUrl}/api/notifications/${myUid}`);
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
      }
    } catch {}
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

    if (myUid) {
      try {
        await update(dbRef(db, `notifications/${myUid}/${notificationId}`), { read: true });
      } catch {}

      try {
        const serverUrl = getApiServerUrl();
        if (serverUrl) {
          fetch(`${serverUrl}/api/notifications/${myUid}/read/${notificationId}`, {
            method: 'POST'
          }).catch(() => {});
        }
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
      try {
        const updates: Record<string, any> = {};
        notifications.value.forEach((n) => {
          updates[`notifications/${myUid}/${n.id}/read`] = true;
        });
        await update(dbRef(db), updates);
      } catch {}

      try {
        const serverUrl = getApiServerUrl();
        if (serverUrl) {
          fetch(`${serverUrl}/api/notifications/${myUid}/read-all`, {
            method: 'POST'
          }).catch(() => {});
        }
      } catch {}
    }
  };

  /**
   * Create and deliver a comment notification to the post author.
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

    try {
      await set(dbRef(db, `notifications/${params.postAuthorId}/${notifId}`), notification);
    } catch {}
  };

  /**
   * Create and deliver a reply notification to the parent comment author.
   */
  const createReplyNotification = async (params: {
    targetAuthorId: string;
    postId: string;
    postTitle?: string;
    commentId: string;
    replyText: string;
  }) => {
    const session = await getSessionUser();
    const currentUid = session?.uid || currentProfile.value?.id;
    if (!currentUid) return;

    if (params.targetAuthorId === currentUid) {
      return;
    }

    const notifId = `notif_reply_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notification: AppNotification = {
      id: notifId,
      type: 'reply',
      actorId: currentUid,
      actorName: currentProfile.value?.name || session?.name || 'Community Member',
      actorUsername: currentProfile.value?.username || session?.username || 'user',
      actorAvatarUrl: currentProfile.value?.avatarUrl || null,
      postId: params.postId,
      postTitle: params.postTitle,
      commentId: params.commentId,
      text: params.replyText.trim().slice(0, 100),
      createdAt: Date.now(),
      read: false
    };

    try {
      await set(dbRef(db, `notifications/${params.targetAuthorId}/${notifId}`), notification);
    } catch {}
  };

  /**
   * Create and deliver a community merit notification to the helper.
   */
  const createMeritNotification = async (params: {
    recipientId: string;
    postId: string;
    postTitle?: string;
    awardedByName: string;
  }) => {
    const session = await getSessionUser();
    const currentUid = session?.uid || currentProfile.value?.id;
    if (!currentUid) return;

    if (params.recipientId === currentUid) {
      return;
    }

    const notifId = `notif_merit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notification: AppNotification = {
      id: notifId,
      type: 'merit_awarded',
      actorId: currentUid,
      actorName: params.awardedByName || currentProfile.value?.name || 'A community member',
      actorUsername: currentProfile.value?.username || session?.username || 'user',
      actorAvatarUrl: currentProfile.value?.avatarUrl || null,
      postId: params.postId,
      postTitle: params.postTitle,
      text: `${params.awardedByName} awarded you a Community Merit for helping recover ${params.postTitle || 'this item'}.`,
      createdAt: Date.now(),
      read: false
    };

    try {
      await set(dbRef(db, `notifications/${params.recipientId}/${notifId}`), notification);
    } catch {}
  };

  return {
    notifications,
    loading,
    unreadCount: unreadNotificationCount,
    subscribeToNotifications,
    markAsRead,
    markAllAsRead,
    createCommentNotification,
    createReplyNotification,
    createMeritNotification
  };
}
