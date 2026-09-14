<template>
  <ion-page>
    <!-- iOS Minimal Header with Translucency -->
    <ion-header :translucent="true" class="ios-header">
      <ion-toolbar class="ios-toolbar">
        <ion-title class="ios-title-small">Activity</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ios-content">
      <!-- Pull To Refresh -->
      <ion-refresher slot="fixed" @ion-refresh="handleRefresh">
        <ion-refresher-content pulling-icon="arrow-down" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="ios-screen-container">
        <!-- Large iOS Navigation Header Title -->
        <header class="ios-large-header">
          <span class="ios-pretitle">HISTORY &amp; INSIGHTS</span>
          <h1 class="ios-large-title">Activity</h1>
          <p class="ios-subtitle">Recent timeline of reported and resolved belongings.</p>
        </header>

        <!-- KPI Metrics Grid -->
        <section class="metrics-grid" aria-label="Activity Metrics">
          <div class="metric-card">
            <span class="metric-number text-primary">{{ items.length }}</span>
            <span class="metric-name">Total Logged</span>
          </div>
          <div class="metric-card">
            <span class="metric-number text-success">{{ claimedCount }}</span>
            <span class="metric-name">Resolved / Claimed</span>
          </div>
          <div class="metric-card">
            <span class="metric-number text-warning">{{ unclaimedCount }}</span>
            <span class="metric-name">Still Unclaimed</span>
          </div>
        </section>

        <!-- Activity Feed Sections -->
        <div v-if="loading" class="loading-wrap">
          <ion-spinner name="crescent" />
          <span>Loading activity history...</span>
        </div>

        <div v-else class="activity-sections-list">
          <!-- Section 1: Recently Reported Items -->
          <section class="activity-group">
            <div class="group-header">
              <span class="group-title">RECENTLY REPORTED</span>
              <span class="group-badge">{{ recentItems.length }}</span>
            </div>
            <div v-if="recentItems.length" class="ios-inset-list">
              <div
                v-for="item in recentItems"
                :key="item.id"
                class="ios-list-row"
                role="button"
                tabindex="0"
                @click="openDetails(item)"
              >
                <div
                  class="row-status-dot"
                  :class="item.type === 'Found' ? 'dot-found' : 'dot-lost'"
                ></div>
                <div class="row-info">
                  <span class="row-title">{{ item.itemName }}</span>
                  <span class="row-sub">
                    {{ item.type }} • {{ item.location }} • {{ formatDate(item.date) }}
                  </span>
                </div>
                <span
                  class="row-tag"
                  :class="item.status === 'Claimed' ? 'tag-claimed' : 'tag-unclaimed'"
                >
                  {{ item.status }}
                </span>
                <ChevronRight :size="16" class="row-chevron" />
              </div>
            </div>
            <div v-else class="group-empty">No items recorded yet.</div>
          </section>

          <!-- Section 2: Recently Claimed / Resolved -->
          <section class="activity-group">
            <div class="group-header">
              <span class="group-title">RECENTLY RESOLVED &amp; CLAIMED</span>
              <span class="group-badge">{{ claimedItems.length }}</span>
            </div>
            <div v-if="claimedItems.length" class="ios-inset-list">
              <div
                v-for="item in claimedItems"
                :key="item.id"
                class="ios-list-row"
                role="button"
                tabindex="0"
                @click="openDetails(item)"
              >
                <div class="row-status-dot dot-claimed"></div>
                <div class="row-info">
                  <span class="row-title">{{ item.itemName }}</span>
                  <span class="row-sub">
                    Found &amp; Returned • {{ item.location }}
                  </span>
                </div>
                <ChevronRight :size="16" class="row-chevron" />
              </div>
            </div>
            <div v-else class="group-empty">No items claimed yet.</div>
          </section>

          <!-- Section 3: Active Lost Items -->
          <section class="activity-group">
            <div class="group-header">
              <span class="group-title">PENDING LOST BELONGINGS</span>
              <span class="group-badge">{{ lostUnclaimedItems.length }}</span>
            </div>
            <div v-if="lostUnclaimedItems.length" class="ios-inset-list">
              <div
                v-for="item in lostUnclaimedItems"
                :key="item.id"
                class="ios-list-row"
                role="button"
                tabindex="0"
                @click="openDetails(item)"
              >
                <div class="row-status-dot dot-lost"></div>
                <div class="row-info">
                  <span class="row-title">{{ item.itemName }}</span>
                  <span class="row-sub">Missing at {{ item.location }} • {{ formatDate(item.date) }}</span>
                </div>
                <ChevronRight :size="16" class="row-chevron" />
              </div>
            </div>
            <div v-else class="group-empty">No pending lost items.</div>
          </section>

          <!-- Section 4: Active Found Items Waiting for Owner -->
          <section class="activity-group">
            <div class="group-header">
              <span class="group-title">FOUND ITEMS WAITING FOR OWNER</span>
              <span class="group-badge">{{ foundUnclaimedItems.length }}</span>
            </div>
            <div v-if="foundUnclaimedItems.length" class="ios-inset-list">
              <div
                v-for="item in foundUnclaimedItems"
                :key="item.id"
                class="ios-list-row"
                role="button"
                tabindex="0"
                @click="openDetails(item)"
              >
                <div class="row-status-dot dot-found"></div>
                <div class="row-info">
                  <span class="row-title">{{ item.itemName }}</span>
                  <span class="row-sub">Found at {{ item.location }} • {{ formatDate(item.date) }}</span>
                </div>
                <ChevronRight :size="16" class="row-chevron" />
              </div>
            </div>
            <div v-else class="group-empty">No pending found items.</div>
          </section>
        </div>
      </div>
    </ion-content>

    <!-- Floating Dock -->
    <AppDock
      current-tab="profile"
      @select-tab="handleTabSelect"
      @open-create="showReportModal = true"
    />

    <!-- Item Details Modal -->
    <ItemDetailsModal
      :is-open="selectedItem !== null"
      :item="selectedItem"
      :format-date="formatDate"
      @close="selectedItem = null"
      @edit="handleStartEdit"
      @delete="handleDeleteItem"
      @toggle-status="handleToggleStatus"
    />

    <!-- Report / Edit Modal -->
    <ReportItemModal
      :is-open="showReportModal"
      :form="form"
      :errors="errors"
      :editing-id="editingId"
      :saving="saving"
      @close="handleCloseReport"
      @submit="handleSaveItem"
      @clear-error="clearError"
      @update-form="Object.assign(form, $event)"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from "@ionic/vue";
