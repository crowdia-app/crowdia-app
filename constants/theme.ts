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

// Status Colors
export const Green = {
  50: '#E6F7ED',
  100: '#B8E6C9',
  200: '#8AD5A5',
  300: '#5CC481',
  400: '#2EB35D',
  500: '#00A239',
  600: '#00822E',
  700: '#006123',
  800: '#004118',
  900: '#00200C',
};

export const Red = {
  50: '#FFE5E5',
  100: '#FFB8B8',
  200: '#FF8A8A',
  300: '#FF5C5C',
  400: '#FF2E2E',
  500: '#FF0000',
  600: '#CC0000',
  700: '#990000',
  800: '#660000',
  900: '#330000',
};

export const Yellow = {
  50: '#FFF9E5',
  100: '#FFECB8',
  200: '#FFDF8A',
  300: '#FFD25C',
  400: '#FFC52E',
  500: '#FFB800',
  600: '#CC9300',
  700: '#996E00',
  800: '#664A00',
  900: '#332500',
};

export const Blue = {
  50: '#E5F3FF',
  100: '#B8DEFF',
  200: '#8AC9FF',
  300: '#5CB4FF',
  400: '#2E9FFF',
  500: '#008AFF',
  600: '#006ECC',
  700: '#005399',
  800: '#003766',
  900: '#001C33',
};

export const Colors = {
  magenta: Magenta,
  charcoal: Charcoal,
  green: Green,
  red: Red,
  yellow: Yellow,
  blue: Blue,
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    textMuted: '#9BA1A6',
    subtext: '#687076',
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
    subtext: '#9BA1A6',
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
  xxs: 2,
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
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Typography sizes
export const Typography = {
  xxs: 10,
  xs: 12,
  sm: 14,
  md: 16,
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
