<template>
  <div class="skeleton-list" aria-label="Loading content">
    <div v-for="n in count" :key="n" class="skeleton-card">
      <div class="skeleton-image-area">
        <ion-skeleton-text :animated="true" class="skeleton-rect" />
      </div>
      <div class="skeleton-body">
        <ion-skeleton-text :animated="true" class="skeleton-title" />
        <ion-skeleton-text :animated="true" class="skeleton-line-long" />
        <ion-skeleton-text :animated="true" class="skeleton-line-short" />
        <div class="skeleton-meta">
          <ion-skeleton-text :animated="true" class="skeleton-pill" />
          <ion-skeleton-text :animated="true" class="skeleton-pill" />
        </div>
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
    count: 3,
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
  overflow: hidden;
  box-shadow: var(--app-card-shadow);
  border: 1px solid var(--app-card-border);
}

.skeleton-image-area {
  width: 100%;
  height: 140px;
}

.skeleton-rect {
  width: 100%;
  height: 100%;
  margin: 0;
}

.skeleton-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-title {
  width: 55%;
  height: 20px;
  border-radius: 6px;
  margin-bottom: 4px;
}

.skeleton-line-long {
  width: 85%;
  height: 13px;
  border-radius: 4px;
}

.skeleton-line-short {
  width: 65%;
  height: 13px;
  border-radius: 4px;
}

.skeleton-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 0.5px solid var(--app-separator);
}

.skeleton-pill {
  width: 70px;
  height: 16px;
  border-radius: 4px;
}
</style>
