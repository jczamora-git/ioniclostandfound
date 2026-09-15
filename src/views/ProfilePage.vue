<template>
  <ion-page>
    <!-- Fixed Page Header -->
    <PageHeader title="My Profile" />

    <ion-content :fullscreen="true" class="profile-content">
      <div class="ios-screen-container profile-container">
        <!-- Modern Profile Hero Card -->
        <div class="profile-hero-card">
          <!-- Cover Area with Blurred Avatar Background -->
          <div class="profile-cover">
            <div
              v-if="currentProfile?.avatarUrl"
              class="profile-cover-blur"
              :style="{ backgroundImage: `url(${currentProfile.avatarUrl})` }"
            ></div>
            <div v-else class="profile-cover-fallback"></div>
            <div class="profile-cover-overlay"></div>
          </div>

          <!-- Hero Card Body (Avatar overlaps cover) -->
          <div class="profile-card-body">
            <div class="hero-avatar-wrap">
              <UserAvatar
                :name="currentProfile?.name"
                :username="currentProfile?.username"
                :avatar-url="currentProfile?.avatarUrl"
                size="xl"
              />
            </div>

            <div class="hero-identity">
              <h1 class="hero-name">{{ currentProfile?.name || 'Community Member' }}</h1>
              <span class="hero-username">@{{ currentProfile?.username || 'user' }}</span>
            </div>

            <!-- Clean Inline Stats Row -->
            <div class="stats-row">
              <div class="stat-box">
                <span class="stat-number">{{ myPosts.length }}</span>
                <span class="stat-label">Posts</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-box">
                <span class="stat-number text-danger">{{ lostCount }}</span>
                <span class="stat-label">Lost</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-box">
                <span class="stat-number text-success">{{ foundCount }}</span>
                <span class="stat-label">Found</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-box">
                <span class="stat-number text-resolved">{{ resolvedCount }}</span>
                <span class="stat-label">Resolved</span>
              </div>
            </div>

            <!-- Action Row: Edit Profile, Theme Toggle, Sign Out -->
            <div class="profile-action-row">
              <button
                type="button"
                class="hero-cta-btn"
                @click="router.push('/edit-profile')"
              >
                <Pencil :size="16" class="cta-icon" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                class="hero-theme-btn"
                aria-label="Change theme"
                :title="themeAriaLabel"
                @click="cycleTheme"
              >
                <Sun v-if="themePreference === 'light'" :size="19" />
                <Moon v-else-if="themePreference === 'dark'" :size="19" />
                <Monitor v-else :size="19" />
              </button>

              <button
                type="button"
                class="hero-signout-btn"
                aria-label="Sign out"
                title="Sign out"
                @click="handleSignOut"
              >
                <LogOut :size="18" />
              </button>
            </div>
          </div>
        </div>

        <!-- Achievements Section -->
        <AchievementsSection
          v-if="currentProfile?.id"
          :user-id="currentProfile.id"
        />

        <!-- My Posts Section Header & Filter Pills -->
        <section class="posts-heading-section">
          <div class="heading-row">
            <h2 class="section-title">My Posts</h2>
            <span class="posts-count-tag">{{ filteredMyPosts.length }}</span>
          </div>

          <div class="category-pills-row" role="tablist">
            <button
              v-for="item in tabFilters"
              :key="item.value"
              type="button"
              role="tab"
              class="category-pill-btn"
              :class="{ active: activeTab === item.value }"
              @click="activeTab = item.value"
            >
              <component :is="item.icon" :size="14" class="pill-icon" />
              <span class="pill-label">{{ item.label }}</span>
            </button>
          </div>
        </section>

        <!-- My Posts Feed -->
        <div v-if="filteredMyPosts.length === 0" class="empty-my-posts">
          <div class="empty-icon-wrap">
            <FileText :size="28" class="empty-icon" />
          </div>
          <h3 class="empty-title">No posts yet</h3>
          <p class="empty-sub">Your Lost & Found posts will appear here.</p>
          <button
            type="button"
            class="create-first-post-btn"
            @click="showComposer = true"
          >
            Create Your First Post
          </button>
        </div>

        <div v-else class="my-posts-list">
          <PostCard
            v-for="post in filteredMyPosts"
            :key="post.id"
            :post="post"
            :is-helpful="isHelpfulByMe(post.id)"
            @toggle-helpful="toggleHelpful"
          />
        </div>

        <div class="dock-spacer"></div>
      </div>
    </ion-content>

    <PostComposerModal
      :is-open="showComposer"
      initial-type="lost"
      @close="showComposer = false"
      @submit="handleCreate"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonContent,
  IonPage,
  actionSheetController,
  toastController
} from "@ionic/vue";
import PageHeader from "../components/PageHeader.vue";
import {
  Pencil,
  Sun,
  Moon,
  Monitor,
  FileText,
  CircleHelp,
  SearchCheck,
  LayoutGrid,
  LogOut
} from "lucide-vue-next";
import UserAvatar from "../components/UserAvatar.vue";
import PostCard from "../components/PostCard.vue";
import PostComposerModal from "../components/PostComposerModal.vue";
import AchievementsSection from "../components/AchievementsSection.vue";
import { useAuth } from "../composables/useAuth";
import { usePosts } from "../composables/usePosts";
import { useTheme } from "../composables/useTheme";
import type { Post, PostFormData } from "../types/post";

