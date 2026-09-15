<template>
  <ion-modal
    :is-open="isOpen"
    :breakpoints="[0, 0.7, 1]"
    :initial-breakpoint="0.7"
    class="notifications-sheet-modal"
    @did-dismiss="$emit('close')"
  >
    <div class="notifications-sheet-container">
      <!-- Modal Header -->
      <div class="notif-header">
        <div class="notif-header-left">
          <h2 class="notif-title">Notifications</h2>
          <span v-if="unreadCount > 0" class="notif-unread-count-pill">
            {{ unreadCount }} new
          </span>
        </div>

        <div class="notif-header-actions">
          <button
            v-if="unreadCount > 0"
            type="button"
            class="mark-all-read-btn"
            @click="handleMarkAllRead"
          >
            Mark all read
          </button>
          <button
            type="button"
            class="close-sheet-btn"
            aria-label="Close notifications"
            @click="$emit('close')"
          >
            <X :size="20" />
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="notif-content-scroll">
        <!-- Loading -->
        <div v-if="loading && notifications.length === 0" class="notif-loading">
          <ion-spinner name="crescent" />
          <span>Loading notifications...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="notifications.length === 0" class="notif-empty-state">
          <div class="notif-empty-bubble">
            <Bell :size="32" />
          </div>
          <h3 class="empty-heading">No notifications yet</h3>
          <p class="empty-sub">
            When community members comment on your posts, you'll see live alerts here.
          </p>
        </div>

        <!-- Notifications List -->
        <div v-else class="notif-list" role="list">
          <div
            v-for="item in notifications"
            :key="item.id"
            class="notif-row"
            :class="{ unread: !item.read }"
            role="listitem"
            @click="handleClickNotification(item)"
          >
            <!-- Avatar -->
            <div class="notif-avatar-wrap">
              <UserAvatar
                :name="item.actorName || 'User'"
                :username="item.actorUsername || 'user'"
                :avatar-url="item.actorAvatarUrl"
                size="md"
              />
              <span v-if="!item.read" class="notif-unread-dot" aria-label="Unread notification"></span>
            </div>

            <!-- Details -->
            <div class="notif-details">
              <div class="notif-line-1">
                <span class="notif-actor-name">{{ item.actorName }}</span>
                <span v-if="item.type === 'merit_awarded'" class="notif-action-text merit-text">awarded you a Community Merit 🏅</span>
                <span v-else-if="item.type === 'reply'" class="notif-action-text">replied to your comment</span>
                <span v-else class="notif-action-text">commented on your post</span>
              </div>

              <p v-if="item.text && item.type !== 'merit_awarded'" class="notif-comment-quote">
                &ldquo;{{ item.text }}&rdquo;
              </p>

              <div class="notif-meta">
                <span class="notif-time">{{ formatTime(item.createdAt) }}</span>
                <span v-if="item.postTitle" class="notif-post-ref">&bull; {{ item.postTitle }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonSpinner } from '@ionic/vue';
import { Bell, X } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import UserAvatar from './UserAvatar.vue';
import { useNotifications } from '../composables/useNotifications';
import type { AppNotification } from '../types/notification';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();
const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();

const formatTime = (timestamp: number): string => {
  if (!timestamp) return 'just now';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const handleMarkAllRead = async () => {
  await markAllAsRead();
};

const handleClickNotification = async (item: AppNotification) => {
  if (!item.read) {
    await markAsRead(item.id);
  }
  emit('close');
  if (item.postId) {
    router.push(`/post/${item.postId}`);
  }
};
</script>

<style scoped>
.notifications-sheet-modal {
  --background: var(--app-surface, #ffffff);
  --border-radius: 20px 20px 0 0;
}

.notifications-sheet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-surface, #ffffff);
  color: var(--app-text-primary, #0f172a);
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--app-card-border, #e2e8f0);
}

.notif-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notif-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text-primary, #0f172a);
  letter-spacing: -0.3px;
}

.notif-unread-count-pill {
  padding: 2px 8px;
  border-radius: 10px;
  background-color: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  font-size: 11px;
  font-weight: 700;
}

.notif-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mark-all-read-btn {
  background: transparent;
  border: none;
  color: var(--app-primary, #2f9fe8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  transition: opacity 0.15s ease;
}

.mark-all-read-btn:active {
  opacity: 0.65;
}

.close-sheet-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-surface-secondary, #f1f5f9);
  border: none;
  border-radius: 50%;
  color: var(--app-text-secondary, #64748b);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.close-sheet-btn:active {
  background-color: var(--app-surface-tertiary, #e2e8f0);
}

.notif-content-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
}

.notif-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--app-text-secondary, #64748b);
  font-size: 14px;
}

.notif-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 70px 24px;
  gap: 10px;
}

.notif-empty-bubble {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--app-surface-secondary, #f1f5f9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-tertiary, #94a3b8);
  margin-bottom: 4px;
}

.empty-heading {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-primary, #0f172a);
}

.empty-sub {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary, #64748b);
  max-width: 260px;
  line-height: 1.4;
}

.notif-list {
  display: flex;
  flex-direction: column;
}

.notif-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--app-card-border, #e2e8f0);
}

.notif-row:hover {
  background-color: var(--app-surface-secondary, #f8fafc);
}

.notif-row:active {
  background-color: var(--app-surface-tertiary, #f1f5f9);
}

.notif-row.unread {
  background-color: rgba(47, 159, 232, 0.05);
}

.notif-avatar-wrap {
  position: relative;
  flex-shrink: 0;
  margin-top: 2px;
}

.notif-unread-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: var(--app-primary, #2f9fe8);
  border: 1.5px solid var(--app-surface, #ffffff);
}

.notif-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.notif-line-1 {
  font-size: 14px;
  line-height: 1.35;
  color: var(--app-text-primary, #0f172a);
}

.notif-actor-name {
  font-weight: 700;
  margin-right: 4px;
}

.notif-action-text {
  color: var(--app-text-secondary, #64748b);
}

.merit-text {
  color: var(--app-primary, #2f9fe8);
  font-weight: 600;
}

.notif-row.unread .notif-action-text {
  color: var(--app-text-primary, #0f172a);
}

.notif-comment-quote {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--app-text-secondary, #475569);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
}

.notif-row.unread .notif-comment-quote {
  color: var(--app-text-primary, #0f172a);
  font-weight: 500;
}

.notif-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--app-text-tertiary, #94a3b8);
  margin-top: 2px;
}

.notif-time {
  font-weight: 500;
}

.notif-post-ref {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
