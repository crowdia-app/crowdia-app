import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Charcoal, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { askLumio, LumioEvent } from '@/services/lumio';
import { useAuthStore } from '@/stores/authStore';

const LUMIO_PURPLE = '#7C3AED';
const LUMIO_PURPLE_DIM = '#5B21B6';
const LUMIO_PURPLE_BRIGHT = '#9333EA';
const LUMIO_BG = '#1E1B2E';

type LumioAvatarState = 'idle' | 'listening' | 'thinking' | 'excited';

interface ChatMessage {
  id: string;
  role: 'user' | 'lumio';
  text: string;
  events?: LumioEvent[];
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
  const router = useRouter();
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lumioAvatarState, setLumioAvatarState] = useState<LumioAvatarState>('idle');
  const scrollRef = useRef<ScrollView>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    animRef.current?.stop();
    animRef.current = null;
    pulseAnim.setValue(0);
    spinAnim.setValue(0);

    if (lumioAvatarState === 'listening') {
      scaleAnim.setValue(1);
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      );
      animRef.current.start();
    } else if (lumioAvatarState === 'thinking') {
      scaleAnim.setValue(1);
      animRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animRef.current.start();
    } else if (lumioAvatarState === 'excited') {
      animRef.current = Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, speed: 14, bounciness: 4, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, speed: 10, bounciness: 8, useNativeDriver: true }),
      ]);
      animRef.current.start(() => {
        animRef.current = null;
      });
    } else {
      animRef.current = Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true });
      animRef.current.start(() => {
        animRef.current = null;
      });
    }
  }, [lumioAvatarState, pulseAnim, spinAnim, scaleAnim]);

  useEffect(() => {
    if (isSending) setLumioAvatarState('thinking');
  }, [isSending]);

  useEffect(() => {
    if (!visible) {
      animRef.current?.stop();
      pulseAnim.setValue(0);
      spinAnim.setValue(0);
      scaleAnim.setValue(1);
    }
  }, [visible, pulseAnim, spinAnim, scaleAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const avatarBgColor =
    lumioAvatarState === 'idle'
      ? LUMIO_PURPLE_DIM
      : lumioAvatarState === 'excited'
        ? LUMIO_PURPLE_BRIGHT
        : LUMIO_PURPLE;

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
          events: response.events.length > 0 ? response.events : undefined,
        };
        setMessages((prev) => [...prev, lumioMsg]);
        setLumioAvatarState(response.lumioAvatar);
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
    setLumioAvatarState('idle');
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
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarPulseRing, { opacity: pulseAnim }]} />
              <Animated.View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: avatarBgColor, transform: [{ scale: scaleAnim }, { rotate: spin }] },
                ]}
              >
                <Ionicons name="bulb" size={22} color="#FFFFFF" />
              </Animated.View>
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
              messages.map((msg) => {
                if (msg.role === 'lumio') {
                  return (
                    <View key={msg.id} style={styles.lumioMessageGroup}>
                      <View style={[styles.bubbleRow, styles.bubbleRowLumio]}>
                        <View style={styles.lumioAvatarSmall}>
                          <Ionicons name="bulb" size={12} color="#FFFFFF" />
                        </View>
                        <View style={[styles.bubble, { backgroundColor: bubbleLumioBg }]}>
                          <Text style={[styles.bubbleText, { color: bubbleLumioText }]}>
                            {msg.text}
                          </Text>
                        </View>
                      </View>
                      {msg.events && msg.events.length > 0 && (
                        <View style={styles.eventCards}>
                          {msg.events.map((event) => {
                            const dateLabel = event.event_start_time
                              ? new Date(event.event_start_time).toLocaleDateString('it-IT', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : null;
                            return (
                              <Pressable
                                key={event.id}
                                style={({ pressed }) => [
                                  styles.eventCard,
                                  {
                                    backgroundColor:
                                      colorScheme === 'dark' ? Charcoal[700] : '#EDE9FE',
                                    borderColor: LUMIO_PURPLE + '44',
                                    opacity: pressed ? 0.8 : 1,
                                  },
                                ]}
                                onPress={() => {
                                  onClose();
                                  router.push(`/event/${event.id}`);
                                }}
                              >
                                <Text
                                  style={[styles.eventCardTitle, { color: bubbleLumioText }]}
                                  numberOfLines={1}
                                >
                                  {event.title}
                                </Text>
                                {(event.location_name || dateLabel) && (
                                  <Text
                                    style={[styles.eventCardMeta, { color: colors.textMuted }]}
                                    numberOfLines={1}
                                  >
                                    {[event.location_name, dateLabel].filter(Boolean).join(' · ')}
                                  </Text>
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                }
                return (
                  <View key={msg.id} style={[styles.bubbleRow, styles.bubbleRowUser]}>
                    <View style={[styles.bubble, { backgroundColor: bubbleUserBg }]}>
                      <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{msg.text}</Text>
                    </View>
                  </View>
                );
              })
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
              onFocus={() => {
                if (!isSending) setLumioAvatarState('listening');
              }}
              onChangeText={(t) => {
                setInputText(t);
                if (!isSending) setLumioAvatarState('listening');
              }}
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
  avatarContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: LUMIO_PURPLE,
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
  lumioMessageGroup: {
    marginBottom: Spacing.sm,
  },
  eventCards: {
    marginLeft: 22 + (Spacing.xs ?? 4),
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md ?? 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  eventCardTitle: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  eventCardMeta: {
    fontSize: Typography.xs,
    marginTop: 2,
  },
});
