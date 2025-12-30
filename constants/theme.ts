/**
 * Crowdia Design System
 * Based on the Crowdia landing page theme - bold, modern dark theme with vibrant magenta accents
 */

import { Platform } from 'react-native';

// Brand Colors - Magenta palette
export const Magenta = {
  50: '#FFE5F0',
  100: '#FFB8D9',
  200: '#FF8ABF',
  300: '#FF5CA6',
  400: '#FF2E8C',
  500: '#FF007F', // Primary brand color
  600: '#CC0066',
  700: '#99004D',
  800: '#660033',
  900: '#33001A',
};

// Neutral Colors - Charcoal palette
export const Charcoal = {
  50: '#B8B8B8',
  100: '#A8A8A8',
  200: '#888888',
  300: '#686868',
  400: '#484848',
  500: '#2E2E2E',
  600: '#1E1E1E',
  700: '#141414',
  800: '#0A0A0A',
  900: '#000000',
};

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    textMuted: '#9BA1A6',
    background: '#FFFFFF',
    backgroundSecondary: '#F8F8F8',
    card: '#FFFFFF',
    cardBorder: '#E8E8E8',
    tint: Magenta[500],
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: Magenta[500],
    primary: Magenta[500],
    primaryLight: Magenta[100],
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FF9500',
    divider: '#E8E8E8',
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    textMuted: '#686868',
    background: Charcoal[900],
    backgroundSecondary: Charcoal[800],
    card: Charcoal[700],
    cardBorder: Charcoal[500],
    tint: Magenta[500],
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Magenta[500],
    primary: Magenta[500],
    primaryLight: Magenta[800],
    success: '#30D158',
    error: '#FF453A',
    warning: '#FF9F0A',
    divider: Charcoal[600],
    inputBackground: Charcoal[700],
    inputBorder: Charcoal[500],
  },
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radius scale
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Typography sizes
export const Typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
