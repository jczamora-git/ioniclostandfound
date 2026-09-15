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
            :disabled="saving || loading || !post"
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

          <PostCategoryFields
            v-model:category="form.category"
            v-model:sub-category="form.subCategory"
            v-model:pending-subcategory="form.pendingSubcategory"
            :disabled="saving"
            :error="errors.category"
          />

          <CustomDatePicker
            v-model="form.eventDate"
            :disabled="saving"
            :error="errors.eventDate"
          />

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

          <!-- Photo Attachment Section -->
          <div class="field-group">
            <label class="field-label">PHOTO (OPTIONAL)</label>
            <div v-if="previewPhotoUrl" class="photo-preview-box">
              <img :src="previewPhotoUrl" alt="Post preview" class="preview-img" />
              <div class="photo-overlay-actions">
                <button
                  type="button"
                  class="overlay-action-btn change-btn"
                  :disabled="saving"
                  @click="triggerPhotoPicker"
                >
                  <Camera :size="14" />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  class="overlay-action-btn remove-btn"
                  :disabled="saving"
                  @click="removePhoto"
                >
                  <Trash2 :size="14" />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            <div v-else class="photo-add-box">
              <button
                type="button"
                class="add-photo-btn"
                :disabled="saving"
                @click="triggerPhotoPicker"
              >
                <ImagePlus :size="18" />
                <span>Add Photo</span>
              </button>
            </div>

            <span v-if="photoError" class="field-error">{{ photoError }}</span>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden-file-input"
              @change="onPhotoSelected"
            />
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
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
  MapPin,
  ImagePlus,
  Camera,
  Trash2
} from "lucide-vue-next";
import { usePosts } from "../composables/usePosts";
import { validateImageFile } from "../composables/useStorageUpload";
import PostCategoryFields from "../components/PostCategoryFields.vue";
import CustomDatePicker from "../components/CustomDatePicker.vue";
import { type Post, type PostFormData, type PostFormErrors } from "../types/post";

const route = useRoute();
const router = useRouter();
const { getPostById, updatePost } = usePosts();

const postId = computed(() => route.params.id as string);
const post = ref<Post | null>(null);
const loading = ref(true);
const saving = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedPhotoFile = ref<File | null>(null);
const previewPhotoUrl = ref("");
const removePhotoFlag = ref(false);
const photoError = ref("");

const form = reactive<PostFormData>({
  type: "lost",
  title: "",
  category: "",
  subCategory: "",
  pendingSubcategory: undefined,
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
    form.subCategory = post.value.subCategory;
    form.description = post.value.description;
    form.location = post.value.location;
    form.eventDate = post.value.eventDate;
    form.imageUrl = post.value.imageUrl || "";
    previewPhotoUrl.value = post.value.imageUrl || "";
  }
  loading.value = false;
});

onUnmounted(() => {
  if (previewPhotoUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewPhotoUrl.value);
  }
});

const triggerPhotoPicker = () => {
  fileInputRef.value?.click();
};

const onPhotoSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    photoError.value = validation.error || "Please select a valid image.";
    if (fileInputRef.value) fileInputRef.value.value = "";
    return;
  }

  if (previewPhotoUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewPhotoUrl.value);
  }

  selectedPhotoFile.value = file;
  previewPhotoUrl.value = URL.createObjectURL(file);
  removePhotoFlag.value = false;
  photoError.value = "";
};

const removePhoto = () => {
  if (previewPhotoUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewPhotoUrl.value);
  }
  selectedPhotoFile.value = null;
  previewPhotoUrl.value = "";
  removePhotoFlag.value = true;
  photoError.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
};

const validate = (): boolean => {
  let valid = true;
  Object.keys(errors).forEach((k) => delete errors[k as keyof PostFormData]);

  if (!form.title.trim()) {
    errors.title = "Title is required.";
    valid = false;
  }
  if (!form.category) {
    errors.category = "Choose a category.";
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
  if (saving.value || loading.value || !post.value || !validate()) return;
  saving.value = true;
  try {
    await updatePost(postId.value, {
      title: form.title,
      category: form.category,
      subCategory: form.subCategory,
      pendingSubcategory: form.pendingSubcategory,
      description: form.description,
      location: form.location,
      eventDate: form.eventDate,
      imageFile: selectedPhotoFile.value,
      removeImage: removePhotoFlag.value
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

.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--app-text-secondary);
}

.composer-input,
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

.composer-input {
  height: 48px;
}

.composer-input:focus,
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

.field-error {
  font-size: 12px;
  color: var(--ion-color-danger);
}

.photo-preview-box {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 220px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
  margin-top: 4px;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-overlay-actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.overlay-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  backdrop-filter: blur(8px);
  transition: background-color 0.15s ease;
}

.overlay-action-btn:active {
  background: rgba(0, 0, 0, 0.85);
}

.overlay-action-btn.remove-btn:hover,
.overlay-action-btn.remove-btn:active {
  background: rgba(239, 68, 68, 0.85);
}

.photo-add-box {
  display: flex;
  flex-direction: column;
}

.add-photo-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  padding: 8px 14px;
  background: var(--app-surface-secondary);
  border: 1px dashed var(--app-card-border);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.add-photo-btn:active {
  background: var(--app-surface-tertiary, rgba(20, 25, 30, 0.08));
}

.hidden-file-input {
  display: none;
}
</style>
