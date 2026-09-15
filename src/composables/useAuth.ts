import { ref, computed } from "vue";
import {
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
import { disconnectSocket, getApiServerUrl } from "../services/socket";
import { useProfiles } from "./useProfiles";
import type { Profile, ProfileFormData } from "../types/profile";

export interface DevSession {
  uid: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  avatarUrl?: string | null;
  avatarKey?: string | null;
  isDevAccount: true;
}

const DEV_AUTH_STORAGE_KEY = "dev_auth_session";

export const isDevBypassAuth =
  import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

/**
 * Checks whether development authentication bypass is enabled.
 * Driven by VITE_DEV_BYPASS_AUTH === 'true'.
 */
export const isDevBypassEnabled = (): boolean => {
  return isDevBypassAuth;
};

export const getDevSession = (): DevSession | null => {
  try {
    const raw = localStorage.getItem(DEV_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.isDevAccount) {
      return parsed as DevSession;
    }
    return null;
  } catch {
    return null;
  }
};

export const saveDevSession = (session: DevSession): void => {
  if (!isDevBypassAuth) return;
  try {
    localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn("[DEV] Failed to save dev session to localStorage:", e);
  }
};

export const clearDevSession = (): void => {
  try {
    localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
  } catch {}
};

export const createDevUser = (session: DevSession): User => {
  return {
    uid: session.uid,
    email: session.email,
    isAnonymous: false,
    displayName: session.name,
    emailVerified: false,
    metadata: {},
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "",
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => session,
    phoneNumber: session.phone,
    photoURL: null,
    providerId: "password",
    isDevAccount: true
  } as unknown as User;
};

const currentUser = ref<User | null>(null);
const currentProfile = ref<Profile | null>(null);
const isAuthReady = ref(false);
const authLoading = ref(true);

let authInitPromise: Promise<User | null> | null = null;

/**
 * Normalize username: trim, lowercase, remove leading @, strip invalid characters
 */
export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_.]/g, "");
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
      return "Incorrect email/username or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/user-disabled":
      return "This account is disabled.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not enabled in Firebase Console.";
    case "auth/configuration-not-found":
      return "Email/Password sign-in provider is not configured in Firebase Console. Please enable it under Authentication > Sign-in method.";
    case "auth/network-request-failed":
      return "Unable to connect. Check your connection.";
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
 * Checks for existing Firebase Auth session.
 */
