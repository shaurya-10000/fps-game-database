export interface TierRules {
  tier: string;
  minRating: number;
  divisionless?: boolean;
}

const DEFAULT_TIERS: TierRules[] = [
  { tier: "Bronze", minRating: 0 },
  { tier: "Silver", minRating: 1200 },
  { tier: "Gold", minRating: 1500 },
  { tier: "Platinum", minRating: 1800 },
  { tier: "Diamond", minRating: 2100 },
  { tier: "Master", minRating: 2400 },
  { tier: "Legendary", minRating: 2800, divisionless: true },
];

export interface TierResult {
  tier: string;
  division: number;
}

export function deriveTier(rating: number, rules: TierRules[] = DEFAULT_TIERS): TierResult {
  // Sort descending to find the highest tier the player qualifies for
  const sorted = [...rules].sort((a, b) => b.minRating - a.minRating);

  for (const rule of sorted) {
    if (rating >= rule.minRating) {
      if (rule.divisionless) {
        return { tier: rule.tier, division: 1 };
      }
      const division = 3 - Math.min(2, Math.floor((rating - rule.minRating) / 100));
      return { tier: rule.tier, division: Math.max(1, division) };
    }
  }

  return { tier: "Bronze", division: 3 };
}
