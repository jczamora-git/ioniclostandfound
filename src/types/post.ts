import { CATEGORY_NAMES } from "../config/categories";

export type PostType = "lost" | "found";

export type PostStatus = "open" | "resolved" | "returned";

export type PostFilter = "All" | "Lost" | "Found" | "Resolved";

export const POST_CATEGORIES = CATEGORY_NAMES;

export type PostCategory = string;

export interface AdvancedFilterOptions {
  categories?: string[];
  subcategories?: string[];
}

export interface PostFilters {
  type: PostFilter;
  categories: string[];
  subcategories: string[];
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  type: PostType;
  title: string;
  category: PostCategory;
  subCategory?: string;
  description: string;
  location: string;
  eventDate: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  status: PostStatus;
  helpfulCount?: number;
  commentsCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PostFormData {
  type: PostType;
  title: string;
  category: PostCategory;
  subCategory?: string;
  pendingSubcategory?: { category: string; name: string };
  description: string;
  location: string;
  eventDate: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  imageFile?: File | null;
  removeImage?: boolean;
}

export type PostFormErrors = Partial<Record<keyof PostFormData, string>>;

export function hasValidDescription(description?: string | null): boolean {
  if (!description || typeof description !== "string") return false;
  const trimmed = description.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== "nan" && lower !== "null" && lower !== "undefined";
}
