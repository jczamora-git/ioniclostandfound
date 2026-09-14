<template>
  <section class="items-section" aria-labelledby="items-heading">
    <div class="items-heading">
      <div>
        <p class="eyebrow">Your records</p>
        <h2 id="items-heading">Lost &amp; Found Items</h2>
      </div>
      <span class="result-count"
        >{{ filteredItems.length }}
        {{ filteredItems.length === 1 ? "item" : "items" }}</span
      >
    </div>

    <ion-searchbar
      :value="searchQuery"
      class="search-bar"
      placeholder="Search items, details, or locations"
      :debounce="150"
      show-clear-button="focus"
      @ion-input="onSearch"
    />
    <div class="filter-row" role="tablist" aria-label="Filter items">
      <button
        v-for="filter in filters"
        :key="filter"
        class="filter-chip"
        :class="{ active: activeFilter === filter }"
        type="button"
        role="tab"
        :aria-selected="activeFilter === filter"
        @click="$emit('filter-change', filter)"
      >
        {{ filter }}
      </button>
    </div>

    <div v-if="loading" class="state-panel">
      <ion-spinner name="dots" />
      <p>Loading your records...</p>
    </div>
    <div v-else-if="filteredItems.length" class="item-list">
      <article v-for="item in filteredItems" :key="item.id" class="item-card">
        <div class="item-card-top">
          <div
            class="item-symbol"
            :class="item.type === 'Found' ? 'found' : 'lost'"
          >
            <ion-icon :icon="item.type === 'Found' ? checkIcon : searchIcon" />
          </div>
          <div class="item-title">
            <h3>{{ item.itemName }}</h3>
            <p>{{ item.description }}</p>
          </div>
          <div class="item-actions">
            <ion-button
              fill="clear"
              size="small"
              aria-label="Edit item"
              title="Edit item"
              @click="$emit('edit', item)"
              ><ion-icon slot="icon-only" :icon="pencilIcon"
            /></ion-button>
            <ion-button
              fill="clear"
              color="danger"
              size="small"
              aria-label="Delete item"
              title="Delete item"
              @click="$emit('delete', item.id)"
              ><ion-icon slot="icon-only" :icon="trashIcon"
            /></ion-button>
          </div>
        </div>
        <div class="item-meta">
          <span><ion-icon :icon="locationIcon" />{{ item.location }}</span>
          <span
            ><ion-icon :icon="calendarIcon" />{{ formatDate(item.date) }}</span
          >
        </div>
        <div class="item-footer">
          <div class="badges">
            <span class="badge" :class="item.type.toLowerCase()">{{
              item.type
            }}</span
            ><span class="badge" :class="item.status.toLowerCase()">{{
              item.status
            }}</span>
          </div>
          <ion-button
            fill="clear"
            size="small"
            class="claim-button"
            @click="$emit('toggle-status', item)"
            >{{
              item.status === "Claimed" ? "Mark unclaimed" : "Mark claimed"
            }}</ion-button
          >
        </div>
      </article>
    </div>
    <div v-else class="state-panel empty-state">
      <div class="empty-icon"><ion-icon :icon="fileIcon" /></div>
      <h3>
        {{
          searchQuery || activeFilter !== "All"
            ? "No matching items"
            : "No Lost &amp; Found Items Yet"
        }}
      </h3>
      <p>
        {{
          searchQuery || activeFilter !== "All"
            ? "Try a different search or filter."
            : "Add an item to start keeping track of lost and found belongings."
        }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonButton, IonIcon, IonSearchbar, IonSpinner } from "@ionic/vue";
import {
  calendarOutline,
  checkmarkCircleOutline,
  createOutline,
  documentTextOutline,
  locationOutline,
  searchOutline,
  trashOutline,
} from "ionicons/icons";
import type { Filter, LostFoundItem } from "../types/lostFound";

defineProps<{
  filteredItems: LostFoundItem[];
  loading: boolean;
  searchQuery: string;
  activeFilter: Filter;
  formatDate: (value: string) => string;
}>();
const emit = defineEmits<{
  "search-change": [value: string];
  "filter-change": [filter: Filter];
  edit: [item: LostFoundItem];
  delete: [id: string];
  "toggle-status": [item: LostFoundItem];
}>();

