import { ref } from 'vue';
import { ref as dbRef, get, update, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebase';
import { useAuth, sessionUid, getSessionUser } from './useAuth';
import { useNotifications } from './useNotifications';
import {
  MERIT_TIERS,
  type Achievement,
  type MeritTier,
  type UserBadgeInfo
} from '../types/achievement';
import type { PostType } from '../types/post';

// Shared UID-keyed achievements cache
const achievementsByUid = ref<Record<string, Achievement[]>>({});
const inFlightAchievementRequests = new Map<string, Promise<Achievement[]>>();
const postAchievementsCache = new Map<string, Achievement | null>();

export function useAchievements() {
  const { currentProfile } = useAuth();
  const { createMeritNotification } = useNotifications();

  /**
   * Fetch achievements for a specific UID with in-flight deduplication.
   */
  const loadUserAchievements = async (uid: string): Promise<Achievement[]> => {
    if (!uid) return [];
    if (achievementsByUid.value[uid]) {
      return achievementsByUid.value[uid];
    }
    if (inFlightAchievementRequests.has(uid)) {
      return inFlightAchievementRequests.get(uid)!;
    }

    const fetchPromise = (async () => {
      try {
        const achQuery = query(
          dbRef(db, 'achievements'),
          orderByChild('recipientId'),
          equalTo(uid)
        );
        const snap = await get(achQuery);
        const list: Achievement[] = [];
        if (snap.exists()) {
          const val = snap.val();
          Object.entries(val).forEach(([id, item]: [string, any]) => {
            if (item && item.type === 'community_merit') {
              const ach: Achievement = {
                id,
                type: 'community_merit',
                postId: item.postId || '',
                recipientId: item.recipientId || '',
                awardedBy: item.awardedBy || '',
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
              };
              list.push(ach);
              if (ach.postId) {
                postAchievementsCache.set(ach.postId, ach);
              }
            }
          });
        }
        achievementsByUid.value[uid] = list;
        return list;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[useAchievements] Failed to fetch user merits:', err);
        }
        return [];
      } finally {
        inFlightAchievementRequests.delete(uid);
      }
    })();

    inFlightAchievementRequests.set(uid, fetchPromise);
    return fetchPromise;
  };

  /**
   * Get all merit achievements awarded to a specific user UID (sync read with bg fetch).
   */
  const getUserMerits = (uid: string | null | undefined): Achievement[] => {
    if (!uid) return [];
    if (!achievementsByUid.value[uid] && !inFlightAchievementRequests.has(uid)) {
      loadUserAchievements(uid);
    }
    return achievementsByUid.value[uid] || [];
  };

  /**
   * Get total merit count for a specific user UID.
   */
  const getMeritCount = (uid: string | null | undefined): number => {
    return getUserMerits(uid).length;
  };

  /**
   * Get badge tier states (unlocked/locked/highest) for a specific user UID.
   */
  const getUserBadges = (uid: string | null | undefined): UserBadgeInfo[] => {
    const count = getMeritCount(uid);
    let highestUnlockedId: string | null = null;

    // Find highest tier unlocked
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
   * Get the highest unlocked tier for a user, or null if none.
   */
  const getHighestTier = (uid: string | null | undefined): MeritTier | null => {
    const count = getMeritCount(uid);
    for (let i = MERIT_TIERS.length - 1; i >= 0; i--) {
      if (count >= MERIT_TIERS[i].minMerits) {
        return MERIT_TIERS[i];
      }
    }
    return null;
  };

  /**
   * Check if an achievement already exists for a post.
   */
  const getAchievementByPostId = (postId: string): Achievement | null => {
    if (!postId) return null;
    return postAchievementsCache.get(postId) || null;
  };

  /**
   * Award merit and resolve a post atomically.
   */
  const awardMeritAndResolvePost = async (params: {
    postId: string;
    postTitle: string;
    postType: PostType;
    postAuthorId: string;
    recipientId?: string | null;
  }) => {
    const session = await getSessionUser();
    const currentUid = session?.uid || sessionUid.value || currentProfile.value?.id;
    if (!currentUid) {
      throw new Error('You must be signed in to resolve posts.');
    }

    if (params.postAuthorId !== currentUid) {
      throw new Error('Only the post author can mark this post as resolved.');
    }

    const nextStatus = params.postType === 'found' ? 'returned' : 'resolved';
    const now = Date.now();
    const updates: Record<string, any> = {
      [`posts/${params.postId}/status`]: nextStatus,
      [`posts/${params.postId}/resolvedAt`]: now,
      [`posts/${params.postId}/resolvedBy`]: currentUid,
      [`posts/${params.postId}/updatedAt`]: now
    };

    let newAchievementId: string | null = null;
    const recipientId = params.recipientId?.trim();

    if (recipientId) {
      if (recipientId === currentUid) {
        throw new Error('You cannot award a community merit to yourself.');
      }

      // Check if merit already awarded for this post
      const existing = getAchievementByPostId(params.postId);
      if (!existing) {
        newAchievementId = `ach_${now}_${Math.random().toString(36).substring(2, 7)}`;
        updates[`posts/${params.postId}/meritRecipientId`] = recipientId;
        updates[`achievements/${newAchievementId}`] = {
          id: newAchievementId,
          type: 'community_merit',
          postId: params.postId,
          recipientId,
          awardedBy: currentUid,
          createdAt: now
        };
      }
    }

    // Atomic write to Firebase RTDB
    await update(dbRef(db), updates);

    // Send in-app notification to the credited recipient if a new merit was awarded
    if (recipientId && newAchievementId) {
      const awarderName = currentProfile.value?.name || session?.name || 'A community member';
      createMeritNotification({
        recipientId,
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
    achievements: achievementsByUid,
    loadUserAchievements,
    subscribeToAchievements: (uid?: string) => (uid ? loadUserAchievements(uid) : Promise.resolve([])),
    getUserMerits,
    getMeritCount,
    getUserBadges,
    getHighestTier,
    getAchievementByPostId,
    awardMeritAndResolvePost
  };
}
