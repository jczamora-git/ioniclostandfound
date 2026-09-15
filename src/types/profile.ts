export interface Profile {
  id: string; // Firebase UID
  name: string;
  username: string; // @username without leading @
  phone: string; // Kept private, only visible in edit profile
  email?: string; // Kept private
  avatarUrl?: string | null;
  avatarKey?: string | null;
  // Legacy Firebase Storage path retained for existing profile records.
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
  avatarKey?: string | null;
  // Legacy Firebase Storage path retained for existing profile records.
  avatarPath?: string | null;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}
