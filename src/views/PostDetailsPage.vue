<template>
  <ion-page>
    <ion-content :fullscreen="true" class="details-content">
      <div v-if="loading" class="details-loading">
        <ion-spinner name="crescent" />
        <span>Loading item details...</span>
      </div>

      <div v-else-if="!post" class="details-not-found">
        <AlertCircle :size="36" class="not-found-icon" />
        <h2>Post Not Found</h2>
        <p>This item report may have been deleted or is no longer available.</p>
        <button type="button" class="back-home-btn" @click="router.replace('/tabs/home')">
          Return to Home
        </button>
      </div>

      <div v-else class="ios-screen-container details-container">
        <!-- Minimal Top Navigation: Back on left, More options on right -->
        <nav class="post-detail-top-nav">
          <button type="button" class="back-nav-btn" aria-label="Go back" @click="router.back()">
            <ArrowLeft :size="22" />
          </button>
          <button
            type="button"
            class="header-more-btn"
            aria-label="Post options"
            @click="handleMoreOptions"
          >
            <MoreHorizontal :size="20" />
          </button>
        </nav>

        <!-- Author Info Directly (No outer card) -->
        <div class="thread-author-row">
          <div class="author-left" @click="goToAuthorProfile">
            <UserAvatar :name="post.authorName" :username="post.authorUsername" size="md" />
            <div class="author-meta">
              <span class="author-name">{{ post.authorName }}</span>
              <span class="author-sub">{{ relativeTime }}</span>
            </div>
          </div>

          <StatusBadge :type="post.type" :status="post.status" />
        </div>

        <!-- Post Title Directly Under Author -->
        <h1 class="thread-title">{{ post.title }}</h1>

        <!-- Photo or Compact Placeholder (Aspect-ratio 4/3, no shadow) -->
        <div v-if="post.imageUrl && !imageFailed" class="thread-media-box">
          <img
            :src="post.imageUrl"
            :alt="post.title"
            class="thread-img"
            @error="imageFailed = true"
          />
        </div>
        <div v-else class="thread-no-photo-box">
          <ImageIcon :size="22" class="placeholder-icon" aria-hidden="true" />
          <span>No photo attached</span>
        </div>

        <!-- Description (Filtered against 'nan', null, empty; No outer card) -->
        <div v-if="showDescription" class="thread-desc-box">
          <p class="thread-desc-text">{{ post.description }}</p>
        </div>

        <!-- Compact Metadata List (Rows separated by subtle lines, not one large card) -->
        <div class="thread-meta-list">
          <div class="thread-meta-row">
            <div class="meta-row-left">
              <Tag :size="15" class="meta-icon" />
              <span class="meta-label">Category</span>
            </div>
            <span class="meta-val">{{ post.category }}</span>
          </div>

          <div class="thread-meta-row">
            <div class="meta-row-left">
              <MapPin :size="15" class="meta-icon" />
              <span class="meta-label">{{ post.type === 'found' ? 'Found At' : 'Last Seen' }}</span>
            </div>
            <span class="meta-val">{{ post.location }}</span>
          </div>

          <div v-if="formattedDate" class="thread-meta-row">
            <div class="meta-row-left">
              <CalendarDays :size="15" class="meta-icon" />
              <span class="meta-label">{{ post.type === 'found' ? 'Date Found' : 'Date Lost' }}</span>
            </div>
            <span class="meta-val">{{ formattedDate }}</span>
          </div>

          <div class="thread-meta-row">
            <div class="meta-row-left">
              <BadgeCheck :size="15" class="meta-icon" />
              <span class="meta-label">Status</span>
            </div>
            <span class="meta-val status-val" :class="post.status">
              {{ post.status.toUpperCase() }}
            </span>
          </div>
        </div>

        <!-- Social Action Row (Social-media style: Heart, Comment, Message Poster, Share) -->
        <div class="thread-actions-row">
          <button
            type="button"
            class="thread-action-btn"
            :class="{ active: isHelpfulByMe(post.id) }"
            @click="handleToggleHelpful"
          >
            <Heart :size="18" :fill="isHelpfulByMe(post.id) ? 'currentColor' : 'none'" />
            <span>Helpful</span>
            <span v-if="(post.helpfulCount || 0) > 0" class="action-count-tag">
              {{ post.helpfulCount }}
            </span>
          </button>

          <button
            type="button"
            class="thread-action-btn"
            @click="scrollToComments"
          >
            <MessageCircle :size="18" />
            <span>Comment</span>
            <span v-if="comments.length > 0" class="action-count-tag">
              {{ comments.length }}
            </span>
          </button>

          <!-- Message Poster Button (Only if viewer is not the author) -->
          <button
            v-if="!isOwner"
            type="button"
            class="thread-action-btn message-poster-btn"
            :disabled="creatingChat"
            @click="handleMessagePoster"
          >
            <ion-spinner v-if="creatingChat" name="crescent" class="chat-spinner" />
            <SendHorizontal v-else :size="17" />
            <span>Message Poster</span>
          </button>

          <button type="button" class="thread-action-btn" @click="handleShare">
            <Share2 :size="18" />
            <span>Share</span>
          </button>
        </div>

        <!-- Thin Separator -->
        <hr class="thread-separator" />

        <!-- Prioritized Community Comments Section -->
        <section class="details-comments-section">
          <CommentList
            :comments="comments"
            :current-user-id="currentProfile?.id"
            :loading="commentsLoading"
            @delete-comment="handleDeleteComment"
          />
        </section>
      </div>

      <!-- Docked Comment Composer for Bottom of Page -->
      <CommentComposer
        v-if="post"
        @submit-comment="handleSubmitComment"
      />
    </ion-content>

    <!-- Post Owner Action Sheet -->
    <ion-action-sheet
      :is-open="showOwnerActionSheet"
      header="Manage Post"
      :buttons="ownerActionButtons"
      @did-dismiss="showOwnerActionSheet = false"
    />

    <!-- General Post Action Sheet (Non-Owner) -->
    <ion-action-sheet
      :is-open="showGeneralActionSheet"
      :buttons="generalActionButtons"
      @did-dismiss="showGeneralActionSheet = false"
    />

    <!-- Delete Confirmation IonAlert -->
    <ion-alert
      :is-open="showDeleteAlert"
      header="Delete Post?"
      message="This post and its community comments will be permanently removed."
      :buttons="deleteAlertButtons"
      @did-dismiss="showDeleteAlert = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonAlert,
  IonActionSheet,
  IonContent,
  IonPage,
  IonSpinner,
  toastController
} from "@ionic/vue";
import {
  ArrowLeft,
  MoreHorizontal,
  AlertCircle,
  Image as ImageIcon,
  Tag,
  MapPin,
  CalendarDays,
  BadgeCheck,
  Heart,
  Share2,
  MessageCircle,
  SendHorizontal
} from "lucide-vue-next";
import UserAvatar from "../components/UserAvatar.vue";
import StatusBadge from "../components/StatusBadge.vue";
import CommentList from "../components/CommentList.vue";
import CommentComposer from "../components/CommentComposer.vue";
import { auth } from "../firebase";
import { useAuth, getAuthenticatedUser } from "../composables/useAuth";
import { usePosts } from "../composables/usePosts";
import { useComments } from "../composables/useComments";
import { createOrGetConversation } from "../composables/useConversations";
import { hasValidDescription, type Post } from "../types/post";

