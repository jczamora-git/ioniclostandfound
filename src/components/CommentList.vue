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
      <p class="empty-sub">Be the first to help.</p>
    </div>

    <!-- Loading Spinner -->
    <div v-if="loading" class="loading-comments">
      <ion-spinner name="crescent" />
      <span>Loading comments...</span>
    </div>

    <!-- Threaded Comments List -->
    <div v-else-if="threads.length > 0" class="comments-list">
      <div
        v-for="(thread, index) in threads"
        :key="thread.root.id"
        class="comment-thread-group"
        :class="{ 'has-top-border': index > 0 }"
      >
        <!-- Root Top-Level Comment -->
        <article class="comment-item root-comment">
          <!-- Author Avatar -->
          <div class="comment-avatar" @click="handleAuthorClick(thread.root.authorId)">
            <UserAvatar
              :name="getCommentAuthorName(thread.root)"
              :username="getCommentAuthorUsername(thread.root)"
              :avatar-url="getCommentAvatarUrl(thread.root.authorId)"
              size="sm"
            />
          </div>

          <!-- Comment Content -->
          <div class="comment-content">
            <div class="comment-author-row">
              <span class="author-name" @click="handleAuthorClick(thread.root.authorId)">
                {{ getCommentAuthorName(thread.root) }}
              </span>
              <AchievementBadge :user-id="thread.root.authorId" :size="13" />
              <span class="author-handle">@{{ getCommentAuthorUsername(thread.root) }}</span>
              <span class="comment-dot">·</span>
              <span class="comment-time">{{ formatTime(thread.root.createdAt) }}</span>

              <!-- Delete own comment button -->
              <button
                v-if="currentUserId === thread.root.authorId"
                type="button"
                class="delete-comment-btn"
                aria-label="Delete comment"
                @click="$emit('delete-comment', thread.root.id)"
              >
                <Trash2 :size="13" />
              </button>
            </div>

            <p class="comment-text">{{ thread.root.content }}</p>

            <!-- Action Row: Reply action + replies count indicator -->
            <div class="comment-action-row">
              <button
                type="button"
                class="reply-action-btn"
                @click="handleReplyClick(thread.root, thread.root.id)"
              >
                <Reply :size="13" class="reply-icon" />
                <span>Reply</span>
              </button>

              <span v-if="thread.replies.length > 0" class="thread-replies-count">
                {{ thread.replies.length }} {{ thread.replies.length === 1 ? 'reply' : 'replies' }}
              </span>
            </div>
          </div>
        </article>

        <!-- Threaded Replies (Indented under single root block) -->
        <div v-if="thread.replies.length > 0" class="thread-replies-wrap">
          <article
            v-for="reply in thread.replies"
            :key="reply.id"
            class="comment-item reply-comment"
          >
            <!-- Reply Avatar (Compact 28px) -->
            <div class="comment-avatar reply-avatar" @click="handleAuthorClick(reply.authorId)">
              <UserAvatar
                :name="getCommentAuthorName(reply)"
                :username="getCommentAuthorUsername(reply)"
                :avatar-url="getCommentAvatarUrl(reply.authorId)"
                size="xs"
              />
            </div>

            <!-- Reply Content -->
            <div class="comment-content">
              <div class="comment-author-row">
                <span class="author-name" @click="handleAuthorClick(reply.authorId)">
                  {{ getCommentAuthorName(reply) }}
                </span>
                <AchievementBadge :user-id="reply.authorId" :size="12" />
                <span class="author-handle">@{{ getCommentAuthorUsername(reply) }}</span>
                <span class="comment-dot">·</span>
                <span class="comment-time">{{ formatTime(reply.createdAt) }}</span>

                <!-- Delete own reply button -->
                <button
                  v-if="currentUserId === reply.authorId"
                  type="button"
                  class="delete-comment-btn"
                  aria-label="Delete reply"
                  @click="$emit('delete-comment', reply.id)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>

              <p class="comment-text">{{ reply.content }}</p>

              <!-- Reply Action Row -->
              <div class="comment-action-row">
                <button
                  type="button"
                  class="reply-action-btn"
                  @click="handleReplyClick(reply, thread.root.id)"
                >
                  <Reply :size="13" class="reply-icon" />
                  <span>Reply</span>
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { IonSpinner } from "@ionic/vue";
import { Trash2, Reply } from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import AchievementBadge from "./AchievementBadge.vue";
import { useProfiles } from "../composables/useProfiles";
import type { PostComment } from "../types/comment";
import type { ReplyTarget } from "./CommentComposer.vue";