const router = useRouter();
const { currentProfile, signOutUser } = useAuth();
const { posts, toggleHelpful, isHelpfulByMe, createPost } = usePosts();
const { themePreference, setTheme } = useTheme();

const cycleTheme = () => {
  if (themePreference.value === "light") {
    setTheme("dark");
  } else if (themePreference.value === "dark") {
    setTheme("system");
  } else {
    setTheme("light");
  }
};

const themeAriaLabel = computed(() => {
  if (themePreference.value === "light") return "Theme: Light";
  if (themePreference.value === "dark") return "Theme: Dark";
  return "Theme: System";
});

const handleSignOut = async () => {
  const actionSheet = await actionSheetController.create({
    header: "Sign Out",
    subHeader: "Are you sure you want to sign out of your account?",
    buttons: [
      {
        text: "Sign Out",
        role: "destructive",
        handler: async () => {
          await signOutUser();
          const toast = await toastController.create({
            message: "Signed out successfully.",
            duration: 2000,
            position: "top",
            color: "medium"
          });
          await toast.present();
          router.replace("/auth");
        }
      },
      {
        text: "Cancel",
        role: "cancel"
      }
    ]
  });
  await actionSheet.present();
};

const showComposer = ref(false);
const activeTab = ref<"Posts" | "Lost" | "Found">("Posts");

interface ProfileTabItem {
  value: "Posts" | "Lost" | "Found";
  label: string;
  icon: any;
}

const tabFilters: ProfileTabItem[] = [
  { value: "Posts", label: "Posts", icon: LayoutGrid },
  { value: "Lost", label: "Lost", icon: CircleHelp },
  { value: "Found", label: "Found", icon: SearchCheck }
];

const myPosts = computed(() => {
  if (!currentProfile.value) return [];
  return posts.value.filter((p) => p.authorId === currentProfile.value?.id);
});

const lostCount = computed(() => myPosts.value.filter((p) => p.type === "lost").length);
const foundCount = computed(() => myPosts.value.filter((p) => p.type === "found").length);
const resolvedCount = computed(
  () => myPosts.value.filter((p) => p.status === "resolved" || p.status === "returned").length
);

const filteredMyPosts = computed(() => {
  if (activeTab.value === "Lost") return myPosts.value.filter((p) => p.type === "lost");
  if (activeTab.value === "Found") return myPosts.value.filter((p) => p.type === "found");
  return myPosts.value;
});

const handleCreate = async (data: PostFormData) => {
  try {
    await createPost(data);
    showComposer.value = false;
    const toast = await toastController.create({
      message: "Post created successfully!",
      duration: 2500,
      position: "top",
      color: "success"
    });
    await toast.present();
  } catch (err: any) {
    const toast = await toastController.create({
      message: err.message || "Failed to create post.",
      duration: 3000,
      position: "top",
      color: "danger"
    });
    await toast.present();
  }
};
</script>

<style scoped>
.profile-content {
  --background: var(--app-bg);
}