const route = useRoute();
const router = useRouter();
const { currentProfile } = useAuth();
const { getPostById, deletePost, resolvePost, toggleHelpful, isHelpfulByMe } = usePosts();
const { comments, commentsLoading, subscribeToComments, stopCommentsSubscription, addComment, deleteComment } = useComments();

const postId = computed(() => route.params.id as string);
const post = ref<Post | null>(null);
const loading = ref(true);
const imageFailed = ref(false);
const creatingChat = ref(false);

const showDescription = computed(() => hasValidDescription(post.value?.description));

const showOwnerActionSheet = ref(false);
const showGeneralActionSheet = ref(false);
const showDeleteAlert = ref(false);

const isOwner = computed(() => {
  const currentUid = auth.currentUser?.uid || currentProfile.value?.id;
  if (!post.value || !currentUid) return false;
  return post.value.authorId === currentUid;
});

const handleMoreOptions = () => {
  if (isOwner.value) {
    showOwnerActionSheet.value = true;
  } else {
    showGeneralActionSheet.value = true;
  }
};

const handleMessagePoster = async () => {
  if (!post.value || creatingChat.value) return;
  creatingChat.value = true;
  try {
    const currentUser = await getAuthenticatedUser();
    if (!currentUser?.uid) {
      console.error("[PostDetails] Auth missing when attempting to message poster.");
      const toast = await toastController.create({
        message: "Authentication session is still initializing. Please try again.",
        duration: 2500,
        position: "top",
        color: "warning"
      });
      await toast.present();
      return;
    }

    if (isOwner.value || post.value.authorId === currentUser.uid) {
      console.warn("[PostDetails] Cannot message on own post.");
      const toast = await toastController.create({
        message: "Unable to start conversation.",
        duration: 2500,
        position: "top",
        color: "medium"
      });
      await toast.present();
      return;
    }

    const targetAuthorId = post.value.authorId;
    if (!targetAuthorId || typeof targetAuthorId !== "string") {
      console.error("[PostDetails] Post author ID is missing or invalid.");
      const toast = await toastController.create({
        message: "Unable to start conversation.",
        duration: 2500,
        position: "top",
        color: "danger"
      });
      await toast.present();
      return;
    }

    const conv = await createOrGetConversation({
      otherUserId: targetAuthorId,
      postId: post.value.id
    });
    if (conv?.id) {
      await router.push(`/chat/${conv.id}`);
    } else {
      throw new Error("Unable to start conversation.");
    }
  } catch (err: any) {
    console.error("[PostDetails] Failed to start conversation with poster:", err);
    const toast = await toastController.create({
      message: err.message || "Unable to start conversation.",
      duration: 3000,
      position: "top",
      color: "danger"
    });
    await toast.present();
  } finally {
    creatingChat.value = false;
  }
};

