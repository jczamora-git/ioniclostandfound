import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';
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
  import.meta.env.VITE_API_SERVER_URL ||
  'https://ioniclostandfound.vercel.app';

// Remove Android production fallbacks to localhost / 127.0.0.1 / 192.168.* / :3000
const sanitizedApiBase =
  API_BASE.includes('localhost') ||
  API_BASE.includes('127.0.0.1') ||
  API_BASE.includes('192.168.') ||
  API_BASE.includes(':3000')
    ? 'https://ioniclostandfound.vercel.app'
    : API_BASE.trim().replace(/\/+$/, '');

const uploadthingUrl = `${sanitizedApiBase}/api/uploadthing`;
export const UPLOADTHING_URL = uploadthingUrl;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadDiagnosticData {
  platform: string;
  endpoint: string;
  slug: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileSizeBytes: string;
  isRealFile: boolean;
  status: string | number;
  code: string;
  message: string;
  timestamp: string;
}

const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadError = ref<string | null>(null);
const lastDiagnosticText = ref<string>('');
const lastDiagnosticData = ref<UploadDiagnosticData | null>(null);

export function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return 'Unknown error occurred';
  return String(msg)
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9-_.]+/g, '[TOKEN_REDACTED]')
    .replace(/sk_live_[A-Za-z0-9_-]+/gi, '[KEY_REDACTED]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[FIREBASE_KEY_REDACTED]')
    .slice(0, 300);
}

export function buildDiagnosticText(data: UploadDiagnosticData): string {
  return [
    'Upload failed',
    '',
    `Platform: ${data.platform}`,
    'Endpoint:',
    data.endpoint,
    '',
    'Uploader:',
    data.slug,
    '',
    'File:',
    data.fileName,
    data.fileType || 'unknown',
    data.fileSizeBytes,
    '',
    'Status:',
    String(data.status),
    '',
    'Error:',
    data.message
  ].join('\n');
}

/**
 * Normalizes Android/mobile File objects where MIME type may be missing or non-standard.
 * Ensures selected object is a real File instance with proper image MIME type.
 */
