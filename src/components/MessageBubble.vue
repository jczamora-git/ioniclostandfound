<template>
  <div class="message-row" :class="{ 'is-own': isOwn }">
    <div class="message-bubble" :class="{ 'own-bubble': isOwn, 'other-bubble': !isOwn }">
      <p class="bubble-text">{{ message.text }}</p>
      <span class="bubble-time">{{ formattedTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../types/message';

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
}>();

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
}

.message-row.is-own {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 78%;
  padding: 8px 14px;
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

.bubble-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
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
</style>
