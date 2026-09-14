<template>
  <ion-page>
    <ion-content :fullscreen="true" class="profile-content">
      <div class="ios-screen-container profile-container">
        <!-- Unified Left-Aligned Page Header -->
        <PageHeader title="My Profile" />

        <!-- Profile Identity Section (Flattened, no bulky card) -->
        <div class="profile-hero-section">
          <UserAvatar
            :name="currentProfile?.name"
            :username="currentProfile?.username"
            size="xl"
          />
          <div class="hero-info">
            <h1 class="hero-name">{{ currentProfile?.name || 'Community Member' }}</h1>
            <span class="hero-username">@{{ currentProfile?.username || 'user' }}</span>
          </div>

          <!-- Compact Stats Row (No giant box, clean dividers) -->
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

          <!-- Edit Profile Button -->
          <button
            type="button"
            class="edit-profile-btn"
            @click="router.push('/edit-profile')"
          >
            <Pencil :size="15" class="edit-profile-icon" />
            <span>Edit Profile</span>
          </button>
        </div>

        <!-- Appearance & App Settings Row (Flattened, subtle border) -->
        <section class="profile-settings-section" aria-label="Appearance settings">
          <button type="button" class="settings-item-btn" @click="openThemeSelector">
            <div class="settings-item-left">
              <div class="settings-icon-bubble">
                <SunMoon :size="18" />
              </div>
              <span class="settings-item-label">Appearance</span>
            </div>
            <div class="settings-item-right">
              <span class="settings-item-value">{{ currentThemeLabel }}</span>
              <ChevronRight :size="16" class="settings-chevron" />
            </div>
          </button>
        </section>

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
              <component :is="item.icon" :size="15" class="pill-icon" />
              <span class="pill-label">{{ item.label }}</span>
            </button>
          </div>
        </section>

        <!-- My Posts Feed -->
        <div v-if="filteredMyPosts.length === 0" class="empty-my-posts">
          <FileText :size="36" class="empty-icon" />
          <h3 class="empty-title">You haven't posted anything yet</h3>
          <p class="empty-sub">Report items you've lost or found to help the community.</p>
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
            @share="handleShare"
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
  SunMoon,
  ChevronRight,
  FileText,
  CircleHelp,
  SearchCheck,
  LayoutGrid
} from "lucide-vue-next";
import UserAvatar from "../components/UserAvatar.vue";
import PostCard from "../components/PostCard.vue";
import PostComposerModal from "../components/PostComposerModal.vue";
import { useAuth } from "../composables/useAuth";
import { usePosts } from "../composables/usePosts";
import { useTheme } from "../composables/useTheme";
import type { Post, PostFormData } from "../types/post";

const router = useRouter();
const { currentProfile } = useAuth();
const { posts, toggleHelpful, isHelpfulByMe, createPost } = usePosts();
const { themePreference, setTheme } = useTheme();

const currentThemeLabel = computed(() => {
  if (themePreference.value === "system") return "System Default";
  if (themePreference.value === "light") return "Light";
  return "Dark";
});

const openThemeSelector = async () => {
  const actionSheet = await actionSheetController.create({
    header: "Appearance",
    subHeader: "Choose how Lost & Found looks for you",
    buttons: [
      {
        text: "System Default" + (themePreference.value === "system" ? " ✓" : ""),
        handler: () => {
          setTheme("system");
        }
      },
      {
        text: "Light" + (themePreference.value === "light" ? " ✓" : ""),
        handler: () => {
          setTheme("light");
        }
      },
      {
        text: "Dark" + (themePreference.value === "dark" ? " ✓" : ""),
        handler: () => {
          setTheme("dark");
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

const handleShare = async (post: Post) => {
  const shareData = {
    title: post.title,
    text: `${post.title} — ${post.location}`,
    url: window.location.origin + `/post/${post.id}`
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // ignore abort
    }
  }
  try {
    await navigator.clipboard.writeText(shareData.url);
    const toast = await toastController.create({
      message: "Post link copied to clipboard!",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();
  } catch {
    // ignore
  }
};

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

.ios-profile-header {
  border-bottom: 0.5px solid var(--app-separator);
}

.ios-toolbar {
  --background: var(--app-dock-bg);
  --backdrop-filter: blur(20px);
}

.ios-header-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
}

.profile-container {
  padding: 0 16px 100px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 600px;
  margin: 0 auto;
}

/* Profile Hero Section (Flattened, no bulky card) */
.profile-hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 20px 0 8px;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-name {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--app-text-primary);
}

.hero-username {
  font-size: 14px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

/* Stats Row (Compact social stats, subtle dividers) */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 12px 0;
  border-top: 1px solid var(--app-card-border);
  border-bottom: 1px solid var(--app-card-border);
  margin-top: 4px;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-number {
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.text-danger {
  color: var(--app-lost);
}

.text-success {
  color: var(--app-found);
}

.text-resolved {
  color: var(--app-resolved);
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--app-text-secondary);
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 20px;
  background: var(--app-card-border);
}

/* Edit Profile Button */
.edit-profile-btn {
  width: 100%;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-primary);
  border-radius: 12px;
  padding: 10px 16px;
  height: 42px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.edit-profile-btn:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  border-color: rgba(47, 159, 232, 0.3);
}

.edit-profile-btn:active {
  transform: scale(0.985);
}

.edit-profile-icon {
  flex-shrink: 0;
}

/* Profile Settings Row (Flattened, subtle border) */
.profile-settings-section {
  background: var(--app-surface);
  border-radius: 14px;
  border: 1px solid var(--app-card-border);
  overflow: hidden;
}

.settings-item-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.settings-item-btn:hover,
.settings-item-btn:active {
  background: var(--app-surface-secondary);
}

.settings-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-icon-bubble {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--app-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-primary);
}

.settings-item-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.settings-item-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-item-value {
  font-size: 14px;
  color: var(--app-text-secondary);
}

.settings-chevron {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

/* My Posts Heading & Category Filter Pills */
.posts-heading-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}

.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--app-text-primary);
}

.posts-count-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
  background: var(--app-primary-soft);
  padding: 3px 9px;
  border-radius: 12px;
}

.category-pills-row {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.category-pills-row::-webkit-scrollbar {
  display: none;
}

.category-pill-btn {
  flex: 1;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 14px;
  padding: 10px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.category-pill-btn:hover {
  background: var(--app-surface-secondary);
}

.category-pill-btn.active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  border-color: rgba(47, 159, 232, 0.35);
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(47, 159, 232, 0.12);
}

.pill-icon {
  flex-shrink: 0;
  color: currentColor;
}

/* My Posts List */
.my-posts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-my-posts {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
  background: var(--app-surface);
  border-radius: 20px;
  border: 1px solid var(--app-card-border);
  gap: 8px;
}

.empty-icon {
  font-size: 36px;
  color: var(--app-text-tertiary);
  margin-bottom: 4px;
}

.empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.empty-sub {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary);
  max-width: 260px;
}

.create-first-post-btn {
  margin-top: 10px;
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  border-radius: 14px;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(47, 159, 232, 0.25);
  transition: all 0.15s ease;
}

.create-first-post-btn:hover {
  background: var(--app-primary-deep);
}

.create-first-post-btn:active {
  transform: scale(0.985);
}

/* Brand Footer */
.profile-brand-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0 8px;
  gap: 4px;
  opacity: 0.75;
}

.profile-footer-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.profile-footer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.profile-footer-sub {
  font-size: 11px;
  color: var(--app-text-tertiary);
}

.dock-spacer {
  height: 40px;
}
</style>
