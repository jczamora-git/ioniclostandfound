<template>
  <ion-page>
    <ion-content :fullscreen="true" class="messages-content">
      <ion-refresher slot="fixed" @ion-refresh="handleRefresh">
        <ion-refresher-content pulling-icon="arrow-down" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="ios-screen-container messages-container">
        <!-- Unified Page Header -->
        <PageHeader title="Messages" />

        <!-- Unauthenticated Prompt (Only when no session and no dev account) -->
        <div v-if="!hasValidSession" class="messages-empty-state">
          <div class="empty-icon-bubble">
            <Lock :size="36" />
          </div>
          <h3 class="empty-title">Sign in to view messages</h3>
          <p class="empty-sub">
            Please sign in or create an account to start and view private conversations.
          </p>
          <button type="button" class="auth-btn" @click="router.push('/auth')">
            Sign In
          </button>
        </div>

        <!-- Loading State -->
        <div v-else-if="loading && conversations.length === 0" class="messages-loading">
          <ion-spinner name="crescent" />
          <span>Loading conversations...</span>
        </div>

        <!-- Empty State (Session active, 0 conversations) -->
        <div v-else-if="conversations.length === 0" class="messages-empty-state">
          <div class="empty-icon-bubble">
            <MessageCircle :size="36" />
          </div>
          <h3 class="empty-title">No conversations yet</h3>
          <p class="empty-sub">
            Message someone from a Lost or Found post to start a private conversation.
          </p>
        </div>

        <!-- Conversation List -->
        <div v-else class="conversations-list">
          <ConversationRow
            v-for="conv in conversations"
            :key="conv.id"
            :conversation="conv"
            @select="handleSelectConversation"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner
} from '@ionic/vue';
import { MessageCircle, Lock } from 'lucide-vue-next';
import PageHeader from '../components/PageHeader.vue';
import ConversationRow from '../components/ConversationRow.vue';
import { useConversations } from '../composables/useConversations';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { hasValidSession } = useAuth();
const { conversations, loading, subscribeToConversations, stopConversationSubscription } =
  useConversations();

onMounted(() => {
  if (hasValidSession.value) {
    subscribeToConversations();
  }
});

watch(hasValidSession, (valid) => {
  if (valid) {
    subscribeToConversations();
  } else {
    stopConversationSubscription();
  }
});

onUnmounted(() => {
  stopConversationSubscription();
});

const handleRefresh = (event: any) => {
  if (hasValidSession.value) {
    subscribeToConversations();
  }
  setTimeout(() => {
    event.target.complete();
  }, 600);
};

const handleSelectConversation = (convId: string) => {
  router.push(`/chat/${convId}`);
};
</script>

<style scoped>
.messages-content {
  --background: var(--app-bg);
}

.messages-container {
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 100px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
}

.messages-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--app-text-secondary);
}

.messages-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px;
  gap: 10px;
}

.empty-icon-bubble {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--app-surface-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-tertiary);
  margin-bottom: 4px;
}

.empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.empty-sub {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-secondary);
  max-width: 280px;
  line-height: 1.4;
}

.auth-btn {
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--ion-color-primary, #2F9FE8);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.conversations-list {
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
}
</style>
