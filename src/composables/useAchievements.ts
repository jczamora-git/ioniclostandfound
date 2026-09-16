import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { ref as dbRef, get, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { db, auth } from '../firebase';
import { useAuth, currentAppUserId, sessionUid } from './useAuth';
import { resolveAppUserId, getProfileById } from './useProfiles';
import { useNotifications } from './useNotifications';
import {
  MERIT_TIERS,
  type Achievement,
  type MeritTier,
  type UserBadgeInfo
} from '../types/achievement';
import type { PostType } from '../types/post';

// Shared reactive cache keyed by user/profile ID
const achievementsByUserId = ref<Record<string, Achievement[]>>({});
const loadingByUserId = ref<Record<string, boolean>>({});
const inFlightRequests = new Map<string, Promise<Achievement[]>>();
const postAchievementsMap = new Map<string, Achievement>();

let hasLoadedGlobalAchievements = false;
let globalAchievementsPromise: Promise<void> | null = null;

/**
 * Checks if two user IDs refer to the same application user.
 * Handles dev prefixes (e.g. dev_user1 === user1) and whitespace.
 */
export function isSameAppUser(idA?: string | null, idB?: string | null): boolean {
  if (!idA || !idB) return false;
  const a = idA.trim();
  const b = idB.trim();
  if (a === b) return true;
  // Normalize dev bypass prefix if present
  if (a.replace(/^dev_/, '') === b.replace(/^dev_/, '')) return true;
  return false;
}

/**
 * Global batch loader that fetches all achievements once and caches them by recipient ID.
 * Avoids N+1 calls across feeds, message lists, and comments.
 */
export const loadAllAchievements = async (forceRefresh = false): Promise<void> => {
  if (hasLoadedGlobalAchievements && !forceRefresh) return;
  if (globalAchievementsPromise && !forceRefresh) return globalAchievementsPromise;

  globalAchievementsPromise = (async () => {
    try {
      const snap = await get(dbRef(db, 'achievements'));
      const grouped: Record<string, Achievement[]> = {};

      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        for (const [id, item] of Object.entries(val)) {
          if (item && item.type === 'community_merit') {
            const ach: Achievement = {
              id,
              type: 'community_merit',
              postId: item.postId || '',
              recipientId: item.recipientId || '',
              awardedBy: item.awardedBy || '',
              createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
            };
            if (ach.postId) {
              postAchievementsMap.set(ach.postId, ach);
            }
            if (ach.recipientId) {
              const rId = ach.recipientId.trim();
              if (!grouped[rId]) grouped[rId] = [];
              grouped[rId].push(ach);
            }
          }
        }
      }

      // Deduplicate each recipient's achievements by postId
      const finalGrouped: Record<string, Achievement[]> = {};
      for (const [rId, list] of Object.entries(grouped)) {
        const seenPosts = new Set<string>();
        const unique: Achievement[] = [];
        for (const ach of list) {
          if (ach.postId) {
            if (seenPosts.has(ach.postId)) continue;
            seenPosts.add(ach.postId);
          }
          unique.push(ach);
        }
        unique.sort((a, b) => b.createdAt - a.createdAt);
        finalGrouped[rId] = unique;
      }

      achievementsByUserId.value = {
        ...achievementsByUserId.value,
        ...finalGrouped
      };
      hasLoadedGlobalAchievements = true;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useAchievements] Failed loading all achievements:', err);
      }
    } finally {
      globalAchievementsPromise = null;
    }
  })();

  return globalAchievementsPromise;
};

/**
 * Fetch and reconcile achievements for a canonical user/profile ID.
 */