const relativeTime = computed(() => {
  if (!post.value) return "";
  const timestamp = post.value.createdAt || Date.now();
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
});

const formattedDate = computed(() => {
  if (!post.value?.eventDate) return "";
  try {
    const d = new Date(post.value.eventDate);
    if (isNaN(d.getTime())) return post.value.eventDate;
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return post.value.eventDate;
  }
});

onMounted(async () => {
  loading.value = true;
  post.value = await getPostById(postId.value);
  loading.value = false;
  if (post.value) {
    subscribeToComments(post.value.id);
  }
});

onUnmounted(() => {
  stopCommentsSubscription();
});

const goToAuthorProfile = () => {
  if (post.value?.authorId) {
    router.push(`/profile/${post.value.authorId}`);
  }
};

const handleToggleHelpful = async () => {
  if (!post.value) return;
  await toggleHelpful(post.value.id);
};

const handleShare = async () => {
  if (!post.value) return;
  const shareData = {
    title: `${post.value.type.toUpperCase()}: ${post.value.title}`,
    text: `${post.value.title} — ${post.value.location}. Check Lost & Found forum.`,
    url: window.location.href
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e: any) {
      if (e.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(
      `${shareData.title}\n${shareData.text}\n${shareData.url}`
    );
    const toast = await toastController.create({
      message: "Post link copied to clipboard!",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();
  } catch {
    // fallback
  }
};

const scrollToComments = () => {
  const el = document.querySelector('.details-comments-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
};

const handleSubmitComment = async (content: string) => {
  if (!post.value) return;
  try {
    await addComment(post.value.id, content);
  } catch (err: any) {
    const toast = await toastController.create({
      message: err.message || "Failed to submit comment.",
      duration: 2500,
      position: "top",
      color: "danger"
    });
    await toast.present();
  }
};

const handleDeleteComment = async (commentId: string) => {
  if (!post.value) return;
  try {
    await deleteComment(post.value.id, commentId);
    const toast = await toastController.create({
      message: "Comment deleted.",
      duration: 2000,
      position: "top",
      color: "medium"
    });
    await toast.present();
  } catch (err: any) {
    const toast = await toastController.create({
      message: err.message || "Failed to delete comment.",
      duration: 2500,
      position: "top",
      color: "danger"
    });
    await toast.present();
  }
};

// Owner Actions
const ownerActionButtons = computed(() => {
  if (!post.value) return [];
  const isResolved = post.value.status === "resolved" || post.value.status === "returned";

  const buttons: any[] = [
    {
      text: "Edit Post",
      handler: () => {
        router.push(`/edit-post/${post.value?.id}`);
      }
    },
    {
      text: isResolved
        ? "Re-open Case"
        : post.value.type === "found"
        ? "Mark as Returned / Resolved"
        : "Mark as Found / Resolved",
      handler: async () => {
        const nextStatus = isResolved
          ? "open"
          : post.value?.type === "found"
          ? "returned"
          : "resolved";
        await resolvePost(post.value!.id, nextStatus as any);
        post.value!.status = nextStatus as any;
        const toast = await toastController.create({
          message: isResolved ? "Post re-opened." : "Post marked as resolved! 🎉",
          duration: 2500,
          position: "top",
          color: "success"
        });
        await toast.present();
      }
    },
    {
      text: "Delete Post",
      role: "destructive",
      handler: () => {
        showDeleteAlert.value = true;
      }
    },
    {
      text: "Cancel",
      role: "cancel"
    }
  ];

  return buttons;
});

const generalActionButtons = computed(() => [
  {
    text: "Share Post",
    handler: () => {
      handleShare();
    }
  },
  {
    text: "Cancel",
    role: "cancel"
  }
]);

const deleteAlertButtons = [
  {
    text: "Cancel",
    role: "cancel"
  },
  {
    text: "Delete",
    role: "destructive",
    handler: async () => {
      if (!post.value) return;
      try {
        await deletePost(post.value.id);
        const toast = await toastController.create({
          message: "Post deleted successfully.",
          duration: 2000,
          position: "top",
          color: "success"
        });
        await toast.present();
        router.replace("/tabs/home");
      } catch (err: any) {
        const toast = await toastController.create({
          message: err.message || "Failed to delete post.",
          duration: 3000,
          position: "top",
          color: "danger"
        });
        await toast.present();
      }
    }
  }
];
</script>

<style scoped>
.details-content {
  --background: var(--app-bg);
}

.details-loading,
.details-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--app-text-secondary);
}

.not-found-icon {
  color: var(--app-lost);
}

.back-home-btn {
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
}

.details-container {
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 36px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
  width: 100%;
}

/* Minimal Top Navigation (44px compact) */
.post-detail-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  min-height: 44px;
  margin-bottom: 0;
  padding: 0;
}

.back-nav-btn,
.header-more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  color: var(--app-text-primary);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease;
}

