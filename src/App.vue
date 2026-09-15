<template>
  <ion-app>
    <!-- Branded Startup Loading Screen -->
    <transition name="fade">
      <div v-if="!isAuthReady" class="app-splash-screen">
        <img
          src="/lost-and-found.png"
          alt="Lost &amp; Found Logo"
          class="splash-logo"
        />
        <h1 class="splash-title">Lost &amp; Found</h1>
        <p class="splash-subtitle">Community Forum</p>
        <ion-spinner name="crescent" class="splash-spinner" />
      </div>
    </transition>

    <ion-router-outlet v-show="isAuthReady" />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { IonApp, IonRouterOutlet, IonSpinner } from "@ionic/vue";
import { useAuth } from "./composables/useAuth";
import { useConversations } from "./composables/useConversations";
import { useNotifications } from "./composables/useNotifications";

const { isAuthReady, hasValidSession, initializeAuthSession } = useAuth();
const { subscribeToConversations } = useConversations();
const { subscribeToNotifications } = useNotifications();

onMounted(async () => {
  await initializeAuthSession();
  if (hasValidSession.value) {
    subscribeToConversations();
    subscribeToNotifications();
  }
});

watch(hasValidSession, (valid) => {
  if (valid) {
    subscribeToConversations();
    subscribeToNotifications();
  }
});
</script>

<style scoped>
.app-splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: var(--app-bg);
  color: var(--app-text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  user-select: none;
}

.splash-logo {
  width: 88px;
  height: 88px;
  object-fit: contain;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(47, 159, 232, 0.2);
  margin-bottom: 8px;
}

.splash-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--app-text-primary);
}

.splash-subtitle {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.splash-spinner {
  color: var(--app-primary);
  width: 26px;
  height: 26px;
}

.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-leave-to {
  opacity: 0;
}
</style>
