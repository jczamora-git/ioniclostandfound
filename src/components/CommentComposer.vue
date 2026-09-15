<template>
  <div class="comment-composer-bar">
    <!-- Active Reply Banner Directly Above Input -->
    <div v-if="replyTarget" class="reply-context-banner">
      <div class="reply-banner-left">
        <Reply :size="13" class="reply-banner-icon" />
        <div class="reply-banner-info">
          <div class="reply-banner-target">
            Replying to <span class="reply-banner-name">{{ replyTarget.authorName }}</span>
          </div>
          <p v-if="replyTarget.contentPreview" class="reply-banner-quote">
            {{ replyTarget.contentPreview }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="cancel-reply-btn"
        aria-label="Cancel reply"
        @click="$emit('cancel-reply')"
      >
        <X :size="14" />
      </button>
    </div>

    <div class="composer-container">
      <UserAvatar
        :name="currentProfile?.name || 'User'"
        :username="currentProfile?.username || 'user'"
        size="sm"
        class="composer-avatar"
      />
      <div class="composer-inner">
        <input
          ref="inputRef"
          v-model="text"
          type="text"
          class="comment-input"
          :placeholder="composerPlaceholder"
          :disabled="submitting"
          @keydown.enter.prevent="handleSend"
          @keydown.esc="handleEscape"
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
import { computed, ref } from "vue";
import { IonSpinner } from "@ionic/vue";
import { SendHorizontal, Reply, X } from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import { useAuth } from "../composables/useAuth";

export interface ReplyTarget {
  commentId: string;
  rootCommentId: string;
  authorId: string;
  authorName: string;
  contentPreview?: string;
}

const props = defineProps<{
  replyTarget?: ReplyTarget | null;
}>();

const emit = defineEmits<{
  (e: "submit-comment", content: string): void;
  (e: "cancel-reply"): void;
}>();

const { currentProfile } = useAuth();
const text = ref("");
const submitting = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const composerPlaceholder = computed(() => {
  if (props.replyTarget?.authorName) {
    return `Reply to ${props.replyTarget.authorName}...`;
  }
  return "Write a public comment...";
});

const handleEscape = () => {
  if (props.replyTarget) {
    emit("cancel-reply");
  }
};

const handleSend = () => {
  const content = text.value.trim();
  if (!content || submitting.value) return;

  submitting.value = true;
  emit("submit-comment", content);
  text.value = "";
  submitting.value = false;
};

const focusInput = () => {
  inputRef.value?.focus();
};

defineExpose({
  focusInput
});
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

/* Reply Context Banner */
.reply-context-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto 8px;
  padding: 6px 12px;
  background: var(--app-surface-secondary);
  border-radius: 10px;
  border-left: 3px solid var(--app-primary);
  animation: slideInDown 0.15s ease-out;
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reply-banner-left {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.reply-banner-icon {
  color: var(--app-primary);
  margin-top: 2px;
  flex-shrink: 0;
}

.reply-banner-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.reply-banner-target {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.reply-banner-name {
  font-weight: 600;
  color: var(--app-text-primary);
}

.reply-banner-quote {
  margin: 0;
  font-size: 11px;
  color: var(--app-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cancel-reply-btn {
  background: transparent;
  border: none;
  color: var(--app-text-tertiary);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cancel-reply-btn:hover {
  background: var(--app-surface-tertiary);
  color: var(--app-text-primary);
}

.cancel-reply-btn:active {
  transform: scale(0.92);
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
  min-height: 44px;
  height: 44px;
  background: var(--app-surface-secondary);
  border-radius: 22px;
  padding: 0 6px 0 14px;
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
