<template>
  <ion-page>
    <!-- Fixed Header with Save Action -->
    <PageHeader title="Edit Post" :show-back="true" :default-back-url="`/post/${postId}`">
      <template #action>
        <button
          type="button"
          class="header-save-btn"
          :disabled="saving || isUploading || loading || !post"
          @click="handleSave"
        >
          <ion-spinner v-if="saving || isUploading" name="crescent" class="btn-spinner" />
          <span v-else>Save</span>
        </button>
      </template>
    </PageHeader>

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
              :disabled="saving || isUploading"
            />
            <span v-if="errors.title" class="field-error">{{ errors.title }}</span>
          </div>

          <PostCategoryFields
            v-model:category="form.category"
            v-model:sub-category="form.subCategory"
            v-model:pending-subcategory="form.pendingSubcategory"
            :disabled="saving || isUploading"
            :error="errors.category"
          />

          <CustomDatePicker
            v-model="form.eventDate"
            :disabled="saving || isUploading"
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
                :disabled="saving || isUploading"
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
              :disabled="saving || isUploading"
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
                  :disabled="saving || isUploading"
                  @click="triggerPhotoPicker"
                >
                  <Camera :size="14" />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  class="overlay-action-btn remove-btn"
                  :disabled="saving || isUploading"
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
                :disabled="saving || isUploading"
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
  IonContent,
  IonPage,
  IonSpinner,
  toastController
} from "@ionic/vue";
import { Camera, ImagePlus, MapPin, Trash2 } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import PostCategoryFields from "../components/PostCategoryFields.vue";
import CustomDatePicker from "../components/CustomDatePicker.vue";
import { usePosts } from "../composables/usePosts";
import { useImageUpload, validateImageFile, MAX_POST_IMAGE_SIZE_BYTES } from "../composables/useImageUpload";
import type {
  Post,
  PostCategory,
  PostFormData,
  PostFormErrors,
  PostType
} from "../types/post";

const route = useRoute();
const router = useRouter();
const { getPostById, updatePost } = usePosts();
const { uploadPostImage, deleteUploadedFile, isUploading } = useImageUpload();

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
  type: "lost" as PostType,
  title: "",
  category: "" as PostCategory,
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
    form.imageKey = post.value.imageKey || "";
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

  const validation = validateImageFile(file, MAX_POST_IMAGE_SIZE_BYTES);
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
  if (saving.value || isUploading.value || loading.value || !post.value || !validate()) return;
  saving.value = true;
  photoError.value = "";

  const oldImageKey = post.value.imageKey;

  try {
    let newImageUrl: string | null | undefined = undefined;
    let newImageKey: string | null | undefined = undefined;

    if (selectedPhotoFile.value) {
      // Upload new image to UploadThing
      const uploadRes = await uploadPostImage(selectedPhotoFile.value);
      newImageUrl = uploadRes.url;
      newImageKey = uploadRes.key;
    } else if (removePhotoFlag.value) {
      newImageUrl = null;
      newImageKey = null;
    }

    const payload: Partial<PostFormData> = {
      title: form.title,
      category: form.category,
      subCategory: form.subCategory,
      pendingSubcategory: form.pendingSubcategory,
      description: form.description,
      location: form.location,
      eventDate: form.eventDate,
      ...(newImageUrl !== undefined
        ? { imageUrl: newImageUrl, imageKey: newImageKey, removeImage: removePhotoFlag.value }
        : {
            imageUrl: post.value.imageUrl && !post.value.imageUrl.startsWith("blob:") ? post.value.imageUrl : null,
            imageKey: post.value.imageKey || null
          })
    };

    // Update Firebase post
    await updatePost(postId.value, payload);

    // After post update succeeds, delete old file from UploadThing if replaced/removed
    if (oldImageKey && (newImageKey || removePhotoFlag.value)) {
      deleteUploadedFile(oldImageKey).catch(() => {});
    }

    const toast = await toastController.create({
      message: "Post updated successfully.",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();

    router.replace(`/post/${postId.value}`);
  } catch (err: any) {
    if (import.meta.env.DEV) {
      console.error("Update post error:", err);
    }
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

.form-container {
  padding: 16px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
}

.header-save-btn {
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  min-height: 34px;
  transition: opacity 0.15s ease;
}

.header-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  --color: #ffffff;
}

.type-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--app-surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--app-card-border);
}

.type-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.type-badge.lost {
  background: rgba(240, 68, 68, 0.15);
  color: var(--app-lost);
}

.type-badge.found {
  background: rgba(34, 181, 115, 0.15);
  color: var(--app-found);
}

.type-hint {
  font-size: 12px;
  color: var(--app-text-tertiary);
}

.form-card {
  background: var(--app-surface);
  border-radius: 24px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--app-text-tertiary);
  letter-spacing: 0.5px;
}

.composer-input,
.composer-textarea {
  width: 100%;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--app-text-primary);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.composer-input:focus,
.composer-textarea:focus {
  border-color: var(--app-primary);
  background: var(--app-surface);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.leading-icon {
  position: absolute;
  left: 14px;
  color: var(--app-text-tertiary);
  pointer-events: none;
}

.composer-input.with-icon {
  padding-left: 38px;
}

.photo-preview-box {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--app-surface-secondary);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay-actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
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
  backdrop-filter: blur(10px);
  transition: opacity 0.15s ease;
}

.change-btn {
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
}

.remove-btn {
  background: rgba(239, 68, 68, 0.85);
  color: #ffffff;
}

.photo-add-box {
  width: 100%;
}

.add-photo-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--app-surface-secondary);
  border: 1px dashed var(--app-card-border);
  border-radius: 14px;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.add-photo-btn:active {
  background: var(--app-primary-soft);
}

.hidden-file-input {
  display: none;
}

.field-error {
  font-size: 12px;
  color: var(--app-lost);
  font-weight: 500;
}

.loading-wrap,
.not-found-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 12px;
  color: var(--app-text-secondary);
}
</style>