import { ChevronRight } from "lucide-vue-next";
import {
  get,
  onValue,
  push,
  ref as databaseRef,
  remove,
  update,
} from "firebase/database";
import AppDock from "../components/AppDock.vue";
import ItemDetailsModal from "../components/ItemDetailsModal.vue";
import ReportItemModal from "../components/ReportItemModal.vue";
import { db } from "../firebase";
import type {
  FieldName,
  FormErrors,
  ItemStatus,
  ItemType,
  LostFoundForm,
  LostFoundItem,
} from "../types/lostFound";

const router = useRouter();

const items = ref<LostFoundItem[]>([]);
const loading = ref(true);
const saving = ref(false);
const showReportModal = ref(false);
const selectedItem = ref<LostFoundItem | null>(null);
const editingId = ref<string | null>(null);
const errors = reactive<FormErrors>({});

const form = reactive<LostFoundForm>({
  itemName: "",
  description: "",
  location: "",
  date: new Date().toISOString().split("T")[0],
  type: "Lost",
  status: "Unclaimed",
});

let unsubscribe: (() => void) | undefined;

const claimedCount = computed(
  () => items.value.filter((i) => i.status === "Claimed").length
);
const unclaimedCount = computed(
  () => items.value.filter((i) => i.status === "Unclaimed").length
);

const recentItems = computed(() => {
  return [...items.value]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
});

const claimedItems = computed(() => {
  return items.value.filter((i) => i.status === "Claimed");
});

const lostUnclaimedItems = computed(() => {
  return items.value.filter((i) => i.type === "Lost" && i.status === "Unclaimed");
});

const foundUnclaimedItems = computed(() => {
  return items.value.filter((i) => i.type === "Found" && i.status === "Unclaimed");
});

const showToast = async (
  message: string,
  color: "success" | "danger" = "success"
) => {
  const toast = await toastController.create({
    message,
    duration: 2500,
    position: "top",
    color,
  });
  await toast.present();
};

const handleRefresh = async (event: CustomEvent) => {
  try {
    const snapshot = await get(databaseRef(db, "lost_found"));
    items.value = snapshot.exists()
      ? Object.entries(snapshot.val()).map(([id, item]) => ({
          id,
          ...(item as Omit<LostFoundItem, "id">),
        }))
      : [];
  } catch (err) {
    console.error("Refresh failed:", err);
  } finally {
    event.detail.complete();
  }
};

const handleTabSelect = (tab: "home" | "messages" | "profile") => {
  if (tab === "home") {
    router.push("/tabs/home");
  } else if (tab === "messages") {
    router.push("/tabs/messages");
  } else {
    router.push("/tabs/profile");
  }
};

const openDetails = (item: LostFoundItem) => {
  selectedItem.value = item;
};

const clearError = (field: FieldName) => {
  delete errors[field];
};

const validateForm = () => {
  const fields: Array<[FieldName, string, string]> = [
    ["itemName", form.itemName, "Item name is required."],
    ["description", form.description, "Description is required."],
    ["location", form.location, "Location is required."],
    ["date", form.date, "Date is required."],
    ["type", form.type, "Type is required."],
    ["status", form.status, "Status is required."],
  ];
  fields.forEach(([field, value, message]) => {
    if (!value.trim()) errors[field] = message;
  });
  return Object.keys(errors).length === 0;
};

const resetForm = () => {
  Object.assign(form, {
    itemName: "",
    description: "",
    location: "",
    date: new Date().toISOString().split("T")[0],
    type: "Lost" as ItemType,
    status: "Unclaimed" as ItemStatus,
  });
  editingId.value = null;
  Object.keys(errors).forEach((field) => delete errors[field as FieldName]);
};

