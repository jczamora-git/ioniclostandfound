<template>
  <ion-modal
    class="filter-sheet-modal"
    :is-open="isOpen"
    :breakpoints="[0, 1]"
    :initial-breakpoint="1"
    aria-labelledby="filter-sheet-title"
    @did-dismiss="$emit('close')"
  >
    <div class="filter-sheet-container">
      <!-- Sheet Header -->
      <header class="filter-sheet-header">
        <div class="header-title-wrap">
          <h2 id="filter-sheet-title" class="filter-title">Filters</h2>
          <span v-if="draftTotalCount > 0" class="filter-count-badge">
            {{ draftTotalCount }} active
          </span>
        </div>
        <button
          type="button"
          class="close-sheet-btn"
          aria-label="Close filters"
          @click="$emit('close')"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Scrollable Sheet Body -->
      <div class="filter-sheet-body">
        <!-- Section: Post Type -->
        <section class="filter-section" aria-labelledby="post-type-filter-label">
          <h3 id="post-type-filter-label" class="section-label">Post Type / Status</h3>
          <div class="type-chips-grid">
            <button
              v-for="t in typeOptions"
              :key="t.value"
              type="button"
              class="filter-chip"
              :class="{ active: draftFilters.type === t.value }"
              :aria-pressed="draftFilters.type === t.value"
              @click="draftFilters.type = t.value"
            >
              <span>{{ t.label }}</span>
            </button>
          </div>
        </section>

        <!-- Section: Categories (Multiple Selection) -->
        <section class="filter-section" aria-labelledby="category-filter-label">
          <div class="section-header-row">
            <h3 id="category-filter-label" class="section-label">Categories</h3>
            <span v-if="draftFilters.categories.length" class="selection-count">
              {{ draftFilters.categories.length }} selected
            </span>
          </div>

          <div class="chips-flex-wrap">
            <button
              v-for="cat in mainCategories"
              :key="cat.name"
              type="button"
              class="filter-chip"
              :class="{ active: isCategorySelected(cat.name) }"
              :aria-pressed="isCategorySelected(cat.name)"
              @click="toggleCategory(cat.name)"
            >
              <Check v-if="isCategorySelected(cat.name)" :size="14" class="chip-check-icon" />
              <span>{{ cat.name }}</span>
            </button>
          </div>
        </section>

        <!-- Section: Subcategories (Multiple Selection) -->
        <section class="filter-section" aria-labelledby="subcategory-filter-label">
          <div class="section-header-row">
            <h3 id="subcategory-filter-label" class="section-label">Subcategories</h3>
            <span v-if="draftFilters.subcategories.length" class="selection-count">
              {{ draftFilters.subcategories.length }} selected
            </span>
          </div>

          <div v-if="draftFilters.categories.length === 0" class="subcategories-hint">
            Select one or more categories above to filter by specific subcategories.
          </div>
          <div v-else-if="availableSubcategories.length === 0" class="subcategories-hint">
            No subcategories are available for the selected categories.
          </div>

          <div v-else class="chips-flex-wrap">
            <button
              v-for="sub in availableSubcategories"
              :key="sub"
              type="button"
              class="filter-chip sub-chip"
              :class="{ active: isSubcategorySelected(sub) }"
              :aria-pressed="isSubcategorySelected(sub)"
              @click="toggleSubcategory(sub)"
            >
              <Check v-if="isSubcategorySelected(sub)" :size="13" class="chip-check-icon" />
              <span>{{ sub }}</span>
            </button>
          </div>
        </section>
      </div>

      <!-- Bottom Action Bar -->
      <footer class="filter-sheet-footer">
        <button
          type="button"
          class="reset-filters-btn"
          :disabled="!hasDraftAdvancedFilters"
          @click="handleReset"
        >
          Reset
        </button>
        <button
          type="button"
          class="apply-filters-btn"
          @click="handleApply"
        >
          <span>Apply Filters</span>
          <span v-if="draftTotalCount > 0" class="apply-count-pill">
            {{ draftTotalCount }}
          </span>
        </button>
      </footer>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import { X, Check } from "lucide-vue-next";
import { useCategories } from "../composables/useCategories";
import { normalizeCategoryKey } from "../config/categories";
import type { PostFilter, PostFilters } from "../types/post";

const props = defineProps<{
  isOpen: boolean;
  appliedFilters: PostFilters;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "apply", payload: PostFilters): void;
}>();

const { mainCategories, getSubcategoriesForCategory } = useCategories();

const typeOptions: { label: string; value: PostFilter }[] = [
  { label: "All", value: "All" },
  { label: "Lost", value: "Lost" },
  { label: "Found", value: "Found" },
  { label: "Resolved", value: "Resolved" }
];

