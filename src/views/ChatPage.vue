<template>
  <ion-page>
    <!-- Fixed Top Page Header -->
    <PageHeader
      :title="otherParticipant?.name || 'Chat'"
      :subtitle="headerSubtitle"
      :show-back="true"
      @back="handleBack"
    >
      <template #action>
        <div class="header-actions-row">
          <button
            type="button"
            class="header-icon-btn refresh-btn"
            aria-label="Refresh messages"
            title="Refresh messages"
            :disabled="isRefreshing"
            @click="handleManualRefreshButton"
          >
            <RefreshCw :size="18" :class="{ 'spinning': isRefreshing }" />
          </button>
          <button
            type="button"
            class="header-icon-btn"
            aria-label="View user profile"
            @click="handleOpenProfile"
          >
            <UserAvatar
              :name="otherParticipant?.name || 'User'"
              :username="otherParticipant?.username || 'user'"
              :avatar-url="otherParticipant?.avatarUrl"
              size="sm"
            />
          </button>
        </div>
      </template>
    </PageHeader>

    <ion-content :fullscreen="true" class="chat-content">
      <ion-refresher slot="fixed" @ion-refresh="handleIonRefresh">
        <ion-refresher-content pulling-icon="arrow-down" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="chat-view-container">
        <!-- Message History Timeline Stream -->
        <div ref="scrollContainerRef" class="chat-messages-scroll">
          <!-- Public Meetup Safety Note (Top only once) -->
          <div class="safety-tip-bar">
            <ShieldAlert :size="15" class="safety-icon" />
            <span>For item exchanges, consider meeting in a public place.</span>
          </div>

          <!-- 1. SKELETON LOADING STATE -->
          <div v-if="isMessagesLoading" class="chat-skeleton-stream" aria-label="Loading messages">
            <div class="skeleton-bubble-row left">
              <ion-skeleton-text :animated="true" class="skeleton-bubble bubble-w60 left-bubble" />
            </div>
            <div class="skeleton-bubble-row right">
              <ion-skeleton-text :animated="true" class="skeleton-bubble bubble-w45 right-bubble" />
            </div>
            <div class="skeleton-bubble-row left">
              <ion-skeleton-text :animated="true" class="skeleton-bubble bubble-w75 left-bubble" />
            </div>
            <div class="skeleton-bubble-row right">
              <ion-skeleton-text :animated="true" class="skeleton-bubble bubble-w55 right-bubble" />
            </div>
            <div class="skeleton-bubble-row left">
              <ion-skeleton-text :animated="true" class="skeleton-bubble bubble-w40 left-bubble" />
            </div>
          </div>

          <!-- 2. EMPTY STATE -->
          <div v-else-if="messages.length === 0" class="chat-empty-thread">
            <p class="empty-thread-title">No messages yet</p>
            <p class="empty-thread-sub">Send a message to start the conversation.</p>
          </div>

          <!-- 3. ONE CONTINUOUS CHAT TIMELINE (General + Inline Slack-style Single Post Threads) -->
          <div v-else class="timeline-blocks-stream">
            <template v-for="group in timelineGroups" :key="group.id">
              <!-- A. GENERAL MESSAGES BLOCK -->
              <div v-if="group.type === 'general'" class="timeline-general-block">
                <MessageBubble
                  v-for="msg in group.messages"
                  :key="msg.id"
                  :message="msg"
                  :is-own="msg.senderId === myUid || resolveSender(msg.senderId).isOwn"
                  @reply="handleReplyMessage(msg)"
                />
              </div>

              <!-- B. SINGLE POST INLINE THREAD BLOCK (Exactly ONE per post) -->
              <div
                v-else-if="group.type === 'post-thread' && group.postId"
                class="timeline-post-thread-block"
              >
                <!-- Compact Post Thread Root (Shown only ONCE at top of thread) -->
                <div
                  class="thread-root-card"
                  role="button"
                  tabindex="0"
                  @click="handleOpenPost(group.postId)"
                  @keydown.enter="handleOpenPost(group.postId)"
                >
                  <div class="post-thumb-box">
                    <img
                      v-if="postCache[group.postId]?.imageUrl"
                      :src="postCache[group.postId]?.imageUrl || undefined"
                      :alt="postCache[group.postId]?.title || 'Post thumbnail'"
                      class="post-thumb-img"
                    />
                    <div v-else class="post-thumb-fallback">
                      <Image :size="16" />
                    </div>
                  </div>

                  <div class="post-info-box">
                    <span class="post-title">
                      {{ postCache[group.postId]?.title || 'Post Discussion' }}
                    </span>
                    <div class="post-meta-line">
                      <span
                        v-if="postCache[group.postId]?.type"
                        class="post-type-badge"
                        :class="postCache[group.postId]?.type"
                      >
                        {{ postCache[group.postId]?.type.toUpperCase() }}
                      </span>
                      <span v-if="postCache[group.postId]?.location" class="post-location">
                        · {{ postCache[group.postId]?.location }}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="thread-reply-shortcut-btn"
                    title="Reply in this thread"
                    @click.stop="handleReplyPost(group.postId)"
                  >
                    <Reply :size="13" />
                    <span>Reply</span>
                  </button>

                  <ChevronRight :size="16" class="post-chevron" />
                </div>

                <!-- Indented Continuous Thread Replies -->
                <div class="thread-replies-stream">
                  <div
                    v-for="msg in group.messages"
                    :key="msg.id"
                    class="thread-reply-row"
                    :class="{ 'is-own': msg.senderId === myUid }"
                  >
                    <div class="reply-avatar-col">
                      <UserAvatar
                        :name="resolveSender(msg.senderId).name"
                        :username="resolveSender(msg.senderId).username"
                        :avatar-url="resolveSender(msg.senderId).avatarUrl"
                        size="sm"
                      />
                    </div>
                    <div class="reply-content-col">
                      <div class="reply-header-line">
                        <span class="reply-sender-name">{{ resolveSender(msg.senderId).name }}</span>
                        <span class="reply-timestamp">{{ formatMessageTime(msg.createdAt) }}</span>
                      </div>

                      <!-- Attached Image -->
                      <div
                        v-if="msg.imageUrl"
                        class="reply-image-wrap"
                        role="button"
                        tabindex="0"
                        aria-label="View full image"
                        @click="openFullscreenImage(msg.imageUrl)"
                        @keydown.enter="openFullscreenImage(msg.imageUrl)"
                      >
                        <img
                          :src="msg.imageUrl"
                          alt="Attached photo"
                          class="reply-img"
                          loading="lazy"
                        />
                      </div>

                      <!-- Text message -->
                      <p v-if="msg.text" class="reply-text">{{ msg.text }}</p>

                      <!-- Quick Reply action -->
                      <button
                        type="button"
                        class="reply-action-btn"
                        @click="handleReplyPost(group.postId)"
                      >
                        <Reply :size="11" />
                        <span>Reply</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Ephemeral Typing Indicator -->
          <div v-if="isOtherTyping" class="typing-indicator-row">
            <span class="typing-dots-bubble">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </span>
            <span class="typing-text">
              {{ otherParticipant?.name || 'User' }} is typing...
            </span>
          </div>
        </div>

        <!-- Sticky Composer with Reply Banner & Image Attachment Support -->
        <ChatComposer
          ref="composerRef"
          :sending="sending"
          :reply-context="activeReplyContext"
          @send="handleSendMessage"
          @typing="handleTyping"
          @clear-reply="handleClearReply"
        />
      </div>
    </ion-content>

    <!-- Fullscreen Image Viewer Modal for Thread Replies -->
    <Teleport to="body">
      <div
        v-if="fullscreenImageUrl"
        class="fullscreen-image-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Fullscreen photo viewer"
        @click="fullscreenImageUrl = null"
      >
        <button
          type="button"
          class="viewer-close-btn"
          aria-label="Close photo viewer"
          @click.stop="fullscreenImageUrl = null"
        >
          <X :size="24" />
        </button>
        <div class="viewer-image-container" @click.stop>
          <img
            :src="fullscreenImageUrl"
            alt="Fullscreen photo"
            class="viewer-full-img"
          />
        </div>
      </div>
    </Teleport>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  toastController
} from '@ionic/vue';
import { ShieldAlert, Image, ChevronRight, Reply, X, RefreshCw } from 'lucide-vue-next';
import PageHeader from '../components/PageHeader.vue';
import UserAvatar from '../components/UserAvatar.vue';
import MessageBubble from '../components/MessageBubble.vue';
import ChatComposer, { type ReplyContext } from '../components/ChatComposer.vue';
import { useChat } from '../composables/useChat';
import { useConversations } from '../composables/useConversations';
import { useAuth, sessionUid } from '../composables/useAuth';
import { usePosts } from '../composables/usePosts';
import { useImageUpload } from '../composables/useImageUpload';
import { getChatServerUrl } from '../services/socket';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import type { Post } from '../types/post';
import type { Profile } from '../types/profile';
import type { ChatMessage } from '../types/message';

