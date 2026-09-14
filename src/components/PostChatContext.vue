<template>
  <div v-if="post" class="post-context-bar" @click="handleNavigate">
    <div class="context-thumb-box">
      <img
        v-if="post.imageUrl"
        :src="post.imageUrl"
        :alt="post.title"
        class="context-img"
      />
      <div v-else class="context-placeholder">
        <Image :size="16" />
      </div>
    </div>

    <div class="context-info">
      <span class="context-title">{{ post.title }}</span>
      <div class="context-sub">
        <span class="context-type" :class="post.type">{{ post.type.toUpperCase() }}</span>
        <span class="context-dot">·</span>
        <span class="context-location">{{ post.location }}</span>
      </div>
    </div>

    <ChevronRight :size="16" class="context-chevron" />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Image, ChevronRight } from 'lucide-vue-next';
import type { Post } from '../types/post';

const props = defineProps<{
  post?: Post | null;
}>();

const router = useRouter();

const handleNavigate = () => {
  if (props.post?.id) {
    router.push(`/post/${props.post.id}`);
  }
};
</script>

<style scoped>
.post-context-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background-color: var(--app-surface-secondary);
  border-radius: 12px;
  border: 1px solid var(--app-card-border);
  margin: 8px 16px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.post-context-bar:hover {
  background-color: var(--app-surface-tertiary);
}

.context-thumb-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--app-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--app-card-border);
}

.context-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.context-placeholder {
  color: var(--app-text-tertiary);
}

.context-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.context-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--app-text-secondary);
}

.context-type {
  font-weight: 700;
}

.context-type.lost {
  color: var(--app-lost, #f04444);
}

.context-type.found {
  color: var(--app-found, #22b573);
}

.context-dot {
  color: var(--app-text-tertiary);
}

.context-location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-chevron {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}
</style>
