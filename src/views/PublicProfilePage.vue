<template>
  <ion-page>
    <!-- Fixed Header with Back Navigation -->
    <PageHeader
      title="Member Profile"
      :show-back="true"
      default-back-url="/tabs/home"
    />

    <ion-content :fullscreen="true" class="public-content">
      <div class="ios-screen-container public-container">
        <div v-if="loading" class="public-loading">
          <ion-spinner name="crescent" />
          <span>Loading member profile...</span>
        </div>

        <template v-else>
          <!-- Modern Profile Hero Card -->
          <div class="public-hero-card">
            <!-- Cover Area with Blurred Avatar Background -->
            <div class="profile-cover">
              <div
                v-if="profile?.avatarUrl"
                class="profile-cover-blur"
                :style="{ backgroundImage: `url(${profile.avatarUrl})` }"
              ></div>
              <div v-else class="profile-cover-fallback"></div>
              <div class="profile-cover-overlay"></div>
            </div>

            <!-- Hero Card Body (Avatar overlaps cover) -->
            <div class="profile-card-body">
              <div class="hero-avatar-wrap">
                <UserAvatar
                  :name="profile?.name || authorNameFallback"
                  :username="profile?.username || authorUsernameFallback"
                  :avatar-url="profile?.avatarUrl"
                  size="xl"
                />
              </div>

              <div class="hero-identity">
                <h1 class="hero-name">{{ profile?.name || authorNameFallback }}</h1>
                <span class="hero-username">@{{ profile?.username || authorUsernameFallback }}</span>
              </div>

              <!-- Clean Inline Stats Row -->
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

              <!-- Large High-Contrast Full-Width Pill CTA Button -->
              <button
                v-if="!isOwnProfile"
                type="button"
                class="hero-cta-btn"
                :disabled="creatingChat"
                @click="handleMessageUser"
              >
                <ion-spinner v-if="creatingChat" name="crescent" class="chat-spinner" />
                <template v-else>
                  <MessageCircle :size="16" class="cta-icon" />
                  <span>Message User</span>
                </template>
              </button>
            </div>
          </div>

          <!-- Achievements Section -->
          <AchievementsSection
            v-if="targetProfileId"
            :user-id="targetProfileId"
            :is-own-profile="isOwnProfile"
          />

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
                <component :is="item.icon" :size="14" class="pill-icon" />
                <span class="pill-label">{{ item.label }}</span>
              </button>
            </div>
          </section>

          <!-- Member Posts Feed -->
          <div v-if="filteredUserPosts.length === 0" class="empty-user-posts">
            <div class="empty-icon-wrap">
              <FileText :size="28" class="empty-icon" />
            </div>
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
            />
          </div>

          <div class="dock-spacer"></div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonContent,
  IonPage,
  IonSpinner,
  onIonViewWillEnter,
  toastController
} from "@ionic/vue";
import {
  LayoutGrid,
  CircleHelp,
  SearchCheck,
  FileText,
  MessageCircle
} from "lucide-vue-next";
import UserAvatar from "../components/UserAvatar.vue";
import PostCard from "../components/PostCard.vue";
import PageHeader from "../components/PageHeader.vue";
import AchievementsSection from "../components/AchievementsSection.vue";
import { auth } from "../firebase";
import { useAuth, getSessionUser, currentAppUserId } from "../composables/useAuth";
import { useProfiles, loadProfile } from "../composables/useProfiles";
import { usePosts } from "../composables/usePosts";
import { useAchievements } from "../composables/useAchievements";
import { createOrGetConversation } from "../composables/useConversations";
import type { Post } from "../types/post";
import type { Profile } from "../types/profile";

const route = useRoute();
const router = useRouter();
const { currentProfile } = useAuth();
const { posts, toggleHelpful, isHelpfulByMe } = usePosts();
const { loadAchievementsForUser } = useAchievements();

const targetProfileId = computed(() => (((route.params as any).userId || route.params.uid) as string || "").trim());
const uid = targetProfileId;
const profile = ref<Profile | null>(null);
const loading = ref(true);
const creatingChat = ref(false);
const activeTab = ref<"Posts" | "Lost" | "Found">("Posts");

const isOwnProfile = computed(() => {
  const currentId = currentAppUserId.value || currentProfile.value?.id;
  if (!currentId || !targetProfileId.value) return false;
  return currentId === targetProfileId.value;
});

onIonViewWillEnter(() => {
  if (targetProfileId.value) {
    loadAchievementsForUser(targetProfileId.value, true);
  }
});

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
  if (uid.value) {
    profile.value = await loadProfile(uid.value);
  }
  loading.value = false;
});

const handleMessageUser = async () => {
  if (creatingChat.value) return;
  creatingChat.value = true;
  try {
    const session = await getSessionUser();
    if (!session?.uid || (session.isAnonymous && !session.isDevAccount)) {
      console.warn('[PublicProfile] Unauthenticated user, redirecting to Sign In.');
      const toast = await toastController.create({
        message: 'Please sign in or create an account to message this member.',
        duration: 2500,
        position: 'top',
        color: 'warning'
      });
      await toast.present();
      router.push('/auth');
      return;
    }

    if (isOwnProfile.value || uid.value === session.uid) {
      console.warn('[PublicProfile] Cannot message own profile.');
      const toast = await toastController.create({
        message: 'Unable to start conversation.',
        duration: 2500,
        position: 'top',
        color: 'medium'
      });
      await toast.present();
      return;
    }

    const targetUid = uid.value;
    if (!targetUid || typeof targetUid !== 'string' || targetUid.trim() === '') {
      console.error('[PublicProfile] Target profile UID missing or invalid.');
      const toast = await toastController.create({
        message: 'Unable to start conversation.',
        duration: 2500,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
      return;
    }

    const conv = await createOrGetConversation({
      otherUserId: targetUid,
      postId: null,
      threadId: 'general'
    });

    if (conv && conv.id) {
      await router.push(`/chat/${conv.id}?thread=general`);
    } else {
      throw new Error('Unable to start conversation.');
    }
  } catch (err: any) {
    console.error('[PublicProfile] Failed to start conversation with user:', err);
    const toast = await toastController.create({
      message: err.message || 'Unable to start conversation.',
      duration: 3000,
      position: 'top',
      color: 'danger'
    });
    await toast.present();
  } finally {
    creatingChat.value = false;
  }
};
</script>

<style scoped>
.public-content {
  --background: var(--app-bg);
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
  padding: 16px 16px calc(100px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
  width: 100%;
}

/* 1. Modern Profile Hero Card */
.public-hero-card {
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

/* Clean Inline Stats Row */
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

/* Strong High-Contrast Full-Width Pill CTA Button */
.hero-cta-btn {
  width: 100%;
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
}

.hero-cta-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.hero-cta-btn:active {
  transform: scale(0.985);
  opacity: 0.88;
}

.hero-cta-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.cta-icon {
  flex-shrink: 0;
}

.chat-spinner {
  width: 18px;
  height: 18px;
  --color: currentColor;
}

/* Member Posts Heading & Category Filter Tabs */
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

/* User Posts List & Empty State */
.user-posts-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-user-posts {
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

.dock-spacer {
  height: 20px;
}
</style>
