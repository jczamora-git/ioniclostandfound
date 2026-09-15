/**
 * Re-export useImageUpload for backward compatibility.
 * UploadThing is now the active file storage provider.
 */
export {
  useImageUpload as useStorageUpload,
  validateImageFile,
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_SIZE_BYTES,
  MAX_POST_IMAGE_SIZE_BYTES,
  type FileValidationResult
} from './useImageUpload';
