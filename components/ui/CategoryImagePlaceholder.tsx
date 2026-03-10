import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryPlaceholder } from '@/utils/categoryPlaceholder';

interface CategoryImagePlaceholderProps {
  categorySlug?: string | null;
  style?: ViewStyle;
  iconSize?: number;
}

export function CategoryImagePlaceholder({
  categorySlug,
  style,
  iconSize = 40,
}: CategoryImagePlaceholderProps) {
  const { colors, icon } = getCategoryPlaceholder(categorySlug);

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      <Ionicons name={icon} size={iconSize} color="rgba(255,255,255,0.6)" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
