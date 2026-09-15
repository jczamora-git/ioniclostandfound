import { ref, onMounted, onUnmounted, watch } from "vue";
import { ref as dbRef, onValue, query, limitToLast } from "firebase/database";
import { db } from "../firebase";

export interface LatestCommentPreview {
  id: string;
  authorName: string;
  content: string;
  createdAt: number;
}

export function useLatestComment(postIdGetter: () => string) {
  const latestComment = ref<LatestCommentPreview | null>(null);
  let unsubscribe: (() => void) | null = null;

  const subscribe = (postId: string) => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!postId) {
      latestComment.value = null;
      return;
    }

    const commentsQuery = query(dbRef(db, `comments/${postId}`), limitToLast(1));
    const unsub = onValue(
      commentsQuery,
      (snapshot) => {
        if (!snapshot.exists()) {
          latestComment.value = null;
          return;
        }

        const val = snapshot.val();
        if (!val || typeof val !== "object") {
          latestComment.value = null;
          return;
        }

        const entries = Object.entries(val);
        if (entries.length === 0) {
          latestComment.value = null;
          return;
        }

        const [id, c] = entries[entries.length - 1] as [string, any];
        if (!c || typeof c !== "object") {
          latestComment.value = null;
          return;
        }

        const content = typeof c.content === "string" ? c.content.trim() : "";
        if (!content) {
          latestComment.value = null;
          return;
        }

        latestComment.value = {
          id,
          authorName:
            typeof c.authorName === "string" && c.authorName.trim()
              ? c.authorName.trim()
              : "Community Member",
          content,
          createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now()
        };
      },
      (error) => {
        console.error(`Failed to subscribe to latest comment for post ${postId}:`, error);
        latestComment.value = null;
      }
    );

    unsubscribe = () => unsub();
  };

  onMounted(() => {
    subscribe(postIdGetter());
  });

  watch(postIdGetter, (newId) => {
    subscribe(newId);
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return {
    latestComment
  };
}
