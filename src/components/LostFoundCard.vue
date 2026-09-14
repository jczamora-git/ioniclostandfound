<template>
  <article
    class="ios-card"
    role="button"
    tabindex="0"
    :aria-label="`${item.itemName}, ${item.type} at ${item.location}`"
    @click="$emit('select', item)"
    @keydown.enter="$emit('select', item)"
  >
    <!-- Top Image Placeholder Area -->
    <div class="card-visual-area">
      <div class="visual-placeholder">
        <ImageIcon :size="24" class="visual-icon" aria-hidden="true" />
      </div>

      <!-- Type Badge Overlaid at Top Left -->
      <div
        class="type-pill"
        :class="item.type === 'Found' ? 'pill-found' : 'pill-lost'"
      >
        <span class="pill-dot"></span>
        <span>{{ item.type }}</span>
      </div>

      <!-- Claimed Status Overlaid at Top Right -->
      <div
        class="status-pill"
        :class="item.status === 'Claimed' ? 'status-claimed' : 'status-unclaimed'"
      >
        <BadgeCheck
          v-if="item.status === 'Claimed'"
          :size="13"
          aria-hidden="true"
        />
        <AlertCircle
          v-else
          :size="13"
          aria-hidden="true"
        />
        <span>{{ item.status }}</span>
      </div>
    </div>

    <!-- Card Content Details -->
    <div class="card-body">
      <div class="header-row">
        <h3 class="item-title">{{ item.itemName }}</h3>
      </div>

      <p v-if="item.description" class="item-desc">
        {{ item.description }}
      </p>

      <!-- Metadata Info Rows -->
      <div class="card-meta">
        <div class="meta-entry">
          <MapPin :size="14" aria-hidden="true" />
          <span class="meta-text">{{ item.location }}</span>
        </div>
        <div class="meta-entry">
          <CalendarDays :size="14" aria-hidden="true" />
          <span class="meta-text">{{ formatDate(item.date) }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
} from "lucide-vue-next";
import type { LostFoundItem } from "../types/lostFound";

defineProps<{
  item: LostFoundItem;
  formatDate: (dateStr: string) => string;
}>();

defineEmits<{
  select: [item: LostFoundItem];
}>();
</script>

<style scoped>
.ios-card {
  background: var(--app-surface);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.18s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.ios-card:active {
  transform: scale(0.98);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

/* Image Visual Placeholder Area */
.card-visual-area {
  position: relative;
  width: 100%;
  height: 140px;
  background: linear-gradient(
    180deg,
    var(--app-surface-secondary) 0%,
    var(--app-surface-tertiary) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
}

.visual-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
}

@media (prefers-color-scheme: dark) {
  .visual-placeholder {
    background: rgba(44, 44, 46, 0.7);
  }
}

.visual-icon {
  font-size: 28px;
  color: var(--app-text-secondary);
  opacity: 0.7;
}

/* Overlaid Pills */
.type-pill {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pill-lost {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-lost-text);
}
.pill-lost .pill-dot {
  background: var(--status-lost-text);
}

.pill-found {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-found-text);
}
.pill-found .pill-dot {
  background: var(--status-found-text);
}

@media (prefers-color-scheme: dark) {
  .pill-lost,
  .pill-found {
    background: rgba(28, 28, 30, 0.85);
  }
}

.status-pill {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.status-pill ion-icon {
  font-size: 13px;
}

.status-claimed {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-claimed-text);
}

.status-unclaimed {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-unclaimed-text);
}

@media (prefers-color-scheme: dark) {
  .status-claimed,
  .status-unclaimed {
    background: rgba(28, 28, 30, 0.85);
  }
}

/* Card Body Content */
.card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text-primary);
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--app-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Metadata Rows */
.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 0.5px solid var(--app-separator);
}

.meta-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.meta-entry ion-icon {
  font-size: 14px;
  color: var(--ion-color-primary);
  opacity: 0.9;
}

.meta-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}
</style>
