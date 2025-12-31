import { StyleSheet } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';

export const createAuthStyles = (isDark: boolean) => {
  const colors = Colors[isDark ? 'dark' : 'light'];

  return StyleSheet.create({
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    container: {
      flex: 1,
      padding: Spacing.xl,
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    header: {
      marginBottom: Spacing.xxxl,
      alignItems: 'center',
    },
    title: {
      fontSize: Typography.xxxl,
      fontWeight: '700',
      marginBottom: Spacing.xs,
      textAlign: 'center',
      color: colors.text,
    },
    subtitle: {
      fontSize: Typography.md,
      color: colors.subtext,
      textAlign: 'center',
      marginBottom: Spacing.xxl,
    },
    inputContainer: {
      marginBottom: Spacing.md,
    },
    inputLabel: {
      fontSize: Typography.sm,
      color: colors.text,
      marginBottom: Spacing.xs,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: Typography.md,
      backgroundColor: colors.inputBackground,
      color: colors.text,
    },
    inputFocused: {
      borderColor: Colors.magenta[500],
      borderWidth: 2,
    },
    button: {
      backgroundColor: Colors.magenta[500],
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
      shadowColor: Colors.magenta[500],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: Typography.md,
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.magenta[500],
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    secondaryButtonText: {
      color: Colors.magenta[500],
      fontSize: Typography.md,
      fontWeight: '600',
    },
    linkText: {
      color: Colors.magenta[500],
      textAlign: 'center',
      marginTop: Spacing.lg,
      fontSize: Typography.sm,
      fontWeight: '600',
    },
    forgotPasswordLink: {
      color: colors.subtext,
      textAlign: 'right',
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
      fontSize: Typography.sm,
    },
    errorText: {
      color: Colors.red[500],
      marginBottom: Spacing.md,
      textAlign: 'center',
      fontSize: Typography.sm,
      backgroundColor: Colors.red[50],
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    successText: {
      color: Colors.green[700],
      marginBottom: Spacing.md,
      textAlign: 'center',
      fontSize: Typography.sm,
      backgroundColor: Colors.green[50],
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    toggleButton: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      backgroundColor: colors.inputBackground,
    },
    toggleButtonActive: {
      backgroundColor: Colors.magenta[500],
      borderColor: Colors.magenta[500],
    },
    toggleText: {
      fontSize: Typography.md,
      color: colors.text,
      fontWeight: '600',
      textAlign: 'center',
    },
    toggleTextActive: {
      color: '#FFFFFF',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.xl,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      marginHorizontal: Spacing.md,
      fontSize: Typography.sm,
      color: colors.subtext,
    },
    helpText: {
      fontSize: Typography.sm,
      color: colors.subtext,
      textAlign: 'center',
      marginTop: Spacing.md,
      lineHeight: 20,
    },
  });
};

// For backward compatibility with existing code that imports styles directly
export const styles = createAuthStyles(false);
