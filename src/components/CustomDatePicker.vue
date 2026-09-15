<template>
  <div class="custom-date-picker-wrap">
    <!-- Row Button Trigger in form -->
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
          {{ formattedTriggerDate || placeholder }}
        </span>
        <ChevronRight :size="16" class="row-chevron" />
      </div>
    </button>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <!-- Custom Date Slider Bottom Sheet -->
    <ion-modal
      :is-open="isOpen"
      :breakpoints="[0, 1]"
      :initial-breakpoint="1"
      :expand-to-scroll="false"
      class="date-slider-modal"
      aria-label="Choose a date"
      @did-dismiss="handleDismiss"
    >
      <div class="date-slider-sheet">
        <!-- Sheet Header -->
        <header class="sheet-header">
          <div class="sheet-header-text">
            <h2 class="sheet-title">Select Date</h2>
            <span class="sheet-subtitle">Choose from the last 30 days</span>
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

        <!-- Main Body: Date Visualizer, Slider & Cards -->
        <div class="sheet-body">
          <!-- Hero Selected Date Card -->
          <div class="hero-date-card">
            <div class="hero-top-row">
              <span class="hero-relative-badge" :class="{ 'is-today': activeDayItem?.daysAgo === 0 }">
                {{ activeDayItem?.relativeLabel }}
              </span>
              <span class="hero-weekday">{{ activeDayItem?.weekdayLong }}</span>
            </div>
            <div class="hero-date-text">
              {{ activeDayItem?.monthLong }} {{ activeDayItem?.dayNumber }}, {{ currentYear }}
            </div>
          </div>

          <!-- Interactive Range Slider -->
          <div class="slider-section">
            <div class="slider-meta-row">
              <span class="slider-meta-title">Timeframe</span>
              <span class="slider-meta-val">
                {{ activeDayItem?.daysAgo === 0 ? 'Happened Today' : `${activeDayItem?.daysAgo} days ago` }}
              </span>
            </div>

            <div class="slider-track-box">
              <input
                v-model.number="draftDaysAgo"
                type="range"
                min="0"
                max="30"
                step="1"
                class="modern-range-slider"
                :style="sliderProgressStyle"
                aria-label="Date slider in days ago"
              />
            </div>

            <!-- Ticks along the slider -->
            <div class="slider-ticks-row">
              <button
                type="button"
                class="tick-btn"
                :class="{ active: draftDaysAgo === 0 }"
                @click="draftDaysAgo = 0"
              >
                Today
              </button>
              <button
                type="button"
                class="tick-btn"
                :class="{ active: draftDaysAgo === 7 }"
                @click="draftDaysAgo = 7"
              >
                7d
              </button>
              <button
                type="button"
                class="tick-btn"
                :class="{ active: draftDaysAgo === 14 }"
                @click="draftDaysAgo = 14"
              >
                14d
              </button>
              <button
                type="button"
                class="tick-btn"
                :class="{ active: draftDaysAgo === 21 }"
                @click="draftDaysAgo = 21"
              >
                21d
              </button>
              <button
                type="button"
                class="tick-btn"
                :class="{ active: draftDaysAgo === 30 }"
                @click="draftDaysAgo = 30"
              >
                30d ago
              </button>
            </div>
          </div>

          <!-- Horizontal Day Cards Carousel -->
          <div class="day-carousel-section">
            <div ref="cardsTrackEl" class="day-cards-track">
              <button
                v-for="item in daysList"
                :key="item.daysAgo"
                :ref="(el) => setCardRef(el, item.daysAgo)"
                type="button"
                class="day-card"
                :class="{ active: draftDaysAgo === item.daysAgo }"
                :aria-pressed="draftDaysAgo === item.daysAgo"
                @click="draftDaysAgo = item.daysAgo"
              >
                <span class="card-weekday">{{ item.weekdayShort }}</span>
                <span class="card-number">{{ item.dayNumber }}</span>
                <span class="card-month">{{ item.monthShort }}</span>
              </button>
            </div>
          </div>

          <!-- Quick Presets -->
          <div class="presets-row">
            <button
              v-for="p in presets"
              :key="p.days"
              type="button"
              class="preset-chip"
              :class="{ active: draftDaysAgo === p.days }"
              @click="draftDaysAgo = p.days"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- Sticky Footer Action Buttons -->
        <footer class="sheet-footer">
          <button
            type="button"
            class="footer-btn cancel-btn"
            @click="isOpen = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="footer-btn confirm-btn"
            @click="confirmSelection"
          >
            Apply Date
          </button>
        </footer>
      </div>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from "vue";
