<template>
  <ion-modal
    :is-open="isOpen"
    :breakpoints="[0, 0.95, 1]"
    :initial-breakpoint="0.95"
    @did-dismiss="handleClose"
  >
    <div class="composer-sheet">
      <!-- Lightweight Header Bar -->
      <header class="composer-header">
        <button type="button" class="header-cancel-btn" @click="handleClose">
          Cancel
        </button>
        <span class="composer-header-title">Create Post</span>
        <button
          type="button"
          class="header-post-btn"
          :disabled="!isValid || submitting"
          @click="handleSubmit"
        >
          <ion-spinner v-if="submitting" name="crescent" class="post-spinner" />
          <span v-else>Post</span>
        </button>
      </header>

      <!-- Social Composer Body -->
      <div class="composer-body">
        <!-- Author Profile Row -->
        <div class="composer-author-row">
          <UserAvatar
            :name="currentProfile?.name || 'User'"
            :username="currentProfile?.username || 'user'"
            :avatar-url="currentProfile?.avatarUrl"
            size="md"
          />
          <div class="author-meta">
            <span class="author-name">{{ currentProfile?.name || 'Anonymous' }}</span>
            <span class="author-handle">@{{ currentProfile?.username || 'community' }}</span>
          </div>
        </div>

        <!-- Minimal Lost / Found Chips Selector -->
        <div class="type-chips-row">
          <button
            type="button"
            class="type-chip lost-chip"
            :class="{ active: form.type === 'lost' }"
            @click="form.type = 'lost'"
          >
            <span class="chip-dot"></span>
            <span>Lost</span>
          </button>
          <button
            type="button"
            class="type-chip found-chip"
            :class="{ active: form.type === 'found' }"
            @click="form.type = 'found'"
          >
            <span class="chip-dot"></span>
            <span>Found</span>
          </button>
        </div>

        <!-- Main Title Input -->
        <div class="title-area">
          <input
            v-model="form.title"
            type="text"
            class="composer-title-input"
            :placeholder="form.type === 'found' ? 'What did you find?' : 'What did you lose?'"
            maxlength="80"
          />
          <span v-if="errors.title" class="field-error-text">{{ errors.title }}</span>
        </div>

        <!-- Main Description Textarea -->
        <div class="desc-area">
          <textarea
            v-model="form.description"
            rows="4"
            class="composer-desc-input"
            :placeholder="form.type === 'found' ? 'Describe the item, distinctive marks, or where it is safely kept...' : 'Tell the community what happened, contents, identifying markings...'"
            maxlength="800"
          ></textarea>
          <span v-if="errors.description" class="field-error-text">{{ errors.description }}</span>
        </div>

        <!-- Photo Attachment Preview or Add Photo Button -->
        <div v-if="previewPhotoUrl" class="photo-preview-wrap">
          <img :src="previewPhotoUrl" alt="Attached photo" class="preview-img" />
          <div class="photo-overlay-actions">
            <button
              type="button"
              class="overlay-action-btn change-btn"
              :disabled="submitting"
              @click="triggerPhotoPicker"
            >
              <Camera :size="14" />
              <span>Change</span>
            </button>
            <button
              type="button"
              class="overlay-action-btn remove-btn"
              :disabled="submitting"
              @click="removePhoto"
            >
              <Trash2 :size="14" />
              <span>Remove</span>
            </button>
          </div>
          <span class="photo-disabled-hint">Photo upload is not available yet.</span>
        </div>

        <div v-else class="photo-add-section">
          <button
            type="button"
            class="add-photo-btn"
            :disabled="submitting"
            @click="triggerPhotoPicker"
          >
            <ImagePlus :size="18" />
            <span>Add Photo</span>
          </button>
          <span class="photo-disabled-hint">Photo upload is not available yet.</span>
        </div>

        <span v-if="photoError" class="field-error-text">{{ photoError }}</span>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden-file-input"
          @change="onPhotoSelected"
        />

        <!-- Attachment Rows (Compact list, no cards) -->
        <div class="attachment-rows-list">
          <PostCategoryFields
            :key="formSession"
            v-model:category="form.category"
            v-model:sub-category="form.subCategory"
            v-model:pending-subcategory="form.pendingSubcategory"
            :disabled="submitting"
            :error="errors.category"
          />

          <!-- Location Row -->
          <div class="attachment-row">
            <div class="row-left">
              <MapPin :size="16" class="row-icon" />
              <span class="row-label">{{ form.type === 'found' ? 'Found At' : 'Location' }}</span>
            </div>
            <div class="row-right input-right">
              <input
                v-model="form.location"
                type="text"
                class="row-input"
                placeholder="e.g. Central Mall, 2nd Floor"
                maxlength="100"
              />
            </div>
          </div>

          <!-- Date Row (Custom Calendar Picker) -->
          <CustomDatePicker
            v-model="form.eventDate"
            :disabled="submitting"
            :error="errors.eventDate"
          />
        </div>

        <!-- Visibility Footer -->
        <div class="post-visibility-footer">
          <Globe :size="15" class="globe-icon" />
          <span>Post visibility: Public · Visible to community</span>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { IonModal, IonSpinner } from "@ionic/vue";
