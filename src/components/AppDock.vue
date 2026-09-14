<template>
  <nav class="mobile-dock-wrapper" aria-label="Main Navigation">
    <div class="mobile-dock">
      <!-- Home Tab -->
      <button
        type="button"
        class="dock-tab-btn"
        :class="{ active: currentTab === 'home' }"
        aria-label="Home Feed"
        @click="$emit('select-tab', 'home')"
      >
        <div class="dock-icon-box">
          <House :size="20" :stroke-width="currentTab === 'home' ? 2.3 : 1.9" class="dock-icon" />
        </div>
        <span class="dock-label">Home</span>
      </button>

      <!-- Create Tab (Uniform with others) -->
      <button
        type="button"
        class="dock-tab-btn"
        aria-label="Create a Post"
        @click="$emit('open-create')"
      >
        <div class="dock-icon-box">
          <Plus :size="22" :stroke-width="2.1" class="dock-icon" />
        </div>
        <span class="dock-label">Create</span>
      </button>

      <!-- Messages Tab -->
      <button
        type="button"
        class="dock-tab-btn"
        :class="{ active: currentTab === 'messages' }"
        aria-label="Messages"
        @click="$emit('select-tab', 'messages')"
      >
        <div class="dock-icon-box relative-icon-box">
          <MessageCircle :size="20" :stroke-width="currentTab === 'messages' ? 2.3 : 1.9" class="dock-icon" />
          <span v-if="totalUnreadCount > 0" class="dock-unread-dot" aria-label="Unread messages"></span>
        </div>
        <span class="dock-label">Messages</span>
      </button>

      <!-- Profile Tab -->
      <button
        type="button"
        class="dock-tab-btn"
        :class="{ active: currentTab === 'profile' }"
        aria-label="My Profile"
        @click="$emit('select-tab', 'profile')"
      >
        <div class="dock-icon-box">
          <UserRound :size="20" :stroke-width="currentTab === 'profile' ? 2.3 : 1.9" class="dock-icon" />
        </div>
        <span class="dock-label">Profile</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { House, Plus, MessageCircle, UserRound } from "lucide-vue-next";
import { useConversations } from "../composables/useConversations";

withDefaults(
  defineProps<{
    currentTab?: "home" | "messages" | "profile";
  }>(),
  {
    currentTab: "home"
  }
);

defineEmits<{
  "select-tab": [tab: "home" | "messages" | "profile"];
  "open-create": [];
}>();

const { totalUnreadCount } = useConversations();
</script>

<style scoped>
.mobile-dock-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 99;
  display: flex;
  justify-content: center;
  pointer-events: none;
  padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
  padding-left: 16px;
  padding-right: 16px;
}

.mobile-dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 320px;
  height: 58px;
  padding: 0 10px;
  border-radius: 29px;
  background: var(--app-dock-bg);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--app-dock-border);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}

.dock-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  color: var(--app-text-tertiary);
  transition: color 0.18s ease, transform 0.15s ease;
  padding: 2px 0;
}

.dock-tab-btn:active {
  transform: scale(0.92);
}

.dock-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.relative-icon-box {
  position: relative;
}

.dock-unread-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--app-primary, #2f9fe8);
  border: 1px solid var(--app-surface, #ffffff);
}

.dock-icon {
  color: currentColor;
  transition: transform 0.18s ease, color 0.18s ease;
}

.dock-tab-btn.active {
  color: var(--app-primary);
}

.dock-tab-btn.active .dock-icon {
  transform: scale(1.05);
}

.dock-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: -0.1px;
  margin-top: 1px;
  color: inherit;
  transition: color 0.18s ease;
}

.dock-tab-btn.active .dock-label {
  font-weight: 600;
}
</style>