export type ChatDisplayGroup =
  | {
      id: string;
      type: 'general';
      firstCreatedAt: number;
      messages: ChatMessage[];
    }
  | {
      id: string;
      type: 'post-thread';
      threadId: string;
      postId: string;
      firstCreatedAt: number;
      messages: ChatMessage[];
    };

const route = useRoute();
const router = useRouter();
const conversationId = computed(() => route.params.conversationId as string);
const initialThreadQuery = computed(() => (route.query.thread as string) || 'general');

const { currentProfile } = useAuth();
const { getPostById } = usePosts();
const { markAsRead } = useConversations();
const { uploadMessageImage } = useImageUpload();

const myUid = computed(() => sessionUid.value || currentProfile.value?.id || '');

const {
  messages,
  isMessagesLoading,
  isOtherTyping,
  loadHistory,
  setupSocketListeners,
  sendChatMessage,
  handleTyping,
  cleanup
} = useChat(conversationId.value, 'all');

const otherParticipant = ref<Profile | null>(null);
const sending = ref(false);
const scrollContainerRef = ref<HTMLDivElement | null>(null);
const composerRef = ref<InstanceType<typeof ChatComposer> | null>(null);

// Active composer context & Post metadata cache
const activeReplyContext = ref<ReplyContext | null>(null);
const postCache = ref<Record<string, Post>>({});
const fullscreenImageUrl = ref<string | null>(null);