const handleCloseReport = () => {
  showReportModal.value = false;
  resetForm();
};

const handleStartEdit = (item: LostFoundItem) => {
  Object.assign(form, item);
  editingId.value = item.id;
  showReportModal.value = true;
};

const handleSaveItem = async () => {
  if (!validateForm()) return;
  saving.value = true;
  const editing = Boolean(editingId.value);
  const payload = {
    itemName: form.itemName.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    date: form.date,
    type: form.type,
    status: form.status,
  };

  try {
    if (editingId.value) {
      await update(databaseRef(db, `lost_found/${editingId.value}`), payload);
    } else {
      await push(databaseRef(db, "lost_found"), payload);
    }
    handleCloseReport();
    await showToast(
      editing ? "✓ Item updated successfully" : "✓ Item reported successfully"
    );
  } catch (error) {
    console.error("Save error:", error);
    await showToast("Could not save item. Please try again.", "danger");
  } finally {
    saving.value = false;
  }
};

const handleDeleteItem = async (id: string) => {
  try {
    await remove(databaseRef(db, `lost_found/${id}`));
    selectedItem.value = null;
    await showToast("Item deleted.");
  } catch (error) {
    console.error("Delete error:", error);
    await showToast("Could not delete item.", "danger");
  }
};

const handleToggleStatus = async (item: LostFoundItem) => {
  try {
    const nextStatus: ItemStatus =
      item.status === "Claimed" ? "Unclaimed" : "Claimed";
    await update(databaseRef(db, `lost_found/${item.id}`), {
      status: nextStatus,
    });
    // Update active view
    if (selectedItem.value && selectedItem.value.id === item.id) {
      selectedItem.value.status = nextStatus;
    }
    await showToast(
      nextStatus === "Claimed"
        ? "✓ Marked as claimed"
        : "✓ Marked as unclaimed"
    );
  } catch (error) {
    console.error("Status update error:", error);
    await showToast("Could not update status.", "danger");
  }
};

const formatDate = (val: string) => {
  const parsed = new Date(`${val}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? val
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(parsed);
};

onMounted(() => {
  unsubscribe = onValue(
    databaseRef(db, "lost_found"),
    (snapshot) => {
      items.value = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, item]) => ({
            id,
            ...(item as Omit<LostFoundItem, "id">),
          }))
        : [];
      loading.value = false;
    },
    (err) => {
      console.error("Firebase onValue error:", err);
      loading.value = false;
    }
  );
});

onUnmounted(() => unsubscribe?.());
</script>

<style scoped>
.ios-content {
  --background: var(--app-bg);
}

.ios-header {
  border-bottom: 0.5px solid var(--app-separator);
}

.ios-toolbar {
  --background: var(--app-bg);
  --color: var(--app-text-primary);
}

.ios-title-small {
  font-size: 17px;
  font-weight: 600;
}

.ios-large-header {
  padding: 16px 20px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ios-pretitle {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--ion-color-primary);
}

.ios-large-title {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.8px;
  color: var(--app-text-primary);
}

.ios-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-secondary);
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 20px;
}

.metric-card {
  background: var(--app-surface);
  border-radius: 16px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}

.metric-number {
  font-size: 24px;
  font-weight: 800;
}

.text-primary {
  color: var(--ion-color-primary);
}

.text-success {
  color: var(--status-found-text);
}

.text-warning {
  color: var(--status-unclaimed-text);
}

.metric-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--app-text-secondary);
  font-size: 14px;
}

/* Activity Sections */
.activity-sections-list {
  padding: 10px 20px 110px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.activity-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.group-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: var(--app-text-secondary);
}

.group-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--app-text-secondary);
  background: var(--app-surface-secondary);
  padding: 2px 8px;
  border-radius: 10px;
}

.ios-inset-list {
  background: var(--app-surface);
  border-radius: 18px;
  border: 1px solid var(--app-card-border);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
}

.ios-list-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 0.5px solid var(--app-separator);
  cursor: pointer;
  transition: background 0.15s ease;
}

.ios-list-row:last-child {
  border-bottom: none;
}

.ios-list-row:active {
  background: var(--app-surface-secondary);
}

.row-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 14px;
  flex-shrink: 0;
}

.dot-lost {
  background: var(--status-lost-text);
}
.dot-found {
  background: var(--status-found-text);
}
.dot-claimed {
  background: var(--status-claimed-text);
}

.row-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.row-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sub {
  font-size: 12px;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  margin: 0 8px;
}

.tag-claimed {
  background: var(--status-claimed-bg);
  color: var(--status-claimed-text);
}

.tag-unclaimed {
  background: var(--status-unclaimed-bg);
  color: var(--status-unclaimed-text);
}

.row-chevron {
  font-size: 16px;
  color: var(--app-text-tertiary);
}

.group-empty {
  font-size: 13px;
  color: var(--app-text-secondary);
  padding: 12px 16px;
  background: var(--app-surface);
  border-radius: 14px;
  border: 1px dashed var(--app-card-border);
}
</style>
