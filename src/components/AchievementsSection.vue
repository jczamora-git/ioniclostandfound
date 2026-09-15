<template>
  <section class="achievements-section" aria-label="Community Achievements">
    <!-- Header -->
    <div class="achievements-header">
      <h2 class="section-title">Achievements</h2>
      <span v-if="meritCount > 0" class="merits-count-badge">
        {{ meritCount }} {{ meritCount === 1 ? 'Merit' : 'Merits' }}
      </span>
    </div>

    <!-- Compact Empty State -->
    <div v-if="meritCount === 0" class="achievements-empty-row">
      <div class="empty-icon-bubble">
        <Medal :size="20" />
      </div>
      <div class="empty-text-wrap">
        <span class="empty-title">No verified merits yet</span>
        <p class="empty-desc">
          Help return or recover items to earn community merits.
        </p>
      </div>
    </div>

    <!-- Active Achievements Display -->
    <div v-else class="achievements-content">
      <!-- Highest Unlocked Rank Card -->
      <div v-if="highestTier" class="highest-rank-card">
        <div class="rank-icon-bubble">
          <component :is="getTierIcon(highestTier.iconName)" :size="22" />
        </div>
        <div class="rank-info">
          <div class="rank-title-row">
            <span class="rank-name">{{ highestTier.name }}</span>
            <span class="verified-pill">Verified</span>
          </div>
          <span class="rank-merits-sub">
            {{ meritCount }} verified community {{ meritCount === 1 ? 'merit' : 'merits' }}
          </span>
        </div>
      </div>

      <!-- Badge Chips Row -->
      <div class="badge-chips-row">
        <div
          v-for="badge in userBadges"
          :key="badge.tier.id"
          class="badge-chip"
          :class="{ unlocked: badge.unlocked }"
        >
          <component :is="getTierIcon(badge.tier.iconName)" :size="13" class="chip-icon" />
          <span class="chip-label">{{ badge.tier.name }}</span>
          <span v-if="badge.unlocked" class="chip-check">✓</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Medal, Award, BadgeCheck, Trophy } from 'lucide-vue-next';
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
  gap: 10px;
}

.achievements-header {
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

.merits-count-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary, #2f9fe8);
  background: var(--app-primary-soft, rgba(47, 159, 232, 0.12));
  padding: 2px 8px;
  border-radius: 10px;
}

/* Compact Empty Row */
.achievements-empty-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  border-radius: 14px;
}

.empty-icon-bubble {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.empty-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.empty-desc {
  margin: 0;
  font-size: 11.5px;
  color: var(--app-text-secondary);
  line-height: 1.35;
}

/* Content */
.achievements-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Highest Rank Card */
.highest-rank-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  border-radius: 14px;
}

.rank-icon-bubble {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #fef3c7;
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  gap: 6px;
}

.rank-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.verified-pill {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #059669;
  background: #d1fae5;
  padding: 1px 5px;
  border-radius: 4px;
}

.rank-merits-sub {
  font-size: 12px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

/* Badge Chips Row */
.badge-chips-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  background: var(--app-surface-secondary);
  color: var(--app-text-tertiary);
  border: 1px solid var(--app-card-border);
  transition: all 0.15s ease;
}

.badge-chip.unlocked {
  background: var(--app-primary-soft, rgba(47, 159, 232, 0.1));
  color: var(--app-primary, #2f9fe8);
  border-color: rgba(47, 159, 232, 0.25);
  font-weight: 600;
}

.chip-icon {
  flex-shrink: 0;
}

.chip-check {
  font-size: 10px;
  margin-left: 2px;
  font-weight: 700;
}
</style>
