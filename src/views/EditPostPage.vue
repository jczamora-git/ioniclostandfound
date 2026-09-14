<template>
  <ion-page>
    <ion-header :translucent="true" class="ios-edit-header">
      <ion-toolbar class="ios-toolbar">
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/post/${postId}`" text="Cancel" />
        </ion-buttons>
        <ion-title class="ios-header-title">Edit Post</ion-title>
        <ion-buttons slot="end">
          <button
            type="button"
            class="header-save-btn"
            :disabled="saving"
            @click="handleSave"
          >
            <ion-spinner v-if="saving" name="crescent" class="btn-spinner" />
            <span v-else>Save</span>
          </button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="edit-post-content">
      <div v-if="loading" class="loading-wrap">
        <ion-spinner name="crescent" />
        <span>Loading post...</span>
      </div>

      <div v-else-if="!post" class="not-found-wrap">
        <p>Post not found.</p>
      </div>

      <div v-else class="ios-screen-container form-container">
        <!-- Post Type Indicator (Read-only for consistency) -->
        <div class="type-banner">
          <span class="type-badge" :class="post.type === 'found' ? 'found' : 'lost'">
            {{ post.type.toUpperCase() }} POST
          </span>
          <span class="type-hint">Post type cannot be changed after publishing.</span>
        </div>

        <div class="form-card">
          <!-- Title -->
          <div class="field-group">
            <label class="field-label">ITEM TITLE</label>
            <input
              v-model="form.title"
              type="text"
              class="composer-input title-input"
              maxlength="80"
              placeholder="e.g. Black Leather Wallet"
            />
            <span v-if="errors.title" class="field-error">{{ errors.title }}</span>
          </div>

          <!-- Category & Date Row -->
          <div class="two-col-row">
            <div class="field-group half-field">
              <label class="field-label">CATEGORY</label>
              <div class="select-wrapper">
                <select v-model="form.category" class="composer-select">
                  <option v-for="cat in POST_CATEGORIES" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>
                <ChevronDown :size="16" class="select-chevron" />
              </div>
            </div>

            <div class="field-group half-field">
              <label class="field-label">WHEN?</label>
              <input
                v-model="form.eventDate"
                type="date"
                class="composer-input date-input"
              />
              <span v-if="errors.eventDate" class="field-error">{{ errors.eventDate }}</span>
            </div>
          </div>

          <!-- Location -->
          <div class="field-group">
            <label class="field-label">LOCATION</label>
            <div class="input-with-icon">
              <MapPin :size="16" class="leading-icon" />
              <input
                v-model="form.location"
                type="text"
                class="composer-input with-icon"
                placeholder="e.g. Central Mall Food Court"
                maxlength="100"
              />
            </div>
            <span v-if="errors.location" class="field-error">{{ errors.location }}</span>
          </div>

          <!-- Description -->
          <div class="field-group">
            <label class="field-label">DESCRIPTION</label>
            <textarea
              v-model="form.description"
              rows="5"
              class="composer-textarea"
              placeholder="Provide item details..."
              maxlength="800"
            ></textarea>
            <span v-if="errors.description" class="field-error">{{ errors.description }}</span>
          </div>

          <!-- Photo URL -->
          <div class="field-group">
            <label class="field-label">PHOTO URL (OPTIONAL)</label>
            <div class="input-with-icon">
              <ImageIcon :size="16" class="leading-icon" />
              <input
                v-model="form.imageUrl"
                type="url"
                class="composer-input with-icon"
                placeholder="Paste image URL..."
              />
              <button
                v-if="form.imageUrl"
                type="button"
                class="clear-photo-btn"
                @click="form.imageUrl = ''"
              >
                <X :size="16" />
              </button>
            </div>

            <div v-if="form.imageUrl" class="photo-preview-box">
              <img :src="form.imageUrl" alt="Preview" class="preview-img" />
              <button type="button" class="remove-preview-btn" @click="form.imageUrl = ''">
                <X :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController
} from "@ionic/vue";
import {
  ChevronDown,
  MapPin,
  Image as ImageIcon,
  X
} from "lucide-vue-next";
import { usePosts } from "../composables/usePosts";
import { POST_CATEGORIES, type Post, type PostFormData, type PostFormErrors } from "../types/post";

const route = useRoute();
const router = useRouter();
const { getPostById, updatePost } = usePosts();

const postId = computed(() => route.params.id as string);
const post = ref<Post | null>(null);
const loading = ref(true);
const saving = ref(false);

const form = reactive<PostFormData>({
  type: "lost",
  title: "",
  category: "Other",
  description: "",
  location: "",
  eventDate: "",
  imageUrl: ""
});

const errors = reactive<PostFormErrors>({});

onMounted(async () => {
  loading.value = true;
  post.value = await getPostById(postId.value);
  if (post.value) {
    form.type = post.value.type;
    form.title = post.value.title;
    form.category = post.value.category;
    form.description = post.value.description;
    form.location = post.value.location;
    form.eventDate = post.value.eventDate;
    form.imageUrl = post.value.imageUrl || "";
  }
  loading.value = false;
});

const validate = (): boolean => {
  let valid = true;
  Object.keys(errors).forEach((k) => delete errors[k as keyof PostFormData]);

  if (!form.title.trim()) {
    errors.title = "Title is required.";
    valid = false;
  }
  if (!form.description.trim()) {
    errors.description = "Description is required.";
    valid = false;
  }
  if (!form.location.trim()) {
    errors.location = "Location is required.";
    valid = false;
  }
  if (!form.eventDate) {
    errors.eventDate = "Date is required.";
    valid = false;
  }

  return valid;
};

const handleSave = async () => {
  if (!validate()) return;
  saving.value = true;
  try {
    await updatePost(postId.value, {
      title: form.title,
      category: form.category,
      description: form.description,
      location: form.location,
      eventDate: form.eventDate,
      imageUrl: form.imageUrl || undefined
    });

    const toast = await toastController.create({
      message: "Post updated successfully.",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();

    router.replace(`/post/${postId.value}`);
  } catch (err: any) {
    console.error("Update post error:", err);
    const toast = await toastController.create({
      message: err.message || "Failed to update post.",
      duration: 3000,
      position: "top",
      color: "danger"
    });
    await toast.present();
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.edit-post-content {
  --background: var(--app-bg);
}

.ios-toolbar {
  --background: var(--app-dock-bg);
  --backdrop-filter: blur(20px);
}

.ios-header-title {
  font-size: 17px;
  font-weight: 600;
}

.header-save-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-color-primary);
  padding: 8px 12px;
  cursor: pointer;
}

.btn-spinner {
  width: 18px;
  height: 18px;
}

.loading-wrap,
.not-found-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--app-text-secondary);
}

.form-container {
  padding: 16px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.type-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--app-surface);
  border-radius: 14px;
  padding: 10px 14px;
  border: 1px solid var(--app-card-border);
}

.type-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
}

.type-badge.lost {
  background: var(--status-lost-bg);
  color: var(--status-lost-text);
}

.type-badge.found {
  background: var(--status-found-bg);
  color: var(--status-found-text);
}

.type-hint {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.form-card {
  background: var(--app-surface);
  border-radius: 20px;
  padding: 20px 16px;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.two-col-row {
  display: flex;
  gap: 12px;
}

.half-field {
  flex: 1;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--app-text-secondary);
}

.composer-input,
.composer-select,
.composer-textarea {
  width: 100%;
  background: var(--app-input-background);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--app-text-primary);
  box-sizing: border-box;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.composer-input,
.composer-select {
  height: 48px;
}

.composer-input:focus,
.composer-select:focus,
.composer-textarea:focus {
  border-color: var(--ion-color-primary);
}

.title-input {
  font-weight: 600;
}

.composer-textarea {
  resize: none;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.leading-icon {
  position: absolute;
  left: 12px;
  font-size: 18px;
  color: var(--app-text-secondary);
  pointer-events: none;
}

.composer-input.with-icon {
  padding-left: 38px;
}

.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-chevron {
  position: absolute;
  right: 12px;
  font-size: 16px;
  color: var(--app-text-secondary);
  pointer-events: none;
}

.field-error {
  font-size: 12px;
  color: var(--ion-color-danger);
}

.clear-photo-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--app-text-secondary);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.photo-preview-box {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 180px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--app-separator);
  margin-top: 4px;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-preview-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
}
</style>
