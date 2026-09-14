export type PostType = "lost" | "found";

export type PostStatus = "open" | "resolved" | "returned";

export type PostFilter = "All" | "Lost" | "Found" | "Resolved";

export const POST_CATEGORIES = [
  "ID / Cards",
  "Wallet",
  "Keys",
  "Electronics",
  "Bags",
  "Clothing",
  "Accessories",
  "Documents",
  "Pets",
  "Other"
] as const;

export type PostCategory = typeof POST_CATEGORIES[number];

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  type: PostType;
  title: string;
  category: PostCategory;
  description: string;
  location: string;
  eventDate: string;
  imageUrl?: string;
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
  description: string;
  location: string;
  eventDate: string;
  imageUrl?: string;
}

export type PostFormErrors = Partial<Record<keyof PostFormData, string>>;

export function hasValidDescription(description?: string | null): boolean {
  if (!description || typeof description !== "string") return false;
  const trimmed = description.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== "nan" && lower !== "null" && lower !== "undefined";
}
