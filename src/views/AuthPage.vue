<template>
  <ion-page class="auth-page">
    <ion-content :fullscreen="true" class="auth-content">
      <div class="auth-outer-wrap">
        <div class="auth-center-container">
          <!-- VIEW 1: SIGN IN -->
          <template v-if="view === 'signin'">
            <!-- Branding Header -->
            <header class="auth-brand">
              <img
                src="/lost-and-found.png"
                alt="Lost &amp; Found Logo"
                class="auth-logo"
              />
              <h1 class="auth-title">Lost &amp; Found</h1>
              <p class="auth-subtitle">Community item recovery &amp; reconnection</p>
            </header>

            <!-- Sign In Form -->
            <form class="auth-form" @submit.prevent="handleSignIn">
              <!-- Email -->
              <div class="form-group">
                <label class="input-label" for="signin-email">Email</label>
                <input
                  id="signin-email"
                  v-model="signInForm.email"
                  type="email"
                  class="auth-input"
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
                <div class="password-wrap">
                  <input
                    id="signin-password"
                    v-model="signInForm.password"
                    :type="showSignInPassword ? 'text' : 'password'"
                    class="auth-input with-toggle"
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
                class="auth-primary-btn"
                :disabled="loading"
              >
                <ion-spinner v-if="loading" name="crescent" class="btn-spinner" />
                <span v-else>Sign In</span>
              </button>

              <!-- Switch Link -->
              <div class="auth-switch-prompt">
                <span>Don't have an account?</span>
                <button type="button" class="switch-link-btn" @click="switchView('create-profile')">
                  Create Account
                </button>
              </div>
            </form>
          </template>

          <!-- VIEW 2: CREATE PROFILE (Step 1 of Create Account) -->
          <template v-else-if="view === 'create-profile'">
            <!-- Branding Header -->
            <header class="auth-brand">
              <img
                src="/lost-and-found.png"
                alt="Lost &amp; Found Logo"
                class="auth-logo"
              />
              <h1 class="auth-title">Lost &amp; Found</h1>
              <p class="auth-section-title">Create your profile</p>
            </header>

            <!-- Profile Details Form -->
            <form class="auth-form" @submit.prevent="handleContinueToAccount">
              <!-- Full Name -->
              <div class="form-group">
                <label class="input-label" for="signup-name">Full Name</label>
                <input
                  id="signup-name"
                  v-model="signUpForm.name"
                  type="text"
                  class="auth-input"
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
                    class="auth-input with-prefix"
                    placeholder="alexj"
                    autocomplete="username"
                    autocapitalize="none"
                    maxlength="30"
                    @input="handleUsernameInput"
                    @blur="handleUsernameBlur"
                  />
                </div>
                <span v-if="errors.username" class="input-error">{{ errors.username }}</span>
              </div>

              <!-- Phone Number -->
              <div class="form-group">
                <label class="input-label" for="signup-phone">Phone Number</label>
                <input
                  id="signup-phone"
                  v-model="signUpForm.phone"
                  type="tel"
                  class="auth-input"
                  placeholder="e.g., 09123456789"
                  autocomplete="tel"
                  maxlength="20"
                  @input="clearError('phone')"
                />
                <span class="input-hint">Private — never visible to other users</span>
                <span v-if="errors.phone" class="input-error">{{ errors.phone }}</span>
              </div>

              <!-- Global Error Banner -->
              <div v-if="globalError" class="error-banner">
                <AlertCircle :size="16" class="error-banner-icon" />
                <span>{{ globalError }}</span>
              </div>

              <!-- Continue Button -->
              <button
                type="submit"
                class="auth-primary-btn"
                :disabled="loading"
              >
                <ion-spinner v-if="loading" name="crescent" class="btn-spinner" />
                <span v-else>Continue</span>
              </button>

              <!-- Switch Link -->
              <div class="auth-switch-prompt">
                <span>Already have an account?</span>
                <button type="button" class="switch-link-btn" @click="switchView('signin')">
                  Sign In
                </button>
              </div>
            </form>
          </template>

          <!-- VIEW 3: CREATE ACCOUNT (Step 2 of Create Account) -->
          <template v-else-if="view === 'create-account'">
            <!-- Step Navigation Header -->
            <div class="auth-step-header">
              <button
                type="button"
                class="auth-back-btn"
                aria-label="Back to profile details"
                @click="goBackToProfile"
              >
                <ArrowLeft :size="20" />
              </button>
              <div class="auth-step-title-wrap">
                <h2 class="auth-step-title">Create your account</h2>
                <p class="auth-step-subtitle">Set your email and password</p>
              </div>
            </div>

            <!-- Credentials Form -->
            <form class="auth-form" @submit.prevent="handleCreateAccount">
              <!-- Email -->
              <div class="form-group">
                <label class="input-label" for="signup-email">Email</label>
                <input
                  id="signup-email"
                  v-model="signUpForm.email"
                  type="email"
                  class="auth-input"
                  placeholder="name@example.com"
                  autocomplete="email"
                  autocapitalize="none"
                  @input="clearError('email')"
                />
                <span class="input-hint">Private — used for account sign-in</span>
                <span v-if="errors.email" class="input-error">{{ errors.email }}</span>
              </div>

              <!-- Password -->
              <div class="form-group">
                <label class="input-label" for="signup-password">Password</label>
                <div class="password-wrap">
                  <input
                    id="signup-password"
                    v-model="signUpForm.password"
                    :type="showSignUpPassword ? 'text' : 'password'"
                    class="auth-input with-toggle"
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
                <div class="password-wrap">
                  <input
                    id="signup-confirm-password"
                    v-model="signUpForm.confirmPassword"
                    :type="showConfirmPassword ? 'text' : 'password'"
                    class="auth-input with-toggle"
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
                class="auth-primary-btn"
                :disabled="loading"
              >
                <ion-spinner v-if="loading" name="crescent" class="btn-spinner" />
                <span v-else>Create Account</span>
              </button>
            </form>
          </template>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";
