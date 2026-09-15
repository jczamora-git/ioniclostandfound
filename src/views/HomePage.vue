<template>
  <ion-page>
    <!-- Fixed Home Header with Notifications, Search, and Filter -->
    <ion-header class="ion-no-border home-ion-header">
      <ion-toolbar class="home-ion-toolbar">
        <div class="header-inner-box">
          <header class="home-top-bar">
            <div v-if="!isSearchActive" class="brand-bar-row">
              <h1 class="home-brand-title">Lost &amp; Found</h1>
              <div class="header-actions-wrap">
                <button
                  type="button"
                  class="header-icon-btn bell-btn"
                  aria-label="Notifications"
                  @click="showNotificationsModal = true"
                >
                  <Bell :size="21" />
                  <span
                    v-if="unreadCount > 0"
                    class="bell-unread-badge"
                    aria-label="Unread notifications count"
                  >
                    {{ unreadBadgeFormatted }}
                  </span>
                </button>
                <button
                  type="button"
                  class="header-icon-btn"
                  aria-label="Search lost and found posts"
                  @click="openSearch"
                >
                  <Search :size="21" />
                </button>
                <button
                  type="button"
                  class="header-icon-btn filter-btn"
                  :class="{ active: hasActiveFilters }"
                  :aria-label="filterButtonLabel"
                  aria-haspopup="dialog"
                  :aria-expanded="showFilterSheet"
                  @click="showFilterSheet = true"
                >
                  <SlidersHorizontal :size="20" />
                  <span v-if="hasActiveFilters" class="filter-active-count" aria-hidden="true">
                    {{ activeFilterCount }}
                  </span>
                </button>
              </div>
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
                aria-label="Search lost and found posts"
                autocomplete="off"
              />
              <button
                type="button"
                class="header-icon-btn filter-btn"
                :class="{ active: hasActiveFilters }"
                :aria-label="filterButtonLabel"
                aria-haspopup="dialog"
                :aria-expanded="showFilterSheet"
                @click="showFilterSheet = true"
              >
                <SlidersHorizontal :size="20" />
                <span v-if="hasActiveFilters" class="filter-active-count" aria-hidden="true">
                  {{ activeFilterCount }}
                </span>
              </button>
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
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="feed-content">
      <!-- Native iOS Pull-To-Refresh -->
      <ion-refresher slot="fixed" @ion-refresh="handleRefresh">
        <ion-refresher-content pulling-icon="arrow-down" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="ios-screen-container modern-container">
        <!-- Active Filter Removable Chips (Only shown when advanced filters are active) -->
        <div v-if="activeChips.length > 0" class="active-filter-chips-row">
          <button
            v-for="chip in activeChips"
            :key="chip.id"
            type="button"
            class="active-chip-pill"
            :aria-label="`Remove ${chip.label} filter`"
            @click="removeChip(chip)"
          >
            <span>{{ chip.label }}</span>
            <X :size="12" class="chip-x-icon" />
          </button>
          <button
            type="button"
            class="clear-all-chips-btn"
            @click="clearAllFilters"
          >
            Clear all
          </button>
        </div>

        <!-- Social Category Filter Pills -->
        <section class="categories-section" aria-label="Filter posts">
          <div class="compact-filter-row" role="tablist">
            <button
              v-for="tab in filterTabs"
              :key="tab.value"
              type="button"
              role="tab"
              class="compact-filter-pill"
              :class="{ active: appliedFilters.type === tab.value }"
              :aria-selected="appliedFilters.type === tab.value"
              @click="appliedFilters.type = tab.value"
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
              {{ appliedFilters.type === 'All' ? 'Recent Posts' : `${appliedFilters.type} Posts` }}
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

        <div
          v-else-if="filteredPosts.length === 0 && hasActiveFilters"
          class="feed-empty-state"
        >
          <SlidersHorizontal :size="32" />
          <h3 class="empty-title">No matching posts</h3>
          <p class="empty-sub">Try another category or clear your filters to see more posts.</p>
          <button type="button" class="empty-action-btn" @click="clearAllFilters">
            Clear Filters
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
          />
        </div>

        <!-- Bottom Spacing for Floating Dock -->
        <div class="dock-spacer"></div>
      </div>
    </ion-content>

    <FilterSheetModal
      :is-open="showFilterSheet"
      :applied-filters="appliedFilters"
      @close="showFilterSheet = false"
      @apply="applyFilters"
    />

    <!-- Create Post Modal when triggered from empty state -->
    <PostComposerModal
      :is-open="showComposer"
      :publishing="publishingPost"
      initial-type="lost"
      @close="showComposer = false"
      @submit="handleDirectCreate"
    />

    <!-- Notifications Sheet Modal -->
    <NotificationsModal
      :is-open="showNotificationsModal"
      @close="showNotificationsModal = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watchEffect, type Component } from "vue";
import {
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonToolbar,
  toastController
} from "@ionic/vue";
import {
  Bell,
  LayoutGrid,
  CircleHelp,
  SearchCheck,
  BadgeCheck,
  Search,
  X,
  AlertCircle,
  Inbox,
  SlidersHorizontal
} from "lucide-vue-next";
import PostCard from "../components/PostCard.vue";
import PostCardSkeleton from "../components/PostCardSkeleton.vue";
import PostComposerModal from "../components/PostComposerModal.vue";
import FilterSheetModal from "../components/FilterSheetModal.vue";
import NotificationsModal from "../components/NotificationsModal.vue";
import { useCategories } from "../composables/useCategories";
import { usePosts } from "../composables/usePosts";
import { useNotifications } from "../composables/useNotifications";
import { useProfiles } from "../composables/useProfiles";
import { normalizeCategoryKey } from "../config/categories";
import type { Post, PostFilter, PostFilters, PostFormData } from "../types/post";

