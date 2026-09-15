<template>
  <ion-page>
    <ion-content :fullscreen="true" class="chat-content">
      <div class="chat-view-container">
        <!-- Top Navigation Bar Matching App Header Style -->
        <div class="chat-header-wrap">
          <PageHeader
            :title="otherParticipant?.name || 'Chat'"
            :subtitle="headerSubtitle"
            :show-back="true"
            @back="handleBack"
          >
            <template #action>
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
            </template>
          </PageHeader>
        </div>

        <!-- Compact Thread Selector -->
        <div v-if="threads.length > 0" class="threads-selector-container">
          <div class="threads-pills-row">
            <button
              v-for="t in threads"
              :key="t.id"
              type="button"
              class="thread-tab-pill"
              :class="{ active: activeThreadId === t.id }"
              @click="handleSelectThread(t.id)"
            >
              <span class="thread-tab-title">{{ t.title || 'General' }}</span>
              <span
                v-if="getThreadUnread(t) > 0"
                class="thread-tab-badge"
              >
                {{ getThreadUnread(t) > 99 ? '99+' : getThreadUnread(t) }}
              </span>
            </button>
          </div>
        </div>

        <!-- Post Context Bar (Only shown when active thread is post-based) -->
        <PostChatContext
          v-if="activeThread?.type === 'post' && post"
          :post="post"
        />

        <!-- Public Meetup Safety Note -->
        <div class="safety-tip-bar">
          <ShieldAlert :size="15" class="safety-icon" />
          <span>For item exchanges, consider meeting in a public place.</span>
        </div>

        <!-- Message History List -->
        <div ref="scrollContainerRef" class="chat-messages-scroll">
          <div v-if="loading" class="chat-loading">
            <ion-spinner name="crescent" />
            <span>Loading messages...</span>
          </div>

          <div v-else-if="messages.length === 0" class="chat-empty-thread">
            <p class="empty-thread-title">No messages in this thread yet.</p>
            <p class="empty-thread-sub">
              {{
                activeThread?.type === 'post'
                  ? 'Ask about item details, verify ownership, or arrange a safe meetup.'
                  : 'Send a message to start chatting directly.'
              }}
            </p>
          </div>

          <template v-else>
            <MessageBubble
              v-for="msg in messages"
              :key="msg.id"
              :message="msg"
              :is-own="msg.senderId === (sessionUid || currentProfile?.id)"
            />
          </template>

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

        <!-- Sticky Composer -->
        <ChatComposer
          :sending="sending"
          @send="handleSendMessage"
          @typing="handleTyping"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonSpinner } from '@ionic/vue';
import { ShieldAlert } from 'lucide-vue-next';
import PageHeader from '../components/PageHeader.vue';
import UserAvatar from '../components/UserAvatar.vue';
import MessageBubble from '../components/MessageBubble.vue';
import ChatComposer from '../components/ChatComposer.vue';
import PostChatContext from '../components/PostChatContext.vue';
import { useChat } from '../composables/useChat';
import { useConversations } from '../composables/useConversations';
import { useAuth, sessionUid } from '../composables/useAuth';
import { usePosts } from '../composables/usePosts';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import type { Post } from '../types/post';
import type { Profile } from '../types/profile';
import type { ConversationThread } from '../types/conversation';

const route = useRoute();
const router = useRouter();
const conversationId = computed(() => route.params.conversationId as string);
const initialThreadQuery = computed(() => (route.query.thread as string) || 'general');

const { currentProfile } = useAuth();
const { getPostById } = usePosts();
const { markAsRead } = useConversations();

const {
  messages,
  threads,
  activeThreadId,
  activeThread,
  loading,
  isOtherTyping,
  loadThreads,
  loadHistory,
  switchThread,
  setupSocketListeners,
  sendText,
  handleTyping,
  cleanup
} = useChat(conversationId.value, initialThreadQuery.value);

const post = ref<Post | null>(null);
const otherParticipant = ref<Profile | null>(null);
const sending = ref(false);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

const headerSubtitle = computed(() => {
  if (otherParticipant.value?.username) {
    return `@${otherParticipant.value.username}`;
  }
  return undefined;
});

