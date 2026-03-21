import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Magenta, BorderRadius } from '@/constants/theme';

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
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Close button */}
          <Pressable style={styles.closeButton} onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>

          <Ionicons
            name="heart-circle"
            size={56}
            color={Magenta[500]}
            style={styles.icon}
          />

          <Text style={[styles.title, { color: colors.text }]}>
            Join Crowdia
          </Text>

          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Sign in to save events, follow organizers, and get personalized recommendations.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSignUp}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.cardBorder },
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogin}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Sign In
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: 4,
  },
  icon: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: Typography.sm,
    lineHeight: Typography.sm * 1.5,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Magenta[500],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.base,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