import { IonContent, IonPage, IonSpinner, toastController } from "@ionic/vue";
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-vue-next";
import { useAuth, normalizeUsername } from "../composables/useAuth";

const router = useRouter();
const route = useRoute();
const { signIn, signUp, isAnonymous, checkUsernameAvailable, currentProfile } = useAuth();

type AuthView = "signin" | "create-profile" | "create-account";
const view = ref<AuthView>("signin");
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

let usernameDebounceTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  // If user is anonymous or coming from /onboarding, show profile setup
  if (isAnonymous.value || route.path === "/onboarding") {
    view.value = "create-profile";
  }
  // Pre-fill profile data if present
  if (currentProfile.value) {
    signUpForm.name = currentProfile.value.name || "";
    signUpForm.username = currentProfile.value.username || "";
    signUpForm.phone = currentProfile.value.phone || "";
  }
});

onBeforeUnmount(() => {
  if (usernameDebounceTimer) {
    clearTimeout(usernameDebounceTimer);
  }
});

const switchView = (newView: AuthView) => {
  view.value = newView;
  globalError.value = "";
  Object.keys(errors).forEach((k) => {
    errors[k] = "";
  });
};

const goBackToProfile = () => {
  view.value = "create-profile";
  globalError.value = "";
  errors.email = "";
  errors.password = "";
  errors.confirmPassword = "";
};

const clearError = (field: string) => {
  errors[field] = "";
  globalError.value = "";
};

const handleUsernameInput = () => {
  signUpForm.username = normalizeUsername(signUpForm.username);
  clearError("username");

  // Debounced check — avoid annoying errors while actively typing
  if (usernameDebounceTimer) {
    clearTimeout(usernameDebounceTimer);
  }
  if (signUpForm.username.length >= 3) {
    usernameDebounceTimer = setTimeout(async () => {
      await checkUsernameAvailability();
    }, 600);
  }
};

const handleUsernameBlur = async () => {
  if (usernameDebounceTimer) {
    clearTimeout(usernameDebounceTimer);
  }
  await checkUsernameAvailability();
};

const checkUsernameAvailability = async (): Promise<boolean> => {
  const clean = signUpForm.username.trim();
  if (!clean || clean.length < 3) return true;
  try {
    const isAvail = await checkUsernameAvailable(clean);
    if (!isAvail) {
      errors.username = "This username is already taken. Please choose another.";
      return false;
    } else if (errors.username === "This username is already taken. Please choose another.") {
      errors.username = "";
    }
    return true;
  } catch (err) {
    return true;
  }
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

const validateProfileStep = async (): Promise<boolean> => {
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

  // Validate uniqueness
  if (valid && signUpForm.username.trim()) {
    const isAvail = await checkUsernameAvailability();
    if (!isAvail) {
      valid = false;
    }
  }

  return valid;
};

const validateAccountStep = (): boolean => {
  let valid = true;
  globalError.value = "";

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

const handleContinueToAccount = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const isValid = await validateProfileStep();
    if (isValid) {
      view.value = "create-account";
      globalError.value = "";
    }
  } finally {
    loading.value = false;
  }
};