.profile-container {
  padding: 16px 16px calc(100px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
}

/* 1. Modern Profile Hero Card */
.profile-hero-card {
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

/* 2. Cover Area with Blurred Avatar */
.profile-cover {
  position: relative;
  height: 145px;
  width: 100%;
  overflow: hidden;
  background: var(--app-surface-secondary);
}

.profile-cover-blur {
  position: absolute;
  inset: -24px;
  background-size: cover;
  background-position: center;
  filter: blur(28px) saturate(1.4);
  transform: scale(1.18);
  opacity: 0.9;
}

.profile-cover-fallback {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%);
}

.profile-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.38) 100%);
}

/* 3. Hero Card Body */
.profile-card-body {
  padding: 0 18px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.hero-avatar-wrap {
  margin-top: -46px;
  position: relative;
  z-index: 2;
  border-radius: 50%;
  border: 3.5px solid var(--app-surface);
  background: var(--app-surface);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: -2px;
}

.hero-name {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--app-text-primary);
  line-height: 1.25;
}

.hero-username {
  font-size: 14px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

/* 5. Clean Inline Stats Row */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 12px 0;
  border-top: 1px solid var(--app-card-border);
  border-bottom: 1px solid var(--app-card-border);
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-number {
  font-size: 21px;
  font-weight: 700;
  color: var(--app-text-primary);
  line-height: 1.2;
}

.text-danger {
  color: var(--app-lost, #ef4444);
}

.text-success {
  color: var(--app-found, #10b981);
}

.text-resolved {
  color: var(--app-resolved, #3b82f6);
}

.stat-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--app-text-secondary);
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: var(--app-card-border);
  opacity: 0.8;
}

/* 6. Action Row: High-Contrast CTA Button, Theme Toggle, & Sign Out */
.profile-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.hero-cta-btn {
  flex: 1;
  min-width: 0;
  height: 50px;
  border-radius: 999px;
  border: none;
  background: var(--app-text-primary);
  color: var(--app-bg);
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.hero-cta-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.hero-cta-btn:active {
  transform: scale(0.985);
  opacity: 0.88;
}

.hero-theme-btn {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--app-card-border);
  background: var(--app-surface-secondary);
  color: var(--app-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.15s ease;
  padding: 0;
}

.hero-theme-btn:hover {
  background: var(--app-surface-tertiary);
  transform: translateY(-1px);
}

.hero-theme-btn:active {
  transform: scale(0.96);
  opacity: 0.88;
}

.hero-signout-btn {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  color: var(--app-lost, #ef4444);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.04);
  transition: all 0.15s ease;
  padding: 0;
}

.hero-signout-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  transform: translateY(-1px);
}

.hero-signout-btn:active {
  transform: scale(0.96);
  opacity: 0.88;
}

.cta-icon {
  flex-shrink: 0;
}

/* 11. My Posts Heading & Category Filter Tabs */
.posts-heading-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--app-text-primary);
}

.posts-count-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
  background: var(--app-primary-soft);
  padding: 2px 8px;
  border-radius: 10px;
}

.category-pills-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.category-pill-btn {
  flex: 1;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 11px;
  height: 38px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.category-pill-btn:hover {
  background: var(--app-surface-secondary);
}

.category-pill-btn.active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  border-color: rgba(47, 159, 232, 0.35);
  font-weight: 600;
}

.pill-icon {
  flex-shrink: 0;
  color: currentColor;
}

/* My Posts List & Empty State */
.my-posts-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-my-posts {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 20px;
  background: var(--app-surface);
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  gap: 6px;
}

.empty-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--app-surface-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-tertiary);
  margin-bottom: 2px;
}

.empty-icon {
  color: var(--app-text-tertiary);
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.empty-sub {
  margin: 0;
  font-size: 12.5px;
  color: var(--app-text-secondary);
  max-width: 260px;
  line-height: 1.4;
}

.create-first-post-btn {
  margin-top: 10px;
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(47, 159, 232, 0.25);
  transition: all 0.15s ease;
}

.create-first-post-btn:hover {
  background: var(--app-primary-deep);
}

.create-first-post-btn:active {
  transform: scale(0.985);
}

.dock-spacer {
  height: 20px;
}
</style>