export const loadAchievementsForUser = async (
  rawUserId: string | null | undefined,
  forceRefresh = false
): Promise<Achievement[]> => {
  if (!rawUserId) return [];
  const targetId = rawUserId.trim();

  // Return cached result if already populated and not forcing refresh
  if (!forceRefresh && achievementsByUserId.value[targetId]) {
    return achievementsByUserId.value[targetId];
  }

  // Deduplicate concurrent requests
  if (inFlightRequests.has(targetId)) {
    return inFlightRequests.get(targetId)!;
  }

  // Mark as loading if not yet cached
  if (!achievementsByUserId.value[targetId]) {
    loadingByUserId.value = { ...loadingByUserId.value, [targetId]: true };
  }

  const fetchPromise = (async () => {
    try {
      const userMerits: Achievement[] = [];
      const existingPostIds = new Set<string>();
      const groupedBatch: Record<string, Achievement[]> = {};

      // 1. Direct Firebase Read of all achievements
      try {
        const snap = await get(dbRef(db, 'achievements'));
        if (snap.exists()) {
          const val = snap.val();
          for (const [id, item] of Object.entries(val as Record<string, any>)) {
            if (item && item.type === 'community_merit') {
              const ach: Achievement = {
                id,
                type: 'community_merit',
                postId: item.postId || '',
                recipientId: item.recipientId || '',
                awardedBy: item.awardedBy || '',
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
              };

              if (ach.postId) {
                postAchievementsMap.set(ach.postId, ach);
                existingPostIds.add(ach.postId);
              }

              if (ach.recipientId) {
                const rId = ach.recipientId.trim();
                if (!groupedBatch[rId]) groupedBatch[rId] = [];
                groupedBatch[rId].push(ach);
              }

              // Check if recipient matches target profile ID or legacy alias
              const isMatch = isSameAppUser(ach.recipientId, targetId);
              if (isMatch) {
                userMerits.push(ach);
              } else if (ach.recipientId) {
                // Compatibility check: does raw recipient ID resolve to target profile ID?
                const resolved = await resolveAppUserId(ach.recipientId);
                if (isSameAppUser(resolved, targetId)) {
                  userMerits.push(ach);
                }
              }
            }
          }
        }
      } catch (achErr) {
        if (import.meta.env.DEV) {
          console.warn('[useAchievements] Failed reading achievements node directly:', achErr);
        }
      }

      // 2. Post Merit Fallback (Requirement 14):
      // Check resolved posts with meritRecipientId where no achievement record was created
      try {
        const postsSnap = await get(dbRef(db, 'posts'));
        if (postsSnap.exists()) {
          const postsVal = postsSnap.val() as Record<string, any>;
          for (const [postId, postItem] of Object.entries(postsVal)) {
            if (
              postItem &&
              postItem.meritRecipientId &&
              postItem.resolvedBy &&
              postItem.resolvedAt &&
              !existingPostIds.has(postId)
            ) {
              const matchesRecipient =
                isSameAppUser(postItem.meritRecipientId, targetId) ||
                (await resolveAppUserId(postItem.meritRecipientId)) === targetId;

              if (matchesRecipient) {
                const reconciledAch: Achievement = {
                  id: `ach_reconciled_${postId}`,
                  type: 'community_merit',
                  postId,
                  recipientId: targetId,
                  awardedBy: postItem.resolvedBy,
                  createdAt: typeof postItem.resolvedAt === 'number' ? postItem.resolvedAt : Date.now()
                };

                userMerits.push(reconciledAch);
                existingPostIds.add(postId);
                postAchievementsMap.set(postId, reconciledAch);

                // Reconcile safely into Firebase RTDB under achievements if signed in
                if (auth.currentUser) {
                  set(dbRef(db, `achievements/ach_reconciled_${postId}`), reconciledAch).catch(() => {});
                }
              }
            }
          }
        }
      } catch (postErr) {
        if (import.meta.env.DEV) {
          console.warn('[useAchievements] Post merit fallback check error:', postErr);
        }
      }

      // 3. Deduplicate by postId (Requirement 15: One post awards at most 1 merit)
      const uniqueList: Achievement[] = [];
      const seenPostIds = new Set<string>();
      for (const ach of userMerits) {
        if (ach.postId) {
          if (seenPostIds.has(ach.postId)) continue;
          seenPostIds.add(ach.postId);
        }
        uniqueList.push(ach);
      }

      // Sort by createdAt descending
      uniqueList.sort((a, b) => b.createdAt - a.createdAt);

      // Update global reactive cache
      achievementsByUserId.value = {
        ...achievementsByUserId.value,
        [targetId]: uniqueList
      };

      // Also map current auth UID alias if target is current profile
      const myAuthUid = auth.currentUser?.uid;
      if (myAuthUid && myAuthUid !== targetId && isSameAppUser(myAuthUid, targetId)) {
        achievementsByUserId.value = {
          ...achievementsByUserId.value,
          [myAuthUid]: uniqueList
        };
      }

      // 4. Development logging (Requirement 18)
      if (import.meta.env.DEV) {
        console.log(`[Achievements] profileId: ${targetId}`);
        console.log(`[Achievements] loaded: ${uniqueList.length}`);
        console.log(`[Achievements] meritCount: ${uniqueList.length}`);
      }

      return uniqueList;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useAchievements] Error loading achievements for user:', err);
      }
      return achievementsByUserId.value[targetId] || [];
    } finally {
      inFlightRequests.delete(targetId);
      loadingByUserId.value = {
        ...loadingByUserId.value,
        [targetId]: false
      };
    }
  })();

  inFlightRequests.set(targetId, fetchPromise);
  return fetchPromise;
};

