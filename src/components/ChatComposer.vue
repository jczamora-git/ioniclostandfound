<template>
  <div class="chat-composer-wrap">
    <!-- Active Reply / Post Context Banner -->
    <div v-if="replyContext" class="composer-reply-banner">
      <div class="reply-banner-left">
        <CornerDownRight :size="15" class="reply-banner-icon" />
        <div class="reply-banner-text">
          <span class="reply-banner-label">
            {{ replyContext.type === 'post' ? 'Replying about post:' : `Replying to ${replyContext.senderName || 'user'}:` }}
          </span>
          <span class="reply-banner-title">
            {{ replyContext.title || replyContext.textPreview }}
          </span>
        </div>
      </div>
      <button
        type="button"
        class="reply-banner-close-btn"
        aria-label="Cancel reply context"
        :disabled="sending"
        @click="$emit('clear-reply')"
      >
        <X :size="15" />
      </button>
    </div>

    <!-- Image Preview Above Composer -->
    <div v-if="selectedImagePreview" class="composer-preview-container">
      <div class="composer-image-preview-card">
        <img
          :src="selectedImagePreview"
          alt="Attached preview"
          class="composer-preview-img"
        />
        <button
          type="button"
          class="remove-preview-btn"
          aria-label="Remove attached image"
          :disabled="sending"
          @click="clearSelectedImage"
        >
          <X :size="14" />
        </button>
        <div v-if="sending" class="uploading-overlay">
          <ion-spinner name="crescent" class="upload-spinner" />
          <span class="uploading-text">Uploading photo...</span>
        </div>
      </div>
    </div>

    <!-- Main Composer Input Bar -->
    <div class="chat-composer-inner">
      <!-- Hidden File Input -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden-file-input"
        aria-hidden="true"
        @change="handleFileChange"
      />

      <!-- Image Attachment Button -->
      <button
        type="button"
        class="attach-img-btn"
        aria-label="Attach photo"
        :disabled="sending"
        @click="triggerImagePicker"
      >
        <ImagePlus :size="20" class="attach-icon" />
      </button>

      <!-- Message Text Area -->
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

      <!-- Send Button -->
      <button
        type="button"
        class="send-msg-btn"
        :disabled="isSendDisabled"
        aria-label="Send message"
        @click="handleSubmit"
      >
        <SendHorizontal :size="18" class="send-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { IonSpinner } from '@ionic/vue';
import { ImagePlus, X, SendHorizontal, CornerDownRight } from 'lucide-vue-next';
import { validateImageFile, MAX_MESSAGE_IMAGE_SIZE_BYTES } from '../composables/useImageUpload';

export interface ReplyContext {
  type: 'post' | 'message';
  title?: string;
  subtitle?: string;
  postId?: string | null;
  threadId?: string;
  senderName?: string;
  textPreview?: string;
}

const emit = defineEmits<{
  (e: 'send', payload: { text: string; file: File | null }): void;
  (e: 'typing'): void;
  (e: 'clear-reply'): void;
}>();

const props = defineProps<{
  sending?: boolean;
  replyContext?: ReplyContext | null;
}>();

const text = ref('');
const selectedFile = ref<File | null>(null);
const selectedImagePreview = ref<string | null>(null);

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const isSendDisabled = computed(() => {
  if (props.sending) return true;
  return !text.value.trim() && !selectedFile.value;
});

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

const focus = () => {
  textareaRef.value?.focus();
};

const triggerImagePicker = () => {
  if (props.sending) return;
  fileInputRef.value?.click();
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const validation = validateImageFile(file, MAX_MESSAGE_IMAGE_SIZE_BYTES);
  if (!validation.valid) {
    alert(validation.error || 'Please select a valid image (JPEG, PNG, WebP up to 5MB).');
    if (fileInputRef.value) fileInputRef.value.value = '';
    return;
  }

  selectedFile.value = file;
  selectedImagePreview.value = URL.createObjectURL(file);
};

const clearSelectedImage = () => {
  if (selectedImagePreview.value) {
    URL.revokeObjectURL(selectedImagePreview.value);
  }
  selectedFile.value = null;
  selectedImagePreview.value = null;
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const clear = () => {
  text.value = '';
  clearSelectedImage();
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
    }
  });
};

const handleSubmit = () => {
  const trimmed = text.value.trim();
  const file = selectedFile.value;
  if ((!trimmed && !file) || props.sending) return;

  emit('send', { text: trimmed, file });
};

defineExpose({
  clear,
  clearSelectedImage,
  focus
});
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

.composer-reply-banner {
  max-width: 640px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: var(--app-surface-secondary);
  border-radius: 12px;
  border-left: 3px solid var(--app-primary);
  border-top: 1px solid var(--app-card-border);
  border-right: 1px solid var(--app-card-border);
  border-bottom: 1px solid var(--app-card-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.reply-banner-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.reply-banner-icon {
  color: var(--app-primary);
  flex-shrink: 0;
}

.reply-banner-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.reply-banner-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--app-primary);
  line-height: 1.2;
}

.reply-banner-title {
  font-size: 12px;
  color: var(--app-text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-banner-close-btn {
  background: transparent;
  border: none;
  color: var(--app-text-tertiary);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  margin-left: 6px;
  transition: color 0.15s ease, background 0.15s ease;
}

.reply-banner-close-btn:hover {
  color: var(--app-text-primary);
  background: var(--app-surface-tertiary);
}

.composer-preview-container {
  max-width: 640px;
  margin: 0 auto 8px;
  display: flex;
  align-items: flex-start;
}

.composer-image-preview-card {
  position: relative;
  display: inline-flex;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-height: 140px;
  max-width: 180px;
  background: var(--app-surface-secondary);
}

.composer-preview-img {
  width: 100%;
  max-height: 140px;
  object-fit: cover;
  display: block;
}

.remove-preview-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, background 0.15s ease;
  backdrop-filter: blur(4px);
}

.remove-preview-btn:hover {
  background: rgba(0, 0, 0, 0.85);
  transform: scale(1.08);
}

.uploading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  backdrop-filter: blur(2px);
}

.upload-spinner {
  width: 22px;
  height: 22px;
  color: #ffffff;
}

.uploading-text {
  font-size: 11px;
  color: #ffffff;
  font-weight: 500;
}

.chat-composer-inner {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background-color: var(--app-surface-secondary);
  border-radius: 20px;
  padding: 4px 6px 4px 8px;
  border: 1px solid var(--app-card-border);
  max-width: 640px;
  margin: 0 auto;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.chat-composer-inner:focus-within {
  border-color: var(--app-primary);
  background-color: var(--app-surface);
}

.hidden-file-input {
  display: none;
}

.attach-img-btn {
  background: transparent;
  color: var(--app-text-secondary);
  border: none;
  border-radius: 50%;
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.attach-img-btn:hover {
  color: var(--app-primary);
  background-color: rgba(47, 159, 232, 0.08);
}

.attach-img-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.composer-textarea {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  font-size: 14px;
  line-height: 1.4;
  color: var(--app-text-primary);
  outline: none;
  resize: none;
  font-family: inherit;
  padding: 10px 4px 10px 2px;
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
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
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

