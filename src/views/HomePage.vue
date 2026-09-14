<template>
  <ion-page>
    <ion-header class="app-header">
      <ion-toolbar>
        <div class="header-inner">
          <div class="brand-mark" aria-hidden="true">
            <ion-icon :icon="searchIcon" />
          </div>
          <div>
            <ion-title>Lost &amp; Found</ion-title>
            <p>Keep track of lost and found items</p>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="dashboard-content">
      <main class="dashboard-shell">
        <section class="welcome-row" aria-labelledby="dashboard-heading">
          <div>
            <p class="eyebrow">Dashboard</p>
            <h1 id="dashboard-heading">Find what matters.</h1>
            <p class="intro-copy">
              Record, organize, and reunite belongings with their owners.
            </p>
          </div>
          <div class="date-pill">
            <ion-icon :icon="calendarIcon" aria-hidden="true" /><span>{{
              todayLabel
            }}</span>
          </div>
        </section>

        <SummaryCards :summaries="summaryCards" />

        <div v-if="errorMessage" class="error-banner" role="alert">
          <ion-icon :icon="warningIcon" aria-hidden="true" /><span>{{
            errorMessage
          }}</span
          ><ion-button fill="clear" size="small" @click="loadItems"
            >Try again</ion-button
          >
        </div>

        <section class="workspace-grid">
          <ItemForm
            :form="form"
            :errors="errors"
            :editing-id="editingId"
            :saving="saving"
            @submit="saveItem"
            @reset="resetForm"
            @clear-error="clearError"
            @update-form="Object.assign(form, $event)"
          />
          <ItemList
            :filtered-items="filteredItems"
            :loading="loading"
            :search-query="searchQuery"
            :active-filter="activeFilter"
            :format-date="formatDate"
            @search-change="searchQuery = $event"
            @filter-change="activeFilter = $event"
            @edit="startEdit"
            @delete="deleteItem"
            @toggle-status="toggleStatus"
          />
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { alertController, toastController } from "@ionic/vue";
import { calendarOutline, searchOutline, warningOutline } from "ionicons/icons";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonToolbar,
  IonTitle,
} from "@ionic/vue";
import {
  get,
  onValue,
  push,
  ref as databaseRef,
  remove,
  update,
} from "firebase/database";
import ItemForm from "../components/ItemForm.vue";
import ItemList from "../components/ItemList.vue";
import SummaryCards from "../components/SummaryCards.vue";
import { db } from "../firebase";
import type {
  FieldName,
  Filter,
  FormErrors,
  ItemStatus,
  ItemType,
  LostFoundForm,
  LostFoundItem,
} from "../types/lostFound";

const searchIcon = searchOutline;
const calendarIcon = calendarOutline;
const warningIcon = warningOutline;
const form = reactive<LostFoundForm>({
  itemName: "",
  description: "",
  location: "",
  date: "",
  type: "Lost",
  status: "Unclaimed",
});
const items = ref<LostFoundItem[]>([]);
const searchQuery = ref("");
const activeFilter = ref<Filter>("All");
const editingId = ref<string | null>(null);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const errors = reactive<FormErrors>({});
let unsubscribe: (() => void) | undefined;
const todayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
}).format(new Date());

