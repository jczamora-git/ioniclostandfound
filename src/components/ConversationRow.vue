<template>
  <div
    class="conversation-row"
    :class="{ unread: conversation.unread }"
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
      <span v-if="conversation.unread" class="unread-badge-dot" aria-label="Unread message"></span>
    </div>

    <!-- Details -->
    <div class="row-main">
      <div class="row-top-line">
        <span class="user-name">{{ conversation.otherParticipant?.name || 'Community Member' }}</span>
        <span v-if="relativeTime" class="row-time">{{ relativeTime }}</span>
      </div>

      <div v-if="conversation.post" class="row-post-tag">
        <span class="post-type-bullet" :class="conversation.post.type"></span>
        <span class="post-title">{{ conversation.post.title }}</span>
      </div>

      <p class="row-last-message">
        {{ conversation.lastMessage || 'Conversation started' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UserAvatar from './UserAvatar.vue';
import type { ConversationWithMeta } from '../types/conversation';

const props = defineProps<{
  conversation: ConversationWithMeta;
}>();

defineEmits<{
  (e: 'select', id: string): void;
}>();

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
</script>

<style scoped>
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

.row-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.unread-badge-dot {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--app-primary);
  border: 2px solid var(--app-surface);
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

.row-time {
  font-size: 12px;
  color: var(--app-text-tertiary);
  flex-shrink: 0;
  margin-left: 8px;
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
}

.conversation-row.unread .row-last-message {
  color: var(--app-text-primary);
  font-weight: 600;
}
</style>