const headerSubtitle = computed(() => {
  if (otherParticipant.value?.username) {
    return `@${otherParticipant.value.username}`;
  }
  return undefined;
});

/**
 * Group messages into display groups:
 * - Exactly ONE post-thread group per distinct post thread (Muning, Wallet, etc.)
 * - General messages grouped into continuous general blocks
 * - Thread groups appear chronologically based on their earliest message timestamp
 * - All later replies to a post append strictly inside that post's thread group
 */
const timelineGroups = computed<ChatDisplayGroup[]>(() => {
  if (!messages.value || messages.value.length === 0) return [];

  // 1. Sort all messages chronologically
  const sorted = [...messages.value].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const groups: ChatDisplayGroup[] = [];
  const postGroupMap = new Map<
    string,
    { group: ChatDisplayGroup & { type: 'post-thread' }; index: number }
  >();

  for (const msg of sorted) {
    const rawThreadId = msg.threadId || 'general';
    const isPost = rawThreadId.startsWith('post_');
    const postId = isPost ? rawThreadId.replace('post_', '') : null;

    if (isPost && postId) {
      if (postGroupMap.has(postId)) {
        // Append message to existing post thread group
        const existing = postGroupMap.get(postId)!.group;
        existing.messages.push(msg);
      } else {
        // Create new post thread group placed at its initial message's chronological position
        const newGroup: ChatDisplayGroup & { type: 'post-thread' } = {
          id: `post-group-${postId}`,
          type: 'post-thread',
          threadId: rawThreadId,
          postId,
          firstCreatedAt: msg.createdAt || Date.now(),
          messages: [msg]
        };
        postGroupMap.set(postId, { group: newGroup, index: groups.length });
        groups.push(newGroup);
      }
    } else {
      // General message
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.type === 'general') {
        lastGroup.messages.push(msg);
      } else {
        groups.push({
          id: `general-group-${msg.id}`,
          type: 'general',
          firstCreatedAt: msg.createdAt || Date.now(),
          messages: [msg]
        });
      }
    }
  }

  // Ensure replies inside each group are strictly sorted by createdAt ASC
  for (const g of groups) {
    g.messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  return groups;
});

// Post resolution helper with caching
const resolvePost = async (postId: string): Promise<Post | null> => {
  if (!postId) return null;
  if (postCache.value[postId]) return postCache.value[postId];

  try {
    const fetched = await getPostById(postId);
    if (fetched) {
      postCache.value[postId] = fetched;
      return fetched;
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('Failed to resolve post:', postId, err);
    }
  }
  return null;
};