import { IonModal } from "@ionic/vue";
import {
  CalendarDays,
  ChevronRight,
  X
} from "lucide-vue-next";

interface DayItem {
  daysAgo: number;
  iso: string;
  dayNumber: number;
  monthShort: string;
  monthLong: string;
  weekdayShort: string;
  weekdayLong: string;
  relativeLabel: string;
  formattedDisplay: string;
}

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
const draftDaysAgo = ref(0);
const cardsTrackEl = ref<HTMLElement | null>(null);
const cardRefs = new Map<number, HTMLElement>();

const setCardRef = (el: Element | ComponentPublicInstance | null, days: number) => {
  if (el instanceof HTMLElement) {
    cardRefs.set(days, el);
  } else {
    cardRefs.delete(days);
  }
};

// Generate 31 day items (0 = Today down to 30 = 30 days ago)
const generateDaysList = (): DayItem[] => {
  const list: DayItem[] = [];
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = 0; i <= 30; i++) {
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;

    const dayNumber = d.getDate();
    const monthShort = d.toLocaleDateString("en-US", { month: "short" });
    const monthLong = d.toLocaleDateString("en-US", { month: "long" });
    const weekdayShort = d.toLocaleDateString("en-US", { weekday: "short" });
    const weekdayLong = d.toLocaleDateString("en-US", { weekday: "long" });

    let relativeLabel = `${i} days ago`;
    if (i === 0) relativeLabel = "Today";
    else if (i === 1) relativeLabel = "Yesterday";

    const formattedDisplay = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    list.push({
      daysAgo: i,
      iso,
      dayNumber,
      monthShort,
      monthLong,
      weekdayShort,
      weekdayLong,
      relativeLabel,
      formattedDisplay
    });
  }
  return list;
};

const daysList = ref<DayItem[]>(generateDaysList());

const currentYear = computed(() => {
  const d = activeDayItem.value;
  if (!d) return new Date().getFullYear();
  return d.iso.split("-")[0];
});

const getDaysAgoFromIso = (iso: string): number => {
  if (!iso) return 0;
  const match = daysList.value.find((item) => item.iso === iso);
  if (match) return match.daysAgo;

  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = todayDate.getTime() - target.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(30, days));
};

const activeDayItem = computed<DayItem | undefined>(() => {
  return daysList.value[draftDaysAgo.value] || daysList.value[0];
});

const sliderProgressStyle = computed(() => {
  const pct = (draftDaysAgo.value / 30) * 100;
  return {
    background: `linear-gradient(to right, var(--app-primary) 0%, var(--app-primary) ${pct}%, var(--app-surface-secondary) ${pct}%, var(--app-surface-secondary) 100%)`
  };
});

const presets = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "3 days ago", days: 3 },
  { label: "1 week ago", days: 7 },
  { label: "2 weeks ago", days: 14 },
  { label: "30 days ago", days: 30 }
];

const formattedTriggerDate = computed(() => {
  if (!props.modelValue) return "";
  const match = daysList.value.find((item) => item.iso === props.modelValue);
  if (match) {
    if (match.daysAgo === 0) return `Today (${match.formattedDisplay})`;
    if (match.daysAgo === 1) return `Yesterday (${match.formattedDisplay})`;
    return match.formattedDisplay;
  }
  return props.modelValue;
});

