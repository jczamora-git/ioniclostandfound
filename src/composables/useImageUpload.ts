import { ref } from 'vue';
import { genUploader } from 'uploadthing/client';
import { auth } from '../firebase';
import { getAuthenticatedUser, isDevBypassEnabled, getDevSession } from './useAuth';
import { getChatServerUrl } from '../services/socket';
import type { OurFileRouter } from '../../server/src/uploadthing';

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

export const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_POST_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_MESSAGE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file format and size
 */
export function validateImageFile(
  file: File,
  maxSizeBytes: number = MAX_POST_IMAGE_SIZE_BYTES
): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'Please select an image file.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, and WebP images are allowed.'
    };
  }

  if (file.size > maxSizeBytes) {
    const sizeMb = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Image file size exceeds the ${sizeMb} MB limit.`
    };
  }

  return { valid: true };
}

/**
 * Helper to fetch authorization headers for UploadThing requests
 */
async function getUploadHeaders(): Promise<Record<string, string>> {
  if (isDevBypassEnabled()) {
    const devSession = getDevSession();
    if (devSession && devSession.uid) {
      return {
        Authorization: `Bearer dev_${devSession.uid}`,
        'x-auth-token': `dev_${devSession.uid}`,
        'x-dev-uid': devSession.uid
      };
    }
  }

  let user = auth.currentUser;
  if (!user) {
    user = await getAuthenticatedUser();
  }

  if (user && typeof user.getIdToken === 'function') {
    try {
      const token = await user.getIdToken();
      return {
        Authorization: `Bearer ${token}`
      };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[UploadThing] Failed to get Firebase ID token:', err);
      }
    }
  }

  return {};
}

const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadError = ref<string | null>(null);

export function useImageUpload() {
  /**
   * Upload an avatar image to UploadThing
   */
  const uploadAvatar = async (file: File): Promise<{ url: string; key: string }> => {
    const validation = validateImageFile(file, MAX_AVATAR_SIZE_BYTES);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;

    try {
      const serverUrl = getChatServerUrl();
      const headers = await getUploadHeaders();

      const { uploadFiles } = genUploader<OurFileRouter>({
        url: `${serverUrl}/api/uploadthing`,
        package: 'ioniclostandfound'
      });

      const res = await uploadFiles('avatarUploader', {
        files: [file],
        headers,
        onUploadProgress: (p) => {
          uploadProgress.value = p.progress;
        }
      });

      if (!res || res.length === 0 || !res[0]) {
        throw new Error('Upload returned no file response');
      }

      const uploaded = res[0];
      const url = (uploaded as any).ufsUrl || uploaded.url;
      const key = uploaded.key;

      if (!url || !key) {
        throw new Error('Missing file URL or key from UploadThing');
      }

      return { url, key };
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('[UploadThing] Avatar upload error:', err);
      }
      const friendlyMsg = 'Unable to upload photo. Please try again.';
      uploadError.value = friendlyMsg;
      throw new Error(friendlyMsg);
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Upload a post image to UploadThing
   */
  const uploadPostImage = async (file: File): Promise<{ url: string; key: string }> => {
    const validation = validateImageFile(file, MAX_POST_IMAGE_SIZE_BYTES);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;

    try {
      const serverUrl = getChatServerUrl();
      const headers = await getUploadHeaders();

      const { uploadFiles } = genUploader<OurFileRouter>({
        url: `${serverUrl}/api/uploadthing`,
        package: 'ioniclostandfound'
      });

      const res = await uploadFiles('postImageUploader', {
        files: [file],
        headers,
        onUploadProgress: (p) => {
          uploadProgress.value = p.progress;
        }
      });

      if (!res || res.length === 0 || !res[0]) {
        throw new Error('Upload returned no file response');
      }

      const uploaded = res[0];
      const url = (uploaded as any).ufsUrl || uploaded.url;
      const key = uploaded.key;

      if (!url || !key) {
        throw new Error('Missing file URL or key from UploadThing');
      }

      return { url, key };
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('[UploadThing] Post image upload error:', err);
      }
      const friendlyMsg = 'Unable to upload photo. Please try again.';
      uploadError.value = friendlyMsg;
      throw new Error(friendlyMsg);
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Upload a message image to UploadThing
   */
  const uploadMessageImage = async (file: File): Promise<{ url: string; key: string }> => {
    const validation = validateImageFile(file, MAX_MESSAGE_IMAGE_SIZE_BYTES);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;

    try {
      const serverUrl = getChatServerUrl();
      const headers = await getUploadHeaders();

      const { uploadFiles } = genUploader<OurFileRouter>({
        url: `${serverUrl}/api/uploadthing`,
        package: 'ioniclostandfound'
      });

      const res = await uploadFiles('messageImageUploader', {
        files: [file],
        headers,
        onUploadProgress: (p) => {
          uploadProgress.value = p.progress;
        }
      });

      if (!res || res.length === 0 || !res[0]) {
        throw new Error('Upload returned no file response');
      }

      const uploaded = res[0];
      const url = (uploaded as any).ufsUrl || uploaded.url;
      const key = uploaded.key;

      if (!url || !key) {
        throw new Error('Missing file URL or key from UploadThing');
      }

      return { url, key };
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('[UploadThing] Message image upload error:', err);
      }
      const friendlyMsg = 'Unable to upload image. Please try again.';
      uploadError.value = friendlyMsg;
      throw new Error(friendlyMsg);
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Delete an uploaded file from UploadThing by key gracefully
   */
  const deleteUploadedFile = async (key: string | null | undefined): Promise<void> => {
    if (!key || !key.trim()) return;

    try {
      const serverUrl = getChatServerUrl();
      const headers = await getUploadHeaders();

      await fetch(`${serverUrl}/api/uploadthing/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ key: key.trim() })
      });
    } catch (err: any) {
      // Graceful error handling: log warning but never crash the application
      if (import.meta.env.DEV) {
        console.warn(`[UploadThing] Could not delete file key ${key}:`, err);
      }
    }
  };

  return {
    isUploading,
    uploadProgress,
    uploadError,
    validateImageFile,
    uploadAvatar,
    uploadPostImage,
    uploadMessageImage,
    deleteUploadedFile
  };
}

