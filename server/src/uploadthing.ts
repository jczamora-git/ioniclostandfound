import 'dotenv/config';
import { createUploadthing, type FileRouter } from 'uploadthing/express';
import { UTApi, UploadThingError } from 'uploadthing/server';
import { verifyToken } from './firebaseAdmin.js';

const f = createUploadthing();

export const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN
});

/**
 * Authenticate incoming UploadThing requests:
 * - Real Firebase Auth: validates Firebase ID token from Authorization header or x-auth-token.
 * - Development Bypass: permits dev mock sessions when NODE_ENV !== 'production'.
 */
async function authenticateRequest(req: any): Promise<{ userId: string; isDev: boolean }> {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token: string | undefined = undefined;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.headers['x-auth-token'] === 'string') {
    token = req.headers['x-auth-token'].trim();
  }

  const devUid = req.headers['x-dev-uid'] as string | undefined;
  const isDev = process.env.NODE_ENV !== 'production';

  // DEV bypass mode
  if (isDev && devUid && (token === `dev_${devUid}` || token === 'dev_bypass')) {
    return { userId: devUid, isDev: true };
  }

  if (!token) {
    throw new UploadThingError({
      code: 'FORBIDDEN',
      message: 'Authentication token is required for upload'
    });
  }

  try {
    const uid = await verifyToken(token);
    return { userId: uid, isDev: false };
  } catch (err: any) {
    throw new UploadThingError({
      code: 'FORBIDDEN',
      message: `Invalid or expired auth token: ${err.message}`
    });
  }
}

export const uploadRouter = {
  // Avatar Uploader: max 4MB, 1 image file
  avatarUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1
    }
  })
    .middleware(async ({ req }) => {
      const auth = await authenticateRequest(req);
      return { userId: auth.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[UploadThing] Avatar uploaded by ${metadata.userId} -> Key: ${file.key}, URL: ${fileUrl}`);
      }
      return {
        uploadedBy: metadata.userId,
        fileKey: file.key,
        fileUrl
      };
    }),

  // Post Image Uploader: max 8MB, 1 image file
  postImageUploader: f({
    image: {
      maxFileSize: '8MB',
      maxFileCount: 1
    }
  })
    .middleware(async ({ req }) => {
      const auth = await authenticateRequest(req);
      return { userId: auth.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[UploadThing] Post image uploaded by ${metadata.userId} -> Key: ${file.key}, URL: ${fileUrl}`);
      }
      return {
        uploadedBy: metadata.userId,
        fileKey: file.key,
        fileUrl
      };
    }),

  // Message Image Uploader: max 8MB backend limit (validated to 5MB on client), 1 image file
  messageImageUploader: f({
    image: {
      maxFileSize: '8MB',
      maxFileCount: 1
    }
  })
    .middleware(async ({ req }) => {
      const auth = await authenticateRequest(req);
      return { userId: auth.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileUrl = (file as any).ufsUrl || file.url;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[UploadThing] Message image uploaded by ${metadata.userId} -> Key: ${file.key}, URL: ${fileUrl}`);
      }
      return {
        uploadedBy: metadata.userId,
        fileKey: file.key,
        fileUrl
      };
    })
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;

