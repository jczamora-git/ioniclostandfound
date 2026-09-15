import { enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FilterSheetModal from '../../src/components/FilterSheetModal.vue';
import type { PostFilter } from '../../src/types/post';

vi.mock('@ionic/vue', () => ({
  IonModal: {
    name: 'IonModal',
    props: ['isOpen'],
    emits: ['didDismiss'],
    template: '<div><slot /></div>',
  },
}));

vi.mock('../../src/composables/useCategories', () => {
  const mainCategories = [
    { name: 'Gadgets', key: 'gadgets', subcategories: ['Phone', 'Tablet', 'Carry Case'] },
    { name: 'Bags', key: 'bags', subcategories: ['Backpack', 'carry-case'] },
    { name: 'Clothing', key: 'clothing', subcategories: ['Shirt'] },
  ];

  return {
    useCategories: () => ({
      mainCategories,
      getSubcategoriesForCategory: (name: string) => mainCategories.find(
        (category) => category.name.toLowerCase() === name.toLowerCase(),
      )?.subcategories ?? [],
    }),
  };
});

enableAutoUnmount(afterEach);

type SheetProps = {
  isOpen: boolean;
  activeType: PostFilter;
  selectedCategories: string[];
  selectedSubcategories: string[];
};

function mountSheet(props: Partial<SheetProps> = {}) {
  return mount(FilterSheetModal, {
    props: {
      isOpen: true,
      activeType: 'All',
      selectedCategories: [],
      selectedSubcategories: [],
      ...props,
    },
  });
}

function choices(wrapper: VueWrapper, group: 'post-type' | 'category' | 'subcategory') {
  return wrapper.get(`section[aria-labelledby="${group}-filter-label"]`).findAll('button');
}

function choice(wrapper: VueWrapper, group: 'post-type' | 'category' | 'subcategory', label: string) {
  const button = choices(wrapper, group).find((item) => item.text() === label);
  if (!button) throw new Error(`Missing ${group} choice: ${label}`);
  return button;
}

describe('FilterSheetModal selections', () => {
  it('shows the union of selected categories and applies multiple subcategories with the type', async () => {
    const wrapper = mountSheet();
    expect(choices(wrapper, 'subcategory')).toHaveLength(0);

    await choice(wrapper, 'category', 'Gadgets').trigger('click');
    expect(choices(wrapper, 'subcategory').map((button) => button.text())).toEqual([
      'Phone', 'Tablet', 'Carry Case',
    ]);

    await choice(wrapper, 'category', 'Bags').trigger('click');
    expect(choices(wrapper, 'subcategory').map((button) => button.text())).toEqual([
      'Phone', 'Tablet', 'Carry Case', 'Backpack',
    ]);
    await choice(wrapper, 'subcategory', 'Phone').trigger('click');
    await choice(wrapper, 'subcategory', 'Backpack').trigger('click');
    await choice(wrapper, 'post-type', 'Lost').trigger('click');

    expect(choice(wrapper, 'category', 'Gadgets').attributes('aria-pressed')).toBe('true');
    expect(choice(wrapper, 'category', 'Bags').attributes('aria-pressed')).toBe('true');
    expect(choice(wrapper, 'subcategory', 'Phone').attributes('aria-pressed')).toBe('true');
    expect(choice(wrapper, 'subcategory', 'Backpack').attributes('aria-pressed')).toBe('true');
    expect(wrapper.emitted('apply')).toBeUndefined();

    await wrapper.get('.apply-filters-btn').trigger('click');
    expect(wrapper.emitted('apply')).toEqual([[{
      type: 'Lost',
      categories: ['Gadgets', 'Bags'],
      subcategories: ['Phone', 'Backpack'],
    }]]);
  });

  it('removes only invalid subcategories when a parent is deselected and keeps a shared normalized selection', async () => {
    const wrapper = mountSheet({
      selectedCategories: ['Gadgets', 'Bags'],
      selectedSubcategories: ['PHONE', 'back_pack', 'Carry Case'],
    });

    await choice(wrapper, 'category', 'Gadgets').trigger('click');
    expect(choices(wrapper, 'subcategory').map((button) => button.text())).toEqual([
      'Backpack', 'carry-case',
    ]);
    expect(choice(wrapper, 'subcategory', 'Backpack').attributes('aria-pressed')).toBe('true');
    expect(choice(wrapper, 'subcategory', 'carry-case').attributes('aria-pressed')).toBe('true');

    await wrapper.get('.apply-filters-btn').trigger('click');
    expect(wrapper.emitted('apply')?.[0]).toEqual([{
      type: 'All',
      categories: ['Bags'],
      subcategories: ['back_pack', 'Carry Case'],
    }]);

    await choice(wrapper, 'category', 'Bags').trigger('click');
    expect(choices(wrapper, 'subcategory')).toHaveLength(0);
    await wrapper.get('.apply-filters-btn').trigger('click');
    expect(wrapper.emitted('apply')?.[1]).toEqual([{
      type: 'All', categories: [], subcategories: [],
    }]);
  });

  it('allows individual subcategories to be deselected without removing their category', async () => {
    const wrapper = mountSheet({
      selectedCategories: ['Gadgets'],
      selectedSubcategories: ['Phone', 'Tablet'],
    });

    await choice(wrapper, 'subcategory', 'Phone').trigger('click');
    await wrapper.get('.apply-filters-btn').trigger('click');
    expect(wrapper.emitted('apply')?.[0]).toEqual([{
      type: 'All', categories: ['Gadgets'], subcategories: ['Tablet'],
    }]);
  });
});

describe('FilterSheetModal drafts', () => {
  it('clears only the draft and emits cleared filters when Apply is pressed', async () => {
    const applied: SheetProps = {
      isOpen: true,
      activeType: 'Resolved',
      selectedCategories: ['Gadgets'],
      selectedSubcategories: ['Phone'],
    };
    const wrapper = mountSheet(applied);

    await wrapper.get('.clear-all-btn').trigger('click');
    expect(choice(wrapper, 'post-type', 'All').attributes('aria-pressed')).toBe('true');
    expect(choices(wrapper, 'subcategory')).toHaveLength(0);
    expect(wrapper.get('.clear-all-btn').attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('apply')).toBeUndefined();
    expect(wrapper.props('activeType')).toBe('Resolved');
    expect(applied.selectedCategories).toEqual(['Gadgets']);
    expect(applied.selectedSubcategories).toEqual(['Phone']);

    await wrapper.get('.apply-filters-btn').trigger('click');
    expect(wrapper.emitted('apply')).toEqual([[{
      type: 'All', categories: [], subcategories: [],
    }]]);
  });

  it('discards unapplied edits after closing and reloads current applied filters on reopening', async () => {
    const wrapper = mountSheet({
      activeType: 'Found',
      selectedCategories: ['Gadgets'],
      selectedSubcategories: ['Phone'],
    });

    await wrapper.get('.clear-all-btn').trigger('click');
    await choice(wrapper, 'category', 'Bags').trigger('click');
    await choice(wrapper, 'subcategory', 'Backpack').trigger('click');
    await wrapper.get('.close-sheet-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('apply')).toBeUndefined();

    await wrapper.setProps({ isOpen: false });
    await wrapper.setProps({ isOpen: true });
    expect(choice(wrapper, 'post-type', 'Found').attributes('aria-pressed')).toBe('true');
    expect(choice(wrapper, 'category', 'Gadgets').attributes('aria-pressed')).toBe('true');
    expect(choice(wrapper, 'category', 'Bags').attributes('aria-pressed')).toBe('false');
    expect(choice(wrapper, 'subcategory', 'Phone').attributes('aria-pressed')).toBe('true');

    await wrapper.setProps({ isOpen: false });
    await wrapper.setProps({ activeType: 'Resolved', selectedCategories: ['Bags'], selectedSubcategories: ['Backpack'] });
    await wrapper.setProps({ isOpen: true });
    await wrapper.get('.apply-filters-btn').trigger('click');
    expect(wrapper.emitted('apply')).toEqual([[{
      type: 'Resolved', categories: ['Bags'], subcategories: ['Backpack'],
    }]]);
  });

  it('treats Ionic swipe or backdrop dismissal as closing without applying the draft', async () => {
    const wrapper = mountSheet();
    await choice(wrapper, 'category', 'Gadgets').trigger('click');
    wrapper.getComponent({ name: 'IonModal' }).vm.$emit('didDismiss');

    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('apply')).toBeUndefined();
  });
});
