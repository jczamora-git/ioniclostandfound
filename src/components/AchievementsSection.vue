<template>
  <section class="achievements-section" aria-label="Community Achievements">
    <!-- Header -->
    <div class="achievements-header">
      <div class="header-left">
        <h2 class="section-title">Achievements</h2>
      </div>
      <span v-if="meritCount > 0" class="merits-count-badge">
        {{ meritCount }} {{ meritCount === 1 ? 'Community Merit' : 'Community Merits' }}
      </span>
    </div>

    <!-- Empty State -->
    <div v-if="meritCount === 0" class="achievements-empty">
      <div class="empty-icon-bubble">
        <Medal :size="24" />
      </div>
      <div class="empty-text-wrap">
        <span class="empty-title">No verified merits yet</span>
        <p class="empty-desc">
          Community merits are awarded by post owners when someone helps recover or return an item.
        </p>
      </div>
    </div>

    <!-- Achievements Display -->
    <div v-else class="achievements-content">
      <!-- Highest Unlocked Rank Card -->
      <div v-if="highestTier" class="highest-rank-card">
        <div class="rank-icon-bubble">
          <component :is="getTierIcon(highestTier.iconName)" :size="24" />
        </div>
        <div class="rank-info">
          <div class="rank-title-row">
            <span class="rank-name">{{ highestTier.name }}</span>
            <span class="verified-pill">Verified</span>
          </div>
          <p class="rank-desc">{{ highestTier.description }}</p>
        </div>
      </div>

      <!-- Tier Progression List -->
      <div class="tiers-list">
        <div
          v-for="badge in userBadges"
          :key="badge.tier.id"
          class="tier-row"
          :class="{ unlocked: badge.unlocked, 'is-highest': badge.isHighest }"
        >
          <div class="tier-icon-wrap" :class="{ active: badge.unlocked }">
            <component :is="getTierIcon(badge.tier.iconName)" :size="16" />
          </div>
          <div class="tier-meta">
            <div class="tier-name-row">
              <span class="tier-name">{{ badge.tier.name }}</span>
              <span class="tier-req">{{ badge.tier.minMerits }}+ merits</span>
            </div>
          </div>
          <div class="tier-status">
            <span v-if="badge.unlocked" class="tier-status-unlocked">
              <Check :size="14" />
              <span>Unlocked</span>
            </span>
            <span v-else class="tier-status-locked">
              <span>{{ meritCount }}/{{ badge.tier.minMerits }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Medal, Award, BadgeCheck, Trophy, Check } from 'lucide-vue-next';
import { useAchievements } from '../composables/useAchievements';

const props = defineProps<{
  userId: string;
}>();

const {
  subscribeToAchievements,
  getMeritCount,
  getUserBadges,
  getHighestTier
} = useAchievements();

onMounted(() => {
  subscribeToAchievements();
});

const meritCount = computed(() => getMeritCount(props.userId));
const userBadges = computed(() => getUserBadges(props.userId));
const highestTier = computed(() => getHighestTier(props.userId));

const getTierIcon = (iconName: string) => {
  switch (iconName) {
    case 'Award':
      return Award;
    case 'BadgeCheck':
      return BadgeCheck;
    case 'Trophy':
      return Trophy;
    case 'Medal':
    default:
      return Medal;
  }
};
</script>

<style scoped>
.achievements-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}

.achievements-header {
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

.merits-count-badge {
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
  background: #fef3c7;
  padding: 3px 9px;
  border-radius: 12px;
}

/* Empty State */
.achievements-empty {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
}

.empty-icon-bubble {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--app-surface-secondary);
  color: var(--app-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.empty-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.empty-desc {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.35;
}

/* Content */
.achievements-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Highest Rank Card */
.highest-rank-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(221, 243, 255, 0.6) 100%);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 18px;
}

.rank-icon-bubble {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #fef3c7;
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(217, 119, 6, 0.15);
}

.rank-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rank-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rank-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.verified-pill {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #059669;
  background: #d1fae5;
  padding: 1px 6px;
  border-radius: 6px;
}

.rank-desc {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-secondary);
  line-height: 1.35;
}

/* Tiers List */
.tiers-list {
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
  overflow: hidden;
}

.tier-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-card-border);
  transition: background-color 0.15s ease;
}

.tier-row:last-child {
  border-bottom: none;
}

.tier-row:not(.unlocked) {
  opacity: 0.55;
}

.tier-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--app-surface-secondary);
  color: var(--app-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tier-icon-wrap.active {
  background: #fef3c7;
  color: #d97706;
}

.tier-meta {
  flex: 1;
  min-width: 0;
}

.tier-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.tier-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.tier-req {
  font-size: 11px;
  color: var(--app-text-tertiary);
}

.tier-status {
  font-size: 12px;
  font-weight: 600;
}

.tier-status-unlocked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #059669;
}

.tier-status-locked {
  color: var(--app-text-tertiary);
  font-size: 11px;
}
</style>