import {
  MapPin,
  ImagePlus,
  Camera,
  Trash2,
  Globe
} from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import PostCategoryFields from "./PostCategoryFields.vue";
import CustomDatePicker from "./CustomDatePicker.vue";
import { useAuth } from "../composables/useAuth";
import { validateImageFile } from "../utils/fileValidation";
import {
  type PostFormData,
  type PostFormErrors,
  type PostType
} from "../types/post";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    initialType?: PostType;
  }>(),
  {
    initialType: "lost"
  }
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", data: PostFormData): void;
}>();

const { currentProfile } = useAuth();
const submitting = ref(false);
const formSession = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewPhotoUrl = ref("");
const photoError = ref("");

const form = reactive<PostFormData>({
  type: props.initialType,
  title: "",
  category: "",
  subCategory: "",
  pendingSubcategory: undefined,
  description: "",
  location: "",
  eventDate: new Date().toISOString().split("T")[0],
  imageUrl: "",
  imageFile: null
});

const errors = reactive<PostFormErrors>({});

const isValid = computed(() => {
  return (
    form.title.trim().length > 0 &&
    Boolean(form.category) &&
    form.description.trim().length > 0 &&
    form.location.trim().length > 0 &&
    Boolean(form.eventDate)
  );
});

watch(
  () => props.initialType,
  (newType) => {
    form.type = newType || "lost";
  }
);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (previewPhotoUrl.value?.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl.value);
      }
      form.type = props.initialType;
      form.title = "";
      form.category = "";
      form.subCategory = "";
      form.pendingSubcategory = undefined;
      form.description = "";
      form.location = "";
      form.eventDate = new Date().toISOString().split("T")[0];
      form.imageUrl = "";
      form.imageFile = null;
      previewPhotoUrl.value = "";
      photoError.value = "";
      formSession.value += 1;
      if (fileInputRef.value) fileInputRef.value.value = "";
      Object.keys(errors).forEach((k) => delete errors[k as keyof PostFormData]);
    }
  }
);

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

  form.imageFile = file;
  previewPhotoUrl.value = URL.createObjectURL(file);
  photoError.value = "";
};

const removePhoto = () => {
  if (previewPhotoUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewPhotoUrl.value);
  }
  form.imageFile = null;
  previewPhotoUrl.value = "";
  photoError.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
};

onUnmounted(() => {
  if (previewPhotoUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewPhotoUrl.value);
  }
});

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

const handleSubmit = async () => {
  if (submitting.value || !validate()) return;
  submitting.value = true;
  try {
    // Never save local blob: URLs to database
    const validRemoteImageUrl =
      form.imageUrl && !form.imageUrl.startsWith("blob:") ? form.imageUrl.trim() : null;

    emit("submit", {
      ...form,
      imageUrl: validRemoteImageUrl,
      imageFile: null
    });
  } finally {
    submitting.value = false;
  }
};

