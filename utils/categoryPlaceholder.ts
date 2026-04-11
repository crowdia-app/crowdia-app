import { Ionicons } from '@expo/vector-icons';

interface CategoryPlaceholder {
  colors: [string, string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORY_PLACEHOLDERS: Record<string, CategoryPlaceholder> = {
  'nightlife':   { colors: ['#150030', '#8b0050', '#ff1090'], icon: 'disc' },
  'concert':     { colors: ['#1a003a', '#5200a3', '#8000ff'], icon: 'musical-notes' },
  'music':       { colors: ['#1a003a', '#5200a3', '#8000ff'], icon: 'musical-notes' },
  'party':       { colors: ['#33001a', '#800033', '#cc0044'], icon: 'sparkles' },
  'theater':     { colors: ['#001a33', '#003d7a', '#005eb8'], icon: 'ticket' },
  'comedy':      { colors: ['#2d1800', '#7a4200', '#c46a00'], icon: 'happy' },
  'art':         { colors: ['#003333', '#006666', '#009999'], icon: 'color-palette' },
  'art-culture': { colors: ['#003333', '#006666', '#009999'], icon: 'color-palette' },
  'food-wine':   { colors: ['#2d0a00', '#6b1900', '#a82800'], icon: 'wine' },
  'food-drink':  { colors: ['#2d0a00', '#6b1900', '#a82800'], icon: 'restaurant' },
  'tour':        { colors: ['#002211', '#005530', '#008a4d'], icon: 'walk' },
  'festival':    { colors: ['#2d1000', '#7a2d00', '#c44d00'], icon: 'bonfire' },
  'workshop':    { colors: ['#111a2e', '#1e2d52', '#2d4480'], icon: 'construct' },
  'cultural':    { colors: ['#1a0040', '#3d0099', '#6600ff'], icon: 'library' },
  'sports':      { colors: ['#001a00', '#004400', '#007700'], icon: 'football' },
  'sports-fitness': { colors: ['#001a00', '#004400', '#007700'], icon: 'fitness' },
  'family':      { colors: ['#2d1800', '#6b3d00', '#a86200'], icon: 'people' },
  'networking':  { colors: ['#001429', '#003366', '#0052a3'], icon: 'chatbubbles' },
  'education':   { colors: ['#0d1a33', '#1e3d7a', '#2d5eb8'], icon: 'school' },
  'community':   { colors: ['#1a1100', '#3d2900', '#6b4800'], icon: 'heart-circle' },
  'film':        { colors: ['#0a0a0a', '#1a1a1a', '#2e2e2e'], icon: 'film' },
  'other':       { colors: ['#99004D', '#CC0066', '#FF007F'], icon: 'calendar' },
};

const DEFAULT_PLACEHOLDER: CategoryPlaceholder = {
  colors: ['#99004D', '#CC0066', '#FF007F'],
  icon: 'calendar',
};

export function getCategoryPlaceholder(slug: string | null | undefined): CategoryPlaceholder {
  if (!slug) return DEFAULT_PLACEHOLDER;
  return CATEGORY_PLACEHOLDERS[slug.toLowerCase()] ?? DEFAULT_PLACEHOLDER;
}
