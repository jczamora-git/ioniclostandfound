<template>
  <ion-page>
    <ion-content :fullscreen="true" class="edit-content">
      <!-- Unified Header with Back Navigation -->
      <PageHeader title="Edit Profile" :show-back="true" default-back-url="/tabs/profile" />

      <div class="ios-screen-container edit-container">
        <!-- Avatar Preview and Actions -->
        <div class="avatar-preview-section">
          <UserAvatar
            :name="form.name"
            :username="form.username"
            :avatar-url="previewAvatarUrl"
            size="xl"
          />
          <div class="avatar-actions-row">
            <button
              type="button"
              class="avatar-action-btn change-photo-btn"
              :disabled="saving"
              @click="triggerPhotoPicker"
            >
              <Camera :size="15" />
              <span>{{ previewAvatarUrl ? 'Change Photo' : 'Add Photo' }}</span>
            </button>
            <button
              v-if="previewAvatarUrl"
              type="button"
              class="avatar-action-btn remove-photo-btn"
              :disabled="saving"
              @click="handleRemovePhoto"
            >
              <Trash2 :size="14" />
              <span>Remove Photo</span>
            </button>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden-file-input"
            @change="onFileSelected"
          />
        </div>

        <!-- Form Fields -->
        <div class="form-card">
          <!-- Name -->
          <div class="form-field">
            <label class="field-label">Name</label>
            <input
              v-model="form.name"
              type="text"
              class="ios-input"
              placeholder="Your Full Name"
              maxlength="50"
            />
            <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
          </div>

          <!-- Username -->
          <div class="form-field">
            <label class="field-label">Username</label>
            <div class="input-with-prefix">
              <span class="prefix">@</span>
              <input
                v-model="form.username"
                type="text"
                class="ios-input with-prefix"
                placeholder="username"
                autocapitalize="none"
                maxlength="30"
                @input="handleUsernameInput"
              />
            </div>
            <span class="field-hint">Only lowercase letters, numbers, dots, and underscores</span>
            <span v-if="errors.username" class="field-error">{{ errors.username }}</span>
          </div>

          <!-- Phone Number -->
          <div class="form-field">
            <label class="field-label">Phone Number (Private)</label>
            <input
              v-model="form.phone"
              type="tel"
              class="ios-input"
              placeholder="e.g., 09XXXXXXXXX"
              maxlength="20"
            />
            <span class="field-hint">Your phone number is strictly private and never displayed publicly</span>
            <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
          </div>
        </div>

        <!-- Global Error Banner -->
        <div v-if="globalError" class="error-banner">
          <AlertCircle :size="16" class="error-icon" />
          <span>{{ globalError }}</span>
        </div>

        <!-- Full-Width Save Changes Button Inside Content -->
        <button
          type="button"
          class="save-changes-btn"
          :disabled="saving"
          @click="handleSave"
        >
          <ion-spinner v-if="saving" name="crescent" class="btn-spinner" />
          <span v-else>Save Changes</span>
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonContent,
  IonPage,
  IonSpinner,
  toastController
} from "@ionic/vue";
import { AlertCircle, Camera, Trash2 } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import UserAvatar from "../components/UserAvatar.vue";
import { normalizeUsername, useAuth } from "../composables/useAuth";
import { useStorageUpload } from "../composables/useStorageUpload";
import type { ProfileFormData } from "../types/profile";

const router = useRouter();
const { currentProfile, saveProfile, checkUsernameAvailable } = useAuth();
const { uploadAvatar, deleteStorageFile, validateImageFile } = useStorageUpload();

const form = reactive({
  name: "",
  username: "",
  phone: ""
});

const errors = reactive<Record<string, string>>({});
const globalError = ref("");
const saving = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewAvatarUrl = ref<string | null>(null);
const removeAvatar = ref(false);

onMounted(() => {
  if (currentProfile.value) {
    form.name = currentProfile.value.name || "";
    form.username = currentProfile.value.username || "";
    form.phone = currentProfile.value.phone || "";
    previewAvatarUrl.value = currentProfile.value.avatarUrl || null;
  }
});

onUnmounted(() => {
  if (previewAvatarUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewAvatarUrl.value);
  }
});

const triggerPhotoPicker = () => {
  fileInputRef.value?.click();
};

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    globalError.value = validation.error || "Please select a valid image.";
    if (fileInputRef.value) fileInputRef.value.value = "";
    return;
  }

  // Revoke old blob URL if created previously
  if (previewAvatarUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewAvatarUrl.value);
  }

  selectedFile.value = file;
  previewAvatarUrl.value = URL.createObjectURL(file);
  removeAvatar.value = false;
  globalError.value = "";
};

