<template>
  <ion-page>
    <ion-content :fullscreen="true" class="auth-content">
      <div class="ios-screen-container auth-container">
        <!-- Brand Hero -->
        <header class="auth-hero">
          <img
            src="/lost-and-found.png"
            alt="Lost &amp; Found Logo"
            class="auth-logo"
          />
          <h1 class="auth-title">Lost &amp; Found</h1>
          <p class="auth-subtitle">Community item recovery and reconnection platform</p>
        </header>

        <!-- Segmented Control for Sign In / Create Account -->
        <div class="auth-toggle-bar" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'signin'"
            class="auth-toggle-btn"
            :class="{ active: mode === 'signin' }"
            @click="switchMode('signin')"
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'create'"
            class="auth-toggle-btn"
            :class="{ active: mode === 'create' }"
            @click="switchMode('create')"
          >
            Create Account
          </button>
        </div>

        <!-- Upgrade Notice for Existing Anonymous Users -->
        <div v-if="mode === 'create' && isAnonymous" class="upgrade-info-box">
          <ShieldCheck :size="16" class="upgrade-icon" />
          <span>Your existing posts, comments, and messages will be linked to your new account.</span>
        </div>

        <!-- Auth Form Card -->
        <div class="auth-card">
          <!-- Sign In Form -->
          <form v-if="mode === 'signin'" @submit.prevent="handleSignIn">
            <!-- Email -->
            <div class="form-group">
              <label class="input-label" for="signin-email">Email</label>
              <input
                id="signin-email"
                v-model="signInForm.email"
                type="email"
                class="ios-input"
                placeholder="name@example.com"
                autocomplete="email"
                autocapitalize="none"
                @input="clearError('signInEmail')"
              />
              <span v-if="errors.signInEmail" class="input-error">{{ errors.signInEmail }}</span>
            </div>

            <!-- Password -->
            <div class="form-group">
              <label class="input-label" for="signin-password">Password</label>
              <div class="password-input-wrap">
                <input
                  id="signin-password"
                  v-model="signInForm.password"
                  :type="showSignInPassword ? 'text' : 'password'"
                  class="ios-input password-input"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  @input="clearError('signInPassword')"
                />
                <button
                  type="button"
                  class="pwd-toggle-btn"
                  :aria-label="showSignInPassword ? 'Hide password' : 'Show password'"
                  @click="showSignInPassword = !showSignInPassword"
                >
                  <EyeOff v-if="showSignInPassword" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </div>
              <span v-if="errors.signInPassword" class="input-error">{{ errors.signInPassword }}</span>
            </div>

            <!-- Global Error Banner -->
            <div v-if="globalError" class="error-banner">
              <AlertCircle :size="16" class="error-banner-icon" />
              <span>{{ globalError }}</span>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="auth-action-btn"
              :disabled="loading"
            >
              <ion-spinner v-if="loading" name="crescent" class="btn-spinner" />
              <span v-else>Sign In</span>
            </button>

            <!-- Switch Mode Prompt -->
            <div class="auth-switch-prompt">
              <span>Don't have an account?</span>
              <button type="button" class="switch-link-btn" @click="switchMode('create')">
                Create Account
              </button>
            </div>
          </form>

          <!-- Create Account Form -->
          <form v-else @submit.prevent="handleCreateAccount">
            <!-- Full Name -->
            <div class="form-group">
              <label class="input-label" for="signup-name">Full Name</label>
              <input
                id="signup-name"
                v-model="signUpForm.name"
                type="text"
                class="ios-input"
                placeholder="e.g., Alex Johnson"
                autocomplete="name"
                maxlength="50"
                @input="clearError('name')"
              />
              <span v-if="errors.name" class="input-error">{{ errors.name }}</span>
            </div>

            <!-- Username -->
            <div class="form-group">
              <label class="input-label" for="signup-username">Username</label>
              <div class="input-with-prefix">
                <span class="prefix">@</span>
                <input
                  id="signup-username"
                  v-model="signUpForm.username"
                  type="text"
                  class="ios-input with-prefix"
                  placeholder="alexj"
                  autocomplete="username"
                  autocapitalize="none"
                  maxlength="30"
                  @input="handleUsernameInput"
                />
              </div>
              <span class="input-hint">Lowercase letters, numbers, dots, and underscores only</span>
              <span v-if="errors.username" class="input-error">{{ errors.username }}</span>
            </div>

            <!-- Phone Number -->
            <div class="form-group">
              <label class="input-label" for="signup-phone">Phone Number</label>
              <input
                id="signup-phone"
                v-model="signUpForm.phone"
                type="tel"
                class="ios-input"
                placeholder="e.g., 09123456789"
                autocomplete="tel"
                maxlength="20"
                @input="clearError('phone')"
              />
              <span class="input-hint">Private — never visible to other users.</span>
              <span v-if="errors.phone" class="input-error">{{ errors.phone }}</span>
            </div>

            <!-- Email -->
            <div class="form-group">
              <label class="input-label" for="signup-email">Email</label>
              <input
                id="signup-email"
                v-model="signUpForm.email"
                type="email"
                class="ios-input"
                placeholder="alex@example.com"
                autocomplete="email"
                autocapitalize="none"
                @input="clearError('email')"
              />
              <span class="input-hint">Private — used for account sign-in.</span>
              <span v-if="errors.email" class="input-error">{{ errors.email }}</span>
            </div>

            <!-- Password -->
            <div class="form-group">
              <label class="input-label" for="signup-password">Password</label>
              <div class="password-input-wrap">
                <input
                  id="signup-password"
                  v-model="signUpForm.password"
                  :type="showSignUpPassword ? 'text' : 'password'"
                  class="ios-input password-input"
                  placeholder="At least 6 characters"
                  autocomplete="new-password"
                  @input="clearError('password')"
                />
                <button
                  type="button"
                  class="pwd-toggle-btn"
                  :aria-label="showSignUpPassword ? 'Hide password' : 'Show password'"
                  @click="showSignUpPassword = !showSignUpPassword"
                >
                  <EyeOff v-if="showSignUpPassword" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </div>
              <span v-if="errors.password" class="input-error">{{ errors.password }}</span>
            </div>

            <!-- Confirm Password -->
            <div class="form-group">
              <label class="input-label" for="signup-confirm-password">Confirm Password</label>
              <div class="password-input-wrap">
                <input
                  id="signup-confirm-password"
                  v-model="signUpForm.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="ios-input password-input"
                  placeholder="Repeat your password"
                  autocomplete="new-password"
                  @input="clearError('confirmPassword')"
                />
                <button
                  type="button"
                  class="pwd-toggle-btn"
                  :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <EyeOff v-if="showConfirmPassword" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </div>
              <span v-if="errors.confirmPassword" class="input-error">{{ errors.confirmPassword }}</span>
            </div>

            <!-- Global Error Banner -->
            <div v-if="globalError" class="error-banner">
              <AlertCircle :size="16" class="error-banner-icon" />
              <span>{{ globalError }}</span>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="auth-action-btn"
              :disabled="loading"
            >
              <ion-spinner v-if="loading" name="crescent" class="btn-spinner" />
              <span v-else>Create Account</span>
            </button>

            <!-- Switch Mode Prompt -->
            <div class="auth-switch-prompt">
              <span>Already have an account?</span>
              <button type="button" class="switch-link-btn" @click="switchMode('signin')">
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { IonContent, IonPage, IonSpinner, toastController } from "@ionic/vue";
import { Eye, EyeOff, AlertCircle, ShieldCheck } from "lucide-vue-next";
import { useAuth, normalizeUsername } from "../composables/useAuth";