const cloneFilters = (filters: PostFilters): PostFilters => ({
  type: filters.type,
  categories: [...filters.categories],
  subcategories: [...filters.subcategories]
});

const draftFilters = ref<PostFilters>(cloneFilters(props.appliedFilters));

// Synchronize when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      draftFilters.value = cloneFilters(props.appliedFilters);
    }
  }
);

// Only expose subcategories belonging to selected categories.
const availableSubcategories = computed(() => {
  if (draftFilters.value.categories.length === 0) {
    return [];
  }
  const set = new Set<string>();
  const list: string[] = [];
  draftFilters.value.categories.forEach((cat) => {
    const subs = getSubcategoriesForCategory(cat);
    subs.forEach((s) => {
      const k = normalizeCategoryKey(s);
      if (!set.has(k)) {
        set.add(k);
        list.push(s);
      }
    });
  });
  return list;
});

const isCategorySelected = (name: string): boolean => {
  const norm = normalizeCategoryKey(name);
  return draftFilters.value.categories.some((c) => normalizeCategoryKey(c) === norm);
};

const toggleCategory = (name: string) => {
  const norm = normalizeCategoryKey(name);
  const idx = draftFilters.value.categories.findIndex((c) => normalizeCategoryKey(c) === norm);
  if (idx >= 0) {
    draftFilters.value.categories.splice(idx, 1);
    // A shared subcategory stays selected while another selected parent still provides it.
    const remainingAllowed = new Set(availableSubcategories.value.map(normalizeCategoryKey));
    draftFilters.value.subcategories = draftFilters.value.subcategories.filter((s) =>
      remainingAllowed.has(normalizeCategoryKey(s))
    );
  } else {
    draftFilters.value.categories.push(name);
  }
};

const isSubcategorySelected = (name: string): boolean => {
  const norm = normalizeCategoryKey(name);
  return draftFilters.value.subcategories.some((s) => normalizeCategoryKey(s) === norm);
};

const toggleSubcategory = (name: string) => {
  const norm = normalizeCategoryKey(name);
  const idx = draftFilters.value.subcategories.findIndex((s) => normalizeCategoryKey(s) === norm);
  if (idx >= 0) {
    draftFilters.value.subcategories.splice(idx, 1);
  } else {
    draftFilters.value.subcategories.push(name);
  }
};

const draftTotalCount = computed(() => {
  let count = 0;
  if (draftFilters.value.type !== "All") count += 1;
  count += draftFilters.value.categories.length;
  count += draftFilters.value.subcategories.length;
  return count;
});

const hasDraftAdvancedFilters = computed(() =>
  draftFilters.value.categories.length > 0 || draftFilters.value.subcategories.length > 0
);

const handleReset = () => {
  draftFilters.value.categories = [];
  draftFilters.value.subcategories = [];
  draftFilters.value.type = props.appliedFilters.type;
};

const handleApply = () => {
  emit("apply", cloneFilters(draftFilters.value));
};
</script>

<style scoped>
.filter-sheet-modal {
  --height: 85vh;
  --height: 85dvh;
  --max-height: calc(100dvh - env(safe-area-inset-top, 0px));
  --width: 100%;
  --max-width: 600px;
  --border-radius: 20px 20px 0 0;
}

.filter-sheet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--app-surface);
  color: var(--app-text-primary);
}

.filter-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-card-border);
  flex-shrink: 0;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.filter-count-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
  background: var(--app-primary-soft);
  padding: 2px 8px;
  border-radius: 12px;
}

.close-sheet-btn {
  background: transparent;
  border: none;
  color: var(--app-text-secondary);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.close-sheet-btn:active {
  background: var(--app-surface-secondary);
}

.filter-sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-label {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--app-text-secondary);
}

.selection-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
}

.type-chips-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.chips-flex-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.filter-chip.active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  border-color: rgba(47, 159, 232, 0.4);
  font-weight: 600;
}

.sub-chip {
  font-size: 12px;
  padding: 6px 12px;
}

.chip-check-icon {
  color: currentColor;
  flex-shrink: 0;
}

.subcategories-hint {
  font-size: 13px;
  color: var(--app-text-tertiary);
  padding: 6px 0;
  font-style: italic;
}

.filter-sheet-footer {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px max(16px, env(safe-area-inset-bottom, 16px));
  border-top: 1px solid var(--app-card-border);
  background: var(--app-surface);
  flex-shrink: 0;
}

.reset-filters-btn {
  flex: 1;
  height: 46px;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  border-radius: 12px;
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.reset-filters-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reset-filters-btn:not(:disabled):active {
  background: var(--app-surface-tertiary);
}

.apply-filters-btn {
  flex: 2;
  height: 46px;
  background: var(--app-primary);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.apply-filters-btn:active {
  transform: scale(0.99);
}

.apply-count-pill {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
}
</style>