// Auto fetch post context for any posts appearing in timeline
watch(
  timelineGroups,
  (groups) => {
    for (const g of groups) {
      if (g.type === 'post-thread' && g.postId && !postCache.value[g.postId]) {
        resolvePost(g.postId);
      }
    }
  },
  { immediate: true, deep: true }
);

const resolveSender = (senderId: string) => {
  if (senderId === myUid.value) {
    return {
      isOwn: true,
      name: currentProfile.value?.name || 'You',
      username: currentProfile.value?.username || 'you',
      avatarUrl: currentProfile.value?.avatarUrl
    };
  }
  return {
    isOwn: false,
    name: otherParticipant.value?.name || 'Community Member',
    username: otherParticipant.value?.username || 'user',
    avatarUrl: otherParticipant.value?.avatarUrl
  };
};

const formatMessageTime = (createdAt?: number) => {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const scrollToBottom = (smooth = true) => {
  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTo({
        top: scrollContainerRef.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  });
};

const isNearBottom = (): boolean => {
  if (!scrollContainerRef.value) return true;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.value;
  return scrollHeight - scrollTop - clientHeight < 150;
};

// Auto-scroll when new realtime messages arrive (if already near bottom)
watch(
  () => messages.value.length,
  () => {
    if (isNearBottom()) {
      scrollToBottom(true);
    }
  }
);

// Reply action handlers
const handleReplyPost = async (postId: string) => {
  let targetPost: Post | null | undefined = postCache.value[postId];
  if (!targetPost) {
    targetPost = await resolvePost(postId);
  }

  activeReplyContext.value = {
    type: 'post',
    postId,
    threadId: `post_${postId}`,
    title: targetPost ? targetPost.title : 'Post discussion',
    subtitle: targetPost ? `${targetPost.type.toUpperCase()} · ${targetPost.location}` : undefined
  };

  composerRef.value?.focus();
};

const handleReplyMessage = (msg: ChatMessage) => {
  const senderInfo = resolveSender(msg.senderId);
  const targetThreadId = msg.threadId || 'general';
  const isPostThread = targetThreadId.startsWith('post_');
  const postId = isPostThread ? targetThreadId.replace('post_', '') : null;

  activeReplyContext.value = {
    type: 'message',
    threadId: targetThreadId,
    postId,
    senderName: senderInfo.name,
    textPreview: msg.text || (msg.imageUrl ? 'Photo' : 'Message')
  };

  composerRef.value?.focus();
};

const handleClearReply = () => {
  activeReplyContext.value = null;
};

const openFullscreenImage = (url: string) => {
  fullscreenImageUrl.value = url;
};

const isRefreshing = ref(false);

const handleRefreshMessages = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    markAsRead(conversationId.value, 'all');
    await loadHistory('all');
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[ChatPage] Manual refresh warning:', err);
    }
  } finally {
    isRefreshing.value = false;
  }
};

const handleIonRefresh = async (event: any) => {
  await handleRefreshMessages();
  setTimeout(() => {
    event.target.complete();
  }, 300);
};

const handleManualRefreshButton = async () => {
  await handleRefreshMessages();
};