const handleClose = () => {
  emit("close");
};
</script>

<style scoped>
.composer-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-surface);
  color: var(--app-text-primary);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  overflow: hidden;
}

/* Lightweight Social Header */
.composer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--app-card-border);
  background: var(--app-surface);
}

.composer-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.header-cancel-btn {
  background: transparent;
  border: none;
  font-size: 15px;
  color: var(--app-text-secondary);
  cursor: pointer;
  padding: 6px 4px;
}

.header-post-btn {
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  font-size: 14px;
  font-weight: 600;
  border-radius: 18px;
  padding: 6px 18px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
  min-width: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.header-post-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.header-post-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.post-spinner {
  width: 14px;
  height: 14px;
  --color: #ffffff;
}

/* Composer Body */
.composer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--app-surface);
}

/* Author Identity Row */
.composer-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.author-meta {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.author-handle {
  font-size: 12px;
  color: var(--app-text-secondary);
}

/* Minimal Lost / Found Selector Chips */
.type-chips-row {
  display: flex;
  gap: 8px;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--app-text-tertiary);
}

.lost-chip.active {
  background: rgba(255, 59, 48, 0.08);
  border-color: rgba(255, 59, 48, 0.35);
  color: #ff3b30;
}

.lost-chip.active .chip-dot {
  background: #ff3b30;
}

.found-chip.active {
  background: rgba(52, 199, 89, 0.08);
  border-color: rgba(52, 199, 89, 0.35);
  color: #34c759;
}

.found-chip.active .chip-dot {
  background: #34c759;
}

/* Title & Description Areas */
.title-area,
.desc-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer-title-input {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 19px;
  font-weight: 700;
  color: var(--app-text-primary);
  outline: none;
  padding: 4px 0;
  letter-spacing: -0.3px;
}

.composer-title-input::placeholder {
  color: var(--app-text-tertiary);
}

.composer-desc-input {
  width: 100%;
  background: transparent;
  border: none;
  font-size: 15px;
  line-height: 1.45;
  color: var(--app-text-primary);
  outline: none;
  resize: none;
  padding: 4px 0;
  font-family: inherit;
}

.composer-desc-input::placeholder {
  color: var(--app-text-secondary);
}

.field-error-text {
  font-size: 12px;
  color: var(--app-lost);
}

/* Photo Attachment */
.photo-preview-wrap {
  position: relative;
  width: 100%;
  max-height: 240px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}

.preview-img {
  width: 100%;
  height: 100%;
  max-height: 240px;
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

.photo-add-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.photo-disabled-hint {
  font-size: 11px;
  color: var(--app-text-tertiary);
  margin-top: 2px;
}

.hidden-file-input {
  display: none;
}

/* Attachment Rows (Compact list, separated by thin borders) */
.attachment-rows-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--app-card-border);
  border-bottom: 1px solid var(--app-card-border);
  margin-top: 6px;
}

.attachment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 2px;
  border-bottom: 1px solid var(--app-card-border);
  position: relative;
  cursor: pointer;
}

.attachment-row:last-child {
  border-bottom: none;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.row-icon {
  color: var(--app-text-tertiary);
}

.row-right {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.row-right.input-right {
  flex: 1;
  justify-content: flex-end;
  margin-left: 12px;
}

.row-chevron {
  color: var(--app-text-tertiary);
}

.row-input {
  background: transparent;
  border: none;
  text-align: right;
  font-size: 13px;
  color: var(--app-text-primary);
  outline: none;
  width: 100%;
}

.row-input::placeholder {
  color: var(--app-text-tertiary);
}

.row-date-input {
  background: transparent;
  border: none;
  font-size: 13px;
  color: var(--app-text-primary);
  outline: none;
  font-family: inherit;
  text-align: right;
}

/* Visibility Footer */
.post-visibility-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-tertiary);
  font-size: 12px;
  padding: 4px 2px;
}

.globe-icon {
  flex-shrink: 0;
}
</style>
