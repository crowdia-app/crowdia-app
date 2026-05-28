import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LUMIO_PURPLE = '#7C3AED';
const FAB_SIZE = 56;
const TAB_BAR_HEIGHT = 49;

interface AskLumioFabProps {
  onPress: () => void;
}

export function AskLumioFab({ onPress }: AskLumioFabProps) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        { bottom: TAB_BAR_HEIGHT + insets.bottom + 16 },
        pressed && styles.fabPressed,
      ]}
      onPress={onPress}
      accessibilityLabel="Chiedimi qualcosa — Lumio AI"
      accessibilityRole="button"
    >
      <Ionicons name="bulb-outline" size={26} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: LUMIO_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: LUMIO_PURPLE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
