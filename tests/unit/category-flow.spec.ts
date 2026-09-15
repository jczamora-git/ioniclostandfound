import { mount, type VueWrapper } from '@vue/test-utils';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeCategoryKey } from '../../src/config/categories';
import { useCategories } from '../../src/composables/useCategories';
import { usePosts } from '../../src/composables/usePosts';
import type { Post, PostFormData } from '../../src/types/post';

type Snapshot = { exists: () => boolean; val: () => unknown };

const firebase = vi.hoisted(() => {
  const records = new Map<string, unknown>();
  const listeners = new Map<string, (snapshot: Snapshot) => void>();
  const snapshot = (value: unknown): Snapshot => ({
    exists: () => value !== null && value !== undefined,
    val: () => value,
  });

  return {
    records,
    listeners,
    snapshot,
    ref: vi.fn((_database: unknown, path: string) => ({ path })),
    onValue: vi.fn((reference: { path: string }, callback: (value: Snapshot) => void) => {
      listeners.set(reference.path, callback);
      callback(snapshot(records.get(reference.path)));
      return () => listeners.delete(reference.path);
    }),
    get: vi.fn(async (reference: { path: string }) => snapshot(records.get(reference.path))),
    set: vi.fn(async (_reference: unknown, _value: unknown) => undefined),
    push: vi.fn(() => ({ path: 'posts/new-post', key: 'new-post' })),
    update: vi.fn(async (_reference: unknown, _value: unknown) => undefined),
    remove: vi.fn(async () => undefined),
    runTransaction: vi.fn(async (
      reference: { path: string },
      update: (current: unknown) => unknown,
    ) => {
      const value = update(records.get(reference.path) ?? null);
      if (value !== undefined) records.set(reference.path, value);
      return { committed: value !== undefined, snapshot: snapshot(records.get(reference.path)) };
    }),
  };
});

vi.mock('firebase/database', () => firebase);
vi.mock('../../src/firebase', () => ({ db: {} }));
vi.mock('../../src/composables/useAuth', () => ({
  useAuth: () => ({
    currentProfile: { value: { id: 'member-id', name: 'Member', username: 'member' } },
    currentUser: { value: null },
  }),
}));

function post(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    authorId: 'member-id',
    authorName: 'Member',
    authorUsername: 'member',
    type: 'lost',
    title: 'Black item',
    category: 'Gadgets',
    subCategory: 'Phone',
    description: 'Left behind',
    location: 'Library',
    eventDate: '2026-09-15',
    status: 'open',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  firebase.records.clear();
});

describe('category normalization', () => {
  it.each(['Back Pack', 'backpack', 'BACK-PACK', 'back_pack', ' BackPack '])(
    'normalizes %j to the same exact key',
    (value) => expect(normalizeCategoryKey(value)).toBe('backpack'),
  );

  it.each(['Báck Päck', 'Ba\u0301ck Pa\u0308ck', 'ＢＡＣＫＰＡＣＫ'])('normalizes Unicode form %j', (value) => {
    expect(normalizeCategoryKey(value)).toBe('backpack');
  });

  it('preserves non-Latin letters and keeps unrelated names distinct', () => {
    expect(normalizeCategoryKey(' 手机 ')).toBe('手机');
    expect(normalizeCategoryKey('Phone')).toBe('phone');
    expect(normalizeCategoryKey('Phone Case')).toBe('phonecase');
    expect(normalizeCategoryKey(null)).toBe('');
    expect(normalizeCategoryKey(' --_! ')).toBe('');
  });
});

