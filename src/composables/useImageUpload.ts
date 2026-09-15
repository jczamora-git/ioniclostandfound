import { ref } from 'vue';
import { genUploader } from 'uploadthing/client';
import { auth } from '../firebase';
import { getAuthenticatedUser, isDevBypassEnabled, getDevSession } from './useAuth';

export type OurFileRouter = {
  avatarUploader: any;
  postImageUploader: any;
  messageImageUploader: any;
};

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

export const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_POST_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_MESSAGE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const API_BASE =
  (import.meta.env.VITE_API_SERVER_URL as string | undefined)?.trim() ||
  'https://ioniclostandfound.vercel.app';

export const UPLOADTHING_URL = `${API_BASE.replace(/\/+$/, '')}/api/uploadthing`;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Normalizes Android/mobile File objects where MIME type may be missing or non-standard.
 */
export function normalizeImageFile(file: File): File {
  if (!file) return file;
  let type = file.type?.toLowerCase() || '';
  const name = file.name?.toLowerCase() || '';

  if (!type || type === 'application/octet-stream' || type === 'image/jpg') {
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      type = 'image/jpeg';
    } else if (name.endsWith('.png')) {
      type = 'image/png';
    } else if (name.endsWith('.webp')) {
      type = 'image/webp';
    }
  }

  if (type && type !== file.type) {
    try {
      return new File([file], file.name, { type, lastModified: file.lastModified });
    } catch {
      return file;
    }
  }
  return file;
}

/**
 * Validate image file format and size
 */
export function validateImageFile(
  rawFile: File,
  maxSizeBytes: number = MAX_POST_IMAGE_SIZE_BYTES
): FileValidationResult {
  if (!rawFile) {
    return { valid: false, error: 'Please select an image file.' };
  }

  const file = normalizeImageFile(rawFile);
  const type = file.type?.toLowerCase() || '';
  const name = file.name?.toLowerCase() || '';

  const isAllowedType = ALLOWED_IMAGE_TYPES.includes(type);
  const hasAllowedExt =
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp');

  if (!isAllowedType && !hasAllowedExt) {
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
  const getPlatformName = (): string => {
    return typeof (window as any)?.Capacitor !== 'undefined' ? 'capacitor' : 'web';
  };

  /**
   * Upload an avatar image to UploadThing
   */
  const uploadAvatar = async (rawFile: File): Promise<{ url: string; key: string }> => {
    const file = normalizeImageFile(rawFile);
    const validation = validateImageFile(file, MAX_AVATAR_SIZE_BYTES);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;
    const platform = getPlatformName();

    if (import.meta.env.DEV || (window as any)?.Capacitor) {
      console.log('[UploadThing Client]', {
        endpoint: UPLOADTHING_URL,
        platform,
        slug: 'avatarUploader',
        name: file.name,
        type: file.type,
        size: file.size
      });
    }

    try {
      const headers = await getUploadHeaders();
      const { uploadFiles } = genUploader<OurFileRouter>({
        url: UPLOADTHING_URL,
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
      console.error('[UploadThing Client Error]', {
        endpoint: UPLOADTHING_URL,
        platform,
        slug: 'avatarUploader',
        message: err.message,
        status: err.status || err.statusCode || err.code
      });
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
  const uploadPostImage = async (rawFile: File): Promise<{ url: string; key: string }> => {
    const file = normalizeImageFile(rawFile);
    const validation = validateImageFile(file, MAX_POST_IMAGE_SIZE_BYTES);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;
    const platform = getPlatformName();

    if (import.meta.env.DEV || (window as any)?.Capacitor) {
      console.log('[UploadThing Client]', {
        endpoint: UPLOADTHING_URL,
        platform,
        slug: 'postImageUploader',
        name: file.name,
        type: file.type,
        size: file.size
      });
    }

    try {
      const headers = await getUploadHeaders();
      const { uploadFiles } = genUploader<OurFileRouter>({
        url: UPLOADTHING_URL,
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
      console.error('[UploadThing Client Error]', {
        endpoint: UPLOADTHING_URL,
        platform,
        slug: 'postImageUploader',
        message: err.message,
        status: err.status || err.statusCode || err.code
      });
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
  const uploadMessageImage = async (rawFile: File): Promise<{ url: string; key: string }> => {
    const file = normalizeImageFile(rawFile);
    const validation = validateImageFile(file, MAX_MESSAGE_IMAGE_SIZE_BYTES);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;
    const platform = getPlatformName();

    if (import.meta.env.DEV || (window as any)?.Capacitor) {
      console.log('[UploadThing Client]', {
        endpoint: UPLOADTHING_URL,
        platform,
        slug: 'messageImageUploader',
        name: file.name,
        type: file.type,
        size: file.size
      });
    }

    try {
      const headers = await getUploadHeaders();
      const { uploadFiles } = genUploader<OurFileRouter>({
        url: UPLOADTHING_URL,
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
      console.error('[UploadThing Client Error]', {
        endpoint: UPLOADTHING_URL,
        platform,
        slug: 'messageImageUploader',
        message: err.message,
        status: err.status || err.statusCode || err.code
      });
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
      const headers = await getUploadHeaders();

      await fetch(`${UPLOADTHING_URL}/delete`, {
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
    normalizeImageFile,
    uploadAvatar,
    uploadPostImage,
    uploadMessageImage,
    deleteUploadedFile
  };
}