const router = useRouter();
const route = useRoute();
const { signIn, signUp, isAnonymous, checkUsernameAvailable, currentProfile } = useAuth();

const mode = ref<"signin" | "create">("signin");
const loading = ref(false);
const globalError = ref("");

// Password visibility states (hidden by default)
const showSignInPassword = ref(false);
const showSignUpPassword = ref(false);
const showConfirmPassword = ref(false);

const signInForm = reactive({
  email: "",
  password: ""
});

const signUpForm = reactive({
  name: "",
  username: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: ""
});

const errors = reactive<Record<string, string>>({
  signInEmail: "",
  signInPassword: "",
  name: "",
  username: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: ""
});

onMounted(() => {
  // If an anonymous user visits with an unfinished account, default to create mode
  if (isAnonymous.value || route.path === "/onboarding") {
    mode.value = "create";
  }
  // Pre-fill existing profile data if available
  if (currentProfile.value) {
    signUpForm.name = currentProfile.value.name || "";
    signUpForm.username = currentProfile.value.username || "";
    signUpForm.phone = currentProfile.value.phone || "";
  }
});

const switchMode = (newMode: "signin" | "create") => {
  mode.value = newMode;
  globalError.value = "";
  Object.keys(errors).forEach((key) => {
    errors[key] = "";
  });
};

const clearError = (field: string) => {
  errors[field] = "";
  globalError.value = "";
};

const handleUsernameInput = () => {
  signUpForm.username = normalizeUsername(signUpForm.username);
  clearError("username");
};

const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

const validateSignIn = (): boolean => {
  let valid = true;
  globalError.value = "";

  if (!signInForm.email.trim()) {
    errors.signInEmail = "Email is required.";
    valid = false;
  } else if (!validateEmail(signInForm.email)) {
    errors.signInEmail = "Please enter a valid email address.";
    valid = false;
  }

  if (!signInForm.password) {
    errors.signInPassword = "Password is required.";
    valid = false;
  }

  return valid;
};

