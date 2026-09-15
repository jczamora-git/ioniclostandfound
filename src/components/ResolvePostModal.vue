<template>
  <ion-modal
    :is-open="isOpen"
    :breakpoints="[0, 0.85, 1]"
    :initial-breakpoint="0.85"
    class="resolve-post-modal"
    @did-dismiss="handleClose"
  >
    <div class="resolve-sheet-container">
      <!-- Modal Header -->
      <header class="resolve-header">
        <div class="header-titles">
          <h2 class="resolve-title">Mark as Resolved</h2>
          <p class="resolve-sub">Did someone from the community help you?</p>
        </div>
        <button
          type="button"
          class="close-sheet-btn"
          aria-label="Close"
          @click="handleClose"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Sheet Scroll Content -->
      <div class="resolve-body">
        <!-- Selected Member Card (If chosen) -->
        <div v-if="selectedMember" class="selected-member-card">
          <div class="selected-badge-tag">
            <Award :size="14" />
            <span>Credited Community Member</span>
          </div>
          <div class="selected-member-row">
            <UserAvatar
              :name="selectedMember.name"
              :username="selectedMember.username"
              :avatar-url="selectedMember.avatarUrl"
              size="md"
            />
            <div class="selected-meta">
              <span class="member-name">{{ selectedMember.name }}</span>
              <span class="member-handle">@{{ selectedMember.username }}</span>
            </div>
            <button
              type="button"
              class="remove-selected-btn"
              aria-label="Remove helper"
              @click="selectedMember = null"
            >
              <X :size="16" />
            </button>
          </div>
          <p class="merit-notice">
            They will receive 1 verified Community Merit toward their badge rank.
          </p>
        </div>

        <!-- Member Selector Section (If none selected) -->
        <div v-else class="member-selection-block">
          <!-- Search Bar -->
          <div class="member-search-bar">
            <Search :size="16" class="search-icon" />
            <input
              v-model="searchQuery"
              type="search"
              class="member-search-input"
              placeholder="Search member by name or @username..."
              autocomplete="off"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="clear-search-btn"
              @click="searchQuery = ''"
            >
              <X :size="14" />
            </button>
          </div>

          <!-- Section: Relevant / Recent Community Members -->
          <div class="candidates-section">
            <span class="candidates-heading">
              {{ searchQuery.trim() ? 'Search Results' : 'Suggested Members' }}
            </span>

            <div v-if="loadingCandidates" class="candidates-loading">
              <ion-spinner name="crescent" />
              <span>Finding members...</span>
            </div>

            <div v-else-if="filteredCandidates.length === 0" class="candidates-empty">
              <span v-if="searchQuery.trim()">No members found matching "{{ searchQuery }}".</span>
              <span v-else>No direct post commenters found. Search a member above.</span>
            </div>

            <div v-else class="candidates-list">
              <button
                v-for="cand in filteredCandidates"
                :key="cand.id"
                type="button"
                class="candidate-row-btn"
                @click="selectCandidate(cand)"
              >
                <UserAvatar
                  :name="cand.name"
                  :username="cand.username"
                  :avatar-url="cand.avatarUrl"
                  size="sm"
                />
                <div class="candidate-meta">
                  <span class="candidate-name">{{ cand.name }}</span>
                  <span class="candidate-handle">@{{ cand.username }}</span>
                </div>
                <span v-if="cand.source" class="candidate-badge">{{ cand.source }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Optional: Resolve Without Community Member -->
        <div class="no-member-option-row">
          <button
            type="button"
            class="no-member-btn"
            :class="{ active: selectedMember === null }"
            @click="selectedMember = null"
          >
            <div class="radio-circle" :class="{ checked: selectedMember === null }">
              <div v-if="selectedMember === null" class="radio-dot"></div>
            </div>
            <span>No community member / Resolve only</span>
          </button>
        </div>
      </div>

      <!-- Footer Buttons -->
      <footer class="resolve-footer">
        <button
          type="button"
          class="cancel-btn"
          :disabled="resolving"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          type="button"
          class="confirm-resolve-btn"
          :disabled="resolving"
          @click="handleConfirm"
        >
          <ion-spinner v-if="resolving" name="crescent" class="btn-spinner" />
          <span v-else-if="selectedMember">Award Merit &amp; Resolve</span>
          <span v-else>Resolve Post</span>
        </button>
      </footer>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { IonModal, IonSpinner } from '@ionic/vue';
import { Search, X, Award } from 'lucide-vue-next';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import UserAvatar from './UserAvatar.vue';
import { useAuth } from '../composables/useAuth';
import type { Post } from '../types/post';
import type { PostComment } from '../types/comment';

interface CandidateMember {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  source?: string;
}

const props = defineProps<{
  isOpen: boolean;
  post: Post;
  comments?: PostComment[];
  resolving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', recipientId: string | null): void;
}>();

const { currentProfile } = useAuth();
const searchQuery = ref('');
const selectedMember = ref<CandidateMember | null>(null);
const allProfiles = ref<CandidateMember[]>([]);
const loadingCandidates = ref(false);

const loadSuggestedMembers = async () => {
  loadingCandidates.value = true;
  try {
    const snap = await get(dbRef(db, 'profiles'));
    if (snap.exists()) {
      const val = snap.val();
      const list: CandidateMember[] = [];
      const myId = currentProfile.value?.id || props.post.authorId;

      Object.entries(val).forEach(([uid, item]: [string, any]) => {
        if (uid && uid !== myId && uid !== 'anonymous') {
          list.push({
            id: uid,
            name: item.name || 'Community Member',
            username: item.username || 'user',
            avatarUrl: item.avatarUrl || null
          });
        }
      });
      allProfiles.value = list;
    }
  } catch (err) {
    console.warn('[ResolvePostModal] Could not load profiles:', err);
  } finally {
    loadingCandidates.value = false;
  }
};

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      selectedMember.value = null;
      searchQuery.value = '';
      loadSuggestedMembers();
    }
  }
);

