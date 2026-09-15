<template>
  <ion-modal
    :is-open="isOpen"
    class="share-centered-modal"
    @did-dismiss="$emit('close')"
  >
    <div class="share-modal-container">
      <!-- Close Button Top Right -->
      <button
        type="button"
        class="share-close-btn"
        aria-label="Close share dialog"
        @click="$emit('close')"
      >
        <X :size="18" />
      </button>

      <!-- Top Circular Icon -->
      <div class="share-icon-badge" aria-hidden="true">
        <Share2 :size="24" class="share-badge-icon" />
      </div>

      <!-- Title and Subtitle -->
      <h2 class="share-modal-title">Share this post</h2>
      <p class="share-modal-sub">Help others see this Lost & Found post.</p>

      <!-- Share Link Field -->
      <div class="share-field-group">
        <label class="share-section-label">Share link</label>
        <div class="share-url-box" @click="handleCopy">
          <input
            type="text"
            readonly
            :value="sharePayload.url"
            class="share-url-input"
            tabindex="-1"
            aria-label="Post URL"
          />
          <button
            type="button"
            class="copy-btn"
            :class="{ copied: isCopied }"
            aria-label="Copy post link"
            title="Copy post link"
            @click.stop="handleCopy"
          >
            <Check v-if="isCopied" :size="16" class="copy-icon" />
            <Copy v-else :size="16" class="copy-icon" />
          </button>
        </div>
      </div>

      <!-- Share to Social Grid -->
      <div class="share-social-group">
        <label class="share-section-label">Share to</label>
        <div class="share-social-grid">
          <!-- Facebook -->
          <button
            type="button"
            class="social-action-btn"
            aria-label="Share to Facebook"
            title="Facebook"
            @click="handleFacebook"
          >
            <div class="social-icon-circle facebook-circle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <span class="social-label">Facebook</span>
          </button>

          <!-- X -->
          <button
            type="button"
            class="social-action-btn"
            aria-label="Share to X"
            title="X"
            @click="handleX"
          >
            <div class="social-icon-circle x-circle">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <span class="social-label">X</span>
          </button>

          <!-- Instagram -->
          <button
            type="button"
            class="social-action-btn"
            aria-label="Share to Instagram"
            title="Instagram"
            @click="handleInstagram"
          >
            <div class="social-icon-circle instagram-circle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </div>
            <span class="social-label">Instagram</span>
          </button>

          <!-- Email -->
          <button
            type="button"
            class="social-action-btn"
            aria-label="Share via Email"
            title="Email"
            @click="handleEmail"
          >
            <div class="social-icon-circle email-circle">
              <Mail :size="20" />
            </div>
            <span class="social-label">Email</span>
          </button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script lang="ts">
import type { Post } from "../types/post";

export interface PostSharePayload {
  title: string;
  text: string;
  url: string;
}

export const getPostShareData = (post: Post | null): PostSharePayload => {
  if (!post) {
    return {
      title: "Lost & Found Item",
      text: "Check out this post on Lost & Found.",
      url: window.location.href
    };
  }
  const origin = window.location.origin;
  const url = `${origin}/post/${post.id}`;
  const title = `${post.type.toUpperCase()}: ${post.title}`;
  const text = `${post.title} — ${post.location}. Check Lost & Found forum.`;
  return { title, text, url };
};
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import { IonModal, toastController } from "@ionic/vue";
import { X, Share2, Mail, Copy, Check } from "lucide-vue-next";

