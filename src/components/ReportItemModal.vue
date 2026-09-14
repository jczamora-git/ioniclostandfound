<template>
  <ion-modal
    :is-open="isOpen"
    :breakpoints="[0, 0.95, 1]"
    :initial-breakpoint="0.95"
    @did-dismiss="$emit('close')"
  >
    <div class="report-sheet">
      <!-- Sheet Navigation Bar -->
      <div class="sheet-top-bar">
        <div class="grabber-pill"></div>
        <div class="sheet-header-actions">
          <button
            type="button"
            class="header-action-btn cancel-btn"
            @click="$emit('close')"
          >
            Cancel
          </button>

          <span class="sheet-header-title">
            {{ editingId ? "Edit Item" : "Report an Item" }}
          </span>

          <button
            type="button"
            class="header-action-btn submit-btn"
            :disabled="saving"
            @click="handleSubmit"
          >
            <ion-spinner v-if="saving" name="crescent" class="btn-spinner" />
            <span v-else>{{ editingId ? "Save" : "Report" }}</span>
          </button>
        </div>
      </div>

      <!-- Sheet Form Body -->
      <div class="sheet-body-scroll">
        <!-- Segmented Control: Lost vs Found -->
        <div class="segment-container">
          <div class="ios-segment">
            <button
              type="button"
              class="segment-option"
              :class="{ active: draft.type === 'Lost' }"
              @click="setType('Lost')"
            >
              Lost Item
            </button>
            <button
              type="button"
              class="segment-option"
              :class="{ active: draft.type === 'Found' }"
              @click="setType('Found')"
            >
              Found Item
            </button>
          </div>
        </div>

        <!-- Optional Photo Placeholder Slot -->
        <div class="photo-uploader-slot">
          <div class="photo-icon-circle">
            <Camera :size="20" />
          </div>
          <div class="photo-text">
            <span class="photo-title">Attach Photo</span>
            <span class="photo-desc">Camera &amp; gallery integration ready</span>
          </div>
        </div>

        <!-- Grouped Form Fields (iOS Inset Group style) -->
        <div class="ios-form-group">
          <!-- Item Name -->
          <div class="form-field-row" :class="{ 'has-error': errors.itemName }">
            <label class="field-label" for="item-name-input">ITEM NAME</label>
            <input
              id="item-name-input"
              v-model="draft.itemName"
              type="text"
              class="ios-native-input"
              placeholder="e.g., AirPods Pro, Leather Wallet"
              @input="$emit('clear-error', 'itemName')"
            />
            <span v-if="errors.itemName" class="error-text">{{ errors.itemName }}</span>
          </div>

          <!-- Location -->
          <div class="form-field-row" :class="{ 'has-error': errors.location }">
            <label class="field-label" for="location-input">LOCATION</label>
            <input
              id="location-input"
              v-model="draft.location"
              type="text"
              class="ios-native-input"
              placeholder="e.g., Library 2nd Floor, Room 402"
              @input="$emit('clear-error', 'location')"
            />
            <span v-if="errors.location" class="error-text">{{ errors.location }}</span>
          </div>

          <!-- Date -->
          <div class="form-field-row" :class="{ 'has-error': errors.date }">
            <label class="field-label" for="date-input">DATE</label>
            <input
              id="date-input"
              v-model="draft.date"
              type="date"
              class="ios-native-input"
              @input="$emit('clear-error', 'date')"
            />
            <span v-if="errors.date" class="error-text">{{ errors.date }}</span>
          </div>

          <!-- Status (Claimed / Unclaimed) -->
          <div class="form-field-row">
            <label class="field-label">CLAIM STATUS</label>
            <div class="status-selector-row">
              <button
                type="button"
                class="status-choice-btn"
                :class="{ active: draft.status === 'Unclaimed' }"
                @click="draft.status = 'Unclaimed'"
              >
                Unclaimed
              </button>
              <button
                type="button"
                class="status-choice-btn"
                :class="{ active: draft.status === 'Claimed' }"
                @click="draft.status = 'Claimed'"
              >
                Claimed
              </button>
            </div>
          </div>
        </div>

        <!-- Description Box -->
        <div class="ios-form-group">
          <div class="form-field-row" :class="{ 'has-error': errors.description }">
            <label class="field-label" for="description-input">DESCRIPTION &amp; DETAILS</label>
            <textarea
              id="description-input"
              v-model="draft.description"
              class="ios-native-textarea"
              rows="3"
              placeholder="Color, unique marks, brand, serial or key identifiers..."
              @input="$emit('clear-error', 'description')"
            ></textarea>
            <span v-if="errors.description" class="error-text">{{ errors.description }}</span>
          </div>
        </div>

        <!-- Action Button -->
        <div class="bottom-action-wrapper">
          <button
            type="button"
            class="ios-submit-button"
            :disabled="saving"
            @click="handleSubmit"
          >
            <ion-spinner v-if="saving" name="crescent" />
            <span v-else>{{ editingId ? "Update Item" : "Submit Report" }}</span>
          </button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { IonModal, IonSpinner } from "@ionic/vue";
