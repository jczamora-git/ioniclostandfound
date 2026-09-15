<template>
  <div class="custom-date-picker-wrap">
    <button
      type="button"
      class="date-row-btn"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="handleOpen"
    >
      <div class="row-left">
        <CalendarDays :size="16" class="row-icon" />
        <span class="row-label">{{ label }}</span>
      </div>
      <div class="row-right">
        <span class="row-value" :class="{ placeholder: !modelValue }">
          {{ formattedDisplayDate || placeholder }}
        </span>
        <ChevronRight :size="16" class="row-chevron" />
      </div>
    </button>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <!-- Custom Calendar Bottom Sheet -->
    <ion-modal
      :is-open="isOpen"
      :breakpoints="[0, 0.7, 0.9]"
      :initial-breakpoint="0.7"
      :expand-to-scroll="false"
      aria-label="Choose a date"
      class="calendar-modal"
      @did-dismiss="isOpen = false"
    >
      <div class="calendar-sheet">
        <header class="calendar-sheet-header">
          <div class="header-text-wrap">
            <h2 class="sheet-title">Select Date</h2>
            <span v-if="formattedDisplayDate" class="sheet-sub">
              {{ formattedDisplayDate }}
            </span>
          </div>
          <button
            type="button"
            class="close-sheet-btn"
            aria-label="Close date picker"
            @click="isOpen = false"
          >
            <X :size="20" />
          </button>
        </header>

        <div class="calendar-body">
          <CalendarRoot
            v-slot="{ grid, weekDays }"
            :model-value="(internalDate as any)"
            :locale="'en-US'"
            class="reka-calendar"
            @update:model-value="onDateSelected"
          >
            <CalendarHeader class="reka-cal-header">
              <CalendarPrev class="cal-nav-btn" aria-label="Previous month">
                <ChevronLeft :size="18" />
              </CalendarPrev>
              <CalendarHeading class="cal-heading" />
              <CalendarNext class="cal-nav-btn" aria-label="Next month">
                <ChevronRight :size="18" />
              </CalendarNext>
            </CalendarHeader>

            <CalendarGrid
              v-for="month in grid"
              :key="month.value.toString()"
              class="reka-cal-grid"
            >
              <CalendarGridHead>
                <CalendarGridRow class="reka-cal-weekdays-row">
                  <CalendarHeadCell
                    v-for="day in weekDays"
                    :key="day"
                    class="reka-cal-weekday"
                  >
                    {{ day }}
                  </CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>

              <CalendarGridBody>
                <CalendarGridRow
                  v-for="(weekDates, weekIdx) in month.rows"
                  :key="`week-${weekIdx}`"
                  class="reka-cal-days-row"
                >
                  <CalendarCell
                    v-for="weekDate in weekDates"
                    :key="weekDate.toString()"
                    :date="weekDate"
                    class="reka-cal-cell"
                  >
                    <CalendarCellTrigger
                      :day="weekDate"
                      :month="month.value"
                      class="reka-cal-trigger"
                    />
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </CalendarRoot>
        </div>

        <footer class="calendar-sheet-footer">
          <button
            type="button"
            class="footer-action-btn quick-today-btn"
            @click="selectToday"
          >
            Today
          </button>
          <button
            type="button"
            class="footer-action-btn done-btn"
            @click="isOpen = false"
          >
            Done
          </button>
        </footer>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { IonModal } from "@ionic/vue";
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  X
} from "lucide-vue-next";
import {
  CalendarRoot,
  CalendarHeader,
  CalendarHeading,
  CalendarPrev,
  CalendarNext,
  CalendarGrid,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarGridBody,
  CalendarCell,
  CalendarCellTrigger
} from "reka-ui";
import {
  parseDate,
  today,
  getLocalTimeZone,
  type DateValue
} from "@internationalized/date";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
  }>(),
  {
    label: "Date",
    placeholder: "Select date",
    disabled: false,
    error: ""
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const isOpen = ref(false);

const parseToDateValue = (str: string): DateValue | undefined => {
  if (!str) return undefined;
  try {
    return parseDate(str);
  } catch {
    return undefined;
  }
};

const internalDate = ref<DateValue | undefined>(parseToDateValue(props.modelValue));

watch(
  () => props.modelValue,
  (newVal) => {
    internalDate.value = parseToDateValue(newVal);
  }
);

const formattedDisplayDate = computed(() => {
  if (!props.modelValue) return "";
  try {
    const parts = props.modelValue.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [year, month, day] = parts;
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    }
  } catch {
    // fallback
  }
  return props.modelValue;
});

const handleOpen = () => {
  if (props.disabled) return;
  internalDate.value = parseToDateValue(props.modelValue) || today(getLocalTimeZone());
  isOpen.value = true;
};

const onDateSelected = (dateVal: DateValue | undefined) => {
  if (!dateVal) return;
  const iso = dateVal.toString();
  emit("update:modelValue", iso);
};

const selectToday = () => {
  const t = today(getLocalTimeZone());
  internalDate.value = t;
  emit("update:modelValue", t.toString());
};
</script>

<style scoped>
.custom-date-picker-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.date-row-btn {
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

.date-row-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-row-btn:active:not(:disabled) {
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

/* Calendar Modal Sheet */
.calendar-modal {
  --height: auto;
  --max-height: 90vh;
  --width: 100%;
  --max-width: 480px;
  --border-radius: 24px 24px 0 0;
}

.calendar-sheet {
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  color: var(--app-text-primary);
  padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
}

.calendar-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--app-card-border);
}

.header-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sheet-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.sheet-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
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
}

.close-sheet-btn:active {
  background: var(--app-surface-secondary);
}

.calendar-body {
  padding: 14px 18px 8px;
  display: flex;
  justify-content: center;
}

/* Reka UI Calendar Styling */
.reka-calendar {
  width: 100%;
  max-width: 360px;
  user-select: none;
}

.reka-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 12px;
}

.cal-heading {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.cal-nav-btn {
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-primary);
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.cal-nav-btn:active {
  opacity: 0.6;
}

.reka-cal-grid {
  width: 100%;
  border-collapse: collapse;
}

.reka-cal-weekdays-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
}

.reka-cal-weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-tertiary);
  padding: 4px 0;
}

.reka-cal-days-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.reka-cal-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.reka-cal-trigger {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.reka-cal-trigger:hover {
  background: var(--app-surface-secondary);
}

/* Today indicator */
.reka-cal-trigger[data-today] {
  border: 1px solid var(--app-primary);
  font-weight: 600;
}

/* Selected state */
.reka-cal-trigger[data-selected] {
  background: var(--app-primary) !important;
  color: #ffffff !important;
  font-weight: 700;
}

/* Outside current month */
.reka-cal-trigger[data-outside-view] {
  opacity: 0.3;
}

/* Disabled */
.reka-cal-trigger[data-disabled] {
  opacity: 0.2;
  cursor: not-allowed;
}

.calendar-sheet-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px 0;
  border-top: 1px solid var(--app-card-border);
}

.footer-action-btn {
  height: 42px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s ease;
}

.quick-today-btn {
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-primary);
  padding: 0 18px;
}

.done-btn {
  background: var(--app-primary);
  color: #ffffff;
  padding: 0 24px;
  flex: 1;
}

.footer-action-btn:active {
  opacity: 0.7;
}
</style>
