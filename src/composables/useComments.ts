import { ref } from "vue";
import {
  ref as dbRef,
  onValue,
  push,
  set,
  remove,
  get,
  update
} from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "./useAuth";
import { useNotifications } from "./useNotifications";
import type { PostComment } from "../types/comment";

export function useComments() {
  const { currentProfile } = useAuth();
  const comments = ref<PostComment[]>([]);
  const commentsLoading = ref(false);

  let unsubscribe: (() => void) | null = null;

  const subscribeToComments = (postId: string) => {
    commentsLoading.value = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    const commentsNode = dbRef(db, `comments/${postId}`);
    const unsub = onValue(
      commentsNode,
      (snapshot) => {
        const loaded: PostComment[] = [];
        if (snapshot.exists()) {
          const val = snapshot.val();
          Object.entries(val).forEach(([id, c]: [string, any]) => {
            loaded.push({
              id,
              postId,
              authorId: c.authorId || "anonymous",
              authorName: c.authorName || "Community Member",
              authorUsername: c.authorUsername || "member",
              content: c.content || "",
              createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
              updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : Date.now()
            });
          });
        }
        // Chronological order for comments (oldest to newest)
        loaded.sort((a, b) => a.createdAt - b.createdAt);
        comments.value = loaded;
        commentsLoading.value = false;
      },
      (error) => {
        console.error("Comments subscription failed:", error);
        commentsLoading.value = false;
      }
    );

    unsubscribe = () => unsub();
  };

  const addComment = async (postId: string, content: string): Promise<string> => {
    if (!currentProfile.value) {
      throw new Error("You must complete your profile to comment.");
    }
    const cleanContent = content.trim();
    if (!cleanContent) {
      throw new Error("Comment cannot be empty.");
    }

    const commentsNode = dbRef(db, `comments/${postId}`);
    const newCommentRef = push(commentsNode);
    const commentId = newCommentRef.key!;
    const now = Date.now();

    const newComment: Omit<PostComment, "id"> = {
      postId,
      authorId: currentProfile.value.id,
      authorName: currentProfile.value.name,
      authorUsername: currentProfile.value.username,
      content: cleanContent,
      createdAt: now,
      updatedAt: now
    };

    await set(newCommentRef, newComment);

    // Update commentsCount on post and notify post author
    try {
      const postRef = dbRef(db, `posts/${postId}`);
      const snap = await get(postRef);
      if (snap.exists()) {
        const postData = snap.val();
        const currentCount = postData.commentsCount || 0;
        await update(postRef, { commentsCount: currentCount + 1 });

        if (postData.authorId) {
          const { createCommentNotification } = useNotifications();
          createCommentNotification({
            postAuthorId: postData.authorId,
            postId,
            postTitle: postData.title,
            commentId,
            commentText: cleanContent
          }).catch((err) => console.warn("Failed to deliver comment notification:", err));
        }
      }
    } catch (e) {
      console.warn("Could not update commentsCount or notify author:", e);
    }

    return commentId;
  };

  const deleteComment = async (postId: string, commentId: string) => {
    if (!currentProfile.value) {
      throw new Error("You must be logged in.");
    }

    const comment = comments.value.find((c) => c.id === commentId);
    if (!comment) throw new Error("Comment not found.");
    if (comment.authorId !== currentProfile.value.id) {
      throw new Error("You can only delete your own comments.");
    }

    await remove(dbRef(db, `comments/${postId}/${commentId}`));

    // Update commentsCount on post
    try {
      const postRef = dbRef(db, `posts/${postId}`);
      const snap = await get(postRef);
      if (snap.exists()) {
        const currentCount = snap.val().commentsCount || 1;
        await update(postRef, { commentsCount: Math.max(0, currentCount - 1) });
      }
    } catch (e) {
      console.warn("Could not decrement commentsCount:", e);
    }
  };

  const stopCommentsSubscription = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  return {
    comments,
    commentsLoading,
    subscribeToComments,
    stopCommentsSubscription,
    addComment,
    deleteComment
  };
}
