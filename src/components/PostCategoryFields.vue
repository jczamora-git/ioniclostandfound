<template>
  <div class="category-fields-wrap">
    <!-- Category Row -->
    <button
      type="button"
      class="picker-row-btn"
      :disabled="disabled || isChecking"
      :aria-invalid="Boolean(error)"
      aria-haspopup="dialog"
      @click="activePicker = 'category'"
    >
      <div class="row-left">
        <Tag :size="16" class="row-icon" />
        <span class="row-label">Category</span>
      </div>
      <div class="row-right">
        <span class="row-value" :class="{ placeholder: !category }">
          {{ selectedCategoryLabel || 'Choose category' }}
        </span>
        <ChevronRight :size="16" class="row-chevron" />
      </div>
    </button>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <!-- Subcategory Row -->
    <button
      type="button"
      class="picker-row-btn"
      :disabled="!category || disabled || isChecking"
      aria-haspopup="dialog"
      @click="activePicker = 'subcategory'"
    >
      <div class="row-left">
        <ListFilter :size="16" class="row-icon" />
        <span class="row-label">Subcategory</span>
      </div>
      <div class="row-right">
        <span class="row-value" :class="{ placeholder: !subCategory }">
          {{ selectedSubcategoryLabel || (category ? 'None (optional)' : 'Choose category first') }}
        </span>
        <ChevronRight :size="16" class="row-chevron" />
      </div>
    </button>

    <!-- Category / Subcategory Sheet Modal -->
    <ion-modal
      :is-open="activePicker !== null"
      :breakpoints="[0, 0.65, 0.9]"
      :initial-breakpoint="0.65"
      :expand-to-scroll="false"
      class="category-picker-modal"
      aria-label="Choose a category or subcategory"
      @did-dismiss="handlePickerDismiss"
    >
      <div class="choice-sheet">
        <header class="choice-header">
          <h2 class="choice-title">
            {{ activePicker === 'category' ? 'Select Category' : 'Select Subcategory' }}
          </h2>
          <button
            type="button"
            class="close-sheet-btn"
            aria-label="Close selection"
            @click="activePicker = null"
          >
            <X :size="20" />
          </button>
        </header>

        <div
          class="choice-list"
          role="group"
          :aria-label="activePicker === 'category' ? 'Categories' : 'Subcategories'"
        >
          <!-- Subcategory: None (optional) -->
          <button
            v-if="activePicker === 'subcategory'"
            type="button"
            class="choice-row"
            :class="{ active: !subCategory }"
            :aria-pressed="!subCategory"
            @click="changeSubcategory('')"
          >
            <span class="choice-text">
              None <span class="optional-label">(optional)</span>
            </span>
            <Check v-if="!subCategory" :size="18" class="choice-check" />
          </button>

          <!-- List of Options -->
          <button
            v-for="option in activePicker === 'category' ? categoryOptions : subcategoryOptions"
            :key="option.value"
            type="button"
            class="choice-row"
            :class="{ active: option.value === (activePicker === 'category' ? category : subCategory) }"
            :aria-pressed="option.value === (activePicker === 'category' ? category : subCategory)"
            @click="activePicker === 'category' ? changeCategory(option.value) : changeSubcategory(option.value)"
          >
            <span class="choice-text">{{ option.label }}</span>
            <Check
              v-if="option.value === (activePicker === 'category' ? category : subCategory)"
              :size="18"
              class="choice-check"
            />
          </button>

          <!-- Add Custom Subcategory Option in Subcategory Sheet -->
          <div v-if="activePicker === 'subcategory'" class="custom-subcategory-section">
            <button
              v-if="!showCustomInput"
              type="button"
              class="add-custom-btn"
              :disabled="!isKnownCategory || disabled || isChecking"
              @click="showCustomInput = true"
            >
              <Plus :size="16" />
              <span>+ Add custom subcategory</span>
            </button>

            <div v-else class="custom-entry-box">
              <div class="custom-input-row">
                <input
                  v-model="customName"
                  type="text"
                  aria-label="Custom subcategory name"
                  placeholder="e.g. momo"
                  maxlength="80"
                  :disabled="disabled || isChecking"
                  :aria-invalid="Boolean(customError)"
                  @keydown.enter.prevent="addCustomSubcategory"
                />
                <button
                  type="button"
                  class="save-custom-btn"
                  :disabled="!customName.trim() || disabled || isChecking"
                  @click="addCustomSubcategory"
                >
                  <LoaderCircle v-if="isChecking" :size="15" class="checking-spinner" />
                  <span v-else>Add</span>
                </button>
                <button
                  type="button"
                  class="cancel-custom-btn"
                  aria-label="Cancel custom subcategory"
                  :disabled="disabled || isChecking"
                  @click="resetCustomInput"
                >
                  <X :size="16" />
                </button>
              </div>
              <p v-if="customError" class="field-error" role="alert">{{ customError }}</p>
            </div>
          </div>
        </div>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import {
  Check,
  ChevronRight,
  ListFilter,
  LoaderCircle,
  Plus,
  Tag,
  X
} from "lucide-vue-next";
import { useCategories } from "../composables/useCategories";
import { getCategoryConfig } from "../config/categories";

