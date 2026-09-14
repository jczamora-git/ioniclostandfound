<template>
  <div class="comment-composer-bar">
    <div class="composer-container">
      <UserAvatar
        :name="currentProfile?.name || 'User'"
        :username="currentProfile?.username || 'user'"
        size="sm"
        class="composer-avatar"
      />
      <div class="composer-inner">
        <input
          v-model="text"
          type="text"
          class="comment-input"
          placeholder="Write a public comment..."
          :disabled="submitting"
          @keydown.enter.prevent="handleSend"
        />
        <button
          type="button"
          class="send-btn"
          :disabled="!text.trim() || submitting"
          aria-label="Send comment"
          @click="handleSend"
        >
          <ion-spinner v-if="submitting" name="crescent" class="send-spinner" />
          <SendHorizontal v-else :size="18" class="send-icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { IonSpinner } from "@ionic/vue";
import { SendHorizontal } from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import { useAuth } from "../composables/useAuth";

const emit = defineEmits<{
  (e: "submit-comment", content: string): void;
}>();

const { currentProfile } = useAuth();
const text = ref("");
const submitting = ref(false);

const handleSend = () => {
  const content = text.value.trim();
  if (!content || submitting.value) return;

  submitting.value = true;
  emit("submit-comment", content);
  text.value = "";
  submitting.value = false;
};
</script>

<style scoped>
.comment-composer-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--app-surface);
  border-top: 1px solid var(--app-card-border);
  padding: 8px 16px max(10px, env(safe-area-inset-bottom, 10px));
  z-index: 10;
}

.composer-container {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
}

.composer-avatar {
  flex-shrink: 0;
}

.composer-inner {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-surface-secondary);
  border-radius: 20px;
  padding: 4px 8px 4px 14px;
  border: 1px solid var(--app-card-border);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.composer-inner:focus-within {
  border-color: var(--app-primary);
  background: var(--app-surface);
}

.comment-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--app-text-primary);
  outline: none;
  font-family: inherit;
  padding: 6px 0;
}

.comment-input::placeholder {
  color: var(--app-text-secondary);
}

/* Minimal icon-only send button */
.send-btn {
  background: transparent;
  color: var(--app-primary);
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.send-btn:active {
  transform: scale(0.92);
}

.send-btn:disabled {
  opacity: 0.3;
  color: var(--app-text-tertiary);
  cursor: not-allowed;
}

.send-icon {
  color: currentColor;
}

.send-spinner {
  width: 16px;
  height: 16px;
  --color: var(--app-primary);
}
</style>