const {
  postsLoading,
  postsError,
  subscribeToPosts,
  getFilteredPosts,
  toggleHelpful,
  isHelpfulByMe,
  createPost
} = usePosts();
const { loadProfiles } = useProfiles();
const { getSubcategoriesForCategory } = useCategories();
const { unreadCount } = useNotifications();

const showNotificationsModal = ref(false);

const unreadBadgeFormatted = computed(() => {
  if (unreadCount.value <= 0) return "";
  if (unreadCount.value > 99) return "99+";
  return String(unreadCount.value);
});

const searchQuery = ref("");
const showFilterSheet = ref(false);
const appliedFilters = ref<PostFilters>({
  type: "All",
  categories: [],
  subcategories: []
});
const isSearchActive = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

const openSearch = async () => {
  isSearchActive.value = true;
  await nextTick();
  searchInputRef.value?.focus();
};

const closeSearch = () => {
  searchQuery.value = "";
  isSearchActive.value = false;
};

interface FilterTabItem {
  value: PostFilter;
  label: string;
  icon: Component;
}

const filterTabs: FilterTabItem[] = [
  { value: "All", label: "All", icon: LayoutGrid },
  { value: "Lost", label: "Lost", icon: CircleHelp },
  { value: "Found", label: "Found", icon: SearchCheck },
  { value: "Resolved", label: "Resolved", icon: BadgeCheck }
];

const showComposer = ref(false);
const publishingPost = ref(false);

interface FilterChip {
  id: string;
  group: "category" | "subcategory";
  label: string;
}

const activeFilterCount = computed(() =>
  (appliedFilters.value.type === "All" ? 0 : 1)
  + appliedFilters.value.categories.length
  + appliedFilters.value.subcategories.length
);
const hasActiveFilters = computed(() => activeFilterCount.value > 0);
const filterButtonLabel = computed(() => hasActiveFilters.value
  ? `Filter posts, ${activeFilterCount.value} active`
  : "Filter posts"
);

const activeChips = computed<FilterChip[]>(() => [
  ...appliedFilters.value.categories.map((label) => ({
    id: `category:${normalizeCategoryKey(label)}`,
    group: "category" as const,
    label
  })),
  ...appliedFilters.value.subcategories.map((label) => ({
    id: `subcategory:${normalizeCategoryKey(label)}`,
    group: "subcategory" as const,
    label
  }))
]);

const removeChip = (chip: FilterChip) => {
  const key = normalizeCategoryKey(chip.label);
  if (chip.group === "subcategory") {
    appliedFilters.value.subcategories = appliedFilters.value.subcategories.filter(
      (name) => normalizeCategoryKey(name) !== key
    );
    return;
  }

  appliedFilters.value.categories = appliedFilters.value.categories.filter(
    (name) => normalizeCategoryKey(name) !== key
  );
  const allowedSubcategories = new Set(
    appliedFilters.value.categories.flatMap(getSubcategoriesForCategory).map(normalizeCategoryKey)
  );
  appliedFilters.value.subcategories = appliedFilters.value.subcategories.filter(
    (name) => allowedSubcategories.has(normalizeCategoryKey(name))
  );
};

const clearAllFilters = () => {
  appliedFilters.value = { type: "All", categories: [], subcategories: [] };
};

const applyFilters = (filters: PostFilters) => {
  appliedFilters.value = {
    type: filters.type,
    categories: [...filters.categories],
    subcategories: [...filters.subcategories]
  };
  showFilterSheet.value = false;
};

onMounted(() => {
  subscribeToPosts();
});

const filteredPosts = computed(() => {
  return getFilteredPosts(appliedFilters.value.type, searchQuery.value, appliedFilters.value);
});

watchEffect(() => {
  if (filteredPosts.value && filteredPosts.value.length > 0) {
    loadProfiles(filteredPosts.value.map((p) => p.authorId));
  }
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

const openCreateComposer = () => {
  showComposer.value = true;
};

const handleDirectCreate = async (data: PostFormData) => {
  if (publishingPost.value) return;
  publishingPost.value = true;
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
  } finally {
    publishingPost.value = false;
  }
};
</script>

<style scoped>
.feed-content {
  --background: var(--app-bg);
}

.home-ion-header {
  background: var(--app-bg);
  border-bottom: 1px solid var(--app-card-border);
  z-index: 100;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.home-ion-toolbar {
  --background: var(--app-bg);
  --border-width: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --padding-start: 0;
  --padding-end: 0;
  --min-height: 56px;
}

.header-inner-box {
  width: 100%;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
  padding: 0 16px;
  box-sizing: border-box;
}

.modern-container {
  padding: 12px 16px calc(100px + env(safe-area-inset-bottom, 0px));
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
  background: transparent;
  box-sizing: border-box;
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

.header-actions-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
}

.header-icon-btn {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--app-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease;
}

.header-icon-btn:active {
  opacity: 0.7;
}

.bell-unread-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background-color: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  border: 1.5px solid var(--app-bg, #ffffff);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  letter-spacing: -0.3px;
}

.filter-btn.active {
  color: var(--app-primary);
  background: var(--app-primary-soft);
}

.filter-active-count {
  position: absolute;
  top: 0;
  right: -2px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--app-primary);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.active-filter-chips-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.active-chip-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: 12px;
  cursor: pointer;
}

.chip-x-icon {
  flex-shrink: 0;
}

.clear-all-chips-btn {
  padding: 6px;
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  font-size: 12px;
  cursor: pointer;
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
  min-width: 0;
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

.expanded-search-bar .header-icon-btn {
  width: 34px;
  height: 34px;
}

.close-search-btn {
  flex-shrink: 0;
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
