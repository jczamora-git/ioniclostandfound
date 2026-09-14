<template>
  <ion-modal
    :is-open="isOpen"
    :breakpoints="[0, 0.85, 1]"
    :initial-breakpoint="0.85"
    @did-dismiss="$emit('close')"
  >
    <div v-if="item" class="details-sheet">
      <!-- Sheet Navigation Bar -->
      <div class="sheet-top-bar">
        <div class="grabber-pill"></div>
        <div class="sheet-actions-header">
          <button
            type="button"
            class="nav-icon-btn close-btn"
            aria-label="Close"
            @click="$emit('close')"
          >
            <X :size="18" />
          </button>

          <span class="sheet-title-text">Item Details</span>

          <button
            type="button"
            class="nav-text-btn edit-btn"
            @click="onEdit"
          >
            Edit
          </button>
        </div>
      </div>

      <!-- Scrollable Sheet Content -->
      <div class="sheet-scroll-body">
        <!-- Visual Area -->
        <div class="details-visual">
          <div class="visual-badge-group">
            <span
              class="visual-pill"
              :class="item.type === 'Found' ? 'pill-found' : 'pill-lost'"
            >
              {{ item.type }}
            </span>
            <span
              class="visual-pill"
              :class="item.status === 'Claimed' ? 'status-claimed' : 'status-unclaimed'"
            >
              {{ item.status }}
            </span>
          </div>

          <div class="details-icon-box">
            <ImageIcon :size="28" />
          </div>
          <span class="photo-hint">Photo attachment ready</span>
        </div>

        <!-- Main Title & Primary Badges -->
        <div class="title-section">
          <h2 class="details-main-title">{{ item.itemName }}</h2>
          <p class="details-subtitle">
            Reported as {{ item.type.toLowerCase() }} • {{ formatDate(item.date) }}
          </p>
        </div>

        <!-- Grouped Inset Metadata Sections (iOS Settings style) -->
        <div class="ios-grouped-list">
          <div class="grouped-row">
            <div class="row-leading">
              <div class="row-icon-box icon-location">
                <MapPin :size="16" />
              </div>
              <div class="row-text">
                <span class="row-label">LOCATION</span>
                <span class="row-value">{{ item.location }}</span>
              </div>
            </div>
          </div>

          <div class="grouped-row">
            <div class="row-leading">
              <div class="row-icon-box icon-calendar">
                <CalendarDays :size="16" />
              </div>
              <div class="row-text">
                <span class="row-label">DATE RECORDED</span>
                <span class="row-value">{{ formatDate(item.date) }}</span>
              </div>
            </div>
          </div>

          <div class="grouped-row">
            <div class="row-leading">
              <div class="row-icon-box" :class="item.status === 'Claimed' ? 'icon-claimed' : 'icon-unclaimed'">
                <BadgeCheck v-if="item.status === 'Claimed'" :size="16" />
                <AlertCircle v-else :size="16" />
              </div>
              <div class="row-text">
                <span class="row-label">STATUS</span>
                <span class="row-value">{{ item.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description Card -->
        <div class="desc-card-section">
          <span class="section-micro-label">DESCRIPTION</span>
          <div class="desc-content-box">
            <p class="desc-text">{{ item.description || "No additional description provided." }}</p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="sheet-action-buttons">
          <!-- Primary Toggle Claim Status Button -->
          <button
            type="button"
            class="ios-primary-btn"
            :class="{ 'btn-claimed-state': item.status === 'Claimed' }"
            @click="$emit('toggle-status', item)"
          >
            <RotateCcw v-if="item.status === 'Claimed'" :size="16" />
            <CheckCheck v-else :size="16" />
            <span>
              {{ item.status === 'Claimed' ? 'Mark as Unclaimed' : 'Mark as Claimed' }}
            </span>
          </button>

          <!-- Edit Item Button -->
          <button
            type="button"
            class="ios-secondary-btn"
            @click="onEdit"
          >
            <Pencil :size="16" />
            <span>Edit Item</span>
          </button>

          <!-- Delete Item (Destructive Alert Trigger) -->
          <button
            type="button"
            class="ios-destructive-btn"
            @click="confirmDelete"
          >
            <Trash2 :size="16" />
            <span>Delete Item</span>
          </button>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { alertController, IonModal } from "@ionic/vue";
import {
  X,
  Image as ImageIcon,
  MapPin,
  CalendarDays,
  BadgeCheck,
  AlertCircle,
  RotateCcw,
  CheckCheck,
  Pencil,
  Trash2
} from "lucide-vue-next";
import type { LostFoundItem } from "../types/lostFound";

const props = defineProps<{
  isOpen: boolean;
  item: LostFoundItem | null;
  formatDate: (dateStr: string) => string;
}>();

const emit = defineEmits<{
  close: [];
  edit: [item: LostFoundItem];
  delete: [id: string];
  "toggle-status": [item: LostFoundItem];
}>();

const onEdit = () => {
  if (props.item) {
    emit("edit", props.item);
    emit("close");
  }
};

const confirmDelete = async () => {
  if (!props.item) return;

  const alert = await alertController.create({
    header: `Delete "${props.item.itemName}"?`,
    message: "This action cannot be undone. All item records will be permanently removed from the database.",
    buttons: [
      {
        text: "Cancel",
        role: "cancel",
      },
      {
        text: "Delete",
        role: "destructive",
        handler: () => {
          if (props.item) {
            emit("delete", props.item.id);
            emit("close");
          }
        },
      },
    ],
  });

  await alert.present();
};
</script>

<style scoped>
.details-sheet {
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

.sheet-actions-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-title-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.nav-icon-btn {
  background: var(--app-surface-secondary);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: transform 0.15s ease;
}

.nav-icon-btn:active {
  transform: scale(0.9);
}

.nav-icon-btn ion-icon {
  font-size: 18px;
}

.nav-text-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-color-primary);
  cursor: pointer;
}

.sheet-scroll-body {
  padding: 0 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

/* Large Visual Top Box */
.details-visual {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 20px;
  background: linear-gradient(
    180deg,
    var(--app-surface-secondary) 0%,
    var(--app-surface-tertiary) 100%
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--app-card-border);
}

.visual-badge-group {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
}

.visual-pill {
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.pill-lost {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-lost-text);
}
.pill-found {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-found-text);
}
.status-claimed {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-claimed-text);
}
.status-unclaimed {
  background: rgba(255, 255, 255, 0.9);
  color: var(--status-unclaimed-text);
}