onMounted(async () => {
  markAsRead(conversationId.value, 'all');

  // 1. Fetch conversation participant metadata
  try {
    const { conversations: convList } = useConversations();
    const existing = convList.value.find((c) => c.id === conversationId.value);

    if (existing && existing.otherParticipant) {
      otherParticipant.value = existing.otherParticipant;
    }

    if (!otherParticipant.value) {
      const myId = myUid.value;
      let convData: any = existing;

      if (!convData) {
        // Fallback to server REST endpoint
        try {
          const serverUrl = getChatServerUrl();
          if (serverUrl && myId) {
            const res = await fetch(`${serverUrl}/api/conversations/${myId}`);
            if (res.ok) {
              const json = await res.json();
              convData = (json.conversations || []).find((c: any) => c.id === conversationId.value);
            }
          }
        } catch {}

        // Fallback to Firebase RTDB if available
        if (!convData) {
          try {
            const snap = await get(dbRef(db, `conversations/${conversationId.value}`));
            if (snap.exists()) {
              convData = snap.val();
            }
          } catch {}
        }
      }

      if (convData) {
        const otherUid = (convData.participantIds || []).find((id: string) => id !== myId);
        if (otherUid) {
          if (convData.participantDetails && convData.participantDetails[otherUid]) {
            otherParticipant.value = {
              id: otherUid,
              name: convData.participantDetails[otherUid].name || 'Community Member',
              username: convData.participantDetails[otherUid].username || 'user',
              phone: '',
              avatarUrl: convData.participantDetails[otherUid].avatarUrl || null,
              createdAt: 0,
              updatedAt: 0
            };
          } else {
            try {
              const pSnap = await get(dbRef(db, `profiles/${otherUid}`));
              if (pSnap.exists()) {
                const pVal = pSnap.val();
                otherParticipant.value = {
                  id: otherUid,
                  name: pVal.name || 'Community Member',
                  username: pVal.username || 'user',
                  phone: '',
                  avatarUrl: pVal.avatarUrl || null,
                  createdAt: pVal.createdAt || 0,
                  updatedAt: pVal.updatedAt || 0
                };
              }
            } catch {}
          }
        }
      }
    }

    if (!otherParticipant.value) {
      otherParticipant.value = {
        id: 'user',
        name: 'Community Member',
        username: 'member',
        phone: '',
        avatarUrl: null,
        createdAt: 0,
        updatedAt: 0
      };
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Failed to load conversation details:', err);
    }
  }

  // 2. Load merged conversation history
  await loadHistory('all');

  // 3. If navigated with an initial post thread target (from "Message Poster"), pre-set composer context
  const targetPostId =
    (route.query.postId as string) ||
    (initialThreadQuery.value.startsWith('post_')
      ? initialThreadQuery.value.replace('post_', '')
      : null);

  if (targetPostId) {
    handleReplyPost(targetPostId);
  }

  // 4. Initial bottom scroll after loading finishes
  await nextTick();
  setTimeout(() => {
    scrollToBottom(false);
  }, 50);
});

onUnmounted(() => {
  markAsRead(conversationId.value, 'all');
});

const handleSendMessage = async (payload: { text: string; file: File | null }) => {
  const { text, file } = payload;
  const trimmed = (text || '').trim();
  if ((!trimmed && !file) || sending.value) return;

  sending.value = true;
  let imageUrl: string | null = null;
  let imageKey: string | null = null;

  try {
    if (file) {
      const uploadRes = await uploadMessageImage(file);
      imageUrl = uploadRes.url;
      imageKey = uploadRes.key;
    }

    const threadIdToSend =
      activeReplyContext.value?.threadId ||
      (activeReplyContext.value?.postId
        ? `post_${activeReplyContext.value.postId}`
        : 'general');

    await sendChatMessage(trimmed, imageUrl, imageKey, threadIdToSend);
    composerRef.value?.clear();

    await nextTick();
    scrollToBottom(true);
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error('Error sending message:', err);
    }
    const toast = await toastController.create({
      message: err.message || 'Unable to upload image. Please try again.',
      duration: 3000,
      position: 'top',
      color: 'danger'
    });
    await toast.present();
  } finally {
    sending.value = false;
  }
};

const handleOpenPost = (postId?: string) => {
  if (postId) {
    router.push(`/post/${postId}`);
  }
};

const handleBack = () => {
  router.replace('/tabs/messages');
};

const handleOpenProfile = () => {
  if (otherParticipant.value?.id) {
    router.push(`/profile/${otherParticipant.value.id}`);
  }
};
</script>

<style scoped>
.chat-content {
  --background: var(--app-bg);
}

.chat-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
}

.header-icon-btn {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--app-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  margin-right: -6px;
  transition: opacity 0.15s ease;
}

.header-icon-btn:active {
  opacity: 0.7;
}

/* Meetup Safety Banner (Single at top) */
.safety-tip-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background-color: rgba(47, 159, 232, 0.08);
  border-radius: 10px;
  margin: 4px 0 12px;
  font-size: 11px;
  color: var(--app-primary, #2f9fe8);
  font-weight: 500;
  border: 1px solid rgba(47, 159, 232, 0.15);
  flex-shrink: 0;
}

.safety-icon {
  flex-shrink: 0;
}

/* Message Scroll Area */
.chat-messages-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Chat Message Skeleton Stream */
.chat-skeleton-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}

.skeleton-bubble-row {
  display: flex;
  width: 100%;
}

