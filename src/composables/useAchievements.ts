import { ref, computed } from 'vue';
import { ref as dbRef, onValue, update } from 'firebase/database';
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

// Shared global reactive achievements cache
const achievements = ref<Achievement[]>([]);
const achievementsLoading = ref(false);
let isSubscribed = false;

export function useAchievements() {
  const { currentProfile } = useAuth();
  const { createMeritNotification } = useNotifications();

  /**
   * Subscribe to real-time achievements updates.
   */
  const subscribeToAchievements = () => {
    if (isSubscribed) return;
    isSubscribed = true;
    achievementsLoading.value = true;

    try {
      const achRef = dbRef(db, 'achievements');
      onValue(achRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const list: Achievement[] = [];
          Object.entries(val).forEach(([id, item]: [string, any]) => {
            if (item && item.type === 'community_merit') {
              list.push({
                id,
                type: 'community_merit',
                postId: item.postId || '',
                recipientId: item.recipientId || '',
                awardedBy: item.awardedBy || '',
                createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
              });
            }
          });
          achievements.value = list;
        } else {
          achievements.value = [];
        }
        achievementsLoading.value = false;
      });
    } catch (err) {
      console.warn('[useAchievements] Subscription error:', err);
      achievementsLoading.value = false;
    }
  };

  /**
   * Get all merit achievements awarded to a specific user UID.
   */
  const getUserMerits = (uid: string | null | undefined): Achievement[] => {
    if (!uid) return [];
    if (!isSubscribed) subscribeToAchievements();
    return achievements.value.filter(
      (a) => a.recipientId === uid && a.type === 'community_merit'
    );
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
    if (!isSubscribed) subscribeToAchievements();
    return achievements.value.find(
      (a) => a.postId === postId && a.type === 'community_merit'
    ) || null;
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
        console.warn('[useAchievements] Failed to deliver merit notification:', err);
      });
    }
  };

  return {
    achievements,
    achievementsLoading,
    subscribeToAchievements,
    getUserMerits,
    getMeritCount,
    getUserBadges,
    getHighestTier,
    getAchievementByPostId,
    awardMeritAndResolvePost
  };
}
