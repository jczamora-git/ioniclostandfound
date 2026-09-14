<template>
  <div class="chat-composer-wrap">
    <div class="chat-composer-inner">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="composer-textarea"
        placeholder="Message..."
        rows="1"
        :disabled="sending"
        @input="handleInput"
        @keydown.enter.exact.prevent="handleSubmit"
      ></textarea>

      <button
        type="button"
        class="send-msg-btn"
        :disabled="!text.trim() || sending"
        aria-label="Send message"
        @click="handleSubmit"
      >
        <SendHorizontal :size="18" class="send-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { SendHorizontal } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'typing'): void;
}>();

const props = defineProps<{
  sending?: boolean;
}>();

const text = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const handleInput = () => {
  emit('typing');
  adjustHeight();
};

const adjustHeight = () => {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.min(el.scrollHeight, 120);
  el.style.height = `${newHeight}px`;
};

const handleSubmit = () => {
  const trimmed = text.value.trim();
  if (!trimmed || props.sending) return;

  emit('send', trimmed);
  text.value = '';
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  });
};
</script>

<style scoped>
.chat-composer-wrap {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--app-surface);
  border-top: 1px solid var(--app-card-border);
  padding: 8px 16px max(10px, env(safe-area-inset-bottom, 10px));
  z-index: 20;
}

.chat-composer-inner {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background-color: var(--app-surface-secondary);
  border-radius: 20px;
  padding: 6px 8px 6px 14px;
  border: 1px solid var(--app-card-border);
  max-width: 640px;
  margin: 0 auto;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.chat-composer-inner:focus-within {
  border-color: var(--app-primary);
  background-color: var(--app-surface);
}

.composer-textarea {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 14px;
  line-height: 1.4;
  color: var(--app-text-primary);
  outline: none;
  resize: none;
  font-family: inherit;
  padding: 4px 0;
  max-height: 120px;
}

.composer-textarea::placeholder {
  color: var(--app-text-secondary);
}

.send-msg-btn {
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
  transition: opacity 0.15s ease, transform 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.send-msg-btn:active {
  transform: scale(0.92);
}

.send-msg-btn:disabled {
  opacity: 0.3;
  color: var(--app-text-tertiary);
  cursor: not-allowed;
}

.send-icon {
  color: currentColor;
}
</style>
