import { ref } from "vue";
import {
  ref as dbRef,
  onValue,
  get,
  set,
  push,
  update,
  remove
} from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "./useAuth";
import type {
  Post,
  PostCategory,
  PostFilter,
  PostFormData,
  PostStatus,
  PostType,
  AdvancedFilterOptions
} from "../types/post";
import { getCategoryConfig, normalizeCategoryKey } from "../config/categories";
import { resolveCustomSubcategory, type ResolvedCustomSubcategory } from "./useCategories";

const posts = ref<Post[]>([]);
const postsLoading = ref(true);
const postsError = ref("");
const myHelpfulMap = ref<Record<string, boolean>>({});

let isSubscribed = false;

const resolvePendingSubcategory = async (
  data: Partial<PostFormData>,
  category: string,
  subCategory?: string
): Promise<ResolvedCustomSubcategory | null> => {
  const pending = data.pendingSubcategory;
  if (!pending || !subCategory) return null;
  const categoryKey = getCategoryConfig(category)?.key;
  if (!categoryKey || getCategoryConfig(pending.category)?.key !== categoryKey ||
    normalizeCategoryKey(pending.name) !== normalizeCategoryKey(subCategory)) return null;
  return resolveCustomSubcategory(category, subCategory);
};

/** Save the post and its new shared option in one all-or-nothing Firebase update. */
const savePostWithSubcategory = async (
  postWrites: (name: string) => Record<string, unknown>,
  subcategory: ResolvedCustomSubcategory
) => {
  const path = `subcategories/${subcategory.categoryKey}/${subcategory.normalizedKey}`;
  try {
    await update(dbRef(db), {
      ...postWrites(subcategory.name),
      [path]: {
        name: subcategory.name,
        normalizedKey: subcategory.normalizedKey,
        createdAt: Date.now()
      }
    });
  } catch (error) {
    // Another publisher may have claimed this exact key with a different display name.
    // The immutable-name rule rejects that combined write, so reuse the confirmed record.
    let existingName: string | undefined;
    try {
      const snapshot = await get(dbRef(db, path));
      const existing = snapshot.val();
      if (snapshot.exists() && typeof existing?.name === "string" &&
        normalizeCategoryKey(existing.name) === subcategory.normalizedKey) {
        existingName = existing.name.trim();
      }
    } catch {
      throw error;
    }
    if (!existingName || existingName === subcategory.name) throw error;
    await update(dbRef(db), postWrites(existingName));
  }
};