import { Camera } from "lucide-vue-next";
import type { FormErrors, ItemType, LostFoundForm } from "../types/lostFound";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    form: LostFoundForm;
    errors: FormErrors;
    editingId: string | null;
    saving: boolean;
  }>(),
  {
    editingId: null,
    saving: false,
  }
);

const emit = defineEmits<{
  close: [];
  submit: [];
  "clear-error": [field: keyof FormErrors];
  "update-form": [form: LostFoundForm];
}>();

const draft = reactive<LostFoundForm>({ ...props.form });

watch(
  () => props.form,
  (val) => {
    Object.assign(draft, val);
  },
  { deep: true }
);

watch(
  draft,
  (val) => {
    emit("update-form", { ...val });
  },
  { deep: true }
);

const setType = (type: ItemType) => {
  draft.type = type;
  emit("clear-error", "type");
};

const handleSubmit = () => {
  emit("submit");
};
</script>

<style scoped>
.report-sheet {
  background: var(--app-bg);
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.sheet-top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--app-bg);
  padding: 8px 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.grabber-pill {
  width: 36px;
  height: 5px;
  border-radius: 3px;
  background: var(--app-text-tertiary);
  margin-bottom: 8px;
}

.sheet-header-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-header-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.header-action-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  transition: opacity 0.15s ease;
}

.cancel-btn {
  color: var(--app-text-secondary);
}

.submit-btn {
  color: var(--ion-color-primary);
  font-weight: 700;
}

.btn-spinner {
  width: 20px;
  height: 20px;
}

.sheet-body-scroll {
  padding: 0 18px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

/* iOS Segment */
.segment-container {
  width: 100%;
}

.ios-segment {
  display: flex;
  background: var(--app-surface-secondary);
  border-radius: 12px;
  padding: 3px;
  border: 1px solid var(--app-card-border);
}

.segment-option {
  flex: 1;
  border: none;
  background: transparent;
  padding: 9px 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.segment-option.active {
  background: var(--app-surface);
  color: var(--app-text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Photo slot */
.photo-uploader-slot {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--app-surface);
  border-radius: 16px;
  border: 1px dashed var(--app-card-border);
}

.photo-icon-circle {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--app-surface-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-primary);
}

.photo-icon-circle ion-icon {
  font-size: 22px;
}

.photo-text {
  display: flex;
  flex-direction: column;
}

.photo-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.photo-desc {
  font-size: 11px;
  color: var(--app-text-secondary);
}

/* iOS Inset Form Group */
.ios-form-group {
  background: var(--app-surface);
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
}

.form-field-row {
  display: flex;
  flex-direction: column;
  padding: 10px 16px 12px;
  border-bottom: 0.5px solid var(--app-separator);
}

.form-field-row:last-child {
  border-bottom: none;
}

.field-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--app-text-secondary);
  margin-bottom: 4px;
}

.ios-native-input,
.ios-native-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 16px;
  color: var(--app-text-primary);
  padding: 2px 0;
}

.ios-native-textarea {
  resize: vertical;
  line-height: 1.4;
}

.status-selector-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.status-choice-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  border: 1px solid var(--app-card-border);
  background: var(--app-surface-secondary);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-choice-btn.active {
  background: var(--ion-color-primary);
  color: #ffffff;
  border-color: var(--ion-color-primary);
}

.has-error .field-label {
  color: var(--ion-color-danger);
}

.error-text {
  font-size: 11px;
  color: var(--ion-color-danger);
  margin-top: 4px;
  font-weight: 500;
}

/* Bottom Action */
.bottom-action-wrapper {
  margin-top: 10px;
}

.ios-submit-button {
  width: 100%;
  height: 50px;
  border-radius: 14px;
  background: var(--ion-color-primary);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
  transition: transform 0.15s ease;
}

.ios-submit-button:active {
  transform: scale(0.98);
}
</style>