const handleCreateAccount = async () => {
  if (!validateAccountStep() || loading.value) return;
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
      message: "Account created successfully!",
      duration: 2000,
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
.auth-page {
  --background: var(--app-background, #F7F8FA);
}

.auth-content {
  --background: var(--app-background, #F7F8FA);
}

/* Outer layout wrapper - centered vertically on tall screens, scrollable on short */
.auth-outer-wrap {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  min-height: 100dvh;
  min-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  padding: max(24px, calc(env(safe-area-inset-top, 0px) + 24px)) 24px max(24px, calc(env(safe-area-inset-bottom, 0px) + 24px));
}

/* Center column container constrained to 380px-420px */
.auth-center-container {
  width: 100%;
  max-width: 400px;
  margin: auto 0;
  display: flex;
  flex-direction: column;
}

/* Branding Header */
.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 32px;
}

.auth-logo {
  width: 70px;
  height: 70px;
  object-fit: contain;
  margin-bottom: 12px;
  filter: drop-shadow(0 4px 12px rgba(47, 159, 232, 0.2));
}

.auth-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--app-text-primary, #202124);
}

.auth-subtitle {
  margin: 6px 0 0 0;
  font-size: 14px;
  color: var(--app-text-secondary, #72777D);
}

.auth-section-title {
  margin: 6px 0 0 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text-secondary, #72777D);
}

/* Step 2 Header with Back Button */
.auth-step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.auth-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  background: var(--app-input-background, #F2F4F7);
  border: 1px solid var(--app-border, rgba(20, 25, 30, 0.08));
  border-radius: 50%;
  color: var(--app-text-primary, #202124);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
  touch-action: manipulation;
}

.auth-back-btn:active {
  transform: scale(0.92);
  background: var(--app-border, rgba(20, 25, 30, 0.12));
}

.auth-step-title-wrap {
  display: flex;
  flex-direction: column;
}

.auth-step-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--app-text-primary, #202124);
}

.auth-step-subtitle {
  margin: 2px 0 0 0;
  font-size: 13px;
  color: var(--app-text-secondary, #72777D);
}

/* Form Styles */
.auth-form {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary, #202124);
  margin-bottom: 7px;
  letter-spacing: -0.01em;
}

.auth-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: var(--app-input-background, #F2F4F7);
  border: 1px solid var(--app-border, rgba(20, 25, 30, 0.08));
  border-radius: 12px;
  font-size: 15px;
  color: var(--app-text-primary, #202124);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  -webkit-appearance: none;
}

.auth-input:focus {
  border-color: var(--ion-color-primary, #2F9FE8);
  box-shadow: 0 0 0 3px rgba(47, 159, 232, 0.16);
}

.auth-input::placeholder {
  color: var(--app-text-muted, #9AA0A6);
}

/* Input with @ prefix */
.input-with-prefix {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
}

.input-with-prefix .prefix {
  position: absolute;
  left: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-secondary, #72777D);
  pointer-events: none;
  user-select: none;
}

.auth-input.with-prefix {
  padding-left: 32px;
}

/* Password with Show/Hide toggle */
.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.auth-input.with-toggle {
  padding-right: 44px;
}

.pwd-toggle-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--app-text-secondary, #72777D);
  cursor: pointer;
  transition: color 0.15s ease;
}

.pwd-toggle-btn:hover,
.pwd-toggle-btn:focus {
  color: var(--app-text-primary, #202124);
}

/* Hints & Errors */
.input-hint {
  font-size: 11.5px;
  color: var(--app-text-secondary, #72777D);
  margin-top: 5px;
}

.input-error {
  font-size: 12px;
  color: var(--ion-color-danger, #F04444);
  font-weight: 500;
  margin-top: 5px;
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(240, 68, 68, 0.08);
  border: 1px solid rgba(240, 68, 68, 0.2);
  border-radius: 10px;
  color: var(--ion-color-danger, #F04444);
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 16px;
}

.error-banner-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

/* Primary Button */
.auth-primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  margin-top: 8px;
  background: var(--ion-color-primary, #2F9FE8);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(47, 159, 232, 0.25);
  transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
  touch-action: manipulation;
}

.auth-primary-btn:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(47, 159, 232, 0.2);
}

.auth-primary-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-spinner {
  --color: #ffffff;
  width: 20px;
  height: 20px;
}

/* Switch Prompt Link */
.auth-switch-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 24px;
  font-size: 13.5px;
  color: var(--app-text-secondary, #72777D);
}

.switch-link-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ion-color-primary, #2F9FE8);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.switch-link-btn:active {
  opacity: 0.7;
}
</style>
