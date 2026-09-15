export interface Profile {
  id: string; // Firebase UID
  name: string;
  username: string; // @username without leading @
  phone: string; // Kept private, only visible in edit profile
  email?: string; // Kept private
  avatarUrl?: string | null;
  avatarPath?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileFormData {
  name: string;
  username: string;
  phone: string;
  email?: string;
  avatarUrl?: string | null;
  avatarPath?: string | null;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}
