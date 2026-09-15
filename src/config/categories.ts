export interface CategoryConfig {
  name: string;
  key: string;
  subcategories: string[];
}

/**
 * Smart Category/Subcategory Normalizer
 * Normalizes strings by removing accents, lowercase, collapsing spaces, hyphens, underscores and punctuation.
 * Example:
 * "Back Pack", "backpack", "BACK-PACK", "back_pack", " BackPack " -> "backpack"
 * "Cell Phone", "cell-phone", "CELL_PHONE" -> "cellphone"
 * "Phone", "Phone Case" -> "phone" vs "phonecase" (distinct, exact-key only)
 */
export function normalizeCategoryKey(value?: string | null): string {
  if (!value) return '';
  return value
    .trim()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // remove Unicode diacritics / accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, ''); // retain letters and numbers, including non-Latin names
}

export const MAIN_CATEGORIES: CategoryConfig[] = [
  {
    name: "Pets",
    key: "pets",
    subcategories: ["Cat", "Dog", "Bird", "Other Pet"]
  },
  {
    name: "Accessories",
    key: "accessories",
    subcategories: ["Ring", "Necklace", "Bracelet", "Watch", "Earrings"]
  },
  {
    name: "Bags",
    key: "bags",
    subcategories: ["Tote Bag", "Backpack", "Kids Bag", "Handbag", "Sling Bag"]
  },
  {
    name: "People",
    key: "people",
    subcategories: ["Boy", "Girl", "Man", "Woman"]
  },
  {
    name: "Gadgets",
    key: "gadgets",
    subcategories: ["Laptop", "Phone", "Tablet", "Earphones", "Charger", "Smartwatch"]
  },
  {
    name: "Wallets & Cards",
    key: "walletsandcards",
    subcategories: ["Wallet", "Coin Purse", "Card Holder", "Debit/Credit Card", "Membership Card"]
  },
  {
    name: "Keys",
    key: "keys",
    subcategories: ["House Key", "Car Key", "Motorcycle Key", "Keychain"]
  },
  {
    name: "Documents & IDs",
    key: "documentsandids",
    subcategories: ["Government ID", "School ID", "Company ID", "Passport", "License", "Certificate"]
  },
  {
    name: "Clothing",
    key: "clothing",
    subcategories: ["Shirt", "Jacket", "Pants", "Cap/Hat"]
  },
  {
    name: "Footwear",
    key: "footwear",
    subcategories: ["Shoes", "Slippers", "Sandals"]
  },
  {
    name: "School & Office",
    key: "schoolandoffice",
    subcategories: ["Notebook", "Book", "Pen", "Pencil Case", "Calculator"]
  },
  {
    name: "Toys",
    key: "toys",
    subcategories: ["Doll", "Stuffed Toy", "Toy Vehicle"]
  },
  {
    name: "Other",
    key: "other",
    subcategories: ["Other"]
  }
];

export const CATEGORY_NAMES: string[] = MAIN_CATEGORIES.map((c) => c.name);

export function getCategoryConfig(categoryName: string): CategoryConfig | undefined {
  const norm = normalizeCategoryKey(categoryName);
  return MAIN_CATEGORIES.find((c) => c.key === norm || normalizeCategoryKey(c.name) === norm);
}
