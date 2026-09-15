import { ref } from 'vue';
import { ref as dbRef, get } from 'firebase/database';
import { db } from '../firebase';
import type { Profile } from '../types/profile';

// Shared global reactive profile cache keyed by UID
const profilesByUid = ref<Record<string, Profile>>({});
const inFlightPromises = new Map<string, Promise<Profile | null>>();

/**
 * Shared author profiles composable for deduplicated, cached profile resolution.
 */
export function useProfiles() {
  /**
   * Load a single profile by UID using cached in-memory record or deduplicated fetch.
   */
  const loadProfile = async (uid: string | null | undefined): Promise<Profile | null> => {
    if (!uid || uid === 'anonymous' || uid === 'legacy_user' || uid === 'community' || uid === 'user') {
      return null;
    }

    // 1. Return immediately from cache if available
    if (profilesByUid.value[uid]) {
      return profilesByUid.value[uid];
    }

    // 2. Return in-flight promise if already requesting
    if (inFlightPromises.has(uid)) {
      return inFlightPromises.get(uid)!;
    }

    // 3. Perform one-time fetch and cache
    const fetchPromise = (async () => {
      try {
        const snap = await get(dbRef(db, `profiles/${uid}`));
        if (snap.exists()) {
          const val = snap.val();
          const profile: Profile = {
            id: uid,
            name: val.name || '',
            username: val.username || '',
            phone: val.phone || '',
            email: val.email || undefined,
            avatarUrl: val.avatarUrl || null,
            avatarKey: val.avatarKey || null,
            avatarPath: val.avatarPath || null,
            createdAt: typeof val.createdAt === 'number' ? val.createdAt : Date.now(),
            updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : Date.now()
          };
          profilesByUid.value[uid] = profile;
          return profile;
        }
        return null;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn(`[useProfiles] Error fetching profile for ${uid}:`, err);
        }
        return null;
      } finally {
        inFlightPromises.delete(uid);
      }
    })();

    inFlightPromises.set(uid, fetchPromise);
    return fetchPromise;
  };

  /**
   * Batch load and deduplicate profiles for an array of author UIDs in parallel.
   */
  const loadProfiles = async (uids: (string | null | undefined)[]): Promise<(Profile | null)[]> => {
    const uniqueUids = Array.from(new Set(uids.filter((u): u is string => !!u && u !== 'anonymous' && u !== 'legacy_user' && u !== 'community' && u !== 'user')));
    const uncached = uniqueUids.filter((uid) => !profilesByUid.value[uid]);
    if (uncached.length === 0) {
      return uniqueUids.map((uid) => profilesByUid.value[uid] || null);
    }
    return Promise.all(uncached.map((uid) => loadProfile(uid)));
  };

  /**
   * Get cached profile for an author UID (sync read with background fetch if missing).
   */
  const getProfile = (uid: string | null | undefined): Profile | null => {
    if (!uid) return null;
    if (!profilesByUid.value[uid] && !inFlightPromises.has(uid)) {
      loadProfile(uid);
    }
    return profilesByUid.value[uid] || null;
  };

  /**
   * Get resolved avatar URL for an author UID.
   */
  const getAvatarUrl = (uid: string | null | undefined): string | null => {
    if (!uid) return null;
    const profile = getProfile(uid);
    return profile?.avatarUrl || null;
  };

  /**
   * Manually update/invalidate the profile cache immediately (e.g. after edit profile).
   */
  const setCachedProfile = (profile: Profile) => {
    if (profile && profile.id) {
      profilesByUid.value[profile.id] = { ...profile };
    }
  };

  return {
    profilesCache: profilesByUid,
    profilesByUid,
    loadProfile,
    loadProfiles,
    getProfile,
    getAvatarUrl,
    setCachedProfile
  };
}
