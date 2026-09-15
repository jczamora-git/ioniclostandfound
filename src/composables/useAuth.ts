import { ref, computed } from "vue";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  signOut,
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
import { disconnectSocket } from "../services/socket";
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
 * Human-readable mapping for Firebase Authentication errors.
 * Prevents exposing raw error codes/internals to the user.
 */
export function formatAuthError(err: any): string {
  if (!err) return "An unexpected error occurred. Please try again.";
  const code = err.code || "";
  const msg = err.message || "";

  switch (code) {
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      return "This email address is already registered. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few moments and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not enabled in Firebase Console.";
    case "auth/network-request-failed":
      return "Network connection issue. Please check your internet connection.";
    case "auth/requires-recent-login":
      return "This operation is sensitive. Please sign in again before proceeding.";
    default:
      if (msg.includes("email-already-in-use")) {
        return "This email address is already registered. Please sign in instead.";
      }
      return msg || "Authentication failed. Please try again.";
  }
}

/**
 * Single, unified authentication session initializer.
 * Checks for existing non-anonymous or anonymous session.
 * Does not automatically generate endless anonymous accounts when real auth is present.
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
        // Reuse existing Firebase user session (anonymous or email/password)
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
        // No authenticated session
        currentUser.value = null;
        currentProfile.value = null;
        isAuthReady.value = true;
        authLoading.value = false;

        console.log("[Auth] initialized", {
          authenticated: false,
          uid: undefined
        });

        if (!initialResolved) {
          initialResolved = true;
          resolve(null);
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
        email: val.email || auth.currentUser?.email || undefined,
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
  /**
   * Sign in with existing email and password.
   */
  const signIn = async (email: string, password: string): Promise<User> => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      currentUser.value = userCred.user;
      const profile = await fetchProfile(userCred.user.uid);
      currentProfile.value = profile;
      return userCred.user;
    } catch (err: any) {
      console.error("[Auth] Sign in failed:", err);
      throw new Error(formatAuthError(err));
    }
  };

  /**
   * Create a new account or upgrade an existing anonymous user via linkWithCredential.
   * Preserves the exact same UID so existing posts, comments, conversations, and ownership persist!
   */
  const signUp = async (params: {
    name: string;
    username: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<User> => {
    const cleanEmail = params.email.trim();
    const cleanUsername = normalizeUsername(params.username);
    const cleanName = params.name.trim();
    const cleanPhone = params.phone.trim();

    // Check username availability first
    const isAvail = await checkUsernameAvailable(cleanUsername, auth.currentUser?.uid);
    if (!isAvail) {
      throw new Error("Username is already taken. Please choose another one.");
    }

    let user: User;

    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        // Upgrade anonymous user preserving their existing UID!
        const credential = EmailAuthProvider.credential(cleanEmail, params.password);
        const userCred = await linkWithCredential(auth.currentUser, credential);
        user = userCred.user;
        console.log("[Auth] Successfully linked anonymous account to email/password with UID:", user.uid);
      } else {
        // Fresh sign up
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        user = userCred.user;
      }
    } catch (err: any) {
      console.error("[Auth] Sign up / linking failed:", err);
      throw new Error(formatAuthError(err));
    }

    currentUser.value = user;

    // Save initial profile
    await saveProfile({
      name: cleanName,
      username: cleanUsername,
      phone: cleanPhone,
      email: cleanEmail
    });

    return user;
  };

  /**
   * Sign out current user, clear state, and disconnect socket.
   */
  const signOutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("[Auth] Firebase signOut warning:", err);
    } finally {
      currentUser.value = null;
      currentProfile.value = null;
      authInitPromise = null;
      disconnectSocket();
    }
  };

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
      email: data.email || user.email || currentProfile.value?.email || undefined,
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

  const getPublicProfile = async (uid: string): Promise<Omit<Profile, "phone" | "email"> | null> => {
    const p = await fetchProfile(uid);
    if (!p) return null;
    // Phone number and email are strictly private and never exposed publicly!
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
    isAuthenticated: computed(() => !!currentUser.value && !currentUser.value.isAnonymous),
    isAnonymous: computed(() => !!currentUser.value?.isAnonymous),
    hasProfile: computed(() => !!currentProfile.value?.username),
    initAuth: initializeAuthSession,
    initializeAuthSession,
    getAuthenticatedUser,
    fetchProfile,
    checkUsernameAvailable,
    signIn,
    signUp,
    signOutUser,
    saveProfile,
    getPublicProfile
  };
}
