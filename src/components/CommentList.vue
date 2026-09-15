<template>
  <div class="comments-container">
    <div class="comments-header">
      <h3 class="comments-title">
        Comments
        <span v-if="comments.length" class="count-bubble">{{ comments.length }}</span>
      </h3>
    </div>

    <!-- Minimal Empty State -->
    <div v-if="!loading && comments.length === 0" class="empty-comments-minimal">
      <p class="empty-title">No comments yet.</p>
      <p class="empty-sub">Start the conversation.</p>
    </div>

    <!-- Loading Spinner -->
    <div v-if="loading" class="loading-comments">
      <ion-spinner name="crescent" />
      <span>Loading comments...</span>
    </div>

    <!-- Flat Social Comments List (No heavy card boxes) -->
    <div v-else-if="comments.length > 0" class="comments-list">
      <article
        v-for="(comment, index) in comments"
        :key="comment.id"
        class="comment-item"
        :class="{ 'has-top-border': index > 0 }"
      >
        <!-- Author Avatar -->
        <div class="comment-avatar" @click="handleAuthorClick(comment.authorId)">
          <UserAvatar
            :name="getCommentAuthorName(comment)"
            :username="getCommentAuthorUsername(comment)"
            :avatar-url="getCommentAvatarUrl(comment.authorId)"
            size="sm"
          />
        </div>

        <!-- Comment Content Directly -->
        <div class="comment-content">
          <div class="comment-author-row">
            <span class="author-name" @click="handleAuthorClick(comment.authorId)">
              {{ getCommentAuthorName(comment) }}
            </span>
            <span class="author-handle">@{{ getCommentAuthorUsername(comment) }}</span>
            <span class="comment-dot">·</span>
            <span class="comment-time">{{ formatTime(comment.createdAt) }}</span>

            <!-- Delete own comment button -->
            <button
              v-if="currentUserId === comment.authorId"
              type="button"
              class="delete-comment-btn"
              aria-label="Delete comment"
              @click="$emit('delete-comment', comment.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>

          <p class="comment-text">{{ comment.content }}</p>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watchEffect } from "vue";
import { useRouter } from "vue-router";
import { IonSpinner } from "@ionic/vue";
import { Trash2 } from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import { useProfiles } from "../composables/useProfiles";
import type { PostComment } from "../types/comment";

const props = defineProps<{
  comments: PostComment[];
  currentUserId?: string;
  loading?: boolean;
}>();

defineEmits<{
  (e: "delete-comment", id: string): void;
}>();

const router = useRouter();
const { getProfile, loadProfiles } = useProfiles();

watchEffect(() => {
  if (props.comments && props.comments.length > 0) {
    loadProfiles(props.comments.map((c) => c.authorId));
  }
});

const getCommentAuthorName = (comment: PostComment) => {
  return getProfile(comment.authorId)?.name || comment.authorName || "User";
};

const getCommentAuthorUsername = (comment: PostComment) => {
  return getProfile(comment.authorId)?.username || comment.authorUsername || "user";
};

const getCommentAvatarUrl = (authorId: string) => {
  return getProfile(authorId)?.avatarUrl || null;
};

const formatTime = (timestamp: number) => {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

const handleAuthorClick = (authorId: string) => {
  if (authorId) {
    router.push(`/profile/${authorId}`);
  }
};
</script>

<style scoped>
.comments-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comments-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-bubble {
  color: var(--app-text-secondary);
  font-size: 18px;
  font-weight: 700;
}

.empty-comments-minimal {
  padding: 18px 0;
  text-align: left;
}

.empty-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.empty-sub {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.loading-comments {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.comments-list {
  display: flex;
  flex-direction: column;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;
}

.comment-item.has-top-border {
  border-top: 1px solid var(--app-card-border);
}

.comment-avatar {
  cursor: pointer;
  padding-top: 2px;
  flex-shrink: 0;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-author-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}

.author-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  cursor: pointer;
}

.author-handle {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.comment-dot {
  font-size: 11px;
  color: var(--app-text-tertiary);
}

.comment-time {
  font-size: 12px;
  color: var(--app-text-tertiary);
}

.delete-comment-btn {
  background: transparent;
  border: none;
  color: var(--app-lost);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  margin-left: auto;
  opacity: 0.6;
}

.delete-comment-btn:hover {
  opacity: 1;
}

.comment-text {
  margin: 2px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--app-text-primary);
  word-break: break-word;
}
</style>