interface PendingSubcategory {
  category: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    category: string;
    subCategory?: string;
    pendingSubcategory?: PendingSubcategory;
    disabled?: boolean;
    error?: string;
  }>(),
  {
    subCategory: "",
    disabled: false,
    error: ""
  }
);

const emit = defineEmits<{
  (event: "update:category", value: string): void;
  (event: "update:subCategory", value: string): void;
  (event: "update:pendingSubcategory", value: PendingSubcategory | undefined): void;
  (event: "checking-change", value: boolean): void;
}>();

const {
  mainCategories,
  getSubcategoriesForCategory,
  resolveCustomSubcategory,
  normalizeCategoryKey
} = useCategories();

const activePicker = ref<"category" | "subcategory" | null>(null);
const showCustomInput = ref(false);
const customName = ref("");
const customError = ref("");
const isChecking = ref(false);
const localChoices = ref<Record<string, Record<string, { name: string; isNew: boolean }>>>({});
let isActive = true;

const categoryKey = (cat: string) => getCategoryConfig(cat)?.key || normalizeCategoryKey(cat);
const isKnownCategory = computed(() => Boolean(getCategoryConfig(props.category)));

// Keep legacy spelling and unknown values until selection changes
const categoryOptions = computed(() => {
  const options = mainCategories.map((cat) => ({
    label: cat.name,
    value: categoryKey(props.category) === cat.key ? props.category : cat.name
  }));
  if (props.category && !isKnownCategory.value) {
    options.unshift({ label: props.category, value: props.category });
  }
  return options;
});

const availableSubcategories = (cat: string) => {
  const names = [...getSubcategoriesForCategory(cat)];
  const seen = new Set(names.map(normalizeCategoryKey));
  for (const [key, entry] of Object.entries(localChoices.value[categoryKey(cat)] || {})) {
    if (!seen.has(key)) {
      names.push(entry.name);
      seen.add(key);
    }
  }
  return names;
};

const subcategoryOptions = computed(() => {
  if (!props.category) return [];
  const selectedKey = normalizeCategoryKey(props.subCategory);
  const options = availableSubcategories(props.category).map((name) => ({
    label: name,
    value: props.subCategory && normalizeCategoryKey(name) === selectedKey ? props.subCategory : name
  }));
  if (props.subCategory && !options.some((opt) => normalizeCategoryKey(opt.value) === selectedKey)) {
    options.unshift({ label: props.subCategory, value: props.subCategory });
  }
  return options;
});

const selectedCategoryLabel = computed(() =>
  categoryOptions.value.find((opt) => opt.value === props.category)?.label
);
const selectedSubcategoryLabel = computed(() =>
  subcategoryOptions.value.find((opt) => opt.value === props.subCategory)?.label
);

const resetCustomInput = () => {
  showCustomInput.value = false;
  customName.value = "";
  customError.value = "";
};

const handlePickerDismiss = () => {
  activePicker.value = null;
  resetCustomInput();
};

const updatePendingSelection = (cat: string, name?: string) => {
  const key = normalizeCategoryKey(name);
  const entry = localChoices.value[categoryKey(cat)]?.[key];
  const alreadyRegistered = getSubcategoriesForCategory(cat).some(
    (existing) => normalizeCategoryKey(existing) === key
  );
  emit(
    "update:pendingSubcategory",
    entry?.isNew && !alreadyRegistered ? { category: cat, name: entry.name } : undefined
  );
};

const changeCategory = (nextCat: string) => {
  if (props.disabled || isChecking.value) return;
  if (nextCat !== props.category) {
    const selectedKey = normalizeCategoryKey(props.subCategory);
    const stillValid = availableSubcategories(nextCat).some(
      (name) => normalizeCategoryKey(name) === selectedKey
    );
    emit("update:category", nextCat);
    if (props.subCategory && !stillValid) {
      emit("update:subCategory", "");
    }
    updatePendingSelection(nextCat, stillValid ? props.subCategory : undefined);
    resetCustomInput();
  }
  activePicker.value = null;
};

