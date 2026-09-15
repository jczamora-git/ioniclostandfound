<template>
  <ion-header class="ion-no-border app-page-ion-header">
    <ion-toolbar class="app-page-ion-toolbar">
      <div class="header-inner-box">
        <header class="app-page-header">
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
              <h1 class="header-title" :class="{ 'has-subtitle': !!subtitle }">{{ title }}</h1>
              <span v-if="subtitle" class="header-subtitle">{{ subtitle }}</span>
            </div>
          </div>

          <div v-if="$slots.action" class="header-actions-wrap">
            <slot name="action" />
          </div>
        </header>
      </div>
    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { IonHeader, IonToolbar } from '@ionic/vue';
import { ArrowLeft } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    showBack?: boolean;
    defaultBackUrl?: string;
  }>(),
  {
    showBack: false
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
.app-page-ion-header {
  background: var(--app-bg);
  border-bottom: 1px solid var(--app-card-border);
  z-index: 100;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.app-page-ion-toolbar {
  --background: var(--app-bg);
  --border-width: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --padding-start: 0;
  --padding-end: 0;
  --min-height: 56px;
}

.header-inner-box {
  width: 100%;
  max-width: var(--max-content-width, 600px);
  margin: 0 auto;
  padding: 0 16px;
  box-sizing: border-box;
}

.app-page-header {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  box-sizing: border-box;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.header-title-box {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header-back-btn {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--app-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  margin-left: -8px;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.header-back-btn:active {
  opacity: 0.7;
  background-color: var(--app-surface-secondary);
}

.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--app-text-primary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-title.has-subtitle {
  font-size: 18px;
  line-height: 1.2;
}

.header-subtitle {
  font-size: 12px;
  color: var(--app-text-secondary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
  margin-top: 1px;
}

.header-actions-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  flex-shrink: 0;
}
</style>
