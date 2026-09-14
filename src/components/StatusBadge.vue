<template>
  <div class="badge-wrapper">
    <!-- Type Pill -->
    <span
      class="type-pill"
      :class="type === 'found' ? 'pill-found' : 'pill-lost'"
    >
      <span class="pill-dot"></span>
      {{ type.toUpperCase() }}
    </span>

    <!-- Status Indicator if not open -->
    <span v-if="status === 'resolved'" class="status-pill status-resolved">
      <BadgeCheck :size="12" class="status-icon" aria-hidden="true" />
      RESOLVED
    </span>
    <span v-else-if="status === 'returned'" class="status-pill status-returned">
      <BadgeCheck :size="12" class="status-icon" aria-hidden="true" />
      RETURNED
    </span>
  </div>
</template>

<script setup lang="ts">
import { BadgeCheck } from "lucide-vue-next";
import type { PostStatus, PostType } from "../types/post";

defineProps<{
  type: PostType;
  status: PostStatus;
}>();
</script>

<style scoped>
.badge-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pill-lost {
  background: var(--status-lost-bg, rgba(240, 68, 68, 0.12));
  color: var(--status-lost-text, #F04444);
}

.pill-lost .pill-dot {
  background-color: var(--status-lost-text, #F04444);
}

.pill-found {
  background: var(--status-found-bg, rgba(34, 181, 115, 0.14));
  color: var(--status-found-text, #22B573);
}

.pill-found .pill-dot {
  background-color: var(--status-found-text, #22B573);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.status-resolved {
  background: var(--status-resolved-bg, rgba(47, 159, 232, 0.14));
  color: var(--status-resolved-text, #2F9FE8);
}

.status-returned {
  background: var(--status-found-bg, rgba(34, 181, 115, 0.14));
  color: var(--status-found-text, #22B573);
}

.status-icon {
  flex-shrink: 0;
}
</style>
