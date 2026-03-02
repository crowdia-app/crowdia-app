import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'datetime';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

interface Props {
  visible: boolean;
  title: string;
  fields: FormField[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}

export function AdminFormModal({ visible, title, fields, initialValues, onSubmit, onClose, onDelete }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [values, setValues] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSelect, setExpandedSelect] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValues(initialValues || {});
      setExpandedSelect(null);
    }
  }, [visible, initialValues]);

  const handleSubmit = async () => {
    // Validate required fields
    for (const field of fields) {
      if (field.required && !values[field.key] && values[field.key] !== false && values[field.key] !== 0) {
        Alert.alert('Validation Error', `${field.label} is required`);
        return;
      }
    }
    setIsSaving(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const setValue = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case 'boolean':
        return (
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{field.label}</Text>
            <Switch
              value={!!values[field.key]}
              onValueChange={(v) => setValue(field.key, v)}
              trackColor={{ true: Colors.magenta[500], false: colors.inputBorder }}
              thumbColor="#fff"
            />
          </View>
        );

      case 'select':
        return (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              {field.label}
              {field.required && ' *'}
            </Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
              onPress={() => setExpandedSelect(expandedSelect === field.key ? null : field.key)}
            >
              <Text style={[styles.selectText, { color: values[field.key] ? colors.text : colors.textMuted }]}>
                {field.options?.find((o) => o.value === values[field.key])?.label || `Select ${field.label}...`}
              </Text>
              <IconSymbol name="chevron.down" size={14} color={colors.icon} />
            </TouchableOpacity>
            {expandedSelect === field.key && (
              <View style={[styles.selectDropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
                <TouchableOpacity
                  style={styles.selectOption}
                  onPress={() => {
                    setValue(field.key, null);
                    setExpandedSelect(null);
                  }}
                >
                  <Text style={[styles.selectOptionText, { color: colors.textMuted }]}>None</Text>
                </TouchableOpacity>
                {field.options?.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.selectOption,
                      values[field.key] === opt.value && { backgroundColor: Colors.magenta[50] },
                    ]}
                    onPress={() => {
                      setValue(field.key, opt.value);
                      setExpandedSelect(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        { color: values[field.key] === opt.value ? Colors.magenta[600] : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );

      case 'textarea':
        return (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              {field.label}
              {field.required && ' *'}
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
              value={values[field.key]?.toString() || ''}
              onChangeText={(v) => setValue(field.key, v)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        );

      case 'number':
        return (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              {field.label}
              {field.required && ' *'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
              value={values[field.key]?.toString() || ''}
              onChangeText={(v) => setValue(field.key, v === '' ? null : parseFloat(v) || 0)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </View>
        );

      default:
        return (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>
              {field.label}
              {field.required && ' *'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
              value={values[field.key]?.toString() || ''}
              onChangeText={(v) => setValue(field.key, v)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelText, { color: Colors.magenta[500] }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.magenta[500]} />
            ) : (
              <Text style={[styles.saveText, { color: Colors.magenta[500] }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Fields */}
        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
          {fields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              {renderField(field)}
            </View>
          ))}

          {onDelete && (
            <TouchableOpacity style={[styles.deleteButton, { borderColor: Colors.red[500] }]} onPress={handleDelete}>
              <IconSymbol name="trash" size={16} color={Colors.red[500]} />
              <Text style={[styles.deleteText, { color: Colors.red[500] }]}>Delete</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: Typography.md, fontWeight: '600' },
  cancelText: { fontSize: Typography.md },
  saveText: { fontSize: Typography.md, fontWeight: '600' },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: Spacing.lg },
  fieldContainer: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: Typography.xs, fontWeight: '600', marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sm,
    minHeight: 100,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  switchLabel: { fontSize: Typography.sm, fontWeight: '500' },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  selectText: { fontSize: Typography.sm, flex: 1 },
  selectDropdown: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    maxHeight: 200,
  },
  selectOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  selectOptionText: { fontSize: Typography.sm },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  deleteText: { fontSize: Typography.md, fontWeight: '600' },
});
