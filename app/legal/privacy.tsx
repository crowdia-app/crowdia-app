import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';

const LAST_UPDATED = 'March 1, 2025';

const SECTIONS = [
  {
    title: '1. Introduction',
    body: `Crowdia ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Crowdia mobile application ("App").\n\nBy using the App, you agree to the collection and use of information in accordance with this policy.`,
  },
  {
    title: '2. Information We Collect',
    body: `We may collect the following types of information:\n\n• Account Information: When you create an account, we collect your email address, username, and password.\n• Profile Information: Information you voluntarily provide such as a display name or profile photo.\n• Usage Data: Information about how you interact with the App, including events viewed, searches performed, and features used.\n• Device Information: Device type, operating system, unique device identifiers, and mobile network information.\n• Location Data: If you grant permission, approximate location to show you nearby events. You may disable location access at any time in your device settings.\n• Communications: If you contact us, we may retain records of that correspondence.`,
  },
  {
    title: '3. How We Use Your Information',
    body: `We use the information we collect to:\n\n• Provide, maintain, and improve the App\n• Personalize your event discovery experience\n• Send you notifications about events and updates (with your consent)\n• Respond to your comments and questions\n• Monitor and analyze usage trends to improve the App\n• Detect, prevent, and address technical issues and fraudulent activity\n• Comply with legal obligations`,
  },
  {
    title: '4. Sharing of Information',
    body: `We do not sell, trade, or rent your personal information to third parties. We may share information in the following circumstances:\n\n• Service Providers: We may share information with third-party vendors who perform services on our behalf (e.g., hosting, analytics, customer support), subject to confidentiality obligations.\n• Legal Requirements: We may disclose information if required by law or in response to valid legal process.\n• Business Transfers: If Crowdia is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.\n• With Your Consent: We may share information for any other purpose with your explicit consent.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your personal information for as long as your account is active or as needed to provide the App's services. You may request deletion of your account and associated data at any time by contacting us at legal@crowdia.ai.\n\nWe may retain certain information as required by law or for legitimate business purposes even after your account is deleted.`,
  },
  {
    title: '6. Security',
    body: `We implement reasonable technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '7. Children\'s Privacy',
    body: `The App is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us and we will promptly delete it.`,
  },
  {
    title: '8. Third-Party Services',
    body: `The App uses third-party services that may collect information about you. These include:\n\n• Supabase (authentication and data storage)\n• Expo (application platform)\n\nThese services have their own privacy policies, and we encourage you to review them.`,
  },
  {
    title: '9. Your Rights and Choices',
    body: `Depending on your location, you may have the following rights regarding your personal information:\n\n• Access: Request a copy of the information we hold about you.\n• Correction: Request correction of inaccurate or incomplete information.\n• Deletion: Request deletion of your personal information.\n• Opt-Out: Opt out of marketing communications at any time.\n\nTo exercise any of these rights, please contact us at legal@crowdia.ai.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date at the top of this page. For material changes, we will provide additional notice (such as an in-app notification or email). Continued use of the App after changes take effect constitutes acceptance of the revised policy.`,
  },
  {
    title: '11. Contact Us',
    body: `If you have any questions or concerns about this Privacy Policy, please contact us:\n\nEmail: legal@crowdia.ai`,
  },
];

export default function PrivacyPolicyScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Privacy Policy
        </Text>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
          Last Updated: {LAST_UPDATED}
        </Text>

        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Please read this Privacy Policy carefully to understand how we handle your personal information.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  title: {
    fontSize: Typography.xxxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    fontSize: Typography.xs,
    marginBottom: Spacing.lg,
  },
  intro: {
    fontSize: Typography.sm,
    lineHeight: Typography.sm * 1.6,
    marginBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  sectionBody: {
    fontSize: Typography.sm,
    lineHeight: Typography.sm * 1.7,
  },
});
