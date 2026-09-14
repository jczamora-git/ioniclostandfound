<template>
  <div
    class="user-avatar"
    :class="[`avatar-${size}`]"
    :aria-label="name"
  >
    <span class="avatar-letter">{{ initial }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    name?: string;
    username?: string;
    size?: "sm" | "md" | "lg" | "xl";
  }>(),
  {
    name: "User",
    username: "",
    size: "md"
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
  transition: transform 0.15s ease, background-color 0.2s ease;
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
  width: 80px;
  height: 80px;
  font-size: 30px;
}
</style>
