<template>
  <ion-page>
    <ion-content :fullscreen="true" class="feed-content">
      <!-- Native iOS Pull-To-Refresh -->
      <ion-refresher slot="fixed" @ion-refresh="handleRefresh">
        <ion-refresher-content pulling-icon="arrow-down" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="ios-screen-container modern-container">
        <!-- Minimal Social Header with Expandable Search -->
        <header class="home-top-bar">
          <div v-if="!isSearchActive" class="brand-bar-row">
            <h1 class="home-brand-title">Lost &amp; Found</h1>
            <button
              type="button"
              class="search-toggle-btn"
              aria-label="Search lost and found posts"
              @click="openSearch"
            >
              <Search :size="22" />
            </button>
          </div>

          <!-- Expanded Search Row -->
          <div v-else class="expanded-search-bar">
            <Search :size="18" class="search-leading-icon" aria-hidden="true" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="search"
              class="search-input"
              placeholder="Search lost &amp; found posts..."
              autocomplete="off"
            />
            <button
              type="button"
              class="close-search-btn"
              aria-label="Close search"
              @click="closeSearch"
            >
              <X :size="18" />
            </button>
          </div>
        </header>

        <!-- Social Category Filter Pills -->
        <section class="categories-section" aria-label="Filter posts">
          <div class="compact-filter-row" role="tablist">
            <button
              v-for="tab in filterTabs"
              :key="tab.value"
              type="button"
              role="tab"
              class="compact-filter-pill"
              :class="{ active: activeFilter === tab.value }"
              :aria-selected="activeFilter === tab.value"
              @click="activeFilter = tab.value"
            >
              <component :is="tab.icon" :size="15" class="pill-icon" />
              <span>{{ tab.label }}</span>
            </button>
          </div>
        </section>

        <!-- Feed Section Heading -->
        <div class="feed-section-header">
          <div class="feed-title-block">
            <h2 class="feed-title">
              {{ activeFilter === 'All' ? 'Recent Posts' : `${activeFilter} Posts` }}
            </h2>
            <span class="feed-pill-badge">
              {{ filteredPosts.length }}
            </span>
          </div>
        </div>

        <!-- Skeleton Loading State -->
        <div v-if="postsLoading" class="feed-list">
          <PostCardSkeleton :count="3" />
        </div>

        <!-- Error State -->
        <div v-else-if="postsError" class="feed-error-box">
          <AlertCircle :size="32" class="error-icon" />
          <p class="error-title">Couldn't load feed</p>
          <p class="error-sub">{{ postsError }}</p>
          <button type="button" class="retry-btn" @click="subscribeToPosts">
            Retry
          </button>
        </div>

        <!-- Empty State: Search Results -->
        <div
          v-else-if="filteredPosts.length === 0 && searchQuery.trim()"
          class="feed-empty-state"
        >
          <div class="empty-icon-wrap">
            <Search :size="28" />
          </div>
          <h3 class="empty-title">No posts found</h3>
          <p class="empty-sub">
            No items matching "{{ searchQuery }}". Try checking your spelling or another filter.
          </p>
          <button type="button" class="empty-action-btn" @click="searchQuery = ''">
            Clear Search
          </button>
        </div>

        <!-- Empty State: Clean Feed (No logo on Home) -->
        <div
          v-else-if="filteredPosts.length === 0"
          class="feed-empty-state"
        >
          <Inbox :size="40" class="empty-feed-icon" />
          <h3 class="empty-title">No posts yet</h3>
          <p class="empty-sub">Start the community by posting a lost or found item.</p>
          <button
            type="button"
            class="empty-action-btn primary"
            @click="openCreateComposer"
          >
            Create Post
          </button>
        </div>

        <!-- Posts Timeline Feed -->
        <div v-else class="feed-list">
          <PostCard
            v-for="post in filteredPosts"
            :key="post.id"
            :post="post"
            :is-helpful="isHelpfulByMe(post.id)"
            @toggle-helpful="handleToggleHelpful"
            @share="handleSharePost"
          />
        </div>

        <!-- Bottom Spacing for Floating Dock -->
        <div class="dock-spacer"></div>
      </div>
    </ion-content>

    <!-- Create Post Modal when triggered from empty state -->
    <PostComposerModal
      :is-open="showComposer"
      initial-type="lost"
      @close="showComposer = false"
      @submit="handleDirectCreate"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  toastController
} from "@ionic/vue";
import {
  LayoutGrid,
  CircleHelp,
  SearchCheck,
  BadgeCheck,
  Search,
  X,
  AlertCircle,
  Inbox
} from "lucide-vue-next";
import PostCard from "../components/PostCard.vue";
import PostCardSkeleton from "../components/PostCardSkeleton.vue";
import PostComposerModal from "../components/PostComposerModal.vue";
import { usePosts } from "../composables/usePosts";
import type { Post, PostFilter, PostFormData } from "../types/post";

const router = useRouter();
const {
  postsLoading,
  postsError,
  subscribeToPosts,
  getFilteredPosts,
  toggleHelpful,
  isHelpfulByMe,
  createPost
} = usePosts();

const searchQuery = ref("");
const activeFilter = ref<PostFilter>("All");
const isSearchActive = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

