<template>
  <div
    class="user-avatar"
    :class="[`avatar-${size}`]"
    :aria-label="name"
  >
    <img
      v-if="avatarUrl && !imageError"
      :src="avatarUrl"
      :alt="name"
      class="avatar-img"
      loading="lazy"
      decoding="async"
      @error="imageError = true"
    />
    <span v-else class="avatar-letter">{{ initial }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    name?: string;
    username?: string;
    avatarUrl?: string | null;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
  }>(),
  {
    name: "User",
    username: "",
    avatarUrl: null,
    size: "md"
  }
);

const imageError = ref(false);

watch(
  () => props.avatarUrl,
  () => {
    imageError.value = false;
  }
);

const initial = computed(() => {
  const clean = (props.name || props.username || "U").trim();
  return clean ? clean.charAt(0).toUpperCase() : "U";
});
</script>

<style scoped>
.user-avatar {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--app-primary-soft, #DDF3FF);
  color: var(--app-primary, #2F9FE8);
  border: 1px solid var(--app-border, rgba(20, 25, 30, 0.08));
  font-weight: 700;
  flex-shrink: 0;
  user-select: none;
  overflow: hidden;
  position: relative;
  transition: transform 0.15s ease, background-color 0.2s ease;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.avatar-xs {
  width: 28px;
  height: 28px;
  font-size: 11px;
}

.avatar-sm {
  width: 32px;
  height: 32px;
  font-size: 13px;
}

.avatar-md {
  width: 44px;
  height: 44px;
  font-size: 16px;
}

.avatar-lg {
  width: 54px;
  height: 54px;
  font-size: 20px;
}

.avatar-xl {
  width: 88px;
  height: 88px;
  font-size: 32px;
}
</style>
