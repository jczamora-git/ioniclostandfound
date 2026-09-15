<template>
  <ion-page>
    <!-- Minimal Top Navigation in Fixed IonHeader: Back on left, More options on right -->
    <ion-header class="ion-no-border details-ion-header">
      <ion-toolbar class="details-ion-toolbar">
        <div class="header-inner-box">
          <nav class="post-detail-top-nav">
            <button type="button" class="back-nav-btn" aria-label="Go back" @click="router.back()">
              <ArrowLeft :size="22" />
            </button>
            <button
              v-if="post"
              type="button"
              class="header-more-btn"
              aria-label="Post options"
              @click="handleMoreOptions"
            >
              <MoreHorizontal :size="20" />
            </button>
          </nav>
        </div>
      </ion-toolbar>
    </ion-header>

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
        <!-- Author Info Directly (No outer card) -->
        <div class="thread-author-row">
          <div class="author-left" @click="goToAuthorProfile">
            <UserAvatar
              :name="authorName"
              :username="authorUsername"
              :avatar-url="authorAvatarUrl"
              size="md"
            />
            <div class="author-meta">
              <span class="author-name">{{ authorName }}</span>
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

        <!-- Credited Community Merit Helper Card -->
        <div v-if="creditedHelper" class="thread-merit-card" @click="goToHelperProfile">
          <div class="merit-badge-icon-box">
            <Award :size="20" class="merit-award-icon" />
          </div>
          <div class="merit-card-content">
            <span class="merit-card-label">Recovered with help from</span>
            <div class="merit-helper-row">
              <UserAvatar
                :name="creditedHelper.name"
                :username="creditedHelper.username"
                :avatar-url="creditedHelper.avatarUrl"
                size="sm"
              />
              <div class="merit-helper-meta">
                <span class="helper-name-text">{{ creditedHelper.name }}</span>
                <span class="helper-handle-text">@{{ creditedHelper.username }}</span>
              </div>
              <button type="button" class="view-helper-btn" @click.stop="goToHelperProfile">
                View Profile
              </button>
            </div>
          </div>
        </div>

        <!-- Social Action Row (Icon-first minimal: Heart, Comment, Message Poster, Share) -->
        <div class="thread-actions-row" role="group" aria-label="Post actions">
          <!-- Helpful Action -->
          <button
            type="button"
            class="thread-action-btn"
            :class="{ active: isHelpfulByMe(post.id) }"
            :aria-label="isHelpfulByMe(post.id) ? 'Marked as helpful' : 'Helpful'"
            title="Helpful"
            @click="handleToggleHelpful"
          >
            <Heart :size="20" :fill="isHelpfulByMe(post.id) ? 'currentColor' : 'none'" class="action-btn-icon" />
            <span v-if="(post.helpfulCount || 0) > 0" class="action-count-tag">
              {{ post.helpfulCount }}
            </span>
          </button>

          <!-- Comment Action -->
          <button
            type="button"
            class="thread-action-btn"
            aria-label="Comments"
            title="Comments"
            @click="scrollToComments"
          >
            <MessageCircle :size="20" class="action-btn-icon" />
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
            aria-label="Message poster"
            title="Message poster"
            @click="handleMessagePoster"
          >
            <ion-spinner v-if="creatingChat" name="crescent" class="chat-spinner" />
            <SendHorizontal v-else :size="19" class="action-btn-icon" />
          </button>

          <!-- Share Action -->
          <button
            type="button"
            class="thread-action-btn"
            aria-label="Share"
            title="Share"
            @click.stop="handleShare"
          >
            <Share2 :size="19" class="action-btn-icon" />
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
            @reply-to-comment="handleReplyToComment"
          />
        </section>
      </div>

      <!-- Docked Comment Composer for Bottom of Page -->
      <CommentComposer
        v-if="post"
        ref="commentComposerRef"
        :reply-target="activeReplyTarget"
        @submit-comment="handleSubmitComment"
        @cancel-reply="activeReplyTarget = null"
      />
    </ion-content>

    <!-- Centered Share Modal -->
    <ShareModal
      v-if="post"
      :is-open="showShareModal"
      :post="post"
      @close="showShareModal = false"
    />

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

    <!-- Resolve Post Modal (With community helper credit option) -->
    <ResolvePostModal
      v-if="post"
      :is-open="showResolveModal"
      :post="post"
      :comments="comments"
      :resolving="resolvingPost"
      @close="showResolveModal = false"
      @confirm="handleResolveConfirm"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonAlert,
  IonActionSheet,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonToolbar,
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
  SendHorizontal,
  Award
} from "lucide-vue-next";
import UserAvatar from "../components/UserAvatar.vue";
import StatusBadge from "../components/StatusBadge.vue";
import CommentList from "../components/CommentList.vue";
import CommentComposer, { type ReplyTarget } from "../components/CommentComposer.vue";
import ResolvePostModal from "../components/ResolvePostModal.vue";
import ShareModal from "../components/ShareModal.vue";
import { auth } from "../firebase";
import { useAuth, getSessionUser, sessionUid } from "../composables/useAuth";
import { usePosts } from "../composables/usePosts";
import { useComments } from "../composables/useComments";
import { useProfiles } from "../composables/useProfiles";
import { useAchievements } from "../composables/useAchievements";
import { createOrGetConversation } from "../composables/useConversations";
import { hasValidDescription, type Post } from "../types/post";

