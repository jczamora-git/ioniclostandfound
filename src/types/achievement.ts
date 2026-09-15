export interface Achievement {
  id: string;
  type: 'community_merit';
  postId: string;
  recipientId: string;
  awardedBy: string;
  createdAt: number;
}

export type MeritTierId = 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface MeritTier {
  id: MeritTierId;
  name: string;
  minMerits: number;
  iconName: 'Medal' | 'Award' | 'BadgeCheck' | 'Trophy';
  description: string;
}

export const MERIT_TIERS: MeritTier[] = [
  {
    id: 'tier1',
    name: 'Community Helper',
    minMerits: 1,
    iconName: 'Medal',
    description: 'Awarded for successfully helping recover or return a lost item'
  },
  {
    id: 'tier2',
    name: 'Good Samaritan',
    minMerits: 3,
    iconName: 'Award',
    description: 'Recognized for 3 or more community recoveries'
  },
  {
    id: 'tier3',
    name: 'Trusted Finder',
    minMerits: 5,
    iconName: 'BadgeCheck',
    description: 'Trusted community member with 5 or more verified returns'
  },
  {
    id: 'tier4',
    name: 'Community Hero',
    minMerits: 10,
    iconName: 'Trophy',
    description: 'Outstanding community champion with 10 or more verified returns'
  }
];

export interface UserBadgeInfo {
  tier: MeritTier;
  unlocked: boolean;
  isHighest: boolean;
}
