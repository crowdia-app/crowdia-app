import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const CrowdiaLogo = require('@/assets/images/crowdia-logo-icon-transparent.png');

interface GlowingLogoProps {
  size?: number;
  animated?: boolean;
}

// Blur style for web
const blurStyle = Platform.select({
  web: { filter: 'blur(8px)' },
  default: {},
}) as any;

const blurStyleSmall = Platform.select({
  web: { filter: 'blur(4px)' },
  default: {},
}) as any;

export function GlowingLogo({ size = 32, animated = true }: GlowingLogoProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [animated]);

  const glowStyle = useAnimatedStyle(() => {
    if (!animated) return {};
    const scale = interpolate(pulse.value, [0, 1], [0.9, 1.1]);
    const opacity = interpolate(pulse.value, [0, 1], [0.3, 0.6]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      {/* Animated glow layer */}
      {animated && (
        <Animated.View
          style={[
            styles.glowLayer,
            blurStyle,
            {
              width: size * 1.2,
              height: size * 1.2,
              borderRadius: size,
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
            },
            glowStyle,
          ]}
        />
      )}
      {/* Static glow layers */}
      <View
        style={[
          styles.glowLayer,
          blurStyleSmall,
          {
            width: size * 1.1,
            height: size * 1.1,
            borderRadius: size,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      />
      {/* Logo */}
      <Image
        source={CrowdiaLogo}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </View>
  );
}

// Static logo with white glow (no animation) for placeholders
export function StaticGlowLogo({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.container, { width: size * 1.8, height: size * 1.8 }]}>
      {/* Blurred glow layers */}
      <View
        style={[
          styles.glowLayer,
          blurStyle,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size,
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
          },
        ]}
      />
      <View
        style={[
          styles.glowLayer,
          blurStyleSmall,
          {
            width: size * 1.2,
            height: size * 1.2,
            borderRadius: size,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        ]}
      />
      {/* Logo */}
      <Image
        source={CrowdiaLogo}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowLayer: {
    position: 'absolute',
  },
});
