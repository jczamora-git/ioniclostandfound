<template>
  <ion-page>
    <ion-content :fullscreen="true" class="chat-content">
      <div class="chat-view-container">
        <!-- Top Navigation Bar Matching App Header Style -->
        <PageHeader
          :title="otherParticipant?.name || 'Chat'"
          :subtitle="post ? `About: ${post.title}` : undefined"
          :show-back="true"
          :compact="true"
          @back="handleBack"
        >
          <template #action>
            <div class="header-avatar-action" @click="handleOpenProfile">
              <UserAvatar
                :name="otherParticipant?.name || 'User'"
                :username="otherParticipant?.username || 'user'"
                size="sm"
              />
            </div>
          </template>
        </PageHeader>

        <!-- Post Context Bar (Clickable to post details) -->
        <PostChatContext :post="post" />

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
            <p class="empty-thread-title">No messages yet.</p>
            <p class="empty-thread-sub">
              Ask about item details, verify ownership, or arrange a safe meetup.
            </p>
          </div>

          <template v-else>
            <MessageBubble
              v-for="msg in messages"
              :key="msg.id"
              :message="msg"
              :is-own="msg.senderId === currentProfile?.id"
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
import { useAuth } from '../composables/useAuth';
import { usePosts } from '../composables/usePosts';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import type { Post } from '../types/post';
import type { Profile } from '../types/profile';

const route = useRoute();
const router = useRouter();
const conversationId = computed(() => route.params.conversationId as string);

const { currentProfile } = useAuth();
const { getPostById } = usePosts();
const { markAsRead } = useConversations();

const {
  messages,
  loading,
  isOtherTyping,
  loadHistory,
  setupSocketListeners,
  sendText,
  handleTyping,
  cleanup
} = useChat(conversationId.value);

const post = ref<Post | null>(null);
const otherParticipant = ref<Profile | null>(null);
const sending = ref(false);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

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

onMounted(async () => {
  markAsRead(conversationId.value);

  // Fetch conversation metadata
  try {
    const snap = await get(dbRef(db, `conversations/${conversationId.value}`));
    if (snap.exists()) {
      const convData = snap.val();
      if (convData.postId) {
        post.value = await getPostById(convData.postId);
      }

      const otherUid = (convData.participantIds || []).find(
        (id: string) => id !== currentProfile.value?.id
      );
      if (otherUid) {
        const pSnap = await get(dbRef(db, `profiles/${otherUid}`));
        if (pSnap.exists()) {
          otherParticipant.value = {
            id: otherUid,
            name: pSnap.val().name || 'Community Member',
            username: pSnap.val().username || 'user',
            phone: '',
            createdAt: pSnap.val().createdAt || 0,
            updatedAt: pSnap.val().updatedAt || 0
          };
        }
      }
    }
  } catch (err) {
    console.error('Failed to load conversation details:', err);
  }

  await loadHistory();
  await setupSocketListeners();
  scrollToBottom(false);
});

onUnmounted(() => {
  markAsRead(conversationId.value);
  cleanup();
});

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
  max-width: 640px;
  margin: 0 auto;
}

.header-avatar-action {
  cursor: pointer;
  display: flex;
  align-items: center;
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
