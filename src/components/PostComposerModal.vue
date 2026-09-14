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

        <!-- Photo Attachment Preview or Add Photo Row -->
        <div v-if="form.imageUrl" class="photo-preview-wrap">
          <img :src="form.imageUrl" alt="Attached photo" class="preview-img" />
          <button
            type="button"
            class="remove-photo-btn"
            aria-label="Remove photo"
            @click="form.imageUrl = ''"
          >
            <X :size="16" />
          </button>
        </div>

        <div v-else class="photo-add-section">
          <button
            type="button"
            class="add-photo-btn"
            @click="showPhotoInput = !showPhotoInput"
          >
            <ImagePlus :size="18" />
            <span>Add Photo</span>
          </button>

          <div v-if="showPhotoInput" class="photo-input-drawer">
            <input
              v-model="form.imageUrl"
              type="url"
              class="photo-url-input"
              placeholder="Paste image URL here..."
            />
            <div class="sample-photos-row">
              <span class="sample-label">Quick samples:</span>
              <button
                type="button"
                class="sample-chip"
                @click="form.imageUrl = 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80'"
              >
                Wallet
              </button>
              <button
                type="button"
                class="sample-chip"
                @click="form.imageUrl = 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=600&auto=format&fit=crop&q=80'"
              >
                AirPods
              </button>
              <button
                type="button"
                class="sample-chip"
                @click="form.imageUrl = 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80'"
              >
                Keys
              </button>
              <button
                type="button"
                class="sample-chip"
                @click="form.imageUrl = 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=600&auto=format&fit=crop&q=80'"
              >
                ID Card
              </button>
            </div>
          </div>
        </div>

        <!-- Attachment Rows (Compact list, no cards) -->
        <div class="attachment-rows-list">
          <!-- Category Row with overlay select -->
          <label class="attachment-row">
            <div class="row-left">
              <Tag :size="16" class="row-icon" />
              <span class="row-label">Category</span>
            </div>
            <div class="row-right">
              <span class="row-value">{{ form.category }}</span>
              <select v-model="form.category" class="invisible-select">
                <option v-for="cat in POST_CATEGORIES" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
              <ChevronRight :size="16" class="row-chevron" />
            </div>
          </label>

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

          <!-- Date Row -->
          <label class="attachment-row">
            <div class="row-left">
              <CalendarDays :size="16" class="row-icon" />
              <span class="row-label">Date</span>
            </div>
            <div class="row-right">
              <input
                v-model="form.eventDate"
                type="date"
                class="row-date-input"
              />
              <ChevronRight :size="16" class="row-chevron" />
            </div>
          </label>
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
import { computed, reactive, ref, watch } from "vue";
import { IonModal, IonSpinner } from "@ionic/vue";
import {
  Tag,
  MapPin,
  CalendarDays,
  ImagePlus,
  ChevronRight,
  Globe,
  X
} from "lucide-vue-next";
import UserAvatar from "./UserAvatar.vue";
import { useAuth } from "../composables/useAuth";
import {
  POST_CATEGORIES,
  type PostCategory,
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
const showPhotoInput = ref(false);

const form = reactive<PostFormData>({
  type: props.initialType,
  title: "",
  category: "Other" as PostCategory,
  description: "",
  location: "",
  eventDate: new Date().toISOString().split("T")[0],
  imageUrl: ""
});

const errors = reactive<PostFormErrors>({});

const isValid = computed(() => {
  return (
    form.title.trim().length > 0 &&
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
      form.type = props.initialType;
      form.title = "";
      form.category = "Other";
      form.description = "";
      form.location = "";
      form.eventDate = new Date().toISOString().split("T")[0];
      form.imageUrl = "";
      showPhotoInput.value = false;
      Object.keys(errors).forEach((k) => delete errors[k as keyof PostFormData]);
    }
  }
);

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

const handleSubmit = async () => {
  if (!validate()) return;
  submitting.value = true;
  try {
    emit("submit", { ...form });
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
  max-height: 220px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}

.preview-img {
  width: 100%;
  height: 100%;
  max-height: 220px;
  object-fit: cover;
  display: block;
}

.remove-photo-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
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
}

.photo-input-drawer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--app-surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--app-card-border);
}

.photo-url-input {
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--app-text-primary);
  outline: none;
}

.sample-photos-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.sample-label {
  font-size: 11px;
  color: var(--app-text-tertiary);
}

.sample-chip {
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--app-text-secondary);
  cursor: pointer;
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

.row-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.row-chevron {
  color: var(--app-text-tertiary);
}

.invisible-select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
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