const filters: Filter[] = ["All", "Lost", "Found", "Claimed", "Unclaimed"];
const searchIcon = searchOutline;
const calendarIcon = calendarOutline;
const checkIcon = checkmarkCircleOutline;
const pencilIcon = createOutline;
const trashIcon = trashOutline;
const locationIcon = locationOutline;
const fileIcon = documentTextOutline;

const onSearch = (event: CustomEvent<{ value?: string | null }>) => {
  emit("search-change", event.detail.value ?? "");
};
</script>

<style scoped>
.items-section {
  min-width: 0;
}
.items-heading {
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
.items-heading h2 {
  margin: 0;
  color: #eef3f8;
  font-size: 23px;
}
.result-count {
  color: #8090a2;
  font-size: 12px;
}
.search-bar {
  --background: #171f2a;
  --border-radius: 9px;
  --color: #e7edf5;
  --icon-color: #708399;
  --placeholder-color: #718095;
  --box-shadow: none;
  margin: 17px 0 10px;
  padding: 0;
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 15px;
}
.filter-chip {
  padding: 7px 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 7px;
  color: #9aa8b8;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.filter-chip.active {
  border-color: rgba(87, 157, 225, 0.7);
  color: #d8eaff;
  background: rgba(56, 133, 214, 0.17);
}
.item-list {
  display: grid;
  gap: 10px;
}
.item-card {
  padding: 17px;
  background: #171f2a;
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
}
.item-card-top {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}
.item-symbol {
  display: grid;
  flex: 0 0 35px;
  place-items: center;
  width: 35px;
  height: 35px;
  border-radius: 9px;
}
.item-symbol.lost {
  color: #f59b92;
  background: rgba(220, 77, 77, 0.14);
}
.item-symbol.found {
  color: #83d8a5;
  background: rgba(60, 174, 112, 0.14);
}
.item-title {
  min-width: 0;
  flex: 1;
}
.item-title h3 {
  overflow: hidden;
  margin: 0;
  color: #f1f5f9;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-title p {
  overflow: hidden;
  margin: 4px 0 0;
  color: #8997a8;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-actions {
  display: flex;
  margin: -8px -8px 0 0;
}
.item-actions ion-button {
  --padding-start: 7px;
  --padding-end: 7px;
  --color: #8293a8;
}
.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 17px;
  margin: 15px 0 14px 46px;
  color: #99a7b7;
  font-size: 12px;
}
.item-meta span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.item-meta ion-icon {
  color: #679fd7;
}
.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-left: 46px;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.badge {
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.badge.lost {
  color: #ffaaa1;
  background: rgba(220, 77, 77, 0.15);
}
.badge.found {
  color: #8be1ac;
  background: rgba(60, 174, 112, 0.15);
}
.badge.claimed {
  color: #88ded3;
  background: rgba(45, 169, 169, 0.15);
}
.badge.unclaimed {
  color: #f1bf7b;
  background: rgba(227, 141, 54, 0.15);
}
.claim-button {
  --color: #74b3eb;
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
  font-size: 11px;
  text-transform: none;
}
.state-panel {
  display: grid;
  place-items: center;
  min-height: 190px;
  padding: 30px;
  border: 1px dashed rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  color: #8291a3;
  text-align: center;
}
.state-panel p {
  margin: 10px 0 0;
  font-size: 13px;
}
.empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 13px;
  color: #72b5f5;
  background: rgba(64, 137, 224, 0.14);
}
.empty-icon ion-icon {
  font-size: 25px;
}
.empty-state h3 {
  margin: 14px 0 0;
  color: #e7edf5;
  font-size: 16px;
}
.empty-state p {
  max-width: 280px;
  line-height: 1.5;
}
@media (max-width: 600px) {
  .items-heading h2 {
    font-size: 20px;
  }
  .item-card {
    padding: 14px;
  }
  .item-meta,
  .item-footer {
    margin-left: 0;
  }
  .item-meta {
    gap: 10px;
  }
  .item-footer {
    align-items: flex-end;
    flex-direction: column;
    gap: 5px;
  }
  .claim-button {
    align-self: flex-start;
  }
  .item-title p {
    display: -webkit-box;
    overflow: hidden;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
  }
}
</style>