const props = defineProps<{
  isOpen: boolean;
  post: Post | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const isCopied = ref(false);

const sharePayload = computed(() => getPostShareData(props.post));

const showToast = async (message: string, color: "success" | "medium" = "success") => {
  const toast = await toastController.create({
    message,
    duration: 2000,
    position: "top",
    color
  });
  await toast.present();
};

const handleCopy = async () => {
  const { url } = sharePayload.value;
  try {
    await navigator.clipboard.writeText(url);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
    await showToast("Link copied");
  } catch (err) {
    console.error("Failed to copy link:", err);
  }
};

const handleFacebook = () => {
  emit("close");
  const { url } = sharePayload.value;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(fbUrl, "_blank", "noopener,noreferrer");
};

const handleX = () => {
  emit("close");
  const { text, url } = sharePayload.value;
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(xUrl, "_blank", "noopener,noreferrer");
};

const handleEmail = () => {
  emit("close");
  const { title, text, url } = sharePayload.value;
  const subject = encodeURIComponent(`Lost & Found: ${props.post?.title || "Item"}`);
  const body = encodeURIComponent(`${title}\n${text}\n\nView details: ${url}`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

const handleInstagram = async () => {
  emit("close");
  const { url } = sharePayload.value;
  try {
    await navigator.clipboard.writeText(url);
    await showToast("Link copied. Open Instagram to share.");
  } catch (err) {
    console.error("Failed to copy link for Instagram:", err);
  }
};
</script>

<style scoped>
.share-modal-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  position: relative;
  background: var(--app-surface, #ffffff);
  color: var(--app-text-primary, #0f172a);
  border-radius: 24px;
}

.share-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--app-surface-secondary, #f1f5f9);
  border: none;
  color: var(--app-text-secondary, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.share-close-btn:hover {
  background: var(--app-surface-tertiary, #e2e8f0);
  color: var(--app-text-primary, #0f172a);
}

.share-close-btn:active {
  transform: scale(0.92);
}

.share-icon-badge {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--app-primary-soft, #ddf3ff);
  color: var(--app-primary, #2f9fe8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.share-badge-icon {
  color: currentColor;
}

.share-modal-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--app-text-primary, #0f172a);
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}

.share-modal-sub {
  font-size: 13px;
  color: var(--app-text-secondary, #64748b);
  margin: 0 0 20px;
  line-height: 1.4;
  max-width: 260px;
}

.share-field-group,
.share-social-group {
  width: 100%;
  text-align: left;
}

.share-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-secondary, #64748b);
  margin-bottom: 6px;
  display: block;
}

.share-url-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-surface-secondary, #f8fafc);
  border: 1px solid var(--app-card-border, #e2e8f0);
  border-radius: 12px;
  padding: 0 6px 0 12px;
  height: 44px;
  margin-bottom: 20px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.share-url-box:hover {
  border-color: var(--app-primary, #2f9fe8);
}

.share-url-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--app-text-secondary, #475569);
  outline: none;
  font-family: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--app-primary, #2f9fe8);
  color: #ffffff;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease, background-color 0.2s ease;
}

.copy-btn:hover {
  opacity: 0.9;
}

.copy-btn:active {
  transform: scale(0.92);
}

.copy-btn.copied {
  background: var(--app-found, #22b573);
}

.copy-icon {
  color: currentColor;
}

.share-social-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
}

.social-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 2px;
  transition: opacity 0.15s ease;
}

.social-action-btn:hover {
  opacity: 0.85;
}

.social-icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.social-action-btn:active .social-icon-circle {
  transform: scale(0.92);
}

.facebook-circle {
  background: #1877f2;
  color: #ffffff;
}

.x-circle {
  background: #0f1419;
  color: #ffffff;
}

.instagram-circle {
  background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
  color: #ffffff;
}

.email-circle {
  background: var(--app-surface-secondary, #f1f5f9);
  color: var(--app-text-primary, #0f172a);
  border: 1px solid var(--app-card-border, #e2e8f0);
}

.social-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-secondary, #64748b);
  text-align: center;
}
</style>

<style>
/* Global styling for centered modal */
ion-modal.share-centered-modal {
  --width: min(92vw, 380px);
  --height: auto;
  --border-radius: 24px;
  --box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --backdrop-opacity: 0.5;
  --background: transparent;
}

ion-modal.share-centered-modal::part(content) {
  border-radius: 24px;
  border: 1px solid var(--app-card-border, #e2e8f0);
  background: var(--app-surface, #ffffff);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  position: relative;
  margin: auto;
}
</style>