export function usePosts() {
  const { currentProfile, currentUser } = useAuth();

  const subscribeToPosts = () => {
    if (isSubscribed) return;
    isSubscribed = true;
    postsLoading.value = true;

    const postsNode = dbRef(db, "posts");
    onValue(
      postsNode,
      async (snapshot) => {
        const loaded: Post[] = [];
        if (snapshot.exists()) {
          const val = snapshot.val();
          Object.entries(val).forEach(([id, item]: [string, any]) => {
            loaded.push({
              id,
              authorId: item.authorId || "anonymous",
              authorName: item.authorName || "Community Member",
              authorUsername: item.authorUsername || "member",
              type: (item.type?.toLowerCase() === "found" ? "found" : "lost") as PostType,
              title: item.title || item.itemName || "Untitled Item",
              category: (item.category || "Other") as PostCategory,
              subCategory: item.subCategory || undefined,
              description: item.description || "",
              location: item.location || "Unknown location",
              eventDate: item.eventDate || item.date || new Date().toISOString().split("T")[0],
              imageUrl: item.imageUrl || undefined,
              imagePath: item.imagePath || undefined,
              status: (item.status?.toLowerCase() === "resolved"
                ? "resolved"
                : item.status?.toLowerCase() === "returned" || item.status?.toLowerCase() === "claimed"
                ? "returned"
                : "open") as PostStatus,
              helpfulCount: typeof item.helpfulCount === "number" ? item.helpfulCount : 0,
              commentsCount: typeof item.commentsCount === "number" ? item.commentsCount : 0,
              createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
              updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now()
            });
          });
        }

        // Check if legacy lost_found table has items not yet in posts
        try {
          const legacySnap = await get(dbRef(db, "lost_found"));
          if (legacySnap.exists()) {
            const legacyVal = legacySnap.val();
            const existingIds = new Set(loaded.map((p) => p.id));
            Object.entries(legacyVal).forEach(([id, item]: [string, any]) => {
              if (!existingIds.has(id)) {
                loaded.push({
                  id,
                  authorId: item.authorId || "legacy_user",
                  authorName: item.authorName || "Legacy Post",
                  authorUsername: item.authorUsername || "community",
                  type: (item.type?.toLowerCase() === "found" ? "found" : "lost") as PostType,
                  title: item.itemName || "Untitled Item",
                  category: item.category || "Other",
                  subCategory: item.subCategory || undefined,
                  description: item.description || "",
                  location: item.location || "Unknown location",
                  eventDate: item.date || new Date().toISOString().split("T")[0],
                  imageUrl: undefined,
                  status: (item.status === "Claimed" ? "resolved" : "open") as PostStatus,
                  helpfulCount: 0,
                  commentsCount: 0,
                  createdAt: Date.now() - 86400000,
                  updatedAt: Date.now() - 86400000
                });
              }
            });
          }
        } catch (legacyErr) {
          console.warn("Could not inspect legacy records:", legacyErr);
        }

        // Sort chronological newest first (createdAt descending)
        loaded.sort((a, b) => b.createdAt - a.createdAt);
        posts.value = loaded;
        postsLoading.value = false;
        postsError.value = "";
      },
      (error) => {
        console.error("Posts subscription error:", error);
        postsError.value = "Failed to load community posts.";
        postsLoading.value = false;
      }
    );

    // Also listen to current user's helpful node if logged in
    if (currentUser.value) {
      subscribeToMyHelpful(currentUser.value.uid);
    }
  };

  const subscribeToMyHelpful = (uid: string) => {
    const helpfulUserRef = dbRef(db, `userHelpful/${uid}`);
    onValue(helpfulUserRef, (snap) => {
      if (snap.exists()) {
        myHelpfulMap.value = snap.val() || {};
      } else {
        myHelpfulMap.value = {};
      }
    });
  };

  const createPost = async (data: PostFormData): Promise<string> => {
    if (!currentProfile.value) {
      throw new Error("You must complete your profile first.");
    }

    const postsNode = dbRef(db, "posts");
    const newPostRef = push(postsNode);
    const postId = newPostRef.key!;
    const now = Date.now();

    // Never save local blob: URLs to database
    const validRemoteImageUrl =
      data.imageUrl && !data.imageUrl.startsWith("blob:") ? data.imageUrl.trim() : null;

    const newPost: Omit<Post, "id"> = {
      authorId: currentProfile.value.id,
      authorName: currentProfile.value.name,
      authorUsername: currentProfile.value.username,
      type: data.type,
      title: data.title.trim(),
      category: data.category,
      ...(data.subCategory?.trim() ? { subCategory: data.subCategory.trim() } : {}),
      description: data.description.trim(),
      location: data.location.trim(),
      eventDate: data.eventDate,
      ...(validRemoteImageUrl ? { imageUrl: validRemoteImageUrl } : {}),
      status: "open",
      helpfulCount: 0,
      commentsCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const pending = await resolvePendingSubcategory(data, data.category, data.subCategory);
    if (pending) newPost.subCategory = pending.name;
    if (pending?.isNew) {
      await savePostWithSubcategory(
        (name) => ({ [`posts/${postId}`]: { ...newPost, subCategory: name } }),
        pending
      );
    } else {
      await set(newPostRef, newPost);
    }
    return postId;
  };

  const updatePost = async (postId: string, data: Partial<PostFormData>) => {
    if (!currentProfile.value) {
      throw new Error("You must be logged in to edit posts.");
    }

    const post = posts.value.find((p) => p.id === postId) || await getPostById(postId);
    if (!post) throw new Error("Post not found.");
    if (post.authorId !== currentProfile.value.id) {
      throw new Error("You can only edit your own posts.");
    }

    const updates: Record<string, any> = {
      updatedAt: Date.now()
    };

    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.category !== undefined) updates.category = data.category;
    if (data.subCategory !== undefined) updates.subCategory = data.subCategory?.trim() || null;
    if (data.description !== undefined) updates.description = data.description.trim();
    if (data.location !== undefined) updates.location = data.location.trim();
    if (data.eventDate !== undefined) updates.eventDate = data.eventDate;

    if (data.removeImage) {
      updates.imageUrl = null;
      updates.imagePath = null;
    } else if (data.imageUrl !== undefined && !data.imageUrl?.startsWith("blob:")) {
      updates.imageUrl = data.imageUrl?.trim() || null;
    }

    const pending = await resolvePendingSubcategory(
      data,
      data.category ?? post.category,
      data.subCategory === undefined ? post.subCategory : data.subCategory
    );
    if (pending) updates.subCategory = pending.name;
    if (pending?.isNew) {
      await savePostWithSubcategory(
        (name) => Object.fromEntries(
          Object.entries({ ...updates, subCategory: name }).map(([key, value]) => [
            `posts/${postId}/${key}`, value
          ])
        ),
        pending
      );
    } else {
      await update(dbRef(db, `posts/${postId}`), updates);
    }
  };

  const resolvePost = async (postId: string, status: "resolved" | "returned" = "resolved") => {
    if (!currentProfile.value) {
      throw new Error("You must be logged in.");
    }
    const post = posts.value.find((p) => p.id === postId);
    if (!post) throw new Error("Post not found.");
    if (post.authorId !== currentProfile.value.id) {
      throw new Error("You can only resolve your own posts.");
    }

    await update(dbRef(db, `posts/${postId}`), {
      status,
      updatedAt: Date.now()
    });
  };

  const deletePost = async (postId: string) => {
    if (!currentProfile.value) {
      throw new Error("You must be logged in.");
    }
    const post = posts.value.find((p) => p.id === postId);
    if (!post) throw new Error("Post not found.");
    if (post.authorId !== currentProfile.value.id) {
      throw new Error("You can only delete your own posts.");
    }

    // Remove from posts node
    await remove(dbRef(db, `posts/${postId}`));
    // Also cleanup comments and helpful nodes
    try {
      await remove(dbRef(db, `comments/${postId}`));
      await remove(dbRef(db, `helpful/${postId}`));
    } catch (e) {
      console.warn("Error cleaning up post associations:", e);
    }
  };

  const toggleHelpful = async (postId: string) => {
    if (!currentUser.value) return;
    const uid = currentUser.value.uid;
    const post = posts.value.find((p) => p.id === postId);
    if (!post) return;

    const isMarked = !!myHelpfulMap.value[postId];
    const postRef = dbRef(db, `posts/${postId}`);
    const postHelpfulRef = dbRef(db, `helpful/${postId}/${uid}`);
    const userHelpfulRef = dbRef(db, `userHelpful/${uid}/${postId}`);

    const currentCount = post.helpfulCount || 0;
    const newCount = isMarked ? Math.max(0, currentCount - 1) : currentCount + 1;

    // Optimistic local update
    myHelpfulMap.value = {
      ...myHelpfulMap.value,
      [postId]: !isMarked
    };
    post.helpfulCount = newCount;

    try {
      if (isMarked) {
        await remove(postHelpfulRef);
        await remove(userHelpfulRef);
      } else {
        await set(postHelpfulRef, true);
        await set(userHelpfulRef, true);
      }
      await update(postRef, { helpfulCount: newCount });
    } catch (err) {
      console.error("Error toggling helpful:", err);
      // Revert optimistic update
      myHelpfulMap.value = {
        ...myHelpfulMap.value,
        [postId]: isMarked
      };
      post.helpfulCount = currentCount;
    }
  };

  const isHelpfulByMe = (postId: string) => {
    return !!myHelpfulMap.value[postId];
  };

  const getPostById = async (postId: string): Promise<Post | null> => {
    const existing = posts.value.find((p) => p.id === postId);
    if (existing) return existing;

    try {
      const snap = await get(dbRef(db, `posts/${postId}`));
      if (snap.exists()) {
        const item = snap.val();
        return {
          id: postId,
          authorId: item.authorId || "anonymous",
          authorName: item.authorName || "Community Member",
          authorUsername: item.authorUsername || "member",
          type: (item.type?.toLowerCase() === "found" ? "found" : "lost") as PostType,
          title: item.title || item.itemName || "Untitled Item",
          category: (item.category || "Other") as PostCategory,
          subCategory: item.subCategory || undefined,
          description: item.description || "",
          location: item.location || "Unknown location",
          eventDate: item.eventDate || item.date || new Date().toISOString().split("T")[0],
          imageUrl: item.imageUrl || undefined,
          imagePath: item.imagePath || undefined,
          status: (item.status?.toLowerCase() === "resolved"
            ? "resolved"
            : item.status?.toLowerCase() === "returned"
            ? "returned"
            : "open") as PostStatus,
          helpfulCount: typeof item.helpfulCount === "number" ? item.helpfulCount : 0,
          commentsCount: typeof item.commentsCount === "number" ? item.commentsCount : 0,
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now()
        };
      }
      // Check legacy table
      const legacySnap = await get(dbRef(db, `lost_found/${postId}`));
      if (legacySnap.exists()) {
        const item = legacySnap.val();
        return {
          id: postId,
          authorId: item.authorId || "legacy_user",
          authorName: item.authorName || "Legacy Post",
          authorUsername: item.authorUsername || "community",
          type: (item.type?.toLowerCase() === "found" ? "found" : "lost") as PostType,
          title: item.itemName || "Untitled Item",
          category: item.category || "Other",
          subCategory: item.subCategory || undefined,
          description: item.description || "",
          location: item.location || "Unknown location",
          eventDate: item.date || new Date().toISOString().split("T")[0],
          imageUrl: undefined,
          status: (item.status === "Claimed" ? "resolved" : "open") as PostStatus,
          helpfulCount: 0,
          commentsCount: 0,
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 86400000
        };
      }
      return null;
    } catch (e) {
      console.error("Failed to get post by id:", e);
      return null;
    }
  };

  const getFilteredPosts = (
    filter: PostFilter,
    search: string,
    advanced?: AdvancedFilterOptions
  ) => {
    const q = search.trim().toLowerCase();
    const categoryKey = (value: string) => getCategoryConfig(value)?.key || normalizeCategoryKey(value);
    const categoryKeys = new Set(advanced?.categories?.map(categoryKey));
    const subcategoryKeys = new Set(advanced?.subcategories?.map(normalizeCategoryKey));
    return posts.value.filter((post) => {
      // Filter tab
      const matchesFilter =
        filter === "All" ||
        (filter === "Lost" && post.type === "lost") ||
        (filter === "Found" && post.type === "found") ||
        (filter === "Resolved" && (post.status === "resolved" || post.status === "returned"));

      // Search term
      const matchesSearch =
        !q ||
        [
          post.title,
          post.description,
          post.location,
          post.category,
          post.subCategory,
          post.authorName,
          post.authorUsername
        ].some((text) => (text || "").toLowerCase().includes(q));

      // Advanced Category Filters (Within group: OR)
      const matchesCategories = categoryKeys.size === 0 || categoryKeys.has(categoryKey(post.category));

      // Advanced Subcategory Filters (Within group: OR)
      const matchesSubcategories = subcategoryKeys.size === 0 ||
        Boolean(post.subCategory && subcategoryKeys.has(normalizeCategoryKey(post.subCategory)));

      return matchesFilter && matchesSearch && matchesCategories && matchesSubcategories;
    });
  };

  return {
    posts,
    postsLoading,
    postsError,
    subscribeToPosts,
    createPost,
    updatePost,
    resolvePost,
    deletePost,
    toggleHelpful,
    isHelpfulByMe,
    getPostById,
    getFilteredPosts
  };
}