export function normalizeImageFile(rawFile: File): File {
  if (!rawFile) return rawFile;

  let file: File = rawFile;
  // If native Android picker returns Blob instead of File
  if (!(rawFile instanceof File) && typeof File !== 'undefined' && typeof (rawFile as any)?.slice === 'function') {
    const fallbackName = (rawFile as any).name || 'photo.jpg';
    try {
      file = new File([rawFile as any], fallbackName, {
        type: (rawFile as any).type || 'image/jpeg',
        lastModified: (rawFile as any).lastModified || Date.now()
      });
    } catch {
      file = rawFile;
    }
  }

  let type = file.type?.toLowerCase() || '';
  const name = file.name?.toLowerCase() || '';

  // Android often returns empty MIME or application/octet-stream for camera photos
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
      return new File([file], file.name, { type, lastModified: file.lastModified || Date.now() });
    } catch {
      try {
        Object.defineProperty(file, 'type', { value: type, configurable: true });
      } catch {}
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

export function useImageUpload() {
  const getPlatformName = (): string => {
    try {
      return Capacitor.getPlatform();
    } catch {
      return typeof (window as any)?.Capacitor !== 'undefined' ? 'capacitor' : 'web';
    }
  };

  /**
   * Universal upload handler that logs diagnostic info and manages state safely.
   */
  const performUpload = async (
    slug: 'avatarUploader' | 'postImageUploader' | 'messageImageUploader',
    rawFile: File,
    maxSizeBytes: number,
    friendlyError: string
  ): Promise<{ url: string; key: string }> => {
    const file = normalizeImageFile(rawFile);
    const validation = validateImageFile(file, maxSizeBytes);
    if (!validation.valid) {
      throw new Error(validation.error || 'Please select a valid image.');
    }

    isUploading.value = true;
    uploadProgress.value = 0;
    uploadError.value = null;

    const platform = getPlatformName();
    const isRealFile = typeof File !== 'undefined' && file instanceof File;

    // Diagnostic log before upload
    const debugPayload = {
      platform,
      endpoint: uploadthingUrl,
      slug,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileSizeBytes: formatFileSize(file.size),
      isRealFile
    };

    // ADB logcat filterable prefix and mobile diagnostic log
    console.log('[UploadDebug]', debugPayload);
    console.log('[UploadThing Mobile]', debugPayload);

    try {
      const headers = await getUploadHeaders();
      const { uploadFiles } = genUploader<OurFileRouter>({
        url: uploadthingUrl,
        package: 'ioniclostandfound'
      });

      const res = await uploadFiles(slug, {
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

      // Clear diagnostic on success
      lastDiagnosticText.value = '';
      lastDiagnosticData.value = null;

      return { url, key };
    } catch (err: any) {
      const status =
        err.status ||
        err.statusCode ||
        err.code ||
        (err.message && String(err.message).toLowerCase().includes('fetch') ? 'Fetch/Network Error' : 500);
      const code = err.code || 'UPLOAD_FAILED';
      const safeMessage = sanitizeErrorMessage(err.message || 'Upload failed');

      const errorPayload = {
        endpoint: uploadthingUrl,
        slug,
        status,
        code,
        message: safeMessage
      };

      console.error('[UploadDebug Error]', errorPayload);
      console.error('[UploadThing Mobile Error]', errorPayload);

      const diagInfo: UploadDiagnosticData = {
        platform,
        endpoint: uploadthingUrl,
        slug,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileSizeBytes: formatFileSize(file.size),
        isRealFile,
        status,
        code,
        message: safeMessage,
        timestamp: new Date().toISOString()
      };

      lastDiagnosticData.value = diagInfo;
      lastDiagnosticText.value = buildDiagnosticText(diagInfo);
      uploadError.value = friendlyError;

      throw new Error(friendlyError);
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Upload an avatar image to UploadThing
   */
  const uploadAvatar = async (rawFile: File): Promise<{ url: string; key: string }> => {
    return performUpload(
      'avatarUploader',
      rawFile,
      MAX_AVATAR_SIZE_BYTES,
      'Unable to upload photo. Please try again.'
    );
  };

  /**
   * Upload a post image to UploadThing
   */
  const uploadPostImage = async (rawFile: File): Promise<{ url: string; key: string }> => {
    return performUpload(
      'postImageUploader',
      rawFile,
      MAX_POST_IMAGE_SIZE_BYTES,
      'Unable to upload photo. Please try again.'
    );
  };

  /**
   * Upload a message image to UploadThing
   */
  const uploadMessageImage = async (rawFile: File): Promise<{ url: string; key: string }> => {
    return performUpload(
      'messageImageUploader',
      rawFile,
      MAX_MESSAGE_IMAGE_SIZE_BYTES,
      'Unable to upload image. Please try again.'
    );
  };

  /**
   * Copy safe diagnostic info to clipboard for troubleshooting
   */
  const copyDebugInfo = async (): Promise<boolean> => {
    if (!lastDiagnosticText.value) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(lastDiagnosticText.value);
        return true;
      }
      const textArea = document.createElement('textarea');
      textArea.value = lastDiagnosticText.value;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (e) {
      console.warn('[UploadDebug] Failed to copy debug info:', e);
      return false;
    }
  };

  /**
   * Clear active diagnostic state
   */
  const clearDiagnostic = () => {
    lastDiagnosticText.value = '';
    lastDiagnosticData.value = null;
    uploadError.value = null;
  };

  /**
   * Delete an uploaded file from UploadThing by key gracefully
   */
  const deleteUploadedFile = async (key: string | null | undefined): Promise<void> => {
    if (!key || !key.trim()) return;

    try {
      const headers = await getUploadHeaders();

      await fetch(`${uploadthingUrl}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ key: key.trim() })
      });
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.warn(`[UploadThing] Could not delete file key ${key}:`, err);
      }
    }
  };

  return {
    isUploading,
    uploadProgress,
    uploadError,
    lastDiagnosticText,
    lastDiagnosticData,
    copyDebugInfo,
    clearDiagnostic,
    validateImageFile,
    normalizeImageFile,
    uploadAvatar,
    uploadPostImage,
    uploadMessageImage,
    deleteUploadedFile
  };
}