const summaryCards = computed(() => [
  {
    label: "Total items",
    value: items.value.length,
    icon: searchIcon,
    tone: "blue",
  },
  {
    label: "Lost items",
    value: items.value.filter((item) => item.type === "Lost").length,
    icon: searchIcon,
    tone: "red",
  },
  {
    label: "Found items",
    value: items.value.filter((item) => item.type === "Found").length,
    icon: calendarIcon,
    tone: "green",
  },
  {
    label: "Unclaimed",
    value: items.value.filter((item) => item.status === "Unclaimed").length,
    icon: warningIcon,
    tone: "orange",
  },
  {
    label: "Claimed",
    value: items.value.filter((item) => item.status === "Claimed").length,
    icon: calendarIcon,
    tone: "teal",
  },
]);
const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return items.value.filter((item) => {
    const matchesFilter =
      activeFilter.value === "All" ||
      item.type === activeFilter.value ||
      item.status === activeFilter.value;
    const matchesSearch =
      !query ||
      [item.itemName, item.description, item.location].some((value) =>
        value.toLowerCase().includes(query),
      );
    return matchesFilter && matchesSearch;
  });
});
const showToast = async (
  message: string,
  color: "success" | "danger" = "success",
) => {
  const toast = await toastController.create({
    message,
    duration: 2600,
    position: "bottom",
    color,
  });
  await toast.present();
};
const loadItems = async () => {
  loading.value = true;
  try {
    const snapshot = await get(databaseRef(db, "lost_found"));
    items.value = snapshot.exists()
      ? Object.entries(snapshot.val()).map(([id, item]) => ({
          id,
          ...(item as Omit<LostFoundItem, "id">),
        }))
      : [];
    errorMessage.value = "";
  } catch (error) {
    console.error("Failed to load items:", error);
    errorMessage.value = "We could not load your items. Please try again.";
  } finally {
    loading.value = false;
  }
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
    date: "",
    type: "Lost" as ItemType,
    status: "Unclaimed" as ItemStatus,
  });
  editingId.value = null;
  Object.keys(errors).forEach((field) => delete errors[field as FieldName]);
};
const saveItem = async () => {
  if (!validateForm()) return;
  saving.value = true;
  const editing = Boolean(editingId.value);
  const item = {
    itemName: form.itemName.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    date: form.date,
    type: form.type,
    status: form.status,
  };
  try {
    if (editingId.value)
      await update(databaseRef(db, `lost_found/${editingId.value}`), item);
    else await push(databaseRef(db, "lost_found"), item);
    resetForm();
    await showToast(
      editing ? "Item updated successfully!" : "Item added successfully!",
    );
  } catch (error) {
    console.error("Failed to save item:", error);
    await showToast("We could not save this item. Please try again.", "danger");
  } finally {
    saving.value = false;
  }
};
const startEdit = (item: LostFoundItem) => {
  Object.assign(form, item);
  editingId.value = item.id;
  window.scrollTo({ top: 0, behavior: "smooth" });
};
const deleteItem = async (id: string) => {
  const alert = await alertController.create({
    header: "Delete item?",
    message: "This record will be permanently removed.",
    buttons: [
      { text: "Cancel", role: "cancel" },
      {
        text: "Delete",
        role: "destructive",
        handler: async () => {
          try {
            await remove(databaseRef(db, `lost_found/${id}`));
            await showToast("Item deleted.");
          } catch (error) {
            console.error("Failed to delete item:", error);
            await showToast("We could not delete this item.", "danger");
          }
        },
      },
    ],
  });
  await alert.present();
};
const toggleStatus = async (item: LostFoundItem) => {
  try {
    const nextStatus: ItemStatus =
      item.status === "Claimed" ? "Unclaimed" : "Claimed";
    await update(databaseRef(db, `lost_found/${item.id}`), {
      status: nextStatus,
    });
    await showToast(
      nextStatus === "Claimed"
        ? "Item marked claimed."
        : "Item marked unclaimed.",
    );
  } catch (error) {
    console.error("Failed to update status:", error);
    await showToast("We could not update the status.", "danger");
  }
};
const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
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
      errorMessage.value = "";
    },
    (error) => {
      console.error("Failed to listen for items:", error);
      loading.value = false;
      errorMessage.value = "We could not load your items. Please try again.";
    },
  );
});
onUnmounted(() => unsubscribe?.());
</script>

<style scoped>
:global(body) {
  background: #10151d;
}
.dashboard-content {
  --background: #10151d;
}
.app-header ion-toolbar {
  --background: #151c26;
  --border-color: rgba(148, 163, 184, 0.14);
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}
.header-inner {
  display: flex;
  align-items: center;
  gap: 11px;
  max-width: 1240px;
  margin: auto;
  padding: 12px 24px;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: #9cc8ff;
  background: rgba(64, 137, 224, 0.16);
}
.brand-mark ion-icon {
  font-size: 21px;
}
.header-inner ion-title {
  padding: 0;
  color: #f4f7fb;
  font-size: 17px;
  font-weight: 700;
}
.header-inner p {
  margin: 2px 0 0;
  color: #8c9bad;
  font-size: 11px;
}
.dashboard-shell {
  max-width: 1240px;
  margin: 0 auto;
  padding: 36px 24px 60px;
}
.welcome-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
}
.eyebrow {
  margin: 0 0 8px;
  color: #78b7ff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.welcome-row h1 {
  margin: 0;
  color: #f7f9fc;
  font-size: clamp(29px, 4vw, 43px);
}
.intro-copy {
  margin: 9px 0 0;
  color: #93a0b0;
  font-size: 14px;
}
.date-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 9px;
  color: #aebaca;
  font-size: 12px;
}
.date-pill ion-icon {
  color: #78b7ff;
}
.workspace-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.78fr) minmax(0, 1.22fr);
  align-items: start;
  gap: 26px;
}
.error-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 20px;
  padding: 10px 12px;
  border: 1px solid rgba(238, 118, 109, 0.4);
  border-radius: 8px;
  color: #ffb1a9;
  background: rgba(160, 48, 48, 0.12);
  font-size: 12px;
}
.error-banner span {
  flex: 1;
}
.error-banner ion-button {
  --color: #ffc0b8;
  margin: 0;
}
@media (max-width: 980px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .header-inner,
  .dashboard-shell {
    padding-left: 16px;
    padding-right: 16px;
  }
  .dashboard-shell {
    padding-top: 25px;
  }
  .welcome-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .date-pill {
    align-self: flex-start;
  }
  .error-banner {
    align-items: flex-start;
  }
}
</style>
