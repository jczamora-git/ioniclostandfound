<template>
  <div class="skeleton-list" aria-label="Loading posts">
    <div v-for="n in count" :key="n" class="skeleton-card">
      <!-- Header: Avatar + Meta -->
      <div class="skeleton-header">
        <ion-skeleton-text :animated="true" class="skeleton-avatar" />
        <div class="skeleton-header-text">
          <ion-skeleton-text :animated="true" style="width: 120px; height: 14px;" />
          <ion-skeleton-text :animated="true" style="width: 60px; height: 11px;" />
        </div>
        <ion-skeleton-text :animated="true" style="width: 55px; height: 22px; border-radius: 12px; margin-left: auto;" />
      </div>

      <!-- Title -->
      <ion-skeleton-text :animated="true" style="width: 65%; height: 20px; border-radius: 6px;" />

      <!-- Photo Box -->
      <div class="skeleton-media">
        <ion-skeleton-text :animated="true" style="width: 100%; height: 100%;" />
      </div>

      <!-- Description lines -->
      <div class="skeleton-lines">
        <ion-skeleton-text :animated="true" style="width: 95%; height: 13px;" />
        <ion-skeleton-text :animated="true" style="width: 75%; height: 13px;" />
      </div>

      <!-- Tags & Action Bar -->
      <div class="skeleton-footer">
        <ion-skeleton-text :animated="true" style="width: 70px; height: 24px; border-radius: 8px;" />
        <ion-skeleton-text :animated="true" style="width: 70px; height: 24px; border-radius: 8px;" />
        <ion-skeleton-text :animated="true" style="width: 50px; height: 24px; border-radius: 8px;" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonSkeletonText } from "@ionic/vue";

withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 3
  }
);
</script>

<style scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  background: var(--app-surface);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.skeleton-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-media {
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 200px;
  border-radius: 14px;
  overflow: hidden;
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 0.5px solid var(--app-separator);
}
</style>
