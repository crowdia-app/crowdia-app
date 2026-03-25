import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Magenta, Charcoal, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { GlowingLogo } from '@/components/ui/glowing-logo';

interface LoginPromptModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function LoginPromptModal({ visible, onDismiss }: LoginPromptModalProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const handleLogin = () => {
    onDismiss();
    router.push('/auth/login');
  };

  const handleSignUp = () => {
    onDismiss();
    router.push('/auth/signup');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.card, { backgroundColor: colorScheme === 'dark' ? Charcoal[700] : '#FFFFFF' }]}
          onPress={() => {}}
        >
          {/* Dismiss button */}
          <Pressable style={styles.closeButton} onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>

          {/* Logo + heading */}
          <View style={styles.logoRow}>
            <GlowingLogo size={36} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Join Crowdia</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Save events, follow organizers, and stay in the loop on what's happening in Palermo.
          </Text>

          {/* Actions */}
          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && { opacity: 0.85 }]}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>Log in</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.signupButton,
              { borderColor: Magenta[500] },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleSignUp}
          >
            <Text style={[styles.signupButtonText, { color: Magenta[500] }]}>Sign up free</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.laterButton}>
            <Text style={[styles.laterText, { color: colors.textMuted }]}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxxl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.xs,
  },
  logoRow: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: Typography.sm * 1.5,
    marginBottom: Spacing.xxxl,
  },
  loginButton: {
    width: '100%',
    backgroundColor: Magenta[500],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.base,
    fontWeight: '600',
  },
  signupButton: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  signupButtonText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: Spacing.sm,
  },
  laterText: {
    fontSize: Typography.sm,
  },
});