const changeSubcategory = (name: string) => {
  if (props.disabled || isChecking.value) return;
  emit("update:subCategory", name);
  updatePendingSelection(props.category, name);
  activePicker.value = null;
};

const addCustomSubcategory = async () => {
  if (props.disabled || isChecking.value) return;
  customError.value = "";
  if (!isKnownCategory.value) {
    customError.value = "Choose a category first.";
    return;
  }
  const normalizedKey = normalizeCategoryKey(customName.value);
  if (!normalizedKey) {
    customError.value = "Enter a subcategory containing letters or numbers.";
    return;
  }

  const category = props.category;
  isChecking.value = true;
  emit("checking-change", true);
  try {
    const existingLocal = localChoices.value[categoryKey(category)]?.[normalizedKey];
    const resolved = await resolveCustomSubcategory(
      category,
      existingLocal?.name || customName.value
    );
    if (!isActive || props.category !== category) return;
    localChoices.value[resolved.categoryKey] ||= {};
    localChoices.value[resolved.categoryKey][resolved.normalizedKey] = {
      name: resolved.name,
      isNew: resolved.isNew
    };
    emit("update:subCategory", resolved.name);
    emit(
      "update:pendingSubcategory",
      resolved.isNew ? { category, name: resolved.name } : undefined
    );
    resetCustomInput();
    activePicker.value = null;
  } catch (error) {
    if (isActive) {
      customError.value =
        error instanceof Error ? error.message : "Could not check subcategory. Try again.";
    }
  } finally {
    isChecking.value = false;
    if (isActive) emit("checking-change", false);
  }
};

watch(() => props.category, resetCustomInput);

watch([() => props.category, () => props.subCategory], () => {
  if (
    props.pendingSubcategory &&
    (categoryKey(props.pendingSubcategory.category) !== categoryKey(props.category) ||
      normalizeCategoryKey(props.pendingSubcategory.name) !== normalizeCategoryKey(props.subCategory))
  ) {
    emit("update:pendingSubcategory", undefined);
  }
});

onUnmounted(() => {
  isActive = false;
});
</script>

<style scoped>
.category-fields-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.picker-row-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 46px;
  padding: 12px 2px;
  border: none;
  border-bottom: 1px solid var(--app-card-border);
  background: transparent;
  font: inherit;
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.picker-row-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.picker-row-btn:active:not(:disabled) {
  opacity: 0.7;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-secondary);
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.row-icon {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.row-value {
  font-size: 13px;
  color: var(--app-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-value.placeholder {
  color: var(--app-text-tertiary);
}

.row-chevron {
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.field-error {
  margin: 4px 0 0;
  color: var(--ion-color-danger, #ef4444);
  font-size: 12px;
}

/* Modal Bottom Sheet */
.category-picker-modal {
  --height: auto;
  --max-height: 85vh;
  --width: 100%;
  --max-width: 480px;
  --border-radius: 24px 24px 0 0;
}

.choice-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-surface);
  color: var(--app-text-primary);
}

.choice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--app-card-border);
  flex-shrink: 0;
}

.choice-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-primary);
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

.choice-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 18px max(24px, env(safe-area-inset-bottom, 24px));
}

.choice-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 48px;
  padding: 12px 6px;
  border: none;
  border-bottom: 1px solid var(--app-card-border);
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.choice-row:last-child {
  border-bottom: none;
}

.choice-row:active {
  background: var(--app-surface-secondary);
}

.choice-row.active {
  color: var(--app-primary);
  font-weight: 600;
}

.choice-text {
  flex: 1;
}

.optional-label {
  color: var(--app-text-tertiary);
  font-weight: 400;
  font-size: 13px;
}

.choice-check {
  color: var(--app-primary);
  flex-shrink: 0;
}

/* Custom Subcategory Section */
.custom-subcategory-section {
  padding: 12px 6px 6px;
  border-top: 1px dashed var(--app-card-border);
  margin-top: 6px;
}

.add-custom-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 0;
  cursor: pointer;
}

.add-custom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-entry-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0;
}

.custom-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-input-row input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--app-card-border);
  background: var(--app-surface-secondary);
  color: var(--app-text-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}

.custom-input-row input:focus {
  border-color: var(--app-primary);
}

.save-custom-btn {
  background: var(--app-primary);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-custom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-custom-btn {
  background: transparent;
  border: none;
  color: var(--app-text-secondary);
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checking-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
