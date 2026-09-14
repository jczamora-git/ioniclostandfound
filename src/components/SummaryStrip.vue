<template>
  <div class="summary-strip-container" aria-label="Item Overview">
    <div class="summary-scroll-track">
      <div
        v-for="stat in stats"
        :key="stat.id"
        class="summary-pill"
        :class="`pill-${stat.color}`"
      >
        <span class="pill-count">{{ stat.count }}</span>
        <span class="pill-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface StatItem {
  id: string;
  label: string;
  count: number;
  color: "primary" | "danger" | "success" | "warning";
}

defineProps<{
  stats: StatItem[];
}>();
</script>

<style scoped>
.summary-strip-container {
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
  padding: 4px 0 14px 0;
  -webkit-overflow-scrolling: touch;
}

.summary-strip-container::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.summary-scroll-track {
  display: flex;
  align-items: center;
  gap: 10px;
  width: max-content;
}

.summary-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 14px;
  background: var(--app-surface);
  border: 1px solid var(--app-card-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  user-select: none;
}

.pill-count {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.pill-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.pill-primary .pill-count {
  color: var(--ion-color-primary);
}

.pill-danger .pill-count {
  color: var(--status-lost-text);
}

.pill-success .pill-count {
  color: var(--status-found-text);
}

.pill-warning .pill-count {
  color: var(--status-unclaimed-text);
}
</style>
