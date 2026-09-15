import { ref, onMounted, onUnmounted } from "vue";
import { ref as dbRef, onValue, get } from "firebase/database";
import { db } from "../firebase";
import {
  MAIN_CATEGORIES,
  normalizeCategoryKey,
  getCategoryConfig
} from "../config/categories";

// Global cache for real-time dynamic subcategories from Firebase: { [normCatKey]: { [normSubKey]: string } }
const customSubcategoriesByCat = ref<Record<string, Record<string, string>>>({});
let listenerConsumers = 0;
let unsubscribe: (() => void) | null = null;

export interface ResolvedCustomSubcategory {
  name: string;
  normalizedKey: string;
  categoryKey: string;
  isNew: boolean;
}

/** Resolve a local choice without writing an unpublished option to the shared registry. */
export async function resolveCustomSubcategory(
  categoryName: string,
  rawSubCategory: string
): Promise<ResolvedCustomSubcategory> {
  const mainCat = getCategoryConfig(categoryName);
  if (!mainCat) throw new Error("Choose a main category first.");
  const trimmed = rawSubCategory.trim().normalize("NFC");
  const categoryKey = mainCat.key;
  const normalizedKey = normalizeCategoryKey(trimmed);
  if (!normalizedKey) throw new Error("Enter a subcategory with letters or numbers.");
  if (trimmed.length > 80) throw new Error("Subcategory must be 80 characters or fewer.");

  const matchedDefault = mainCat.subcategories.find(
    (name) => normalizeCategoryKey(name) === normalizedKey
  );
  const cachedName = customSubcategoriesByCat.value[categoryKey]?.[normalizedKey];
  if (matchedDefault || cachedName) {
    return { name: matchedDefault || cachedName, normalizedKey, categoryKey, isNew: false };
  }

  const snap = await get(dbRef(db, `subcategories/${categoryKey}/${normalizedKey}`));
  if (snap.exists()) {
    const value = snap.val();
    if (typeof value?.name !== "string" || normalizeCategoryKey(value.name) !== normalizedKey) {
      throw new Error("Could not load this subcategory. Please try again.");
    }
    const name = value.name.trim();
    customSubcategoriesByCat.value[categoryKey] ||= {};
    customSubcategoriesByCat.value[categoryKey][normalizedKey] = name;
    return { name, normalizedKey, categoryKey, isNew: false };
  }

  return { name: trimmed, normalizedKey, categoryKey, isNew: true };
}

export function useCategories() {
  const initSubcategoriesListener = () => {
    if (unsubscribe) return;

    const subcatRef = dbRef(db, "subcategories");
    unsubscribe = onValue(
      subcatRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const mapped: Record<string, Record<string, string>> = {};
          Object.entries(val).forEach(([category, subMap]) => {
            const catKey = getCategoryConfig(category)?.key || normalizeCategoryKey(category);
            if (!catKey) return;
            mapped[catKey] ||= {};
            if (typeof subMap === "object" && subMap !== null) {
              Object.values(subMap).forEach((item) => {
                if (item && typeof item.name === "string") {
                  const subKey = normalizeCategoryKey(item.name);
                  if (subKey) mapped[catKey][subKey] ||= item.name.trim();
                }
              });
            }
          });
          customSubcategoriesByCat.value = mapped;
        } else {
          customSubcategoriesByCat.value = {};
        }
      },
      (err) => {
        console.warn("Subcategories listener error:", err);
      }
    );
  };

  /**
   * Get all subcategories for a category (default + custom, merged and deduplicated)
   */
  const getSubcategoriesForCategory = (categoryName: string): string[] => {
    const mainCat = getCategoryConfig(categoryName);
    const normCatKey = mainCat?.key || normalizeCategoryKey(categoryName);

    const defaults = mainCat ? [...mainCat.subcategories] : [];
    const customObj = customSubcategoriesByCat.value[normCatKey] || {};

    const seenNormKeys = new Set<string>();
    const result: string[] = [];

    // Add defaults first
    defaults.forEach((sub) => {
      const k = normalizeCategoryKey(sub);
      if (k && !seenNormKeys.has(k)) {
        seenNormKeys.add(k);
        result.push(sub);
      }
    });

    // Add custom subcategories
    Object.values(customObj).forEach((name) => {
      const normKey = normalizeCategoryKey(name);
      if (normKey && !seenNormKeys.has(normKey)) {
        seenNormKeys.add(normKey);
        result.push(name.trim());
      }
    });

    return result;
  };

  onMounted(() => {
    listenerConsumers += 1;
    initSubcategoriesListener();
  });

  onUnmounted(() => {
    listenerConsumers -= 1;
    if (listenerConsumers === 0) {
      unsubscribe?.();
      unsubscribe = null;
    }
  });

  return {
    mainCategories: MAIN_CATEGORIES,
    customSubcategoriesByCat,
    getSubcategoriesForCategory,
    resolveCustomSubcategory,
    normalizeCategoryKey
  };
}
