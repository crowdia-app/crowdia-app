/**
 * Data Source Privacy Tiers & Legal Classification
 *
 * Tiers:
 *  1 = Public API        — official API, full data collection permitted
 *  2 = Open Web          — public site, robots.txt allows, no ToS restriction
 *  3 = Restricted Web    — public site with restrictive ToS; basic metadata only
 *  4 = Social Platform   — Instagram/Facebook; public posts only, no user data
 *  5 = Requires Auth     — closed platform; no automated scraping
 *
 * 80% automated (URL/type pattern matching) / 20% human verification model.
 */

export type PrivacyTier = 1 | 2 | 3 | 4 | 5;

export interface TierMetadata {
  name: string;
  description: string;
  color: string;
  bgColor: string;
}

export interface ScrapingRules {
  rate_limit_ms: number;
  retain_days: number | null; // null = retain indefinitely
  allowed_fields: string[];
  requires_auth: boolean;
  human_review: boolean;
  store_user_data?: boolean;
  automated?: boolean;
}

export const TIER_METADATA: Record<PrivacyTier, TierMetadata> = {
  1: {
    name: 'Public API',
    description: 'Official API with explicit ToS permitting data collection',
    color: '#166534',
    bgColor: '#dcfce7',
  },
  2: {
    name: 'Open Web',
    description: 'Public website, robots.txt allows, no ToS restriction on scraping',
    color: '#1d4ed8',
    bgColor: '#dbeafe',
  },
  3: {
    name: 'Restricted Web',
    description: 'Public website with restrictive ToS; collect basic event metadata only',
    color: '#b45309',
    bgColor: '#fef3c7',
  },
  4: {
    name: 'Social Platform',
    description: 'Meta/social platform; public posts only, no user data stored',
    color: '#9333ea',
    bgColor: '#f3e8ff',
  },
  5: {
    name: 'Requires Auth',
    description: 'Closed platform requiring partnership or auth; no automated scraping',
    color: '#b91c1c',
    bgColor: '#fee2e2',
  },
};

export const TIER_SCRAPING_RULES: Record<PrivacyTier, ScrapingRules> = {
  1: {
    rate_limit_ms: 500,
    retain_days: null,
    allowed_fields: ['all'],
    requires_auth: false,
    human_review: false,
  },
  2: {
    rate_limit_ms: 2000,
    retain_days: 90,
    allowed_fields: ['title', 'date', 'venue', 'description', 'url', 'image'],
    requires_auth: false,
    human_review: false,
  },
  3: {
    rate_limit_ms: 5000,
    retain_days: 30,
    allowed_fields: ['title', 'date', 'venue', 'ticket_url'],
    requires_auth: false,
    human_review: false,
  },
  4: {
    rate_limit_ms: 10000,
    retain_days: 14,
    allowed_fields: ['title', 'date', 'venue'],
    requires_auth: false,
    human_review: true,
    store_user_data: false,
  },
  5: {
    rate_limit_ms: 0,
    retain_days: 0,
    allowed_fields: [],
    requires_auth: true,
    human_review: true,
    automated: false,
  },
};

// Known platform classifications — automated (80% of sources)
const TIER1_PATTERNS: RegExp[] = [
  /ra\.co/i,
  /eventbrite\.(com|it)/i,
];

const TIER2_PATTERNS: RegExp[] = [
  /palermotoday\.it/i,
  /palermoviva\.it/i,
  /balarm\.it/i,
  /teatro\.it/i,
  /terradamare\.org/i,
  /itinerarinellarte\.it/i,
];

const TIER3_PATTERNS: RegExp[] = [
  /feverup\.com/i,
  /ticketone\.it/i,
  /ticketsms\.it/i,
  /dice\.fm/i,
  /xceed\.me/i,
  /songkick\.com/i,
  /bandsintown\.com/i,
];

const TIER4_PATTERNS: RegExp[] = [
  /instagram\.com/i,
  /facebook\.com/i,
];

const TIER5_PATTERNS: RegExp[] = [
  // Platforms requiring login to view event details
];

/**
 * Automatically classify a source URL into a privacy tier.
 * Returns null when the URL does not match any known pattern
 * and requires human review (the 20% manual verification case).
 */
export function classifySourceTier(url: string, type?: string): PrivacyTier | null {
  // Type-based shortcuts
  if (type === 'instagram') return 4;
  if (type === 'facebook') return 4;
  if (type === 'ra') return 1;

  for (const p of TIER1_PATTERNS) if (p.test(url)) return 1;
  for (const p of TIER2_PATTERNS) if (p.test(url)) return 2;
  for (const p of TIER3_PATTERNS) if (p.test(url)) return 3;
  for (const p of TIER4_PATTERNS) if (p.test(url)) return 4;
  for (const p of TIER5_PATTERNS) if (p.test(url)) return 5;

  // Unknown source — queue for human review (20% case)
  return null;
}

/**
 * Returns whether a source is cleared for automated scraping.
 */
export function isAutomatedScrapingAllowed(tier: PrivacyTier): boolean {
  return tier <= 4 && TIER_SCRAPING_RULES[tier].automated !== false;
}

/**
 * Returns the rate limit in ms for a given tier.
 */
export function getRateLimit(tier: PrivacyTier): number {
  return TIER_SCRAPING_RULES[tier].rate_limit_ms;
}

/**
 * Returns the allowed fields for a tier.
 * An ['all'] value means all fields are permitted.
 */
export function getAllowedFields(tier: PrivacyTier): string[] {
  return TIER_SCRAPING_RULES[tier].allowed_fields;
}

/**
 * Returns the data retention limit in days (null = retain indefinitely).
 */
export function getRetentionDays(tier: PrivacyTier): number | null {
  return TIER_SCRAPING_RULES[tier].retain_days;
}
