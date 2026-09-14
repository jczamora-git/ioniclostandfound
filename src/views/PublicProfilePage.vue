<template>
  <ion-page>
    <ion-header :translucent="true" class="ios-public-header">
      <ion-toolbar class="ios-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" text="" />
        </ion-buttons>
        <ion-title class="ios-header-title">Member Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="public-content">
      <div v-if="loading" class="public-loading">
        <ion-spinner name="crescent" />
        <span>Loading member profile...</span>
      </div>

      <div v-else class="ios-screen-container public-container">
        <!-- Profile Identity Card -->
        <header class="public-hero-card">
          <UserAvatar
            :name="profile?.name || authorNameFallback"
            :username="profile?.username || authorUsernameFallback"
            size="xl"
          />
          <div class="hero-info">
            <h1 class="hero-name">{{ profile?.name || authorNameFallback }}</h1>
            <span class="hero-username">@{{ profile?.username || authorUsernameFallback }}</span>
          </div>

          <!-- Stats Grid -->
          <div class="stats-row">
            <div class="stat-box">
              <span class="stat-number">{{ userPosts.length }}</span>
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
        </header>

        <!-- Member Posts Section Header & Filter Pills -->
        <section class="posts-heading-section">
          <div class="heading-row">
            <h2 class="section-title">Member Posts</h2>
            <span class="posts-count-tag">{{ filteredUserPosts.length }}</span>
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

        <!-- Member Posts Feed -->
        <div v-if="filteredUserPosts.length === 0" class="empty-user-posts">
          <FileText :size="36" class="empty-icon" />
          <h3 class="empty-title">No posts in this category</h3>
          <p class="empty-sub">This community member currently has no active listings here.</p>
        </div>

        <div v-else class="user-posts-list">
          <PostCard
            v-for="post in filteredUserPosts"
            :key="post.id"
            :post="post"
            :is-helpful="isHelpfulByMe(post.id)"
            @toggle-helpful="toggleHelpful"
            @share="handleShare"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
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
  LayoutGrid,
  CircleHelp,
  SearchCheck,
  FileText
} from "lucide-vue-next";
import UserAvatar from "../components/UserAvatar.vue";
import PostCard from "../components/PostCard.vue";
import { useAuth } from "../composables/useAuth";
import { usePosts } from "../composables/usePosts";
import type { Post } from "../types/post";

const route = useRoute();
const { getPublicProfile } = useAuth();
const { posts, toggleHelpful, isHelpfulByMe } = usePosts();

const uid = computed(() => route.params.uid as string);
const profile = ref<{ id: string; name: string; username: string } | null>(null);
const loading = ref(true);
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

const userPosts = computed(() => {
  return posts.value.filter((p) => p.authorId === uid.value);
});

const authorNameFallback = computed(() => {
  if (userPosts.value.length > 0) return userPosts.value[0].authorName;
  return "Community Member";
});

const authorUsernameFallback = computed(() => {
  if (userPosts.value.length > 0) return userPosts.value[0].authorUsername;
  return "member";
});

const lostCount = computed(() => userPosts.value.filter((p) => p.type === "lost").length);
const foundCount = computed(() => userPosts.value.filter((p) => p.type === "found").length);
const resolvedCount = computed(
  () => userPosts.value.filter((p) => p.status === "resolved" || p.status === "returned").length
);

const filteredUserPosts = computed(() => {
  if (activeTab.value === "Lost") return userPosts.value.filter((p) => p.type === "lost");
  if (activeTab.value === "Found") return userPosts.value.filter((p) => p.type === "found");
  return userPosts.value;
});

onMounted(async () => {
  loading.value = true;
  profile.value = await getPublicProfile(uid.value);
  loading.value = false;
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
      // ignore
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
</script>

<style scoped>
.public-content {
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

.public-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--app-text-secondary);
}

.public-container {
  padding: 16px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
}

.public-hero-card {
  background: var(--app-surface);
  border-radius: 24px;
  padding: 24px 20px;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-name {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--app-text-primary);
}

.hero-username {
  font-size: 14px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 12px 6px;
  background: var(--app-surface-secondary);
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  margin-top: 4px;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-number {
  font-size: 18px;
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
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-secondary);
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: var(--app-card-border);
}

/* Member Posts Heading & Category Filter Pills */
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

.segment-tab.active .segment-tab-label {
  color: var(--app-text-primary);
  font-weight: 600;
}

.user-posts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-user-posts {
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
</style>