const activeReplyTarget = ref<ReplyTarget | null>(null);
const commentComposerRef = ref<InstanceType<typeof CommentComposer> | null>(null);

const showShareModal = ref(false);

const route = useRoute();
const router = useRouter();
const { currentProfile } = useAuth();
const { getPostById, deletePost, resolvePost, toggleHelpful, isHelpfulByMe } = usePosts();
const { comments, commentsLoading, subscribeToComments, stopCommentsSubscription, addComment, deleteComment } = useComments();
const { getProfile, loadProfile } = useProfiles();
const { awardMeritAndResolvePost } = useAchievements();

const postId = computed(() => route.params.id as string);
const post = ref<Post | null>(null);
const loading = ref(true);
const imageFailed = ref(false);
const creatingChat = ref(false);
const showResolveModal = ref(false);
const resolvingPost = ref(false);

watchEffect(() => {
  if (post.value?.authorId) {
    loadProfile(post.value.authorId);
  }
  if (post.value?.meritRecipientId) {
    loadProfile(post.value.meritRecipientId);
  }
});

const authorProfile = computed(() => getProfile(post.value?.authorId));

const authorName = computed(() => {
  return authorProfile.value?.name || post.value?.authorName || "Community Member";
});

const authorUsername = computed(() => {
  return authorProfile.value?.username || post.value?.authorUsername || "member";
});

const authorAvatarUrl = computed(() => {
  return authorProfile.value?.avatarUrl || null;
});

const creditedHelper = computed(() => {
  if (!post.value?.meritRecipientId) return null;
  const p = getProfile(post.value.meritRecipientId);
  return {
    id: post.value.meritRecipientId,
    name: p?.name || "Community Member",
    username: p?.username || "member",
    avatarUrl: p?.avatarUrl || null
  };
});

const goToHelperProfile = () => {
  if (post.value?.meritRecipientId) {
    router.push(`/profile/${post.value.meritRecipientId}`);
  }
};

const showDescription = computed(() => hasValidDescription(post.value?.description));

const showOwnerActionSheet = ref(false);
const showGeneralActionSheet = ref(false);
const showDeleteAlert = ref(false);

