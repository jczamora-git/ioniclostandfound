import { ref, onMounted, watch } from "vue";
import { ref as dbRef, get, query, limitToLast } from "firebase/database";
import { db } from "../firebase";

export interface LatestCommentPreview {
  id: string;
  authorName: string;
  content: string;
  createdAt: number;
}

const latestCommentCache = new Map<string, LatestCommentPreview | null>();
const inFlightCommentRequests = new Map<string, Promise<LatestCommentPreview | null>>();

export async function fetchLatestCommentForPost(postId: string): Promise<LatestCommentPreview | null> {
  if (!postId) return null;
  if (latestCommentCache.has(postId)) {
    return latestCommentCache.get(postId) || null;
  }
  if (inFlightCommentRequests.has(postId)) {
    return inFlightCommentRequests.get(postId)!;
  }

  const fetchPromise = (async () => {
    try {
      const commentsQuery = query(dbRef(db, `comments/${postId}`), limitToLast(1));
      const snap = await get(commentsQuery);
      if (!snap.exists()) {
        latestCommentCache.set(postId, null);
        return null;
      }

      const val = snap.val();
      if (!val || typeof val !== "object") {
        latestCommentCache.set(postId, null);
        return null;
      }

      const entries = Object.entries(val);
      if (entries.length === 0) {
        latestCommentCache.set(postId, null);
        return null;
      }

      const [id, c] = entries[entries.length - 1] as [string, any];
      if (!c || typeof c !== "object") {
        latestCommentCache.set(postId, null);
        return null;
      }

      const content = typeof c.content === "string" ? c.content.trim() : "";
      if (!content) {
        latestCommentCache.set(postId, null);
        return null;
      }

      const preview: LatestCommentPreview = {
        id,
        authorName:
          typeof c.authorName === "string" && c.authorName.trim()
            ? c.authorName.trim()
            : "Community Member",
        content,
        createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now()
      };
      latestCommentCache.set(postId, preview);
      return preview;
    } catch {
      latestCommentCache.set(postId, null);
      return null;
    } finally {
      inFlightCommentRequests.delete(postId);
    }
  })();

  inFlightCommentRequests.set(postId, fetchPromise);
  return fetchPromise;
}

export function invalidateLatestCommentCache(postId: string) {
  latestCommentCache.delete(postId);
}

export function useLatestComment(postIdGetter: () => string) {
  const latestComment = ref<LatestCommentPreview | null>(null);

  const load = async (postId: string) => {
    if (!postId) {
      latestComment.value = null;
      return;
    }
    const result = await fetchLatestCommentForPost(postId);
    latestComment.value = result;
  };

  onMounted(() => {
    load(postIdGetter());
  });

  watch(postIdGetter, (newId) => {
    load(newId);
  });

  return {
    latestComment
  };
}
