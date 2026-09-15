<template>
  <div class="message-row" :class="{ 'is-own': isOwn }">
    <div
      class="message-bubble-wrapper"
      :class="{ 'is-own': isOwn }"
    >
      <div
        class="message-bubble"
        :class="{
          'own-bubble': isOwn,
          'other-bubble': !isOwn,
          'has-image': !!message.imageUrl,
          'has-image-only': message.imageUrl && !message.text
        }"
      >
        <!-- Attached Image -->
        <div
          v-if="message.imageUrl"
          class="bubble-image-wrap"
          role="button"
          tabindex="0"
          aria-label="View photo in fullscreen"
          @click="showViewer = true"
          @keydown.enter.prevent="showViewer = true"
          @keydown.space.prevent="showViewer = true"
        >
          <img
            :src="message.imageUrl"
            alt="Attached photo"
            class="bubble-img"
            loading="lazy"
          />
        </div>

        <!-- Optional Text Caption / Content -->
        <p v-if="message.text" class="bubble-text">{{ message.text }}</p>

        <!-- Timestamp -->
        <span class="bubble-time">{{ formattedTime }}</span>
      </div>

      <!-- Quick Reply Action Button -->
      <button
        type="button"
        class="bubble-reply-btn"
        aria-label="Reply to message"
        title="Reply"
        @click.stop="$emit('reply', message)"
      >
        <Reply :size="13" />
      </button>
    </div>

    <!-- Fullscreen Image Viewer Modal -->
    <Teleport to="body">
      <div
        v-if="showViewer && message.imageUrl"
        class="fullscreen-image-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Fullscreen photo viewer"
        @click="showViewer = false"
      >
        <button
          type="button"
          class="viewer-close-btn"
          aria-label="Close photo viewer"
          @click.stop="showViewer = false"
        >
          <X :size="24" />
        </button>
        <div class="viewer-image-container" @click.stop>
          <img
            :src="message.imageUrl"
            alt="Fullscreen photo"
            class="viewer-full-img"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Reply } from 'lucide-vue-next';
import type { ChatMessage } from '../types/message';

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
}>();

const emit = defineEmits<{
  (e: 'reply', message: ChatMessage): void;
}>();

const showViewer = ref(false);

const formattedTime = computed(() => {
  if (!props.message.createdAt) return '';
  const d = new Date(props.message.createdAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});
</script>

<style scoped>
.message-row {
  display: flex;
  margin-bottom: 8px;
  width: 100%;
  justify-content: flex-start;
}

.message-row.is-own {
  justify-content: flex-end;
}

.message-bubble-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 80%;
  position: relative;
}

.message-bubble-wrapper.is-own {
  flex-direction: row-reverse;
}

.bubble-reply-btn {
  background: transparent;
  border: none;
  color: var(--app-text-tertiary);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.message-bubble-wrapper:hover .bubble-reply-btn,
.message-bubble-wrapper:focus-within .bubble-reply-btn,
.message-bubble-wrapper:active .bubble-reply-btn {
  opacity: 1;
}

@media (hover: none) {
  .bubble-reply-btn {
    opacity: 0.6;
  }
}

.bubble-reply-btn:hover {
  background: var(--app-surface-secondary);
  color: var(--app-primary);
}

.message-bubble {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  word-break: break-word;
  position: relative;
}

.own-bubble {
  background-color: var(--app-primary, #2f9fe8);
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.other-bubble {
  background-color: var(--app-surface-secondary, #f2f4f7);
  color: var(--app-text-primary, #202124);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--app-card-border);
}

.has-image {
  padding: 6px;
}

.has-image.has-image-only {
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}

.has-image.has-image-only.own-bubble {
  background: transparent;
}

.has-image.has-image-only.other-bubble {
  background: transparent;
  border: none;
}

.bubble-image-wrap {
  position: relative;
  max-width: 260px;
  max-height: 320px;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.bubble-image-wrap:hover {
  opacity: 0.95;
  transform: scale(1.01);
}

.bubble-image-wrap:active {
  transform: scale(0.98);
}

.bubble-img {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: 14px;
}

.bubble-text {
  margin: 6px 4px 2px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.has-image-only .bubble-time {
  position: absolute;
  bottom: 6px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 9px;
  backdrop-filter: blur(4px);
  margin-top: 0;
}

.bubble-time {
  font-size: 10px;
  margin-top: 3px;
  align-self: flex-end;
  opacity: 0.75;
}

.own-bubble .bubble-time {
  color: rgba(255, 255, 255, 0.85);
}

.other-bubble .bubble-time {
  color: var(--app-text-tertiary);
}

/* Fullscreen Image Viewer Modal */
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

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>