const relevantCommenters = computed<CandidateMember[]>(() => {
  if (!props.comments || props.comments.length === 0) return [];
  const map = new Map<string, CandidateMember>();
  const myId = currentProfile.value?.id || props.post.authorId;

  props.comments.forEach((c) => {
    if (c.authorId && c.authorId !== myId && !map.has(c.authorId)) {
      // Find latest profile if loaded
      const matched = allProfiles.value.find((p) => p.id === c.authorId);
      map.set(c.authorId, {
        id: c.authorId,
        name: matched?.name || c.authorName || 'Community Member',
        username: matched?.username || c.authorUsername || 'user',
        avatarUrl: matched?.avatarUrl || null,
        source: 'Commenter'
      });
    }
  });

  return Array.from(map.values());
});

const filteredCandidates = computed<CandidateMember[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const myId = currentProfile.value?.id || props.post.authorId;

  if (query) {
    return allProfiles.value
      .filter((p) => {
        if (p.id === myId) return false;
        return (
          p.name.toLowerCase().includes(query) ||
          p.username.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  }

  // If no search query, show relevant commenters first, then up to 5 other members
  const commenters = relevantCommenters.value;
  const commenterIds = new Set(commenters.map((c) => c.id));
  const others = allProfiles.value
    .filter((p) => p.id !== myId && !commenterIds.has(p.id))
    .slice(0, 5);

  return [...commenters, ...others];
});

const selectCandidate = (cand: CandidateMember) => {
  selectedMember.value = cand;
};

const handleClose = () => {
  emit('close');
};

const handleConfirm = () => {
  emit('confirm', selectedMember.value?.id || null);
};
</script>

<style scoped>
.resolve-post-modal {
  --background: var(--app-surface, #ffffff);
  --border-radius: 24px 24px 0 0;
}

.resolve-sheet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-surface, #ffffff);
  color: var(--app-text-primary, #0f172a);
}

.resolve-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--app-card-border, #e2e8f0);
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resolve-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: var(--app-text-primary, #0f172a);
  letter-spacing: -0.3px;
}

.resolve-sub {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary, #64748b);
}

.close-sheet-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--app-surface-secondary, #f1f5f9);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary, #64748b);
  cursor: pointer;
}

.resolve-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Selected Member Box */
.selected-member-card {
  background: var(--app-primary-soft, #ddf3ff);
  border: 1px solid rgba(47, 159, 232, 0.3);
  border-radius: 16px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selected-badge-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-primary, #2f9fe8);
  font-size: 12px;
  font-weight: 700;
}

.selected-member-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text-primary, #0f172a);
}

.member-handle {
  font-size: 13px;
  color: var(--app-text-secondary, #64748b);
}

.remove-selected-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.06);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary, #64748b);
  cursor: pointer;
}

.merit-notice {
  margin: 0;
  font-size: 12px;
  color: var(--app-primary-deep, #0e4a9e);
  line-height: 1.4;
  font-weight: 500;
}

/* Member Selector */
.member-selection-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-surface-secondary, #f8fafc);
  border: 1px solid var(--app-card-border, #e2e8f0);
  border-radius: 12px;
  padding: 0 12px;
  height: 42px;
}

.search-icon {
  color: var(--app-text-tertiary, #94a3b8);
  flex-shrink: 0;
}

.member-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--app-text-primary, #0f172a);
}

.clear-search-btn {
  background: transparent;
  border: none;
  color: var(--app-text-tertiary, #94a3b8);
  cursor: pointer;
  padding: 4px;
}

.candidates-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.candidates-heading {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--app-text-tertiary, #94a3b8);
}

.candidates-loading,
.candidates-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--app-text-secondary, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.candidates-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
}

.candidate-row-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.candidate-row-btn:hover {
  background: var(--app-surface-secondary, #f8fafc);
  border-color: var(--app-card-border, #e2e8f0);
}

.candidate-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.candidate-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary, #0f172a);
}

.candidate-handle {
  font-size: 12px;
  color: var(--app-text-secondary, #64748b);
}

.candidate-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--app-primary, #2f9fe8);
  background: var(--app-primary-soft, #ddf3ff);
  padding: 2px 6px;
  border-radius: 6px;
}

/* No member option */
.no-member-option-row {
  border-top: 1px solid var(--app-card-border, #e2e8f0);
  padding-top: 12px;
}

.no-member-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text-secondary, #64748b);
  cursor: pointer;
  padding: 6px 0;
}

.radio-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--app-card-border, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-circle.checked {
  border-color: var(--app-primary, #2f9fe8);
}

.radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--app-primary, #2f9fe8);
}

/* Footer Buttons */
.resolve-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px max(16px, env(safe-area-inset-bottom, 16px));
  border-top: 1px solid var(--app-card-border, #e2e8f0);
}

.cancel-btn {
  flex: 1;
  height: 46px;
  border-radius: 12px;
  background: var(--app-surface-secondary, #f1f5f9);
  border: 1px solid var(--app-card-border, #e2e8f0);
  color: var(--app-text-secondary, #64748b);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.confirm-resolve-btn {
  flex: 2;
  height: 46px;
  border-radius: 12px;
  background: var(--app-primary, #2f9fe8);
  border: none;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.confirm-resolve-btn:hover {
  background: var(--app-primary-deep, #0e4a9e);
}

.confirm-resolve-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  --color: #ffffff;
}
</style>
