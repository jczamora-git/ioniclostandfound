<template>
  <ion-card class="form-card">
    <ion-card-header>
      <div class="section-heading">
        <div class="section-icon">
          <ion-icon :icon="editingId ? pencilIcon : addIcon" />
        </div>
        <div>
          <ion-card-title>{{
            editingId ? "Edit Item" : "Add New Item"
          }}</ion-card-title>
          <p>
            {{
              editingId
                ? "Update the details below."
                : "Add a record so it can be found faster."
            }}
          </p>
        </div>
      </div>
    </ion-card-header>

    <ion-card-content>
      <form novalidate @submit.prevent="$emit('submit')">
        <div class="form-fields">
          <ion-input
            v-model="draft.itemName"
            label="Item name"
            label-placement="stacked"
            fill="outline"
            placeholder="e.g. Black wallet"
            :class="{ 'field-invalid': errors.itemName }"
            @ion-input="$emit('clear-error', 'itemName')"
          >
            <ion-icon slot="start" :icon="briefcaseIcon" aria-hidden="true" />
          </ion-input>
          <span v-if="errors.itemName" class="field-error">{{
            errors.itemName
          }}</span>

          <ion-textarea
            v-model="draft.description"
            label="Description"
            label-placement="stacked"
            fill="outline"
            placeholder="Add useful details about the item"
            :auto-grow="true"
            :class="{ 'field-invalid': errors.description }"
            @ion-input="$emit('clear-error', 'description')"
          />
          <span v-if="errors.description" class="field-error">{{
            errors.description
          }}</span>

          <ion-input
            v-model="draft.location"
            label="Last known location"
            label-placement="stacked"
            fill="outline"
            placeholder="e.g. Library, room 204"
            :class="{ 'field-invalid': errors.location }"
            @ion-input="$emit('clear-error', 'location')"
          >
            <ion-icon slot="start" :icon="locationIcon" aria-hidden="true" />
          </ion-input>
          <span v-if="errors.location" class="field-error">{{
            errors.location
          }}</span>

          <ion-input
            v-model="draft.date"
            type="date"
            label="Date"
            label-placement="stacked"
            fill="outline"
            :class="{ 'field-invalid': errors.date }"
            @ion-input="$emit('clear-error', 'date')"
          >
            <ion-icon slot="start" :icon="calendarIcon" aria-hidden="true" />
          </ion-input>
          <span v-if="errors.date" class="field-error">{{ errors.date }}</span>

          <div class="form-row">
            <div>
              <ion-select
                v-model="draft.type"
                label="Type"
                label-placement="stacked"
                fill="outline"
                interface="popover"
                :class="{ 'field-invalid': errors.type }"
                @ion-change="$emit('clear-error', 'type')"
              >
                <ion-select-option value="Lost">Lost</ion-select-option>
                <ion-select-option value="Found">Found</ion-select-option>
              </ion-select>
              <span v-if="errors.type" class="field-error">{{
                errors.type
              }}</span>
            </div>
            <div>
              <ion-select
                v-model="draft.status"
                label="Status"
                label-placement="stacked"
                fill="outline"
                interface="popover"
                :class="{ 'field-invalid': errors.status }"
                @ion-change="$emit('clear-error', 'status')"
              >
                <ion-select-option value="Unclaimed"
                  >Unclaimed</ion-select-option
                >
                <ion-select-option value="Claimed">Claimed</ion-select-option>
              </ion-select>
              <span v-if="errors.status" class="field-error">{{
                errors.status
              }}</span>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <ion-button
            v-if="editingId"
            type="button"
            fill="clear"
            @click="$emit('reset')"
            >Cancel</ion-button
          >
          <ion-button type="submit" class="save-button" :disabled="saving">
            <ion-spinner v-if="saving" name="crescent" />
            <ion-icon
              v-else
              slot="start"
              :icon="editingId ? checkIcon : addIcon"
            />
            {{ saving ? "Saving..." : editingId ? "Save changes" : "Add item" }}
          </ion-button>
        </div>
      </form>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from "@ionic/vue";
import {
  add,
  briefcaseOutline,
  calendarOutline,
  checkmarkCircleOutline,
  createOutline,
  locationOutline,
} from "ionicons/icons";
import type { FormErrors, LostFoundForm } from "../types/lostFound";

const props = withDefaults(
  defineProps<{
    form: LostFoundForm;
    errors: FormErrors;
    editingId: string | null;
    saving: boolean;
  }>(),
  { editingId: null, saving: false },
);
const emit = defineEmits<{
  submit: [];
  reset: [];
  "clear-error": [field: keyof FormErrors];
  "update-form": [form: LostFoundForm];
}>();

const draft = reactive<LostFoundForm>({ ...props.form });

watch(
  () => props.form,
  (value) => Object.assign(draft, value),
  { deep: true },
);
watch(
  draft,
  (value) => emit("update-form", { ...value }),
  { deep: true },
);

const addIcon = add;
const pencilIcon = createOutline;
const checkIcon = checkmarkCircleOutline;
const briefcaseIcon = briefcaseOutline;
const locationIcon = locationOutline;
const calendarIcon = calendarOutline;
</script>

<style scoped>
.form-card {
  margin: 0;
  background: #171f2a;
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 14px;
  box-shadow: none;
}
.form-card ion-card-header {
  padding: 22px 22px 8px;
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  color: #9cc8ff;
  background: rgba(64, 137, 224, 0.16);
}
.section-heading ion-card-title {
  color: #f1f5f9;
  font-size: 17px;
}
.section-heading p {
  margin: 4px 0 0;
  color: #8492a3;
  font-size: 12px;
}
.form-card ion-card-content {
  padding: 12px 22px 22px;
}
.form-fields {
  display: grid;
  gap: 12px;
}
.form-fields ion-input,
.form-fields ion-textarea,
.form-fields ion-select {
  --background: #111822;
  --border-color: rgba(148, 163, 184, 0.23);
  --border-radius: 8px;
  --color: #e8edf4;
  --highlight-color: #67aef4;
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 11px;
  --padding-bottom: 11px;
}
.form-fields ion-input,
.form-fields ion-select {
  min-height: 54px;
}
.form-fields ion-textarea {
  min-height: 85px;
}
.form-fields ion-icon {
  color: #6f9fd0;
  margin-right: 8px;
}
.form-fields ion-label {
  color: #b0bccb !important;
  font-size: 12px;
  font-weight: 600;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field-error {
  display: block;
  margin: -7px 2px 0;
  color: #ff9d98;
  font-size: 11px;
}
.field-invalid {
  --border-color: #e5746c !important;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 18px;
}
.form-actions ion-button {
  --border-radius: 8px;
  height: 42px;
  text-transform: none;
  font-weight: 700;
}
.save-button {
  --background: #347fc9;
  --background-hover: #4393df;
  --color: white;
  min-width: 128px;
}
.save-button ion-spinner {
  margin-right: 7px;
}
@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  .form-card ion-card-header,
  .form-card ion-card-content {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