@media (prefers-color-scheme: dark) {
  .pill-lost,
  .pill-found,
  .status-claimed,
  .status-unclaimed {
    background: rgba(28, 28, 30, 0.85);
  }
}

.details-icon-box {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
}

@media (prefers-color-scheme: dark) {
  .details-icon-box {
    background: rgba(44, 44, 46, 0.8);
  }
}

.details-icon-box ion-icon {
  font-size: 32px;
}

.photo-hint {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-secondary);
  opacity: 0.8;
}

/* Title Section */
.title-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.details-main-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--app-text-primary);
}

.details-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-secondary);
  font-weight: 500;
}

/* Grouped Inset Metadata Sections */
.ios-grouped-list {
  background: var(--app-surface);
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
}

.grouped-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--app-separator);
}

.grouped-row:last-child {
  border-bottom: none;
}

.row-leading {
  display: flex;
  align-items: center;
  gap: 14px;
}

.row-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.row-icon-box ion-icon {
  font-size: 18px;
}

.icon-location {
  background: var(--ion-color-primary);
}

.icon-calendar {
  background: var(--ion-color-secondary);
}

.icon-claimed {
  background: var(--ion-color-success);
}

.icon-unclaimed {
  background: var(--ion-color-warning);
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--app-text-secondary);
}

.row-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
}

/* Description Box */
.desc-card-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-micro-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: var(--app-text-secondary);
  margin-left: 4px;
}

.desc-content-box {
  background: var(--app-surface);
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
  padding: 14px 16px;
}

.desc-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--app-text-primary);
}

/* Sheet Action Buttons */
.sheet-action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.ios-primary-btn,
.ios-secondary-btn,
.ios-destructive-btn {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.ios-primary-btn:active,
.ios-secondary-btn:active,
.ios-destructive-btn:active {
  transform: scale(0.98);
}

.ios-primary-btn {
  background: var(--ion-color-primary);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 122, 255, 0.3);
}

.ios-primary-btn.btn-claimed-state {
  background: var(--app-surface-secondary);
  color: var(--app-text-primary);
  border: 1px solid var(--app-card-border);
  box-shadow: none;
}

.ios-secondary-btn {
  background: var(--app-surface);
  color: var(--ion-color-primary);
  border: 1px solid var(--app-card-border);
}

.ios-destructive-btn {
  background: transparent;
  color: var(--ion-color-danger);
}
</style>