export interface UserDisplayModel {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  meritCount: number;
  highestAchievement: MeritTier | null;
}

/**
 * Get unified cached user display model including profile and achievement rank.
 */
export const getUserDisplayModel = (uid: string | null | undefined): UserDisplayModel | null => {
  if (!uid) return null;
  const p = getProfileById(uid);
  return {
    id: uid,
    name: p?.name || 'Community Member',
    username: p?.username || 'user',
    avatarUrl: p?.avatarUrl || null,
    meritCount: getMeritCount(uid),
    highestAchievement: getHighestTier(uid)
  };
};

/**
 * Get merit achievements for a specific user ID with alias matching and global caching.
 */
export const getMeritAchievements = (userId: string | null | undefined): Achievement[] => {
  if (!userId) return [];
  const targetId = userId.trim();

  // Trigger global achievements load if not yet initialized
  if (!hasLoadedGlobalAchievements && !globalAchievementsPromise) {
    loadAllAchievements();
  }

  // Exact targetId match
  if (achievementsByUserId.value[targetId]) {
    return achievementsByUserId.value[targetId];
  }

  // Matching aliases in cache
  for (const [uid, list] of Object.entries(achievementsByUserId.value)) {
    if (isSameAppUser(uid, targetId)) {
      return list;
    }
  }

  if (!inFlightRequests.has(targetId) && !hasLoadedGlobalAchievements) {
    loadAchievementsForUser(targetId);
  }

  return [];
};

/**
 * Get total verified community merit count for a user.
 */
export const getMeritCount = (userId: string | null | undefined): number => {
  return getMeritAchievements(userId).length;
};

/**
 * Check if achievements are currently loading for a user.
 */
export const isUserAchievementsLoading = (userId: string | null | undefined): boolean => {
  if (!userId) return false;
  const targetId = userId.trim();
  if (loadingByUserId.value[targetId] !== undefined) {
    return loadingByUserId.value[targetId];
  }
  // If not yet cached and not loaded, it's pending load
  if (!achievementsByUserId.value[targetId]) {
    return true;
  }
  return false;
};

/**
 * Get the highest unlocked tier for a user, or null if 0 merits.
 */
export const getHighestTier = (userId: string | null | undefined): MeritTier | null => {
  const count = getMeritCount(userId);
  for (let i = MERIT_TIERS.length - 1; i >= 0; i--) {
    if (count >= MERIT_TIERS[i].minMerits) {
      return MERIT_TIERS[i];
    }
  }
  return null;
};

/**
 * Get badge tier status (unlocked, isHighest) for a user.
 */
export const getUserBadges = (userId: string | null | undefined): UserBadgeInfo[] => {
  const count = getMeritCount(userId);
  let highestUnlockedId: string | null = null;

  for (let i = MERIT_TIERS.length - 1; i >= 0; i--) {
    if (count >= MERIT_TIERS[i].minMerits) {
      highestUnlockedId = MERIT_TIERS[i].id;
      break;
    }
  }

  return MERIT_TIERS.map((tier) => ({
    tier,
    unlocked: count >= tier.minMerits,
    isHighest: tier.id === highestUnlockedId
  }));
};

/**
 * Check if an achievement already exists for a given postId.
 */
export const getAchievementByPostId = (postId: string): Achievement | null => {
  if (!postId) return null;
  return postAchievementsMap.get(postId) || null;
};