const isOwner = computed(() => {
  const currentUid = sessionUid.value || auth.currentUser?.uid || currentProfile.value?.id;
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
    const session = await getSessionUser();
    if (!session?.uid || (session.isAnonymous && !session.isDevAccount)) {
      console.warn("[PostDetails] Unauthenticated user, redirecting to Sign In.");
      const toast = await toastController.create({
        message: "Please sign in or create an account to message the poster.",
        duration: 2500,
        position: "top",
        color: "warning"
      });
      await toast.present();
      router.push("/auth");
      return;
    }

    if (isOwner.value || post.value.authorId === session.uid) {
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

    const targetThreadId = `post_${post.value.id}`;
    const conv = await createOrGetConversation({
      otherUserId: targetAuthorId,
      postId: post.value.id,
      postTitle: post.value.title,
      postSubtitle: `${post.value.type.toUpperCase()} · ${post.value.location}`,
      postLocation: post.value.location,
      threadId: targetThreadId
    });
    if (conv?.id) {
      await router.push(`/chat/${conv.id}?thread=${targetThreadId}`);
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

const handleShare = (e?: MouseEvent) => {
  if (e) {
    e.stopPropagation();
  }
  showShareModal.value = true;
};

const scrollToComments = () => {
  const el = document.querySelector('.details-comments-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
  nextTick(() => {
    commentComposerRef.value?.focusInput();
  });
};

const handleReplyToComment = (target: ReplyTarget) => {
  activeReplyTarget.value = target;
  nextTick(() => {
    commentComposerRef.value?.focusInput();
  });
};

const handleSubmitComment = async (content: string) => {
  if (!post.value) return;
  try {
    const target = activeReplyTarget.value;
    await addComment(
      post.value.id,
      content,
      target
        ? {
            parentCommentId: target.commentId,
            rootCommentId: target.rootCommentId,
            parentAuthorId: target.authorId
          }
        : undefined
    );
    activeReplyTarget.value = null;
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
        if (isResolved) {
          await resolvePost(post.value!.id, "open");
          post.value!.status = "open";
          const toast = await toastController.create({
            message: "Post re-opened.",
            duration: 2500,
            position: "top",
            color: "success"
          });
          await toast.present();
        } else {
          showResolveModal.value = true;
        }
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

const handleResolveConfirm = async (recipientId: string | null) => {
  if (!post.value || resolvingPost.value) return;
  resolvingPost.value = true;
  try {
    await awardMeritAndResolvePost({
      postId: post.value.id,
      postTitle: post.value.title,
      postType: post.value.type,
      postAuthorId: post.value.authorId,
      recipientId
    });
    const nextStatus = post.value.type === "found" ? "returned" : "resolved";
    post.value.status = nextStatus;
    if (recipientId) {
      post.value.meritRecipientId = recipientId;
    }
    showResolveModal.value = false;
    const toast = await toastController.create({
      message: recipientId
        ? "Post marked as resolved and Community Merit awarded! 🏅"
        : "Post marked as resolved! 🎉",
      duration: 2500,
      position: "top",
      color: "success"
    });
    await toast.present();
  } catch (err: any) {
    const toast = await toastController.create({
      message: err.message || "Failed to resolve post.",
      duration: 3000,
      position: "top",
      color: "danger"
    });
    await toast.present();
  } finally {
    resolvingPost.value = false;
  }
};

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

.details-ion-header {
  --background: var(--app-bg);
  background: var(--app-bg);
  border-bottom: 1px solid var(--app-card-border);
  z-index: 100;
}

.details-ion-toolbar {
  --background: var(--app-bg);
  --border-color: transparent;
  --min-height: 52px;
  --padding-top: 0px;
  --padding-bottom: 0px;
  --padding-start: 16px;
  --padding-end: 16px;
}

.header-inner-box {
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
  width: 100%;
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
  padding: 16px 16px 36px;
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

/* Social Actions Row (Icon-only, evenly spaced, minimal mobile layout) */
.thread-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 2px 0;
  width: 100%;
}

.thread-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  min-height: 44px;
  padding: 0 4px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-secondary);
  cursor: pointer;
  flex: 1;
  min-width: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.thread-action-btn:hover {
  background-color: var(--app-surface-secondary);
  color: var(--app-text-primary);
}

.thread-action-btn:active {
  opacity: 0.6;
}

.thread-action-btn.active {
  color: #e53935;
}

.action-btn-icon {
  flex-shrink: 0;
}

.action-count-tag {
  font-size: 13px;
  font-weight: 600;
  color: currentColor;
  line-height: 1;
}

.chat-spinner {
  width: 18px;
  height: 18px;
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

/* Credited Community Helper Card */
.thread-merit-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(221, 243, 255, 0.6) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 14px;
  padding: 12px 14px;
  margin: 4px 0 2px;
  cursor: pointer;
}

.merit-badge-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #fef3c7;
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.merit-card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.merit-card-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #b45309;
}

.merit-helper-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.merit-helper-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.helper-name-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.helper-handle-text {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.view-helper-btn {
  background: var(--app-surface, #ffffff);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #b45309;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-helper-btn:hover {
  background: #fef3c7;
}
</style>
