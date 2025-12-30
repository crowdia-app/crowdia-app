import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search events...',
}: SearchBarProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

  const styles = createStyles(colors, isFocused);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={isFocused ? colors.primary : colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
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
    </View>
  );
}

const createStyles = (colors: typeof Colors.dark, isFocused: boolean) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
    },
    searchIcon: {
      marginRight: Spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: Typography.sm,
      color: colors.text,
      paddingVertical: Spacing.md,
      outlineStyle: 'none',
    } as any,
    clearButton: {
      padding: Spacing.xs,
    },
  });
