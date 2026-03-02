import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Stack } from 'expo-router';

export interface DetailSection {
  title?: string;
  fields: { label: string; value: React.ReactNode }[];
}

interface Props {
  title: string;
  subtitle?: string;
  sections: DetailSection[];
  isLoading: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  actions?: { label: string; icon?: string; color?: string; onPress: () => void }[];
}

export function AdminDetailView({ title, subtitle, sections, isLoading, onEdit, onDelete, actions }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color={Colors.magenta[500]} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: colors.subtext }]}>{subtitle}</Text>}
        </View>
        <View style={styles.headerActions}>
          {onEdit && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.magenta[500] }]} onPress={onEdit}>
              <IconSymbol name="pencil" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.red[500] }]} onPress={onDelete}>
              <IconSymbol name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Custom Actions */}
      {actions && actions.length > 0 && (
        <View style={styles.actionsRow}>
          {actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.customAction, { backgroundColor: action.color || Colors.magenta[500] }]}
              onPress={action.onPress}
            >
              {action.icon && <IconSymbol name={action.icon} size={16} color="#fff" />}
              <Text style={styles.customActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sections */}
      {sections.map((section, si) => (
        <View key={si} style={[styles.section, { backgroundColor: colors.card }]}>
          {section.title && (
            <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{section.title}</Text>
          )}
          {section.fields.map((field, fi) => (
            <View
              key={fi}
              style={[styles.fieldRow, fi < section.fields.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }]}
            >
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>{field.label}</Text>
              <View style={styles.fieldValue}>
                {typeof field.value === 'string' || typeof field.value === 'number' ? (
                  <Text style={[styles.fieldValueText, { color: colors.text }]} selectable>
                    {String(field.value)}
                  </Text>
                ) : (
                  field.value
                )}
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export function StatusBadge({ status, color, bgColor }: { status: string; color: string; bgColor: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

export function BooleanBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <StatusBadge
      status={value ? trueLabel : falseLabel}
      color={value ? Colors.green[700] : Colors.red[700]}
      bgColor={value ? Colors.green[100] : Colors.red[100]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: Typography.xl, fontWeight: '700' },
  subtitle: { fontSize: Typography.sm, marginTop: Spacing.xxs },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionBtnText: { color: '#fff', fontSize: Typography.sm, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  customAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  customActionText: { color: '#fff', fontSize: Typography.sm, fontWeight: '500' },
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  fieldLabel: {
    fontSize: Typography.sm,
    width: 120,
    flexShrink: 0,
  },
  fieldValue: { flex: 1 },
  fieldValueText: { fontSize: Typography.sm },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: Typography.xs, fontWeight: '600' },
});
