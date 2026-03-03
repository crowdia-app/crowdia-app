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
    title: '1. Acceptance of Terms',
    body: `By downloading, installing, or using the Crowdia mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App.\n\nThese Terms apply to all visitors, users, and others who access or use the App.`,
  },
  {
    title: '2. Description of Service',
    body: `Crowdia is an event discovery platform that helps users find, follow, and attend local events and activities. We aggregate publicly available event information and provide tools to help you connect with your community.\n\nWe reserve the right to modify, suspend, or discontinue the App or any feature at any time without notice.`,
  },
  {
    title: '3. User Accounts',
    body: `To access certain features you must create an account. You are responsible for:\n\n• Maintaining the confidentiality of your account credentials\n• All activity that occurs under your account\n• Providing accurate and up-to-date information\n\nYou must be at least 13 years old to create an account. By creating an account you represent that you meet this requirement.`,
  },
  {
    title: '4. User Conduct',
    body: `You agree not to:\n\n• Use the App for any unlawful purpose or in violation of any regulations\n• Post or transmit content that is false, misleading, defamatory, obscene, or harmful\n• Attempt to gain unauthorized access to any part of the App or its infrastructure\n• Scrape, crawl, or otherwise extract data from the App without our written permission\n• Use the App to send unsolicited communications (spam)\n• Impersonate any person or entity`,
  },
  {
    title: '5. User-Generated Content',
    body: `If you submit content (including event check-ins, reviews, or profile information), you grant Crowdia a non-exclusive, worldwide, royalty-free license to use, display, reproduce, and distribute that content in connection with the App.\n\nYou represent that you own or have the necessary rights to the content you submit and that it does not infringe any third-party rights.`,
  },
  {
    title: '6. Privacy',
    body: `Your use of the App is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the App you consent to the collection and use of your data as described in the Privacy Policy.`,
  },
  {
    title: '7. Intellectual Property',
    body: `The App, including its design, logos, graphics, text, and software, is owned by Crowdia and protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works based on any part of the App without our prior written consent.`,
  },
  {
    title: '8. Third-Party Services',
    body: `The App may contain links to or integrate with third-party websites and services. We are not responsible for the content or practices of those third parties. Your use of third-party services is subject to their own terms and privacy policies.`,
  },
  {
    title: '9. Disclaimer of Warranties',
    body: `THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.\n\nWe do not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.`,
  },
  {
    title: '10. Limitation of Liability',
    body: `TO THE FULLEST EXTENT PERMITTED BY LAW, CROWDIA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE APP, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.\n\nOur total liability for any claim arising from or relating to these Terms or the App shall not exceed the amount you paid us in the twelve months preceding the claim, or $100, whichever is less.`,
  },
  {
    title: '11. Termination',
    body: `We may suspend or terminate your account and access to the App at our sole discretion, with or without cause, and without prior notice. Upon termination, your right to use the App will immediately cease.`,
  },
  {
    title: '12. Changes to Terms',
    body: `We may revise these Terms from time to time. When we do, we will update the "Last Updated" date at the top of this page. If a change is material we will provide reasonable notice (e.g., via email or an in-app notification). Continued use of the App after changes take effect constitutes acceptance of the revised Terms.`,
  },
  {
    title: '13. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Crowdia operates, without regard to conflict of law principles.`,
  },
  {
    title: '14. Contact Us',
    body: `If you have any questions about these Terms, please contact us:\n\nEmail: legal@crowdia.ai`,
  },
];

export default function TermsOfServiceScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Terms of Service',
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
          Terms of Service
        </Text>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
          Last Updated: {LAST_UPDATED}
        </Text>

        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Please read these Terms of Service carefully before using the Crowdia app.
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
