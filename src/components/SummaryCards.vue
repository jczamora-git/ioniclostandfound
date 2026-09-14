<template>
  <section class="summary-grid" aria-label="Item summary">
    <article
      v-for="summary in summaries"
      :key="summary.label"
      class="summary-card"
    >
      <div class="summary-icon" :class="`summary-icon--${summary.tone}`">
        <ion-icon :icon="summary.icon" aria-hidden="true" />
      </div>
      <div>
        <strong>{{ summary.value }}</strong>
        <span>{{ summary.label }}</span>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";
import { searchOutline } from "ionicons/icons";

interface SummaryCard {
  label: string;
  value: number;
  icon: typeof searchOutline;
  tone: string;
}

defineProps<{ summaries: SummaryCard[] }>();
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin: 30px 0 26px;
}
.summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 17px 15px;
  background: #171f2a;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 12px;
}
.summary-icon {
  display: grid;
  flex: 0 0 35px;
  place-items: center;
  width: 35px;
  height: 35px;
  border-radius: 9px;
}
.summary-icon ion-icon {
  font-size: 19px;
}
.summary-icon--blue {
  color: #75b7ff;
  background: rgba(64, 137, 224, 0.17);
}
.summary-icon--red {
  color: #fa9a91;
  background: rgba(220, 77, 77, 0.14);
}
.summary-icon--green {
  color: #7bd9a3;
  background: rgba(60, 174, 112, 0.14);
}
.summary-icon--orange {
  color: #f4bd78;
  background: rgba(227, 141, 54, 0.14);
}
.summary-icon--teal {
  color: #72d4d2;
  background: rgba(45, 169, 169, 0.14);
}
.summary-card strong {
  display: block;
  color: #f5f7fb;
  font-size: 23px;
  line-height: 1.1;
}
.summary-card span {
  display: block;
  margin-top: 3px;
  color: #8593a5;
  font-size: 11px;
}
@media (max-width: 980px) {
  .summary-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 600px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 23px;
  }
  .summary-card {
    padding: 13px 10px;
    gap: 8px;
  }
  .summary-icon {
    flex-basis: 30px;
    width: 30px;
    height: 30px;
  }
  .summary-card strong {
    font-size: 19px;
  }
  .summary-card span {
    font-size: 10px;
  }
}
</style>