describe('combined feed filtering', () => {
  const feed = usePosts();

  beforeEach(() => {
    feed.posts.value = [
      post('phone'),
      post('backpack', { category: ' BAGS ', subCategory: 'BACK-PACK' }),
      post('wrong-search', { title: 'White item' }),
      post('wrong-type', { type: 'found' }),
      post('wrong-category', { category: 'Other' }),
      post('wrong-subcategory', { subCategory: 'Phone Case' }),
      post('legacy', { category: 'gadgets', subCategory: undefined }),
      post('resolved', { status: 'resolved' }),
      post('returned', { type: 'found', status: 'returned' }),
    ];
  });

  it('combines search, quick filter, category OR, and subcategory OR using AND', () => {
    const result = feed.getFilteredPosts('Lost', ' BLACK ', {
      categories: ['gadgets', 'bags'],
      subcategories: ['phone', 'Back Pack'],
    });

    expect(result.map((item) => item.id)).toEqual(['phone', 'backpack', 'resolved']);
  });

  it('preserves legacy posts without a subcategory until a subcategory is required', () => {
    expect(feed.getFilteredPosts('All', '', { categories: ['GADGETS'] }).map((item) => item.id))
      .toContain('legacy');
    expect(feed.getFilteredPosts('All', '', { subcategories: ['Phone'] }).map((item) => item.id))
      .not.toContain('legacy');
  });

  it('matches returned and resolved statuses while preserving advanced filters', () => {
    expect(feed.getFilteredPosts('Resolved', 'library', {
      categories: ['gadgets'],
      subcategories: ['PHONE'],
    }).map((item) => item.id)).toEqual(['resolved', 'returned']);
  });

  it('treats empty selections as unrestricted and searches subcategory text', () => {
    expect(feed.getFilteredPosts('All', '', { categories: [], subcategories: [] })).toHaveLength(9);
    expect(feed.getFilteredPosts('All', 'phone case').map((item) => item.id)).toEqual(['wrong-subcategory']);
  });

  it('matches canonical category keys to legacy display names without changing the stored post', () => {
    feed.posts.value = [post('wallet', { category: 'Wallets & Cards', subCategory: 'Coin Purse' })];
    expect(feed.getFilteredPosts('All', '', {
      categories: ['walletsandcards'],
      subcategories: ['COIN_PURSE'],
    }).map((item) => item.id)).toEqual(['wallet']);
    expect(feed.posts.value[0].category).toBe('Wallets & Cards');
    expect(firebase.update).not.toHaveBeenCalled();
    expect(firebase.set).not.toHaveBeenCalled();
  });
});

