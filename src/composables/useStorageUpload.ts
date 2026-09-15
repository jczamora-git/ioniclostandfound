import { ref } from "vue";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import { storage } from "../firebase";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file format and size
 */
export function validateImageFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: "Please select an image file." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, and WebP images are allowed."
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Image file size exceeds the 5 MB limit."
    };
  }

  return { valid: true };
}

export function useStorageUpload() {
  const isUploading = ref(false);
  const uploadProgress = ref(0);
  const uploadError = ref<string | null>(null);

  /**
   * Upload an avatar image under: profile-avatars/{uid}/avatar_{timestamp}.{ext}
   */
  const uploadAvatar = async (
    file: File,
    uid: string
  ): Promise<{ downloadUrl: string; storagePath: string }> => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const storagePath = `profile-avatars/${uid}/avatar_${Date.now()}.${ext}`;
    const sRef = storageRef(storage, storagePath);

    isUploading.value = true;
    uploadError.value = null;
    try {
      await uploadBytes(sRef, file, { contentType: file.type });
      const downloadUrl = await getDownloadURL(sRef);
      return { downloadUrl, storagePath };
    } catch (err: any) {
      uploadError.value = err.message || "Failed to upload avatar image.";
      throw err;
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Upload a post image under: post-images/{uid}/{postId}/{filename}
   */
  const uploadPostImage = async (
    file: File,
    uid: string,
    postId: string
  ): Promise<{ downloadUrl: string; storagePath: string }> => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const rawExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const baseName = file.name
      .substring(0, file.name.lastIndexOf(".") > 0 ? file.name.lastIndexOf(".") : file.name.length)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    const fileName = `${baseName || "photo"}_${Date.now()}.${ext}`;

    const storagePath = `post-images/${uid}/${postId}/${fileName}`;
    const sRef = storageRef(storage, storagePath);

    isUploading.value = true;
    uploadError.value = null;
    try {
      await uploadBytes(sRef, file, { contentType: file.type });
      const downloadUrl = await getDownloadURL(sRef);
      return { downloadUrl, storagePath };
    } catch (err: any) {
      uploadError.value = err.message || "Failed to upload post image.";
      throw err;
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Delete a file from Firebase Storage gracefully.
   * If the file is already deleted or missing, resolve without throwing.
   */
  const deleteStorageFile = async (path: string | null | undefined): Promise<void> => {
    if (!path || !path.trim()) return;
    try {
      const sRef = storageRef(storage, path.trim());
      await deleteObject(sRef);
    } catch (err: any) {
      if (err?.code === "storage/object-not-found") {
        return;
      }
      console.warn(`[Storage] Could not delete file at ${path}:`, err);
    }
  };

  return {
    isUploading,
    uploadProgress,
    uploadError,
    validateImageFile,
    uploadAvatar,
    uploadPostImage,
    deleteStorageFile
  };
}
