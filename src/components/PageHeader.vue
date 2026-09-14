<template>
  <header class="app-page-header" :class="{ 'is-compact': compact || subtitle }">
    <div class="header-left">
      <button
        v-if="showBack"
        type="button"
        class="header-back-btn"
        aria-label="Go back"
        @click="handleBack"
      >
        <ArrowLeft :size="22" />
      </button>
      <div class="header-title-box">
        <h1 class="header-title">{{ title }}</h1>
        <span v-if="subtitle" class="header-subtitle">{{ subtitle }}</span>
      </div>
    </div>

    <div v-if="$slots.action" class="header-right">
      <slot name="action" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    showBack?: boolean;
    compact?: boolean;
    defaultBackUrl?: string;
  }>(),
  {
    showBack: false,
    compact: false
  }
);

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const router = useRouter();

const handleBack = () => {
  emit('back');
  if (props.defaultBackUrl) {
    router.replace(props.defaultBackUrl);
  } else {
    router.back();
  }
};
</script>

<style scoped>
.app-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 60px;
  background-color: var(--app-surface);
  border-bottom: 1px solid var(--app-card-border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-left: -8px;
  background: transparent;
  border: none;
  color: var(--app-text-primary);
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.header-back-btn:active {
  background-color: var(--app-surface-secondary);
}

.header-title-box {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--app-text-primary);
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-compact .header-title {
  font-size: 17px;
  font-weight: 700;
}

.header-subtitle {
  font-size: 12px;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
