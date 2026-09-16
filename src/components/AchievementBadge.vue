<template>
  <span
    v-if="activeTier"
    class="achievement-badge-seal"
    :class="[tierClass, { 'has-text': showText }]"
    :title="badgeTooltip"
    :aria-label="badgeAriaLabel"
    role="img"
  >
    <component
      :is="tierIcon"
      :size="iconSize"
      class="badge-icon-svg"
      aria-hidden="true"
    />
    <span v-if="showText" class="badge-short-text">{{ activeTier.name }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Medal, Award, BadgeCheck, Trophy } from 'lucide-vue-next';
import {
  useAchievements,
  getHighestTier,
  getMeritCount
} from '../composables/useAchievements';
import { MERIT_TIERS, type MeritTier } from '../types/achievement';

const props = withDefaults(
  defineProps<{
    userId?: string | null;
    tier?: MeritTier | null;
    meritCount?: number;
    size?: number;
    showText?: boolean;
  }>(),
  {
    userId: undefined,
    tier: undefined,
    meritCount: undefined,
    size: 14,
    showText: false
  }
);

// Connect to shared achievements reactive cache
const { achievements } = useAchievements();

const count = computed(() => {
  if (typeof props.meritCount === 'number') return props.meritCount;
  if (props.userId) {
    // Access reactive cache so component updates dynamically on achievement load
    void achievements.value;
    return getMeritCount(props.userId);
  }
  return 0;
});

const activeTier = computed<MeritTier | null>(() => {
  if (props.tier !== undefined) return props.tier;
  if (props.userId) {
    void achievements.value;
    return getHighestTier(props.userId);
  }
  if (typeof props.meritCount === 'number') {
    for (let i = MERIT_TIERS.length - 1; i >= 0; i--) {
      if (props.meritCount >= MERIT_TIERS[i].minMerits) {
        return MERIT_TIERS[i];
      }
    }
  }
  return null;
});

const iconSize = computed(() => props.size || 14);

const tierClass = computed(() => {
  if (!activeTier.value) return '';
  return `tier-${activeTier.value.id}`;
});

const tierIcon = computed(() => {
  if (!activeTier.value) return Medal;
  switch (activeTier.value.iconName) {
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
});

const badgeTooltip = computed(() => {
  if (!activeTier.value) return '';
  const c = count.value;
  if (c > 0) {
    return `${activeTier.value.name} (${c} verified community ${c === 1 ? 'merit' : 'merits'})`;
  }
  return `${activeTier.value.name} (Verified Merit)`;
});

const badgeAriaLabel = computed(() => {
  if (!activeTier.value) return '';
  return `${activeTier.value.name} verified badge`;
});
</script>

<style scoped>
.achievement-badge-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 2px;
  box-sizing: border-box;
  user-select: none;
  transition: transform 0.15s ease, opacity 0.15s ease;
  position: relative;
}

.achievement-badge-seal:hover {
  transform: scale(1.1);
}

.badge-icon-svg {
  display: block;
  flex-shrink: 0;
}

/* Tier 1: Community Helper (1+ merits) - Warm Bronze/Amber Verified Accent */
.tier-tier1 {
  color: #d97706;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.28);
}

/* Tier 2: Good Samaritan (3+ merits) - Fresh Emerald Verified Accent */
.tier-tier2 {
  color: #059669;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.28);
}

/* Tier 3: Trusted Finder (5+ merits) - Premium Electric Blue Verified Accent */
.tier-tier3 {
  color: #0284c7;
  background: rgba(2, 132, 199, 0.12);
  border: 1px solid rgba(2, 132, 199, 0.32);
}

/* Tier 4: Community Hero (10+ merits) - Glorious Royal Gold Verified Accent */
.tier-tier4 {
  color: #b45309;
  background: rgba(251, 191, 36, 0.2);
  border: 1px solid rgba(217, 119, 6, 0.4);
}

/* Optional text variant */
.achievement-badge-seal.has-text {
  padding: 2px 6px;
  gap: 3px;
}

.badge-short-text {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: -0.1px;
  line-height: 1;
}
</style>