.skeleton-bubble-row.left {
  justify-content: flex-start;
}

.skeleton-bubble-row.right {
  justify-content: flex-end;
}

.skeleton-bubble {
  height: 42px;
  margin: 0;
}

.left-bubble {
  border-radius: 18px 18px 18px 4px;
}

.right-bubble {
  border-radius: 18px 18px 4px 18px;
}

.bubble-w40 { width: 40%; }
.bubble-w45 { width: 45%; }
.bubble-w55 { width: 55%; }
.bubble-w60 { width: 60%; }
.bubble-w75 { width: 75%; }

.chat-empty-thread {
  text-align: center;
  padding: 60px 20px;
  color: var(--app-text-secondary);
  margin-top: auto;
  margin-bottom: auto;
}

.empty-thread-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin-bottom: 4px;
}

.empty-thread-sub {
  font-size: 13px;
  margin: 0;
  line-height: 1.4;
}

/* Timeline Stream: Anchors to bottom when messages do not fill height */
.timeline-blocks-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  min-height: min-content;
}

.timeline-general-block {
  display: flex;
  flex-direction: column;
}

/* Slack-Inspired Single Inline Post Thread Block */
.timeline-post-thread-block {
  display: flex;
  flex-direction: column;
  margin: 8px 0;
  background-color: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
  padding: 10px 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.thread-root-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  cursor: pointer;
  background-color: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  transition: background-color 0.15s ease;
}

.thread-root-card:hover {
  background-color: var(--app-surface-tertiary);
}

.post-thumb-box {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--app-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--app-card-border);
}

.post-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-thumb-fallback {
  color: var(--app-text-tertiary);
}

.post-info-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.post-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-meta-line {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--app-text-secondary);
}

.post-type-badge {
  font-weight: 700;
}

.post-type-badge.lost {
  color: var(--app-lost, #f04444);
}

.post-type-badge.found {
  color: var(--app-found, #22b573);
}

.post-location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-reply-shortcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid var(--app-card-border);
  border-radius: 12px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-primary);
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.thread-reply-shortcut-btn:hover {
  background-color: rgba(47, 159, 232, 0.1);
}

.post-chevron {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

/* Indented Thread Replies */
.thread-replies-stream {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-left: 14px;
  border-left: 2px solid var(--app-card-border);
  margin-left: 14px;
}

.thread-reply-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.reply-avatar-col {
  flex-shrink: 0;
  padding-top: 2px;
}

.reply-content-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.reply-header-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 2px;
}

.reply-sender-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.reply-timestamp {
  font-size: 10px;
  color: var(--app-text-tertiary);
}

.reply-image-wrap {
  margin: 4px 0;
  max-width: 220px;
  max-height: 220px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--app-card-border);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.reply-image-wrap:hover {
  opacity: 0.95;
  transform: scale(1.01);
}

.reply-img {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  display: block;
}

.reply-text {
  font-size: 13px;
  line-height: 1.4;
  color: var(--app-text-primary);
  margin: 2px 0 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: none;
  font-size: 11px;
  color: var(--app-text-tertiary);
  cursor: pointer;
  padding: 0;
  width: fit-content;
  transition: color 0.15s ease;
}

.reply-action-btn:hover {
  color: var(--app-primary);
}

/* Ephemeral Typing Indicator */
.typing-indicator-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 8px;
}

.typing-dots-bubble {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background-color: var(--app-surface-secondary);
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid var(--app-card-border);
}

.typing-dots-bubble .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--app-text-tertiary);
  animation: typingBounce 1.2s infinite ease-in-out;
}

.typing-dots-bubble .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots-bubble .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1.1);
    opacity: 1;
  }
}

.typing-text {
  font-size: 11px;
  color: var(--app-text-tertiary);
  font-style: italic;
}

/* Fullscreen Viewer */
.fullscreen-image-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-color: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(6px);
  animation: fadeIn 0.15s ease-out;
}

.viewer-close-btn {
  position: absolute;
  top: max(20px, env(safe-area-inset-top, 20px));
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
  z-index: 2;
}

.viewer-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.viewer-image-container {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-full-img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.header-actions-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.12));
  background: var(--app-surface-subtle, rgba(255, 255, 255, 0.06));
  color: var(--app-text-primary, #ffffff);
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--app-surface-hover, rgba(255, 255, 255, 0.12));
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
