<template>
  <div v-if="lastDiagnosticText" class="upload-debug-card">
    <div class="upload-debug-header">
      <div class="upload-debug-title">
        <span class="pulse-indicator"></span>
        <span class="title-text">Diagnostic Info</span>
      </div>
      <div class="upload-debug-actions">
        <button
          type="button"
          class="copy-btn"
          :class="{ copied }"
          @click="handleCopy"
        >
          <Check v-if="copied" :size="13" />
          <Copy v-else :size="13" />
          <span>{{ copied ? 'Copied' : 'Copy Debug Info' }}</span>
        </button>
        <button
          type="button"
          class="dismiss-btn"
          title="Dismiss"
          @click="clearDiagnostic"
        >
          <X :size="13" />
        </button>
      </div>
    </div>

    <pre class="upload-debug-body">{{ lastDiagnosticText }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Copy, Check, X } from 'lucide-vue-next';
import { useImageUpload } from '../composables/useImageUpload';

const { lastDiagnosticText, copyDebugInfo, clearDiagnostic } = useImageUpload();
const copied = ref(false);

const handleCopy = async () => {
  const success = await copyDebugInfo();
  if (success) {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
};
</script>

<style scoped>
.upload-debug-card {
  margin-top: 10px;
  margin-bottom: 10px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  padding: 10px 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}

.upload-debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.upload-debug-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pulse-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
}

.title-text {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #ef4444;
}

.upload-debug-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: #ef4444;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.copy-btn.copied {
  background: #10b981;
}

.dismiss-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: #991b1b;
  background: rgba(239, 68, 68, 0.15);
  border: none;
  cursor: pointer;
}

.upload-debug-body {
  margin: 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
  color: #7f1d1d;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
</style>
