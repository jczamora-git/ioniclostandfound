<template>
  <article class="post-card" @click="handleCardClick">
    <!-- Header: Author, Username, Time, Type Badge -->
    <header class="card-header">
      <div class="author-block" @click.stop="handleAuthorClick">
        <UserAvatar :name="post.authorName" :username="post.authorUsername" size="md" />
        <div class="author-meta">
          <div class="author-name-row">
            <span class="author-name">{{ post.authorName }}</span>
            <span class="author-dot">·</span>
            <time class="relative-time">{{ relativeTime }}</time>
          </div>
        </div>
      </div>

      <StatusBadge :type="post.type" :status="post.status" />
    </header>

    <!-- Item Title -->
    <h3 class="post-title">{{ post.title }}</h3>

    <!-- Photo (if available) -->
    <div v-if="post.imageUrl && !imageFailed" class="post-media-box">
      <img
        :src="post.imageUrl"
        :alt="post.title"
        class="post-image"
        loading="lazy"
        @error="imageFailed = true"
      />
    </div>

    <!-- Description Preview (Filtered against 'nan', null, empty) -->
    <p v-if="showDescription" class="post-description">
      {{ post.description }}
    </p>

    <!-- Subtle Quiet Metadata Row -->
    <div class="post-meta-row">
      <span class="meta-item">
        <Tag :size="13" class="meta-icon" />
        {{ post.category }}
      </span>
      <span class="meta-separator">·</span>
      <span class="meta-item">
        <MapPin :size="13" class="meta-icon" />
        {{ post.location }}
      </span>
      <template v-if="formattedDate">
        <span class="meta-separator">·</span>
        <span class="meta-item">
          <CalendarDays :size="13" class="meta-icon" />
          {{ formattedDate }}
        </span>
      </template>
    </div>

    <!-- Footer Actions: Helpful, Comment, Share -->
    <footer class="card-actions">
      <!-- Helpful Button -->
      <button
        type="button"
        class="action-btn"
        :class="{ active: isHelpful }"
        aria-label="Mark helpful"
        @click.stop="$emit('toggle-helpful', post.id)"
      >
        <Heart :size="18" :fill="isHelpful ? 'currentColor' : 'none'" class="action-icon" />
        <span>Helpful</span>
        <span v-if="(post.helpfulCount || 0) > 0" class="action-count">
          {{ post.helpfulCount }}
        </span>
      </button>

      <!-- Comment Button -->
      <button
        type="button"
        class="action-btn"
        aria-label="View comments"
        @click.stop="handleCommentClick"
      >
        <MessageCircle :size="18" class="action-icon" />
        <span>Comment</span>
        <span v-if="(post.commentsCount || 0) > 0" class="action-count">
          {{ post.commentsCount }}
        </span>
      </button>

      <!-- Share Button -->
      <button
        type="button"
        class="action-btn"
        aria-label="Share post"
        @click.stop="$emit('share', post)"
      >
        <Share2 :size="17" class="action-icon" />
        <span>Share</span>
      </button>
    </footer>

    <!-- Latest Comment Preview (Single most recent comment, max 2 lines) -->
    <div
      v-if="latestComment"
      class="latest-comment-preview"
      role="button"
      tabindex="0"
      aria-label="View latest comment"
      @click.stop="handleCommentClick"
    >
      <p class="comment-preview-text">
        <span class="comment-author-name">{{ latestComment.authorName }}</span>
        <span class="comment-body-text">{{ latestComment.content }}</span>
        <span v-if="commentRelativeTime" class="comment-time">· {{ commentRelativeTime }}</span>
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import {
  Tag,
  MapPin,
  CalendarDays,
  Heart,
  MessageCircle,
  Share2
} from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import StatusBadge from "./StatusBadge.vue";
import { hasValidDescription, type Post } from "../types/post";
import { useLatestComment } from "../composables/useLatestComment";

const props = defineProps<{
  post: Post;
  isHelpful?: boolean;
}>();

defineEmits<{
  (e: "toggle-helpful", id: string): void;
  (e: "share", post: Post): void;
}>();

const router = useRouter();
const imageFailed = ref(false);

const { latestComment } = useLatestComment(() => props.post.id);

const commentRelativeTime = computed(() => {
  if (!latestComment.value?.createdAt) return "";
  const diffSec = Math.floor((Date.now() - latestComment.value.createdAt) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
});

const showDescription = computed(() => hasValidDescription(props.post.description));

const relativeTime = computed(() => {
  const timestamp = props.post.createdAt || Date.now();
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
});

const formattedDate = computed(() => {
  if (!props.post.eventDate) return "";
  try {
    const d = new Date(props.post.eventDate);
    if (isNaN(d.getTime())) return props.post.eventDate;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  } catch {
    return props.post.eventDate;
  }
});

const handleCardClick = () => {
  router.push(`/post/${props.post.id}`);
};

const handleAuthorClick = () => {
  if (props.post.authorId) {
    router.push(`/profile/${props.post.authorId}`);
  }
};

const handleCommentClick = () => {
  router.push(`/post/${props.post.id}`);
};
</script>

<style scoped>
.post-card {
  background: var(--app-surface);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  border: 1px solid var(--app-card-border);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.post-card:active {
  transform: scale(0.99);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.author-block {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
}

.author-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.author-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.author-handle {
  font-size: 13px;
  color: var(--app-text-secondary);
}

.author-dot {
  font-size: 12px;
  color: var(--app-text-tertiary);
}

.relative-time {
  font-size: 12px;
  color: var(--app-text-tertiary);
}

.post-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--app-text-primary);
  line-height: 1.3;
}

/* Image Area */
.post-media-box {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: var(--app-surface-secondary);
  position: relative;
  aspect-ratio: 16 / 10;
  max-height: 240px;
}

.post-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.post-description {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-secondary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Subtle Quiet Metadata Row */
.post-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-top: 1px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-separator {
  color: var(--app-text-tertiary);
  font-weight: 600;
}

.meta-icon {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

/* Bottom Action Strip: Social Actions */
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--app-card-border);
  padding-top: 8px;
  margin-top: 2px;
}

.action-btn {
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-secondary);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  min-height: 38px;
  transition: background 0.15s ease, color 0.15s ease;
}

.action-btn:hover {
  background: var(--app-surface-secondary);
}

.action-icon {
  color: currentColor;
  flex-shrink: 0;
  transition: transform 0.15s ease, color 0.15s ease;
}

.action-btn:active .action-icon {
  transform: scale(0.9);
}

.action-btn.active {
  color: #ff3b30;
}

.action-btn.active .action-icon {
  color: #ff3b30;
}

.action-count {
  font-size: 12px;
  font-weight: 600;
}

/* Latest Comment Preview */
.latest-comment-preview {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--app-card-border);
  cursor: pointer;
}

.latest-comment-preview:active .comment-preview-text {
  opacity: 0.75;
}

.comment-preview-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--app-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.comment-author-name {
  font-weight: 600;
  color: var(--app-text-primary);
  margin-right: 6px;
}

.comment-body-text {
  color: var(--app-text-secondary);
}

.comment-time {
  margin-left: 6px;
  font-size: 11px;
  color: var(--app-text-tertiary);
  white-space: nowrap;
}
</style>
