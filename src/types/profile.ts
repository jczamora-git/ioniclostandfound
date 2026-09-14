export interface Profile {
  id: string; // Firebase UID
  name: string;
  username: string; // @username without leading @
  phone: string; // Kept private, only visible in edit profile
  createdAt: number;
  updatedAt: number;
}

export interface ProfileFormData {
  name: string;
  username: string;
  phone: string;
}
