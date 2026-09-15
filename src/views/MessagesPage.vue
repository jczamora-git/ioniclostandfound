<template>
  <ion-page>
    <!-- Fixed Page Header -->
    <PageHeader title="Messages" />

    <ion-content :fullscreen="true" class="messages-content">
      <ion-refresher slot="fixed" @ion-refresh="handleRefresh">
        <ion-refresher-content pulling-icon="arrow-down" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="ios-screen-container messages-container">
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

        <!-- 1. SKELETON LOADING STATE (4 rows with avatar, name, last-message, timestamp) -->
        <div v-else-if="isConversationsLoading && conversations.length === 0" class="messages-skeleton-list" aria-label="Loading conversations">
          <div v-for="n in 4" :key="n" class="skeleton-conversation-row">
            <div class="skeleton-avatar-box">
              <ion-skeleton-text :animated="true" class="skeleton-avatar-circle" />
            </div>
            <div class="skeleton-row-main">
              <div class="skeleton-row-top">
                <ion-skeleton-text :animated="true" class="skeleton-name" />
                <ion-skeleton-text :animated="true" class="skeleton-time" />
              </div>
              <ion-skeleton-text :animated="true" class="skeleton-last-msg" />
            </div>
          </div>
        </div>

        <!-- 2. CONNECTION FAILURE STATE -->
        <div v-else-if="hasConnectionError && conversations.length === 0" class="messages-empty-state connection-error-state">
          <div class="empty-icon-bubble warning-bubble">
            <WifiOff :size="36" />
          </div>
          <h3 class="empty-title">Unable to connect to messaging</h3>
          <p class="empty-sub">
            Could not reach the messaging server. Please check your network connection and try again.
          </p>
          <button type="button" class="retry-btn" @click="handleRetry">
            <RefreshCw :size="16" class="btn-icon" />
            Retry
          </button>
        </div>

        <!-- 3. EMPTY STATE (Session active, loaded, 0 conversations) -->
        <div v-else-if="conversations.length === 0" class="messages-empty-state">
          <div class="empty-icon-bubble">
            <MessageCircle :size="36" />
          </div>
          <h3 class="empty-title">No conversations yet</h3>
          <p class="empty-sub">
            Message someone from a Lost or Found post to start a private conversation.
          </p>
        </div>

        <!-- 4. REAL CONVERSATION LIST -->
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
  IonSkeletonText
} from '@ionic/vue';
import { MessageCircle, Lock, WifiOff, RefreshCw } from 'lucide-vue-next';
import PageHeader from '../components/PageHeader.vue';
import ConversationRow from '../components/ConversationRow.vue';
import { useConversations } from '../composables/useConversations';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { hasValidSession } = useAuth();
const {
  conversations,
  isConversationsLoading,
  hasConnectionError,
  subscribeToConversations,
  stopConversationSubscription
} = useConversations();

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

const handleRetry = () => {
  subscribeToConversations();
};

const handleRefresh = async (event: any) => {
  if (hasValidSession.value) {
    await subscribeToConversations();
  }
  setTimeout(() => {
    event.target.complete();
  }, 400);
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
  padding: 16px 16px calc(100px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
}

/* Skeleton Loading Styles */
.messages-skeleton-list {
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}

.skeleton-conversation-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--app-card-border);
}

.skeleton-conversation-row:last-child {
  border-bottom: none;
}

.skeleton-avatar-box {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.skeleton-avatar-circle {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  margin: 0;
}

.skeleton-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.skeleton-name {
  width: 42%;
  height: 15px;
  border-radius: 4px;
  margin: 0;
}

.skeleton-time {
  width: 38px;
  height: 12px;
  border-radius: 4px;
  margin: 0;
}

.skeleton-last-msg {
  width: 72%;
  height: 13px;
  border-radius: 4px;
  margin: 0;
}

/* Empty & Error States */
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

.warning-bubble {
  background: rgba(240, 68, 68, 0.08);
  color: var(--app-lost, #f04444);
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

.auth-btn,
.retry-btn {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: var(--ion-color-primary, #2F9FE8);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.retry-btn:active,
.auth-btn:active {
  opacity: 0.85;
}

.btn-icon {
  flex-shrink: 0;
}

.conversations-list {
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}
</style>
