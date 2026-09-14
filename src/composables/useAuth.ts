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

let authInitPromise: Promise<Profile | null> | null = null;

export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
};

const getFallbackUid = (): string => {
  let uid = localStorage.getItem("laf_device_uid");
  if (!uid) {
    uid = "user_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem("laf_device_uid", uid);
  }
  return uid;
};

export function useAuth() {
  const initAuth = (): Promise<Profile | null> => {
    if (authInitPromise) return authInitPromise;

    authInitPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        authLoading.value = true;
        if (user) {
          currentUser.value = user;
          const profile = await fetchProfile(user.uid);
          currentProfile.value = profile;
          isAuthReady.value = true;
          authLoading.value = false;
          resolve(profile);
        } else {
          try {
            const userCred = await signInAnonymously(auth);
            currentUser.value = userCred.user;
            const profile = await fetchProfile(userCred.user.uid);
            currentProfile.value = profile;
            isAuthReady.value = true;
            authLoading.value = false;
            resolve(profile);
          } catch (error) {
            console.warn("Firebase Anonymous Auth failed, using device identity:", error);
            const fallbackUid = getFallbackUid();
            currentUser.value = { uid: fallbackUid } as any;
            const profile = await fetchProfile(fallbackUid);
            currentProfile.value = profile;
            isAuthReady.value = true;
            authLoading.value = false;
            resolve(profile);
          }
        }
      });
    });

    return authInitPromise;
  };

  const fetchProfile = async (uid: string): Promise<Profile | null> => {
    try {
      const snap = await get(dbRef(db, `profiles/${uid}`));
      if (snap.exists()) {
        const val = snap.val();
        return {
          id: uid,
          name: val.name || "",
          username: val.username || "",
          phone: val.phone || "",
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

  const checkUsernameAvailable = async (
    rawUsername: string,
    currentUid?: string
  ): Promise<boolean> => {
    const clean = normalizeUsername(rawUsername);
    if (!clean) return false;
    try {
      const snap = await get(dbRef(db, `usernames/${clean}`));
      if (!snap.exists()) return true;
      // If claimed by same user, it is available
      return snap.val() === (currentUid || currentUser.value?.uid);
    } catch (err) {
      console.error("Error checking username availability:", err);
      return true; // fallback
    }
  };

  const saveProfile = async (data: ProfileFormData): Promise<Profile> => {
    if (!currentUser.value) {
      try {
        const cred = await signInAnonymously(auth);
        currentUser.value = cred.user;
      } catch {
        const fallbackUid = getFallbackUid();
        currentUser.value = { uid: fallbackUid } as any;
      }
    }

    const uid = currentUser.value?.uid || getFallbackUid();
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
    // Phone number is strictly private and never exposed publicly!
    return {
      id: p.id,
      name: p.name,
      username: p.username,
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
    initAuth,
    fetchProfile,
    checkUsernameAvailable,
    saveProfile,
    getPublicProfile
  };
}
