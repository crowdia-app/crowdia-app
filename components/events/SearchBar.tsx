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
  placeholder = 'AI Search...',
  onFilterPress,
  hasActiveFilters = false,
  isRAGSearch = false,
}: SearchBarProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [isFocused, setIsFocused] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  // Gentle continuous pulse on the sparkles icon
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(badgeOpacity, {
      toValue: isRAGSearch ? 1 : 0,
      duration: isRAGSearch ? 200 : 150,
      useNativeDriver: true,
    }).start();
  }, [isRAGSearch]);

  const iconScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const iconOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
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
          (isFocused || isRAGSearch) && styles.activeContainer,
        ]}>
          <Animated.View style={{
            transform: [{ scale: iconScale }],
            opacity: iconOpacity,
            marginRight: Spacing.sm,
          }}>
            <Ionicons
              name="sparkles"
              size={20}
              color={Magenta[500]}
            />
          </Animated.View>
          <TextInput
            style={[styles.input, { color: colors.text }, webInputStyle]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
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
  activeContainer: {
    borderColor: Magenta[500],
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