const handleRemovePhoto = () => {
  if (previewAvatarUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewAvatarUrl.value);
  }
  selectedFile.value = null;
  previewAvatarUrl.value = null;
  removeAvatar.value = true;
  if (fileInputRef.value) fileInputRef.value.value = "";
};

const handleUsernameInput = () => {
  form.username = normalizeUsername(form.username);
  delete errors.username;
};

const validate = async (): Promise<boolean> => {
  let valid = true;
  Object.keys(errors).forEach((k) => delete errors[k]);
  globalError.value = "";

  if (!form.name.trim()) {
    errors.name = "Name is required.";
    valid = false;
  }

  const cleanUser = normalizeUsername(form.username);
  if (!cleanUser) {
    errors.username = "Username is required.";
    valid = false;
  } else if (cleanUser.length < 3) {
    errors.username = "Username must be at least 3 characters.";
    valid = false;
  }

  if (!form.phone.trim()) {
    errors.phone = "Phone number is required.";
    valid = false;
  }

  if (!valid) return false;

  const isAvailable = await checkUsernameAvailable(cleanUser, currentProfile.value?.id);
  if (!isAvailable) {
    errors.username = "This username is already taken.";
    return false;
  }

  return true;
};

const handleSave = async () => {
  if (saving.value) return;
  const isValid = await validate();
  if (!isValid) return;

  saving.value = true;
  globalError.value = "";
  let uploadedAvatar: { downloadUrl: string; storagePath: string } | null = null;

  try {
    const uid = currentProfile.value?.id;
    if (selectedFile.value && uid) {
      uploadedAvatar = await uploadAvatar(selectedFile.value, uid);
    }

    const previousAvatarPath = currentProfile.value?.avatarPath;

    const payload: ProfileFormData = {
      name: form.name.trim(),
      username: normalizeUsername(form.username),
      phone: form.phone.trim(),
      ...(uploadedAvatar
        ? { avatarUrl: uploadedAvatar.downloadUrl, avatarPath: uploadedAvatar.storagePath }
        : removeAvatar.value
        ? { avatarUrl: null, avatarPath: null }
        : {})
    };

    await saveProfile(payload);

    // If avatar was replaced or removed, delete previous Storage file gracefully
    if (
      (uploadedAvatar || removeAvatar.value) &&
      previousAvatarPath &&
      previousAvatarPath !== uploadedAvatar?.storagePath
    ) {
      await deleteStorageFile(previousAvatarPath);
    }

    const toast = await toastController.create({
      message: "Profile updated successfully.",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();

    router.replace("/tabs/profile");
  } catch (err: any) {
    console.error("Update profile error:", err);
    // If upload succeeded but save failed, clean up uploaded file
    if (uploadedAvatar?.storagePath) {
      await deleteStorageFile(uploadedAvatar.storagePath);
    }
    globalError.value = err.message || "Failed to save profile.";
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.edit-content {
  --background: var(--app-bg);
}

.save-changes-btn {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  background: var(--app-primary);
  border: none;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
  margin-top: 4px;
}

.save-changes-btn:hover {
  background: var(--app-primary-deep);
}

.save-changes-btn:active {
  transform: scale(0.99);
}

.save-changes-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  --color: #ffffff;
}

.edit-container {
  padding: 16px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.avatar-preview-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.avatar-actions-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--app-card-border);
  transition: all 0.15s ease;
}

.change-photo-btn {
  background: var(--app-surface-secondary);
  color: var(--app-primary);
}

.change-photo-btn:active {
  background: var(--app-primary-soft);
}

.remove-photo-btn {
  background: transparent;
  color: var(--ion-color-danger, #ef4444);
  border-color: rgba(239, 68, 68, 0.2);
}

.remove-photo-btn:active {
  background: rgba(239, 68, 68, 0.08);
}

.hidden-file-input {
  display: none;
}

.form-card {
  background: var(--app-surface);
  border-radius: 24px;
  padding: 24px 20px;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.ios-input {
  width: 100%;
  height: 50px;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--app-text-primary);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.ios-input:focus {
  border-color: var(--app-primary);
  background: var(--app-surface);
  box-shadow: 0 0 0 3px rgba(47, 159, 232, 0.12);
}

.input-with-prefix {
  position: relative;
  display: flex;
  align-items: center;
}

.prefix {
  position: absolute;
  left: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-secondary);
  pointer-events: none;
}

.ios-input.with-prefix {
  padding-left: 32px;
}

.field-hint {
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.35;
}

.field-error {
  font-size: 12px;
  color: var(--app-lost);
  font-weight: 500;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(240, 68, 68, 0.1);
  color: var(--app-lost);
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
}
</style>