const getThreadUnread = (t: ConversationThread): number => {
  const uid = sessionUid.value || currentProfile.value?.id;
  if (!uid || !t.unreadCounts) return 0;
  return t.unreadCounts[uid] || 0;
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

watch(
  () => messages.value.length,
  () => {
    scrollToBottom();
  }
);

// Helper to load post context for a specific thread
const syncPostContext = async (thread?: ConversationThread) => {
  const current = thread || activeThread.value;
  if (current?.type === 'post' && current.postId) {
    post.value = await getPostById(current.postId);
  } else {
    post.value = null;
  }
};

onMounted(async () => {
  markAsRead(conversationId.value, activeThreadId.value);

  // 1. Fetch conversation participant metadata
  try {
    const { conversations: convList } = useConversations();
    const existing = convList.value.find((c) => c.id === conversationId.value);

    if (existing && existing.otherParticipant) {
      otherParticipant.value = existing.otherParticipant;
    }

    if (!otherParticipant.value) {
      const myUid = sessionUid.value || currentProfile.value?.id;
      let convData: any = existing;

      if (!convData) {
        // Fallback to server REST endpoint
        try {
          const SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || 'http://localhost:3000';
          const res = await fetch(`${SERVER_URL}/api/conversations/${myUid}`);
          if (res.ok) {
            const json = await res.json();
            convData = (json.conversations || []).find((c: any) => c.id === conversationId.value);
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
        const otherUid = (convData.participantIds || []).find((id: string) => id !== myUid);
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
    console.error('Failed to load conversation details:', err);
  }

  // 2. Load threads
  await loadThreads();

  // If query specifies a thread, or if none, check if the initial thread exists
  const requested = initialThreadQuery.value;
  if (requested && threads.value.some((t) => t.id === requested)) {
    activeThreadId.value = requested;
  }

  await syncPostContext();
  await loadHistory(activeThreadId.value);
  await setupSocketListeners();
  scrollToBottom(false);
});

onUnmounted(() => {
  markAsRead(conversationId.value, activeThreadId.value);
  cleanup();
});

const handleSelectThread = async (threadId: string) => {
  if (threadId === activeThreadId.value) return;

  await switchThread(threadId);
  router.replace({ query: { ...route.query, thread: threadId } });

  const selected = threads.value.find((t) => t.id === threadId);
  await syncPostContext(selected);
  scrollToBottom(false);
};

const handleSendMessage = async (text: string) => {
  if (!text || sending.value) return;
  sending.value = true;
  try {
    await sendText(text);
  } catch (err: any) {
    console.error('Error sending message:', err);
  } finally {
    sending.value = false;
  }
};

const handleBack = () => {
  router.back();
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

.chat-header-wrap {
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 0;
  width: 100%;
  box-sizing: border-box;
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

/* Compact Thread Selector Bar */
.threads-selector-container {
  padding: 4px 16px 8px;
  width: 100%;
  box-sizing: border-box;
}

.threads-pills-row {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 2px 0;
}

.threads-pills-row::-webkit-scrollbar {
  display: none;
}

.thread-tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background-color: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.thread-tab-pill:hover {
  background-color: var(--app-surface-tertiary);
  color: var(--app-text-primary);
}

.thread-tab-pill.active {
  background-color: var(--app-primary, #2f9fe8);
  color: #ffffff;
  border-color: var(--app-primary, #2f9fe8);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(47, 159, 232, 0.25);
}

.thread-tab-title {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-tab-badge {
  background-color: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  line-height: 14px;
}

.thread-tab-pill.active .thread-tab-badge {
  background-color: #ffffff;
  color: var(--app-primary, #2f9fe8);
}

/* Meetup Safety Banner */
.safety-tip-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background-color: rgba(47, 159, 232, 0.08);
  border-radius: 8px;
  margin: 0 16px 8px;
  font-size: 11px;
  color: var(--app-primary, #2f9fe8);
  font-weight: 500;
}

.safety-icon {
  flex-shrink: 0;
}

/* Message Scroll Area */
.chat-messages-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
}

.chat-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 8px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.chat-empty-thread {
  text-align: center;
  padding: 60px 20px;
  color: var(--app-text-secondary);
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

/* Typing Indicator */
.typing-indicator-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 8px;
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
</style>