const scrollActiveCardIntoView = () => {
  const el = cardRefs.get(draftDaysAgo.value);
  if (el && cardsTrackEl.value) {
    el.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }
};

watch(draftDaysAgo, () => {
  scrollActiveCardIntoView();
});

const handleOpen = async () => {
  if (props.disabled) return;
  // Refresh day list in case day changed
  daysList.value = generateDaysList();
  draftDaysAgo.value = getDaysAgoFromIso(props.modelValue);
  isOpen.value = true;
  await nextTick();
  setTimeout(scrollActiveCardIntoView, 250);
};

const handleDismiss = () => {
  isOpen.value = false;
};

const confirmSelection = () => {
  if (activeDayItem.value) {
    emit("update:modelValue", activeDayItem.value.iso);
  }
  isOpen.value = false;
};
</script>

<style scoped>
.custom-date-picker-wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* Row Trigger Button */
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

/* Modal Bottom Sheet */
.date-slider-modal {
  --height: auto;
  --max-height: 90vh;
  --width: 100%;
  --max-width: 480px;
  --border-radius: 24px 24px 0 0;
}

.date-slider-sheet {
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  color: var(--app-text-primary);
  padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
}

/* Header */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--app-card-border);
}

.sheet-header-text {
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

.sheet-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--app-text-tertiary);
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

/* Body */
.sheet-body {
  padding: 14px 18px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Hero Date Card */
.hero-date-card {
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  border-radius: 16px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-relative-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  background: var(--app-surface);
  color: var(--app-text-secondary);
  border: 1px solid var(--app-card-border);
}

.hero-relative-badge.is-today {
  background: var(--app-primary);
  color: #ffffff;
  border-color: var(--app-primary);
}

.hero-weekday {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hero-date-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text-primary);
  margin-top: 2px;
}

/* Slider Section */
.slider-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px;
}

.slider-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.slider-meta-title {
  color: var(--app-text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slider-meta-val {
  color: var(--app-primary);
  font-weight: 700;
}

.slider-track-box {
  width: 100%;
}

.modern-range-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 6px;
  outline: none;
  cursor: pointer;
  margin: 8px 0;
  border: 1px solid var(--app-card-border);
}

.modern-range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--app-primary);
  border: 3px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.modern-range-slider::-webkit-slider-thumb:active {
  transform: scale(1.15);
}

.modern-range-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--app-primary);
  border: 3px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

.slider-ticks-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.tick-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text-tertiary);
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s ease;
}

.tick-btn.active {
  color: var(--app-primary);
  font-weight: 700;
}

/* Day Cards Carousel */
.day-carousel-section {
  width: 100%;
  overflow: hidden;
}

.day-cards-track {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px 8px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.day-cards-track::-webkit-scrollbar {
  display: none;
}

.day-card {
  scroll-snap-align: center;
  flex-shrink: 0;
  width: 52px;
  height: 64px;
  border-radius: 12px;
  border: 1px solid var(--app-card-border);
  background: var(--app-surface-secondary);
  color: var(--app-text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  padding: 6px 0;
  transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.day-card:active {
  transform: scale(0.95);
}

.day-card.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-weekday {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  opacity: 0.8;
}

.card-number {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
}

.card-month {
  font-size: 10px;
  font-weight: 500;
  opacity: 0.75;
}

/* Presets */
.presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.preset-chip.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #ffffff;
}

/* Footer Actions */
.sheet-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px 0;
  border-top: 1px solid var(--app-card-border);
}

.footer-btn {
  height: 42px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.footer-btn:active {
  opacity: 0.7;
}

.cancel-btn {
  background: var(--app-surface-secondary);
  border: 1px solid var(--app-card-border);
  color: var(--app-text-secondary);
  padding: 0 16px;
}

.confirm-btn {
  background: var(--app-primary);
  color: #ffffff;
  padding: 0 24px;
  flex: 1;
}
</style>
