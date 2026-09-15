import { ref } from 'vue';
import { ref as dbRef, onValue, get } from 'firebase/database';
import { db } from '../firebase';
import type { Profile } from '../types/profile';

// Shared global reactive profile cache
const profilesCache = ref<Record<string, Profile>>({});
const activeListeners = new Set<string>();

/**
 * Shared author profiles composable for real-time avatar and profile resolution.
 */
export function useProfiles() {
  /**
   * Load and subscribe to real-time updates for an author's profile by UID.
   */
  const loadProfile = (uid: string | null | undefined) => {
    if (!uid || uid === 'anonymous' || uid === 'legacy_user' || uid === 'community') return;
    if (activeListeners.has(uid)) return;
    activeListeners.add(uid);

    try {
      const profileRef = dbRef(db, `profiles/${uid}`);
      onValue(profileRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          profilesCache.value[uid] = {
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
        }
      });
    } catch (err) {
      console.warn(`[useProfiles] Could not attach listener for profile ${uid}:`, err);
    }
  };

  /**
   * Batch load profiles for an array of author UIDs.
   */
  const loadProfiles = (uids: (string | null | undefined)[]) => {
    uids.forEach((uid) => {
      if (uid) loadProfile(uid);
    });
  };

  /**
   * Get cached profile for an author UID.
   */
  const getProfile = (uid: string | null | undefined): Profile | null => {
    if (!uid) return null;
    if (!activeListeners.has(uid)) {
      loadProfile(uid);
    }
    return profilesCache.value[uid] || null;
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
   * Manually update the profile cache (e.g., immediately upon saving in EditProfile).
   */
  const setCachedProfile = (profile: Profile) => {
    if (profile && profile.id) {
      profilesCache.value[profile.id] = { ...profile };
    }
  };

  return {
    profilesCache,
    loadProfile,
    loadProfiles,
    getProfile,
    getAvatarUrl,
    setCachedProfile
  };
}
