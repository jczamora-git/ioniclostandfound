import { ref, computed } from "vue";
import {
  signInAnonymously,
  onAuthStateChanged,
  type User
} from "firebase/auth";
import {
  ref as dbRef,
  get,
  set,
  remove
} from "firebase/database";
import { auth, db } from "../firebase";
import type { Profile, ProfileFormData } from "../types/profile";

const currentUser = ref<User | null>(null);
const currentProfile = ref<Profile | null>(null);
const isAuthReady = ref(false);
const authLoading = ref(true);

let authInitPromise: Promise<User | null> | null = null;

export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
};

/**
 * Single, unified authentication session initializer.
 * Automatically enables Firebase Anonymous Authentication without generating custom local UIDs.
 */
export function initializeAuthSession(): Promise<User | null> {
  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = new Promise<User | null>((resolve) => {
    let initialResolved = false;

    onAuthStateChanged(auth, async (user) => {
      authLoading.value = true;
      if (user) {
        // Reuse existing Firebase user session
        currentUser.value = user;
        try {
          const profile = await fetchProfile(user.uid);
          currentProfile.value = profile;
        } catch (err) {
          console.warn("[Auth] Error fetching profile for user:", err);
        }
        isAuthReady.value = true;
        authLoading.value = false;

        console.log("[Auth] initialized", {
          authenticated: !!user,
          uid: user?.uid
        });

        if (!initialResolved) {
          initialResolved = true;
          resolve(user);
        }
      } else {
        // No Firebase user session found -> perform anonymous sign in
        try {
          const userCred = await signInAnonymously(auth);
          currentUser.value = userCred.user;
          const profile = await fetchProfile(userCred.user.uid);
          currentProfile.value = profile;
          isAuthReady.value = true;
          authLoading.value = false;

          console.log("[Auth] initialized", {
            authenticated: !!userCred.user,
            uid: userCred.user?.uid
          });

          if (!initialResolved) {
            initialResolved = true;
            resolve(userCred.user);
          }
        } catch (error) {
          console.error("[Auth] Firebase Anonymous Auth failed:", error);
          isAuthReady.value = true;
          authLoading.value = false;
          if (!initialResolved) {
            initialResolved = true;
            resolve(null);
          }
        }
      }
    });
  });

  return authInitPromise;
}

/**
 * Returns the currently authenticated Firebase user, waiting for initialization if in flight.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  return await initializeAuthSession();
}

export const fetchProfile = async (uid: string): Promise<Profile | null> => {
  if (!uid) return null;
  try {
    const snap = await get(dbRef(db, `profiles/${uid}`));
    if (snap.exists()) {
      const val = snap.val();
      return {
        id: uid,
        name: val.name || "",
        username: val.username || "",
        phone: val.phone || "",
        avatarUrl: val.avatarUrl || null,
        avatarPath: val.avatarPath || null,
        createdAt: val.createdAt || Date.now(),
        updatedAt: val.updatedAt || Date.now()
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    return null;
  }
};

export const checkUsernameAvailable = async (
  rawUsername: string,
  currentUid?: string
): Promise<boolean> => {
  const clean = normalizeUsername(rawUsername);
  if (!clean) return false;
  try {
    const snap = await get(dbRef(db, `usernames/${clean}`));
    if (!snap.exists()) return true;
    return snap.val() === (currentUid || auth.currentUser?.uid || currentUser.value?.uid);
  } catch (err) {
    console.error("Error checking username availability:", err);
    return true;
  }
};

export function useAuth() {
  const saveProfile = async (data: ProfileFormData): Promise<Profile> => {
    let user = auth.currentUser || currentUser.value;
    if (!user) {
      user = await initializeAuthSession();
    }
    if (!user?.uid) {
      throw new Error("Unable to save profile: Firebase authentication session is missing.");
    }

    const uid = user.uid;
    const cleanUsername = normalizeUsername(data.username);
    const now = Date.now();

    const isAvail = await checkUsernameAvailable(cleanUsername, uid);
    if (!isAvail) {
      throw new Error("Username is already taken. Please pick another one.");
    }

    // Release previous username if changed
    if (currentProfile.value?.username && currentProfile.value.username !== cleanUsername) {
      try {
        await remove(dbRef(db, `usernames/${normalizeUsername(currentProfile.value.username)}`));
      } catch (e) {
        console.warn("Could not remove old username claim:", e);
      }
    }

    const newProfile: Profile = {
      id: uid,
      name: data.name.trim(),
      username: cleanUsername,
      phone: data.phone.trim(),
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : (currentProfile.value?.avatarUrl || null),
      avatarPath: data.avatarPath !== undefined ? data.avatarPath : (currentProfile.value?.avatarPath || null),
      createdAt: currentProfile.value?.createdAt || now,
      updatedAt: now
    };

    // Save profile and claim username
    await set(dbRef(db, `profiles/${uid}`), newProfile);
    await set(dbRef(db, `usernames/${cleanUsername}`), uid);

    currentProfile.value = newProfile;
    return newProfile;
  };

  const getPublicProfile = async (uid: string): Promise<Omit<Profile, "phone"> | null> => {
    const p = await fetchProfile(uid);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      username: p.username,
      avatarUrl: p.avatarUrl || null,
      avatarPath: p.avatarPath || null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  };

  return {
    currentUser,
    currentProfile,
    isAuthReady,
    authLoading,
    isAuthenticated: computed(() => !!currentUser.value),
    hasProfile: computed(() => !!currentProfile.value?.username),
    initAuth: initializeAuthSession,
    initializeAuthSession,
    getAuthenticatedUser,
    fetchProfile,
    checkUsernameAvailable,
    saveProfile,
    getPublicProfile
  };
}
