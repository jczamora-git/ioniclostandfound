<template>
  <div
    class="conversation-row"
    :class="{ unread: unreadCount > 0 }"
    @click="$emit('select', conversation.id)"
  >
    <!-- Avatar of the other user -->
    <div class="row-avatar-wrap">
      <UserAvatar
        :name="conversation.otherParticipant?.name || 'User'"
        :username="conversation.otherParticipant?.username || 'user'"
        :avatar-url="conversation.otherParticipant?.avatarUrl"
        size="md"
      />
      <span v-if="unreadCount > 0" class="unread-badge-dot" aria-label="Unread message"></span>
    </div>

    <!-- Details -->
    <div class="row-main">
      <div class="row-top-line">
        <span class="user-name">{{ conversation.otherParticipant?.name || 'Community Member' }}</span>
        <div class="row-meta-right">
          <span v-if="unreadCount > 0" class="row-unread-count-badge">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
          <span v-if="relativeTime" class="row-time">{{ relativeTime }}</span>
        </div>
      </div>

      <p class="row-last-message">
        <span v-if="postThreadTitle" class="thread-title-prefix">{{ postThreadTitle }} · </span>
        <span>{{ conversation.lastMessage || 'Conversation started' }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UserAvatar from './UserAvatar.vue';
import { sessionUid } from '../composables/useAuth';
import type { ConversationWithMeta } from '../types/conversation';

const props = defineProps<{
  conversation: ConversationWithMeta;
}>();

defineEmits<{
  (e: 'select', id: string): void;
}>();

const unreadCount = computed<number>(() => {
  const uid = sessionUid.value;
  if (
    uid &&
    props.conversation.unreadCounts &&
    typeof props.conversation.unreadCounts[uid] === 'number'
  ) {
    return props.conversation.unreadCounts[uid];
  }
  return props.conversation.unreadCount || (props.conversation.unread ? 1 : 0);
});

const relativeTime = computed(() => {
  const timestamp = props.conversation.lastMessageAt || props.conversation.updatedAt;
  if (!timestamp) return '';

  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
});

const postThreadTitle = computed(() => {
  const title = props.conversation.lastMessageThreadTitle;
  if (title && title.toLowerCase() !== 'general' && title.trim() !== '') {
    return title.trim();
  }
  return null;
});
</script>

<style scoped>
.thread-title-prefix {
  font-weight: 600;
  color: var(--app-primary, #2f9fe8);
}

.conversation-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--app-card-border);
}

.conversation-row:hover {
  background-color: var(--app-surface-secondary);
}

.conversation-row:active {
  background-color: var(--app-surface-tertiary);
}

.conversation-row.unread {
  background-color: rgba(47, 159, 232, 0.04);
}

.row-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.unread-badge-dot {
  position: absolute;
  top: 0;
  right: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background-color: var(--app-primary, #2f9fe8);
  border: 1.5px solid var(--app-surface, #ffffff);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-top-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.row-unread-count-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: var(--app-primary, #2f9fe8);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.row-time {
  font-size: 12px;
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.row-post-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.post-type-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--app-text-tertiary);
}

.post-type-bullet.lost {
  background-color: var(--app-lost, #f04444);
}

.post-type-bullet.found {
  background-color: var(--app-found, #22b573);
}

.post-title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-last-message {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-row.unread .user-name {
  font-weight: 700;
  color: var(--app-text-primary);
}

.conversation-row.unread .row-last-message {
  color: var(--app-text-primary);
  font-weight: 600;
}
</style>
