export type ItemType = "Lost" | "Found";
export type ItemStatus = "Claimed" | "Unclaimed";
export type Filter = "All" | ItemType | ItemStatus;
export type FieldName =
  "itemName" | "description" | "location" | "date" | "type" | "status";

export interface LostFoundItem {
  id: string;
  itemName: string;
  description: string;
  location: string;
  date: string;
  type: ItemType;
  status: ItemStatus;
}

export interface LostFoundForm {
  itemName: string;
  description: string;
  location: string;
  date: string;
  type: ItemType;
  status: ItemStatus;
}

export type FormErrors = Partial<Record<FieldName, string>>;