interface CommentThread {
  root: PostComment;
  replies: PostComment[];
}

const props = defineProps<{
  comments: PostComment[];
  currentUserId?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "delete-comment", id: string): void;
  (e: "reply-to-comment", target: ReplyTarget): void;
}>();

const router = useRouter();
const { getProfile, loadProfiles } = useProfiles();

watchEffect(() => {
  if (props.comments && props.comments.length > 0) {
    loadProfiles(props.comments.map((c) => c.authorId));
  }
});

// Group comments into root threads and their replies
const threads = computed<CommentThread[]>(() => {
  if (!props.comments || props.comments.length === 0) return [];

  const rootMap = new Map<string, CommentThread>();
  const orphanedReplies: PostComment[] = [];

  // First pass: identify root comments
  for (const c of props.comments) {
    if (!c.parentCommentId && !c.rootCommentId) {
      rootMap.set(c.id, { root: c, replies: [] });
    }
  }

  // Second pass: attach replies to their root thread
  for (const c of props.comments) {
    if (c.parentCommentId || c.rootCommentId) {
      const rootId = c.rootCommentId || c.parentCommentId;
      if (rootId && rootMap.has(rootId)) {
        rootMap.get(rootId)!.replies.push(c);
      } else {
        orphanedReplies.push(c);
      }
    }
  }

  // Fallback for orphaned replies if root comment is missing
  for (const orphan of orphanedReplies) {
    rootMap.set(orphan.id, { root: orphan, replies: [] });
  }

  // Sort root threads by createdAt ASC (chronological)
  const result = Array.from(rootMap.values());
  result.sort((a, b) => a.root.createdAt - b.root.createdAt);

  // Sort replies within each thread by createdAt ASC
  for (const thread of result) {
    thread.replies.sort((a, b) => a.createdAt - b.createdAt);
  }

  return result;
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

const handleReplyClick = (comment: PostComment, rootId: string) => {
  const authorName = getCommentAuthorName(comment);
  const snippet = comment.content.length > 45 ? comment.content.slice(0, 45) + "..." : comment.content;
  emit("reply-to-comment", {
    commentId: comment.id,
    rootCommentId: rootId,
    authorId: comment.authorId,
    authorName,
    contentPreview: snippet
  });
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

.comment-thread-group {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
}

.comment-thread-group.has-top-border {
  border-top: 1px solid var(--app-card-border);
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.root-comment {
  padding: 2px 0;
}

.comment-avatar {
  cursor: pointer;
  padding-top: 2px;
  flex-shrink: 0;
}

.reply-avatar {
  padding-top: 1px;
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
  margin: 2px 0 4px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--app-text-primary);
  word-break: break-word;
}

/* Action Row (Reply button, replies indicator) */
.comment-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 3px;
}

.reply-action-btn {
  background: transparent;
  border: none;
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.15s ease;
}

.reply-action-btn:hover,
.reply-action-btn:active {
  color: var(--app-primary);
}

.reply-icon {
  transform: scaleX(-1); /* nice hook reply orientation */
  color: currentColor;
}

.thread-replies-count {
  font-size: 12px;
  color: var(--app-text-tertiary);
  font-weight: 500;
}

/* Threaded Replies Block */
.thread-replies-wrap {
  position: relative;
  margin-left: 14px;
  padding-left: 14px;
  border-left: 2px solid var(--app-card-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  margin-bottom: 2px;
}

.reply-comment {
  padding: 2px 0;
}
</style>