describe('custom subcategory registration and merging', () => {
  let categories: ReturnType<typeof useCategories>;
  let wrapper: VueWrapper;

  beforeAll(() => {
    wrapper = mount({
      setup() {
        categories = useCategories();
        return () => null;
      },
    });
  });

  beforeEach(() => {
    categories.customSubcategoriesByCat.value = {};
  });

  afterAll(() => wrapper.unmount());

  it.each(['Back Pack', 'backpack', 'BACK-PACK', 'back_pack', ' BackPack '])(
    'reuses the default subcategory for %j without a Firebase write',
    async (value) => {
      await expect(categories.registerCustomSubcategory('Bags', value)).resolves.toBe('Backpack');
      expect(firebase.get).not.toHaveBeenCalled();
      expect(firebase.runTransaction).not.toHaveBeenCalled();
      expect(firebase.set).not.toHaveBeenCalled();
    },
  );

  it('saves a normalized child under the canonical parent and reuses it on subsequent requests', async () => {
    await expect(categories.registerCustomSubcategory('Wallets & Cards', ' Travel Pass '))
      .resolves.toBe('Travel Pass');
    expect(firebase.records.get('subcategories/walletsandcards/travelpass')).toMatchObject({
      name: 'Travel Pass',
      normalizedKey: 'travelpass',
    });
    await expect(categories.registerCustomSubcategory('walletsandcards', 'TRAVEL-PASS'))
      .resolves.toBe('Travel Pass');
    expect(firebase.runTransaction).toHaveBeenCalledTimes(1);
    expect(categories.getSubcategoriesForCategory('Wallets & Cards')).toContain('Travel Pass');
  });

  it('reuses an existing normalized Firebase entry without writing', async () => {
    firebase.records.set('subcategories/gadgets/gaminghandheld', {
      name: 'Gaming Handheld', normalizedKey: 'gaminghandheld',
    });
    await expect(categories.registerCustomSubcategory('GADGETS', 'gaming_handheld'))
      .resolves.toBe('Gaming Handheld');
    expect(firebase.runTransaction).not.toHaveBeenCalled();
    expect(firebase.set).not.toHaveBeenCalled();
  });

  it('preserves an entry created concurrently before its transaction commits', async () => {
    firebase.get.mockImplementationOnce(async (reference: { path: string }) => {
      firebase.records.set(reference.path, { name: 'Gaming Handheld', normalizedKey: 'gaminghandheld' });
      return firebase.snapshot(null);
    });
    await expect(categories.registerCustomSubcategory('Gadgets', 'GAMING-HANDHELD'))
      .resolves.toBe('Gaming Handheld');
    expect(firebase.records.get('subcategories/gadgets/gaminghandheld')).toMatchObject({
      name: 'Gaming Handheld',
    });
  });

  it('merges defaults and Firebase names by normalized key under the correct parent', () => {
    firebase.listeners.get('subcategories')!(firebase.snapshot({
      Bags: {
        'BACK-PACK': { name: 'Back Pack', normalizedKey: 'backpack' },
        camerabag: { name: 'Camera Bag', normalizedKey: 'camerabag' },
        'CAMERA-BAG': { name: 'CAMERA_BAG', normalizedKey: 'camerabag' },
      },
      walletsandcards: {
        travelpass: { name: 'Travel Pass', normalizedKey: 'travelpass' },
      },
    }));
    const bags = categories.getSubcategoriesForCategory('bags');
    expect(bags).toContain('Backpack');
    expect(bags.filter((name) => normalizeCategoryKey(name) === 'backpack')).toHaveLength(1);
    expect(bags.filter((name) => normalizeCategoryKey(name) === 'camerabag')).toHaveLength(1);
    expect(bags).not.toContain('Travel Pass');
    expect(categories.getSubcategoriesForCategory('Wallets & Cards')).toContain('Travel Pass');
  });

  it.each([
    ['', 'Gaming Handheld'],
    ['Unknown Category', 'Gaming Handheld'],
    ['Gadgets', ' --_! '],
    ['Gadgets', '  '],
  ])('rejects invalid category/subcategory input (%j, %j)', async (category, subcategory) => {
    await expect(categories.registerCustomSubcategory(category, subcategory)).rejects.toThrow();
    expect(firebase.runTransaction).not.toHaveBeenCalled();
  });

  it('reports a Firebase read failure and does not add an unsaved option', async () => {
    firebase.get.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(categories.registerCustomSubcategory('Gadgets', 'Gaming Handheld')).rejects.toThrow();
    expect(categories.getSubcategoriesForCategory('Gadgets')).not.toContain('Gaming Handheld');
    expect(firebase.runTransaction).not.toHaveBeenCalled();
  });

  it('reports a Firebase transaction failure and does not cache an unsaved option', async () => {
    firebase.runTransaction.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(categories.registerCustomSubcategory('Gadgets', 'Gaming Handheld')).rejects.toThrow();
    expect(categories.getSubcategoriesForCategory('Gadgets')).not.toContain('Gaming Handheld');
  });
});

describe('post persistence', () => {
  const feed = usePosts();
  const form: PostFormData = {
    type: 'lost', title: 'Black phone', category: 'Gadgets', description: 'At the library',
    location: 'Library', eventDate: '2026-09-15',
  };

  it('omits absent optional fields from the Firebase creation payload', async () => {
    await expect(feed.createPost(form)).resolves.toBe('new-post');
    const payload = firebase.set.mock.calls[0][1];
    expect(payload).not.toHaveProperty('subCategory');
    expect(payload).not.toHaveProperty('imageUrl');
  });

  it('persists a chosen subcategory with the post', async () => {
    await feed.createPost({ ...form, subCategory: 'Gaming Handheld' });
    expect(firebase.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      category: 'Gadgets', subCategory: 'Gaming Handheld',
    }));
  });

  it('loads an owned post for direct editing and clears its previous subcategory', async () => {
    feed.posts.value = [];
    firebase.records.set('posts/direct-edit', post('direct-edit'));
    await feed.updatePost('direct-edit', { category: 'Bags', subCategory: '' });
    expect(firebase.update).toHaveBeenCalledWith({ path: 'posts/direct-edit' }, expect.objectContaining({
      category: 'Bags', subCategory: null,
    }));
  });
});
