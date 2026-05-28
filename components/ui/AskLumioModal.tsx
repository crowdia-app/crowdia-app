import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Charcoal, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { askLumio } from '@/services/lumio';
import { useAuthStore } from '@/stores/authStore';

const LUMIO_PURPLE = '#7C3AED';
const LUMIO_PURPLE_DIM = '#5B21B6';
const LUMIO_BG = '#1E1B2E';

interface ChatMessage {
  id: string;
  role: 'user' | 'lumio';
  text: string;
}

const SUGGESTED_PROMPTS = [
  'Qualcosa di bello stasera',
  'Aperitivo vicino Politeama',
  'Musica live questo weekend',
  'Evento gratis domani',
];

interface AskLumioModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AskLumioModal({ visible, onClose }: AskLumioModalProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setIsSending(true);

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      try {
        const response = await askLumio(trimmed, user?.id ?? null);
        const lumioMsg: ChatMessage = {
          id: `l-${Date.now()}`,
          role: 'lumio',
          text: response.reply,
        };
        setMessages((prev) => [...prev, lumioMsg]);
      } finally {
        setIsSending(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    [isSending, user],
  );

  const handleChipPress = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage],
  );

  const handleClose = useCallback(() => {
    setMessages([]);
    setInputText('');
    onClose();
  }, [onClose]);

  const bgColor = colorScheme === 'dark' ? LUMIO_BG : '#F3F0FF';
  const bubbleUserBg = LUMIO_PURPLE;
  const bubbleLumioBg = colorScheme === 'dark' ? Charcoal[600] : '#E9E4FF';
  const bubbleLumioText = colorScheme === 'dark' ? '#FFFFFF' : '#1E1B2E';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheet, { backgroundColor: bgColor, paddingBottom: insets.bottom }]}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="bulb" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>Lumio</Text>
              <Text style={styles.headerSubtitle}>Guida AI di Crowdia</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Rate limit note */}
          <View style={styles.rateLimitRow}>
            <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.rateLimitText, { color: colors.textMuted }]}>
              10 messaggi/ora (gratuito)
            </Text>
          </View>

          {/* Chat area */}
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Cosa stai cercando?
                </Text>
                <View style={styles.chips}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      style={({ pressed }) => [
                        styles.chip,
                        { borderColor: LUMIO_PURPLE, backgroundColor: pressed ? LUMIO_PURPLE_DIM + '22' : 'transparent' },
                      ]}
                      onPress={() => handleChipPress(prompt)}
                    >
                      <Text style={[styles.chipText, { color: LUMIO_PURPLE }]}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.bubbleRow,
                    msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowLumio,
                  ]}
                >
                  {msg.role === 'lumio' && (
                    <View style={styles.lumioAvatarSmall}>
                      <Ionicons name="bulb" size={12} color="#FFFFFF" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      msg.role === 'user'
                        ? { backgroundColor: bubbleUserBg }
                        : { backgroundColor: bubbleLumioBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: msg.role === 'user' ? '#FFFFFF' : bubbleLumioText },
                      ]}
                    >
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))
            )}
            {isSending && (
              <View style={[styles.bubbleRow, styles.bubbleRowLumio]}>
                <View style={styles.lumioAvatarSmall}>
                  <Ionicons name="bulb" size={12} color="#FFFFFF" />
                </View>
                <View style={[styles.bubble, { backgroundColor: bubbleLumioBg }]}>
                  <Text style={[styles.bubbleText, { color: bubbleLumioText }]}>...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Composer */}
          <View style={[styles.composer, { borderTopColor: colorScheme === 'dark' ? Charcoal[500] : '#D1C4FF' }]}>
            <TextInput
              style={[
                styles.composerInput,
                {
                  backgroundColor: colorScheme === 'dark' ? Charcoal[600] : '#EDE9FE',
                  color: colors.text,
                },
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Chiedimi qualcosa..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(inputText)}
              blurOnSubmit={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: inputText.trim() && !isSending ? LUMIO_PURPLE : Charcoal[400] },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isSending}
              accessibilityLabel="Invia"
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Charcoal[300],
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LUMIO_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: LUMIO_PURPLE,
  },
  headerSubtitle: {
    fontSize: Typography.xs,
    color: '#9CA3AF',
    marginTop: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  rateLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  rateLimitText: {
    fontSize: 11,
  },
  chatScroll: {
    flex: 1,
    minHeight: 180,
  },
  chatContent: {
    flexGrow: 1,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full ?? 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowLumio: {
    justifyContent: 'flex-start',
  },
  lumioAvatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LUMIO_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bubbleText: {
    fontSize: Typography.sm,
    lineHeight: Typography.sm * 1.5,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
    fontSize: Typography.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
