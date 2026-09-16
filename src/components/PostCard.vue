<template>
  <article class="post-card" @click="handleCardClick">
    <!-- Header: Author, Username, Time, Type Badge -->
    <header class="card-header">
      <div class="author-block" @click.stop="handleAuthorClick">
        <UserAvatar
          :name="authorName"
          :username="authorUsername"
          :avatar-url="authorAvatarUrl"
          size="md"
        />
        <div class="author-meta">
          <div class="author-name-row">
            <span class="author-name">{{ authorName }}</span>
            <AchievementBadge :user-id="post.authorId" />
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
        decoding="async"
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

    <!-- Credited Community Merit Helper -->
    <div
      v-if="creditedHelper"
      class="post-credited-helper-row"
      @click.stop="handleHelperClick"
    >
      <Award :size="13" class="merit-credit-icon" />
      <span>Resolved with help from <strong class="helper-link-name">{{ creditedHelper.name }}</strong></span>
    </div>

    <!-- Footer Actions: Helpful, Comment, Share -->
    <footer class="card-actions" role="group" aria-label="Post actions">
      <!-- Helpful Button -->
      <button
        type="button"
        class="action-btn"
        :class="{ active: isHelpful }"
        :aria-label="isHelpful ? 'Marked as helpful' : 'Helpful'"
        title="Helpful"
        @click.stop="$emit('toggle-helpful', post.id)"
      >
        <Heart :size="18" :fill="isHelpful ? 'currentColor' : 'none'" class="action-icon" />
        <span v-if="(post.helpfulCount || 0) > 0" class="action-count">
          {{ post.helpfulCount }}
        </span>
      </button>

      <!-- Comment Button -->
      <button
        type="button"
        class="action-btn"
        aria-label="Comments"
        title="Comments"
        @click.stop="handleCommentClick"
      >
        <MessageCircle :size="18" class="action-icon" />
        <span v-if="(post.commentsCount || 0) > 0" class="action-count">
          {{ post.commentsCount }}
        </span>
      </button>

      <!-- Share Button -->
      <button
        type="button"
        class="action-btn"
        aria-label="Share"
        title="Share"
        @click.stop="handleShareClick"
      >
        <Share2 :size="18" class="action-icon" />
      </button>
    </footer>

    <!-- Centered Share Modal -->
    <ShareModal
      :is-open="showShareModal"
      :post="post"
      @close="showShareModal = false"
    />

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
import { ref, computed, watchEffect } from "vue";
import { useRouter } from "vue-router";
import {
  Tag,
  MapPin,
  CalendarDays,
  Heart,
  MessageCircle,
  Share2,
  Award
} from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import StatusBadge from "./StatusBadge.vue";
import ShareModal from "./ShareModal.vue";
import AchievementBadge from "./AchievementBadge.vue";
import { hasValidDescription, type Post } from "../types/post";
import { useLatestComment } from "../composables/useLatestComment";
import { useProfiles, getProfileById, loadProfile } from "../composables/useProfiles";

const props = defineProps<{
  post: Post;
  isHelpful?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-helpful", id: string): void;
}>();

const router = useRouter();
const imageFailed = ref(false);
const showShareModal = ref(false);

const handleShareClick = (e?: MouseEvent) => {
  if (e) {
    e.stopPropagation();
  }
  showShareModal.value = true;
};

watchEffect(() => {
  if (props.post.authorId) {
    loadProfile(props.post.authorId);
  }
  if (props.post.meritRecipientId) {
    loadProfile(props.post.meritRecipientId);
  }
});

const authorProfile = computed(() => getProfileById(props.post.authorId));

const authorName = computed(() => {
  return authorProfile.value?.name || props.post.authorName || "Community Member";
});

const authorUsername = computed(() => {
  return authorProfile.value?.username || props.post.authorUsername || "member";
});

const authorAvatarUrl = computed(() => {
  return authorProfile.value?.avatarUrl || null;
});

const creditedHelper = computed(() => {
  if (!props.post.meritRecipientId) return null;
  const p = getProfileById(props.post.meritRecipientId);
  return {
    id: props.post.meritRecipientId,
    name: p?.name || "Community Member",
    username: p?.username || "member"
  };
});

const handleHelperClick = () => {
  if (props.post.meritRecipientId) {
    router.push(`/profile/${props.post.meritRecipientId}`);
  }
};

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

/* Credited Community Helper Row */
.post-credited-helper-row {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  background: var(--app-primary-soft, #ddf3ff);
  border-radius: 8px;
  font-size: 12px;
  color: var(--app-primary, #2f9fe8);
  cursor: pointer;
  width: fit-content;
  transition: opacity 0.15s ease;
}

.post-credited-helper-row:hover {
  opacity: 0.85;
}

.merit-credit-icon {
  flex-shrink: 0;
}

.helper-link-name {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Bottom Action Strip: Social Actions */
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  border-top: 1px solid var(--app-card-border);
  padding: 4px 0 0;
  margin-top: 2px;
}

.action-btn {
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-secondary);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  height: 44px;
  min-height: 44px;
  flex: 1;
  min-width: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.action-btn:hover {
  background: var(--app-surface-secondary);
  color: var(--app-text-primary);
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
