import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  useColorScheme,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { FilterButton } from '@/components/filters';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
  hasActiveFilters?: boolean;
  isRAGSearch?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search events...',
  onFilterPress,
  hasActiveFilters = false,
  isRAGSearch = false,
}: SearchBarProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [isFocused, setIsFocused] = useState(false);

  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  // Always animate the sparkle
  useEffect(() => {
    Animated.loop(
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(badgeOpacity, {
      toValue: isRAGSearch ? 1 : 0,
      duration: isRAGSearch ? 200 : 150,
      useNativeDriver: true,
    }).start();
  }, [isRAGSearch]);

  const sparkleScale = sparkleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.15, 0.8],
  });

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0.5, 1, 1, 0.5],
  });

  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[
          styles.searchContainer,
          { backgroundColor: colors.inputBackground },
          isFocused && { borderColor: Magenta[500], borderWidth: 1 },
          isRAGSearch && { borderColor: Magenta[400], borderWidth: 1 },
        ]}>
          <View style={styles.iconWrapper}>
            <Ionicons
              name="search"
              size={20}
              color={isFocused || isRAGSearch ? Magenta[500] : colors.textMuted}
            />
            <Animated.Text
              style={[
                styles.sparkle,
                {
                  opacity: sparkleOpacity,
                  transform: [{ scale: sparkleScale }],
                },
              ]}
            >
              ✦
            </Animated.Text>
          </View>
          <TextInput
            style={[styles.input, { color: colors.text }, webInputStyle]}
            value={value}
            onChangeText={onChangeText}
            placeholder={isRAGSearch ? 'AI-powered search...' : placeholder}
            placeholderTextColor={colors.textMuted}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isRAGSearch && (
            <Animated.View style={[styles.aiBadge, { opacity: badgeOpacity }]}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </Animated.View>
          )}
          {value.length > 0 && (
            <Pressable
              onPress={handleClear}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        {onFilterPress && (
          <FilterButton onPress={onFilterPress} isActive={hasActiveFilters} />
        )}
      </View>
    </View>
  );
}

const webInputStyle = Platform.select({
  web: { outlineStyle: 'none' } as any,
  default: {},
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrapper: {
    marginRight: Spacing.sm,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    top: -3,
    right: -4,
    fontSize: 10,
    color: Magenta[400],
  },
  input: {
    flex: 1,
    fontSize: Typography.sm,
    paddingVertical: Spacing.md,
  },
  aiBadge: {
    backgroundColor: Magenta[500],
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: Spacing.xs,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: Typography.xxs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clearButton: {
    padding: Spacing.xs,
  },
});