export function useAchievements(
  targetUserIdInput?: Ref<string | null | undefined> | ComputedRef<string | null | undefined> | string | null
) {
  const { currentProfile } = useAuth();
  const { createMeritNotification } = useNotifications();

  // If a target user ID was supplied, provide pre-bound computed helpers
  const resolvedTargetId = computed(() => {
    if (!targetUserIdInput) return currentAppUserId.value || currentProfile.value?.id || '';
    if (typeof targetUserIdInput === 'string') return targetUserIdInput;
    return targetUserIdInput.value || '';
  });

  const meritAchievements = computed(() => getMeritAchievements(resolvedTargetId.value));
  const meritCount = computed(() => getMeritCount(resolvedTargetId.value));
  const highestMeritBadge = computed(() => getHighestTier(resolvedTargetId.value));
  const unlockedBadges = computed(() => getUserBadges(resolvedTargetId.value));
  const isAchievementsLoading = computed(() => isUserAchievementsLoading(resolvedTargetId.value));

  /**
   * Award merit and resolve a post atomically using canonical application profile IDs.
   */
  const awardMeritAndResolvePost = async (params: {
    postId: string;
    postTitle: string;
    postType: PostType;
    postAuthorId: string;
    recipientId?: string | null;
  }) => {
    const authorCanonicalId = currentAppUserId.value || currentProfile.value?.id || sessionUid.value || auth.currentUser?.uid;
    if (!authorCanonicalId) {
      throw new Error('You must be signed in to resolve posts.');
    }

    if (!isSameAppUser(params.postAuthorId, authorCanonicalId)) {
      throw new Error('Only the post author can mark this post as resolved.');
    }

    // Resolve helper's canonical profile ID
    let helperCanonicalId = params.recipientId?.trim() || null;
    if (helperCanonicalId) {
      helperCanonicalId = await resolveAppUserId(helperCanonicalId);
    }

    if (helperCanonicalId && isSameAppUser(helperCanonicalId, authorCanonicalId)) {
      throw new Error('You cannot award a community merit to yourself.');
    }

    const nextStatus = params.postType === 'found' ? 'returned' : 'resolved';
    const now = Date.now();
    const updates: Record<string, any> = {
      [`posts/${params.postId}/status`]: nextStatus,
      [`posts/${params.postId}/resolvedAt`]: now,
      [`posts/${params.postId}/resolvedBy`]: authorCanonicalId,
      [`posts/${params.postId}/updatedAt`]: now
    };

    let newAchievementId: string | null = null;
    if (helperCanonicalId) {
      // Check whether an achievement already exists for this post
      const existing = getAchievementByPostId(params.postId);
      if (!existing) {
        newAchievementId = `ach_${now}_${Math.random().toString(36).substring(2, 7)}`;
        updates[`posts/${params.postId}/meritRecipientId`] = helperCanonicalId;
        updates[`achievements/${newAchievementId}`] = {
          id: newAchievementId,
          type: 'community_merit',
          postId: params.postId,
          recipientId: helperCanonicalId,
          awardedBy: authorCanonicalId,
          createdAt: now
        };
      }
    }

    // Atomic write to Firebase RTDB
    await update(dbRef(db), updates);

    // Refresh achievements in-memory for helper and author immediately
    if (helperCanonicalId) {
      await loadAchievementsForUser(helperCanonicalId, true);
    }
    await loadAchievementsForUser(authorCanonicalId, true);

    // Send in-app notification to credited helper
    if (helperCanonicalId && newAchievementId) {
      const awarderName = currentProfile.value?.name || 'A community member';
      createMeritNotification({
        recipientId: helperCanonicalId,
        postId: params.postId,
        postTitle: params.postTitle,
        awardedByName: awarderName
      }).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[useAchievements] Failed to deliver merit notification:', err);
        }
      });
    }
  };

  return {
    achievements: achievementsByUserId,
    meritAchievements,
    meritCount,
    highestMeritBadge,
    unlockedBadges,
    isAchievementsLoading,
    isUserAchievementsLoading,
    loadAchievementsForUser,
    loadAchievements: (uid?: string, force = false) => loadAchievementsForUser(uid || resolvedTargetId.value, force),
    subscribeToAchievements: (uid?: string) => loadAchievementsForUser(uid || resolvedTargetId.value),
    getUserMerits: getMeritAchievements,
    getMeritCount,
    getUserBadges,
    getHighestTier,
    getAchievementByPostId,
    loadAllAchievements,
    getUserDisplayModel,
    awardMeritAndResolvePost
  };
}