.back-nav-btn {
  margin-left: -8px;
}

.header-more-btn {
  margin-right: -8px;
}

.nav-placeholder {
  width: 40px;
}

.back-nav-btn:active,
.header-more-btn:active {
  opacity: 0.6;
}

/* Author Row (Directly on canvas, no outer card) */
.thread-author-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
}

.author-left {
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
  gap: 1px;
}

.author-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  line-height: 1.2;
}

.author-sub {
  font-size: 13px;
  color: var(--app-text-secondary);
}

/* Title */
.thread-title {
  margin-top: 8px;
  margin-bottom: 12px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--app-text-primary);
  line-height: 1.25;
}

/* Photo Area */
.thread-media-box {
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  aspect-ratio: 4 / 3;
  box-shadow: none;
}

.thread-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thread-no-photo-box {
  width: 100%;
  height: 170px;
  border-radius: 14px;
  background: var(--app-surface-secondary);
  border: 1px dashed var(--app-card-border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--app-text-tertiary);
  font-size: 13px;
  font-weight: 500;
  box-shadow: none;
}

.placeholder-icon {
  color: var(--app-text-tertiary);
}

/* Description (Directly below image, no outer card) */
.thread-desc-box {
  margin-top: 2px;
  margin-bottom: 4px;
}

.thread-desc-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--app-text-primary);
  white-space: pre-wrap;
}

/* Metadata List (Simple rows with thin separators, no outer card) */
.thread-meta-list {
  display: flex;
  flex-direction: column;
  background: transparent;
  border: none;
  border-top: 1px solid var(--app-card-border);
  border-bottom: 1px solid var(--app-card-border);
  border-radius: 0;
  box-shadow: none;
  margin: 4px 0;
}

.thread-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  border-bottom: 1px solid var(--app-card-border);
  gap: 12px;
  padding: 0 4px;
}

.thread-meta-row:last-child {
  border-bottom: none;
}

.meta-row-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

.meta-icon {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.meta-label {
  font-size: 13px;
  color: var(--app-text-secondary);
}

.meta-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-val.status-val.open {
  color: var(--app-primary, #2f9fe8);
}

.meta-val.status-val.resolved {
  color: var(--app-resolved, #8b5cf6);
}

.meta-val.status-val.returned {
  color: var(--app-found, #22b573);
}

/* Social Actions Row (Social media style: no border/card/background, even distribution) */
.thread-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 4px 0;
  width: 100%;
}

.thread-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px 8px;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-secondary);
  cursor: pointer;
  flex: 1;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.thread-action-btn:active {
  opacity: 0.6;
}

.thread-action-btn.active {
  color: #e53935;
}

.action-count-tag {
  font-size: 12px;
  font-weight: 600;
}

.chat-spinner {
  width: 16px;
  height: 16px;
  --color: var(--app-text-secondary);
}

.thread-separator {
  border: none;
  border-top: 1px solid var(--app-card-border);
  margin: 2px 0 6px;
}

.details-comments-section {
  display: flex;
  flex-direction: column;
}
</style>