export function initializeAuthSession(): Promise<User | null> {
  // If in bypass mode and we already have a dev session in localStorage, immediately populate state
  if (isDevBypassAuth) {
    const devSession = getDevSession();
    if (devSession) {
      const devUser = createDevUser(devSession);
      currentUser.value = devUser;
      currentProfile.value = {
        id: devSession.uid,
        name: devSession.name,
        username: devSession.username,
        phone: devSession.phone,
        email: devSession.email,
        avatarUrl: devSession.avatarUrl || null,
        avatarKey: devSession.avatarKey || null,
        avatarPath: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      isAuthReady.value = true;
      authLoading.value = false;
      return Promise.resolve(devUser);
    }
  }

  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = new Promise<User | null>((resolve) => {
    let initialResolved = false;

    onAuthStateChanged(auth, async (user) => {
      authLoading.value = true;
      try {
        if (user) {
          // Real Firebase Auth session exists -> clear any local dev bypass session
          clearDevSession();
          currentUser.value = user;
          try {
            const profile = await fetchProfile(user.uid);
            currentProfile.value = profile;
          } catch (err) {
            console.warn("[Auth] Error fetching profile for user:", err);
          }
          isAuthReady.value = true;

          if (!initialResolved) {
            initialResolved = true;
            resolve(user);
          }
        } else {
          // No authenticated Firebase user session.
          // Check if dev test bypass is explicitly enabled
          if (isDevBypassAuth) {
            const devSession = getDevSession();
            if (devSession) {
              console.warn("[DEV] Firebase Auth bypass enabled. This is a development mock session.");
              const devUser = createDevUser(devSession);
              currentUser.value = devUser;
              currentProfile.value = {
                id: devSession.uid,
                name: devSession.name,
                username: devSession.username,
                phone: devSession.phone,
                email: devSession.email,
                avatarUrl: devSession.avatarUrl || null,
                avatarKey: devSession.avatarKey || null,
                avatarPath: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              isAuthReady.value = true;

              if (!initialResolved) {
                initialResolved = true;
                resolve(devUser);
              }
              return;
            }
          }

          currentUser.value = null;
          currentProfile.value = null;
          isAuthReady.value = true;

          if (!initialResolved) {
            initialResolved = true;
            resolve(null);
          }
        }
      } catch (e) {
        console.warn("[Auth] Initialization error:", e);
        if (!initialResolved) {
          initialResolved = true;
          resolve(currentUser.value);
        }
      } finally {
        authLoading.value = false;
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
        avatarKey: val.avatarKey || null,
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
    console.warn("Could not check username availability:", err);
    return true;
  }
};

/**
 * Resolve username to account email for authentication.
 */
export async function resolveUsername(rawUsername: string): Promise<string> {
  const clean = normalizeUsername(rawUsername);
  if (!clean) {
    throw new Error("Please enter a valid username.");
  }

  // When bypass is enabled, do not make network calls to /api/auth/resolve-username
  if (isDevBypassAuth) {
    return `${clean}@example.com`;
  }

  const serverUrl = getApiServerUrl();
  let resolvedEmail: string | null = null;

  // 1. Preferred: Query Node/Express backend resolution endpoint with timeout
  if (serverUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${serverUrl}/api/auth/resolve-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success && data.email) {
          resolvedEmail = data.email.trim().toLowerCase();
        }
      } else if (resp.status === 404) {
        throw new Error("Account not found.");
      }
    } catch (err: any) {
      if (err.message === "Account not found.") {
        throw err;
      }
      // If network timed out or failed to server, proceed immediately to client RTDB fallback
    }
  }

  // 2. Direct RTDB fallback: look up usernames/{clean} -> profiles/{uid}/email
  if (!resolvedEmail) {
    try {
      const snap = await get(dbRef(db, `usernames/${clean}`));
      if (snap.exists()) {
        const uid = snap.val();
        if (uid) {
          const profileSnap = await get(dbRef(db, `profiles/${uid}`));
          if (profileSnap.exists()) {
            const profile = profileSnap.val();
            if (profile && profile.email) {
              resolvedEmail = profile.email.trim().toLowerCase();
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn("[Auth] Username lookup fallback warning:", dbErr);
    }
  }

  // 3. Check for dev-bypass account
  const devSession = getDevSession();
  if (devSession && normalizeUsername(devSession.username) === clean) {
    throw new Error("This account was created in development mode. Please create a real account.");
  }

  if (!resolvedEmail) {
    throw new Error("Account not found.");
  }

  return resolvedEmail;
}

export interface SessionUser {
  uid: string;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  isAnonymous: boolean;
  isDevAccount: boolean;
}

export const sessionUser = computed<SessionUser | null>(() => {
  if (currentUser.value) {
    return {
      uid: currentUser.value.uid,
      name: currentProfile.value?.name || currentUser.value.displayName || "Member",
      username: currentProfile.value?.username || "user",
      phone: currentProfile.value?.phone || currentUser.value.phoneNumber || undefined,
      email: currentUser.value.email || currentProfile.value?.email || undefined,
      isAnonymous: currentUser.value.isAnonymous || false,
      isDevAccount: !!(currentUser.value as any)?.isDevAccount
    };
  }
  return null;
});

export const sessionUid = computed<string | null>(() => sessionUser.value?.uid || null);
export const isRealFirebaseUser = computed<boolean>(() => !!auth.currentUser && !auth.currentUser.isAnonymous);
export const isDevBypassUser = computed<boolean>(() => isDevBypassEnabled() && !!(currentUser.value as any)?.isDevAccount);
export const hasValidSession = computed<boolean>(() => !!sessionUser.value && (!sessionUser.value.isAnonymous || sessionUser.value.isDevAccount));

export async function getSessionUser(): Promise<SessionUser | null> {
  await initializeAuthSession();
  return sessionUser.value;
}

export function useAuth() {
  /**
   * Sign in with either Email or Username + Password.
   */
  const signIn = async (identifier: string, password: string): Promise<User> => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      throw new Error("Email or username is required.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }

    let targetEmail = "";
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (isDevBypassEnabled()) {
      const cleanUsername = normalizeUsername(trimmed);
      let targetUid: string | null = null;

      // 1. Try to find user UID by username from RTDB
      try {
        if (cleanUsername) {
          const snap = await get(dbRef(db, `usernames/${cleanUsername}`));
          if (snap.exists()) {
            targetUid = snap.val();
          }
        }
      } catch {}

      // 2. Try to match existing dev session from localStorage
      if (!targetUid) {
        const existingDev = getDevSession();
        if (
          existingDev &&
          (existingDev.username === cleanUsername ||
            existingDev.email.toLowerCase() === trimmed.toLowerCase())
        ) {
          targetUid = existingDev.uid;
        }
      }

      // 3. Fallback: create stable deterministic UID from username
      if (!targetUid) {
        targetUid = `dev_${cleanUsername || Math.random().toString(36).substring(2, 9)}`;
      }

      // Fetch or create profile
      let profile = await fetchProfile(targetUid);
      if (!profile) {
        const defaultName = isEmail ? trimmed.split("@")[0] : trimmed;
        const defaultUsername = cleanUsername || normalizeUsername(defaultName);
        profile = {
          id: targetUid,
          name: defaultName,
          username: defaultUsername,
          phone: "09123456789",
          email: isEmail ? trimmed.toLowerCase() : `${defaultUsername}@example.com`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        try {
          await set(dbRef(db, `profiles/${targetUid}`), profile);
          await set(dbRef(db, `usernames/${defaultUsername}`), targetUid);
        } catch {}
      }

      const devSession: DevSession = {
        uid: targetUid,
        name: profile.name,
        username: profile.username,
        phone: profile.phone,
        email: profile.email || `${profile.username}@example.com`,
        avatarUrl: profile.avatarUrl,
        avatarKey: profile.avatarKey,
        isDevAccount: true
      };

      saveDevSession(devSession);
      const devUser = createDevUser(devSession);
      currentUser.value = devUser;
      currentProfile.value = profile;
      useProfiles().setCachedProfile(profile);
      return devUser;
    }

    if (isEmail) {
      targetEmail = trimmed.toLowerCase();
    } else {
      // Username lookup -> resolves to account email
      targetEmail = await resolveUsername(trimmed);
    }

    try {
      const userCred = await signInWithEmailAndPassword(auth, targetEmail, password);
      clearDevSession();
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
   * Create account.
   * When DEV bypass is enabled, creates local mock account with stable dev UID.
   */
  const signUp = async (params: {
    name: string;
    username: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<User> => {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanUsername = normalizeUsername(params.username);
    const cleanName = params.name.trim();
    const cleanPhone = params.phone.trim();

    if (!cleanName) throw new Error("Full name is required.");
    if (!cleanUsername || cleanUsername.length < 3) throw new Error("Username must be at least 3 characters.");
    if (!cleanEmail) throw new Error("Email is required.");
    if (!params.password || params.password.length < 6) throw new Error("Password must be at least 6 characters.");

    if (isDevBypassEnabled()) {
      const isAvail = await checkUsernameAvailable(cleanUsername);
      if (!isAvail) {
        throw new Error("Username is already taken. Please choose another one.");
      }

      const uid = `dev_${cleanUsername}`;
      const devSession: DevSession = {
        uid,
        name: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        email: cleanEmail,
        isDevAccount: true
      };

      saveDevSession(devSession);
      const devUser = createDevUser(devSession);
      currentUser.value = devUser;

      await saveProfile({
        name: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        email: cleanEmail
      });

      return devUser;
    }

    // Check username availability first
    const isAvail = await checkUsernameAvailable(cleanUsername, auth.currentUser?.uid);
    if (!isAvail) {
      throw new Error("Username is already taken. Please choose another one.");
    }

    let user: User;

    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        // Upgrade anonymous user preserving their existing UID
        const credential = EmailAuthProvider.credential(cleanEmail, params.password);
        const userCred = await linkWithCredential(auth.currentUser, credential);
        user = userCred.user;
        clearDevSession();
      } else {
        // Real Firebase Auth account creation
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        user = userCred.user;
        clearDevSession();
      }
    } catch (err: any) {
      console.error("[Auth] Sign up failed:", err);
      throw new Error(formatAuthError(err));
    }

    currentUser.value = user;

    await saveProfile({
      name: cleanName,
      username: cleanUsername,
      phone: cleanPhone,
      email: cleanEmail
    });

    return user;
  };

  /**
   * Sign out current user, clear session, and disconnect socket.
   */
  const signOutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("[Auth] Firebase signOut warning:", err);
    } finally {
      clearDevSession();
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
      avatarKey: data.avatarKey !== undefined ? data.avatarKey : (currentProfile.value?.avatarKey || null),
      avatarPath: data.avatarPath !== undefined ? data.avatarPath : (currentProfile.value?.avatarPath || null),
      createdAt: currentProfile.value?.createdAt || now,
      updatedAt: now
    };

    // Save profile and claim username in Firebase RTDB
    await set(dbRef(db, `profiles/${uid}`), newProfile);
    await set(dbRef(db, `usernames/${cleanUsername}`), uid);

    currentProfile.value = newProfile;
    useProfiles().setCachedProfile(newProfile);

    if (isDevBypassEnabled() && (currentUser.value as any)?.isDevAccount) {
      saveDevSession({
        uid,
        name: newProfile.name,
        username: newProfile.username,
        phone: newProfile.phone,
        email: newProfile.email || `${newProfile.username}@example.com`,
        avatarUrl: newProfile.avatarUrl,
        avatarKey: newProfile.avatarKey,
        isDevAccount: true
      });
    }

    return newProfile;
  };

  const getPublicProfile = async (uid: string): Promise<Omit<Profile, "phone" | "email"> | null> => {
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
    sessionUser,
    sessionUid,
    currentSessionUser: sessionUser,
    isSessionReady: isAuthReady,
    isRealFirebaseUser,
    isDevBypassUser,
    hasValidSession,
    isAuthReady,
    authLoading,
    uid: computed(() => currentUser.value?.uid || null),
    isAuthenticated: computed(() => !!currentUser.value && !currentUser.value.isAnonymous),
    isAnonymous: computed(() => !!currentUser.value?.isAnonymous),
    isDevAccount: computed(() => !!(currentUser.value as any)?.isDevAccount),
    hasProfile: computed(() => !!currentProfile.value?.username),
    initAuth: initializeAuthSession,
    initializeAuthSession,
    getAuthenticatedUser,
    getSessionUser,
    fetchProfile,
    checkUsernameAvailable,
    resolveUsername,
    signIn,
    signUp,
    signOutUser,
    saveProfile,
    getPublicProfile
  };
}