const validateSignUp = async (): Promise<boolean> => {
  let valid = true;
  globalError.value = "";

  if (!signUpForm.name.trim()) {
    errors.name = "Full name is required.";
    valid = false;
  } else if (signUpForm.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
    valid = false;
  }

  if (!signUpForm.username.trim()) {
    errors.username = "Username is required.";
    valid = false;
  } else if (signUpForm.username.length < 3) {
    errors.username = "Username must be at least 3 characters.";
    valid = false;
  }

  if (!signUpForm.phone.trim()) {
    errors.phone = "Phone number is required.";
    valid = false;
  } else if (!/^[0-9+()-\s]{7,20}$/.test(signUpForm.phone.trim())) {
    errors.phone = "Please enter a valid phone number.";
    valid = false;
  }

  if (!signUpForm.email.trim()) {
    errors.email = "Email is required.";
    valid = false;
  } else if (!validateEmail(signUpForm.email)) {
    errors.email = "Please enter a valid email address.";
    valid = false;
  }

  if (!signUpForm.password) {
    errors.password = "Password is required.";
    valid = false;
  } else if (signUpForm.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
    valid = false;
  }

  if (!signUpForm.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
    valid = false;
  } else if (signUpForm.confirmPassword !== signUpForm.password) {
    errors.confirmPassword = "Passwords do not match.";
    valid = false;
  }

  // Check username uniqueness if fields valid so far
  if (valid && signUpForm.username.trim()) {
    const isAvail = await checkUsernameAvailable(signUpForm.username.trim());
    if (!isAvail) {
      errors.username = "This username is already taken. Please choose another.";
      valid = false;
    }
  }

  return valid;
};

const handleSignIn = async () => {
  if (!validateSignIn() || loading.value) return;
  loading.value = true;
  try {
    await signIn(signInForm.email, signInForm.password);
    const toast = await toastController.create({
      message: "Signed in successfully!",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();
    router.replace("/tabs/home");
  } catch (err: any) {
    globalError.value = err.message || "Failed to sign in. Please verify your credentials.";
  } finally {
    loading.value = false;
  }
};

const handleCreateAccount = async () => {
  const isValid = await validateSignUp();
  if (!isValid || loading.value) return;

  loading.value = true;
  try {
    await signUp({
      name: signUpForm.name,
      username: signUpForm.username,
      phone: signUpForm.phone,
      email: signUpForm.email,
      password: signUpForm.password
    });

    const toast = await toastController.create({
      message: "Account created successfully! Welcome to Lost & Found.",
      duration: 2500,
      position: "top",
      color: "success"
    });
    await toast.present();

    router.replace("/tabs/home");
  } catch (err: any) {
    globalError.value = err.message || "Failed to create account. Please try again.";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-content {
  --background: var(--app-bg);
}

.auth-container {
  padding: calc(24px + env(safe-area-inset-top, 0px)) 20px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100%;
}

.auth-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}

.auth-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  border-radius: 20px;
  box-shadow: 0 10px 28px rgba(47, 159, 232, 0.25);
  margin-bottom: 12px;
}

.auth-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--app-text-primary);
}

.auth-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--app-text-secondary);
  max-width: 280px;
  line-height: 1.4;
}

.auth-toggle-bar {
  display: flex;
  width: 100%;
  background: var(--app-surface-secondary);
  border-radius: 14px;
  padding: 4px;
  margin-bottom: 16px;
  border: 1px solid var(--app-card-border);
}

.auth-toggle-btn {
  flex: 1;
  height: 38px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.auth-toggle-btn.active {
  background: var(--app-surface);
  color: var(--app-text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.upgrade-info-box {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: rgba(47, 159, 232, 0.08);
  border: 1px solid rgba(47, 159, 232, 0.25);
  border-radius: 12px;
  font-size: 12px;
  color: var(--app-text-primary);
  line-height: 1.4;
}

.upgrade-icon {
  color: var(--app-primary);
  flex-shrink: 0;
}

.auth-card {
  width: 100%;
  background: var(--app-surface);
  border-radius: 20px;
  padding: 24px 20px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.ios-input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--app-card-border);
  background: var(--app-input-bg);
  color: var(--app-text-primary);
  font-size: 15px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ios-input:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-soft);
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
  z-index: 2;
}

.ios-input.with-prefix {
  padding-left: 32px;
}

.password-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 46px;
}

.pwd-toggle-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s ease;
}

.pwd-toggle-btn:active {
  color: var(--app-text-primary);
}

.input-hint {
  font-size: 11px;
  color: var(--app-text-tertiary);
  margin-top: 2px;
}

.input-error {
  font-size: 12px;
  font-weight: 500;
  color: var(--ion-color-danger, #ef4444);
  margin-top: 2px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 12px;
  font-size: 13px;
  color: var(--ion-color-danger, #ef4444);
  margin-bottom: 16px;
}

.error-banner-icon {
  flex-shrink: 0;
}

.auth-action-btn {
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
  box-shadow: 0 4px 14px rgba(47, 159, 232, 0.3);
  transition: all 0.15s ease;
}

.auth-action-btn:hover {
  background: var(--app-primary-deep);
}

.auth-action-btn:active {
  transform: scale(0.99);
}

.auth-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-spinner {
  width: 20px;
  height: 20px;
  --color: #ffffff;
}

.auth-switch-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.switch-link-btn {
  border: none;
  background: transparent;
  color: var(--app-primary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.switch-link-btn:hover {
  text-decoration: underline;
}
</style>