const openSearch = () => {
  isSearchActive.value = true;
  setTimeout(() => {
    searchInputRef.value?.focus();
  }, 60);
};

const closeSearch = () => {
  searchQuery.value = "";
  isSearchActive.value = false;
};

interface FilterTabItem {
  value: PostFilter;
  label: string;
  icon: any;
}

const filterTabs: FilterTabItem[] = [
  { value: "All", label: "All", icon: LayoutGrid },
  { value: "Lost", label: "Lost", icon: CircleHelp },
  { value: "Found", label: "Found", icon: SearchCheck },
  { value: "Resolved", label: "Resolved", icon: BadgeCheck }
];

const showComposer = ref(false);

onMounted(() => {
  subscribeToPosts();
});

const filteredPosts = computed(() => {
  return getFilteredPosts(activeFilter.value, searchQuery.value);
});

const handleRefresh = async (event: CustomEvent) => {
  subscribeToPosts();
  setTimeout(() => {
    event.detail.complete();
  }, 600);
};

const handleToggleHelpful = async (postId: string) => {
  await toggleHelpful(postId);
};

const handleSharePost = async (post: Post) => {
  const shareData = {
    title: `${post.type.toUpperCase()}: ${post.title}`,
    text: `${post.title} — ${post.location}. Found/Lost on ${post.eventDate}. Check Lost & Found forum.`,
    url: window.location.origin + `/post/${post.id}`
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e: any) {
      if (e.name === "AbortError") return;
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(
      `${shareData.title}\n${shareData.text}\n${shareData.url}`
    );
    const toast = await toastController.create({
      message: "Post link copied to clipboard!",
      duration: 2000,
      position: "top",
      color: "success"
    });
    await toast.present();
  } catch {
    const toast = await toastController.create({
      message: "Could not share at this time.",
      duration: 2000,
      position: "top",
      color: "warning"
    });
    await toast.present();
  }
};

const openCreateComposer = () => {
  showComposer.value = true;
};

const handleDirectCreate = async (data: PostFormData) => {
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
.feed-content {
  --background: var(--app-bg);
}

.modern-container {
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px 100px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
}

/* Minimal Social Top Bar */
.home-top-bar {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--app-card-border);
  padding-bottom: 8px;
}

.brand-bar-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home-brand-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--app-text-primary);
  line-height: 1.2;
}

.search-toggle-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--app-text-primary);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease;
}

.search-toggle-btn:active {
  opacity: 0.7;
}

/* Expanded Search Input Bar */
.expanded-search-bar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--app-surface);
  border-radius: 14px;
  height: 46px;
  padding: 0 12px 0 14px;
  border: 1px solid var(--app-card-border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  transition: border-color 0.2s ease;
}

.expanded-search-bar:focus-within {
  border-color: var(--app-primary);
}

.search-leading-icon {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 15px;
  color: var(--app-text-primary);
  outline: none;
  font-family: inherit;
  padding: 0;
}

.search-input::placeholder {
  color: var(--app-text-tertiary);
}

.close-search-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--app-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.close-search-btn:active {
  background: var(--app-surface-secondary);
}

/* Categories / Social Filter Pills */
.categories-section {
  width: 100%;
}

.compact-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.compact-filter-row::-webkit-scrollbar {
  display: none;
}

.compact-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-secondary);
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s ease;
}

.compact-filter-pill:active {
  transform: scale(0.96);
}

.compact-filter-pill.active {
  background: var(--app-primary-soft, #DDF3FF);
  color: var(--app-primary, #2F9FE8);
  border-color: rgba(47, 159, 232, 0.35);
  font-weight: 600;
}

.pill-icon {
  flex-shrink: 0;
}

/* Section Header: Recent Posts */
.feed-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  margin-top: 4px;
}

.feed-title-block {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feed-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--app-text-primary);
}

.feed-pill-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
  background: var(--app-primary-soft);
  padding: 2px 8px;
  border-radius: 12px;
}

/* Timeline Feed */
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Empty State */
.feed-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  background: var(--app-surface);
  border-radius: 22px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
  gap: 8px;
}

.empty-brand-logo {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  margin-bottom: 8px;
}

.empty-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: var(--app-surface-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  color: var(--app-text-secondary);
}

.empty-icon-wrap ion-icon {
  font-size: 28px;
  color: var(--app-text-secondary);
}

.empty-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.empty-sub {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-secondary);
  max-width: 280px;
  line-height: 1.4;
}

.empty-action-btn {
  margin-top: 10px;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-separator);
  color: var(--app-text-primary);
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.empty-action-btn:active {
  transform: scale(0.96);
}

.empty-action-btn.primary {
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 14px rgba(47, 159, 232, 0.3);
}

/* Error Box */
.feed-error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  background: var(--app-surface);
  border-radius: 20px;
  border: 1px solid var(--app-card-border);
  text-align: center;
  gap: 6px;
}

.error-icon {
  font-size: 32px;
  color: var(--ion-color-danger);
}

.error-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.error-sub {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.retry-btn {
  margin-top: 10px;
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.dock-spacer {
  height: 70px;
}
</style>
