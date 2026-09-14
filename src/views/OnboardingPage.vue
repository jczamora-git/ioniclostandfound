<template>
  <ion-page>
    <ion-content :fullscreen="true" class="onboarding-content">
      <div class="ios-screen-container onboarding-container">
        <!-- Branded Logo & Header -->
        <header class="onboarding-hero">
          <img
            src="/lost-and-found.png"
            alt="Lost &amp; Found Logo"
            class="onboarding-logo"
          />
          <h1 class="hero-title">Welcome to Lost &amp; Found</h1>
          <p class="hero-subtitle">Join the community and help reconnect people with their belongings.</p>
        </header>

        <!-- Onboarding Form Card -->
        <div class="onboarding-card">
          <!-- Name Field -->
          <div class="form-group">
            <label class="input-label" for="ob-name">Name</label>
            <input
              id="ob-name"
              v-model="form.name"
              type="text"
              class="ios-input"
              placeholder="e.g., Samuel Lim"
              autocomplete="name"
              maxlength="50"
              @input="clearError('name')"
            />
            <span v-if="errors.name" class="input-error">{{ errors.name }}</span>
          </div>

          <!-- Username Field -->
          <div class="form-group">
            <label class="input-label" for="ob-username">Username</label>
            <div class="input-with-prefix">
              <span class="prefix">@</span>
              <input
                id="ob-username"
                v-model="form.username"
                type="text"
                class="ios-input with-prefix"
                placeholder="samuel"
                autocomplete="username"
                autocapitalize="none"
                maxlength="30"
                @input="handleUsernameInput"
              />
            </div>
            <span class="input-hint">Only lowercase letters, numbers, dots, and underscores</span>
            <span v-if="errors.username" class="input-error">{{ errors.username }}</span>
          </div>

          <!-- Phone Number Field -->
          <div class="form-group">
            <label class="input-label" for="ob-phone">Phone Number</label>
            <input
              id="ob-phone"
              v-model="form.phone"
              type="tel"
              class="ios-input"
              placeholder="e.g., 09123456789"
              autocomplete="tel"
              maxlength="20"
              @input="clearError('phone')"
            />
            <span class="input-hint">Your phone number is kept private and never shown publicly.</span>
            <span v-if="errors.phone" class="input-error">{{ errors.phone }}</span>
          </div>

          <!-- Error Alert Banner -->
          <div v-if="globalError" class="error-banner">
            <AlertCircle :size="16" />
            <span>{{ globalError }}</span>
          </div>

          <!-- Continue Submit Button -->
          <button
            type="button"
            class="continue-btn"
            :disabled="saving"
            @click="handleSubmit"
          >
            <ion-spinner v-if="saving" name="crescent" class="btn-spinner" />
            <span v-else>Continue</span>
          </button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonContent,
  IonPage,
  IonSpinner,
  toastController
} from "@ionic/vue";
import { AlertCircle } from "lucide-vue-next";
import { normalizeUsername, useAuth } from "../composables/useAuth";

const router = useRouter();
const { saveProfile, checkUsernameAvailable } = useAuth();

const form = reactive({
  name: "",
  username: "",
  phone: ""
});

const errors = reactive<Record<string, string>>({});
const globalError = ref("");
const saving = ref(false);

const clearError = (field: string) => {
  delete errors[field];
  globalError.value = "";
};

const handleUsernameInput = () => {
  form.username = normalizeUsername(form.username);
  clearError("username");
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

  // Check username availability
  const isAvailable = await checkUsernameAvailable(cleanUser);
  if (!isAvailable) {
    errors.username = "This username is already taken. Please choose another.";
    return false;
  }

  return true;
};

const handleSubmit = async () => {
  saving.value = true;
  try {
    const isValid = await validate();
    if (!isValid) return;

    await saveProfile({
      name: form.name.trim(),
      username: normalizeUsername(form.username),
      phone: form.phone.trim()
    });

    const toast = await toastController.create({
      message: `Welcome to Lost & Found, ${form.name.trim()}!`,
      duration: 2500,
      position: "top",
      color: "success"
    });
    await toast.present();

    router.replace("/tabs/home");
  } catch (err: any) {
    console.error("Onboarding error:", err);
    globalError.value = err.message || "Failed to create profile. Please try again.";
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.onboarding-content {
  --background: var(--app-bg);
}

.onboarding-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
  min-height: 100%;
}

.onboarding-hero {
  text-align: center;
  margin-bottom: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.onboarding-logo {
  width: 76px;
  height: 76px;
  object-fit: contain;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(47, 159, 232, 0.15);
  margin-bottom: 16px;
}

.hero-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--app-text-primary);
}

.hero-subtitle {
  margin: 0;
  font-size: 15px;
  color: var(--app-text-secondary);
  max-width: 300px;
  line-height: 1.45;
}

.onboarding-card {
  width: 100%;
  max-width: 400px;
  background: var(--app-surface);
  border-radius: 24px;
  padding: 26px 22px;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
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
  padding: 0 14px;
  font-size: 15px;
  color: var(--app-text-primary);
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
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

.input-hint {
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.35;
}

.input-error {
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
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.continue-btn {
  height: 52px;
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  border-radius: 16px;
  padding: 0 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(47, 159, 232, 0.25);
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
  margin-top: 6px;
}

.continue-btn:hover {
  background: var(--app-primary-deep);
}

.continue-btn:active {
  transform: scale(0.985);
}

.continue-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-spinner {
  width: 20px;
  height: 20px;
  --color: #ffffff;
}
</style>
