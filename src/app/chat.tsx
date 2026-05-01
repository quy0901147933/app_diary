import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { LockGuard } from '@/components/lock-guard';
import { useChat } from '@/hooks/use-chat';
import { useUserPersona } from '@/hooks/use-persona';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, spacing, typography } from '@/theme';
import type { ChatMessage } from '@/types';

const QUICK_EMOJIS = [
  '😊', '😂', '🥰', '😍', '😘', '🤗', '😴', '😢',
  '🥲', '😭', '😎', '🤔', '😅', '😋', '🥺', '🙃',
  '❤️', '🔥', '✨', '🌸', '🌙', '☕', '🍀', '⭐',
];

const REACTIONS: { key: NonNullable<ChatMessage['reaction']>; emoji: string }[] = [
  { key: 'love', emoji: '❤️' },
  { key: 'like', emoji: '👍' },
  { key: 'haha', emoji: '😂' },
  { key: 'dislike', emoji: '👎' },
];

export default function ChatScreen() {
  const router = useRouter();
  return (
    <LockGuard
      lockKey="lumina"
      title="Mở khóa Lumina"
      subtitle="Nhập PIN 6 số để vào trò chuyện."
      onCancel={() => router.back()}
    >
      <ChatScreenInner />
    </LockGuard>
  );
}

function ChatScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const persona = useUserPersona(userId).data;
  const { turns, send, setReaction, pending } = useChat(userId);
  const [draft, setDraft] = useState('');
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [emojiBarOpen, setEmojiBarOpen] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const aiName = persona?.ai_name || 'Lumina';

  useEffect(() => {
    if (turns.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [turns.length]);

  async function onSend() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft('');
    await send(text);
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Đóng">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Avatar
            size={36}
            url={persona?.ai_avatar_url}
            presetKey={persona?.ai_avatar_key}
            kind="ai"
          />
          <View>
            <Text style={styles.headerTitle}>{aiName}</Text>
            <Text style={styles.headerSub}>
              {persona?.ai_relationship === 'lover'
                ? 'Người thương'
                : persona?.ai_relationship === 'mentor'
                  ? 'Tiền bối'
                  : 'Bạn đồng hành'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Cài đặt">
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Bubble
              msg={item}
              aiAvatarKey={persona?.ai_avatar_key}
              aiAvatarUrl={persona?.ai_avatar_url}
              onLongPress={() => item.role === 'assistant' && setReactionFor(item.id)}
            />
          )}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            <View style={styles.emptyHost}>
              <Avatar
                size={72}
                url={persona?.ai_avatar_url}
                presetKey={persona?.ai_avatar_key}
                kind="ai"
              />
              <Text style={styles.emptyTitle}>{aiName} đang ở đây.</Text>
              <Text style={styles.emptyHint}>
                Hôm nay bạn cảm thấy thế nào? Một khoảnh khắc nhỏ, một ý nghĩ vẩn vơ,
                hay điều gì đó khiến bạn mệt — đều có thể nhắn cho mình.
              </Text>
            </View>
          }
          ListFooterComponent={
            pending ? (
              <TypingBubble
                avatarKey={persona?.ai_avatar_key}
                avatarUrl={persona?.ai_avatar_url}
              />
            ) : null
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {emojiBarOpen ? (
          <View style={styles.emojiBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiBarContent}
            >
              {QUICK_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setDraft((d) => d + e)}
                  style={({ pressed }) => [
                    styles.emojiCell,
                    pressed && styles.emojiCellPressed,
                  ]}
                  accessibilityLabel={`Chèn ${e}`}
                >
                  <Text style={styles.emojiCellText}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Pressable
            onPress={() => setEmojiBarOpen((v) => !v)}
            style={styles.emojiToggle}
            accessibilityLabel="Mở emoji"
            hitSlop={6}
          >
            <Ionicons
              name={emojiBarOpen ? 'close-circle' : 'happy-outline'}
              size={26}
              color={emojiBarOpen ? colors.accent : colors.textSecondary}
            />
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Nhắn cho ${aiName}…`}
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!pending}
            submitBehavior="blurAndSubmit"
            returnKeyType="send"
            onSubmitEditing={onSend}
            onFocus={() => setEmojiBarOpen(false)}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || pending}
            style={[styles.send, (!draft.trim() || pending) && styles.sendDisabled]}
            accessibilityLabel="Gửi"
          >
            <Ionicons name="arrow-up" size={20} color={colors.textInverse} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Reaction picker */}
      <Modal
        transparent
        visible={!!reactionFor}
        animationType="fade"
        onRequestClose={() => setReactionFor(null)}
      >
        <Pressable style={styles.reactionBackdrop} onPress={() => setReactionFor(null)}>
          <View style={styles.reactionRow}>
            {REACTIONS.map((r) => (
              <Pressable
                key={r.key}
                onPress={async () => {
                  if (reactionFor) {
                    await setReaction(reactionFor, r.key);
                  }
                  setReactionFor(null);
                }}
                style={styles.reactionBtn}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={async () => {
                if (reactionFor) await setReaction(reactionFor, null);
                setReactionFor(null);
              }}
              style={styles.reactionBtn}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Bubble({
  msg,
  aiAvatarKey,
  aiAvatarUrl,
  onLongPress,
}: {
  msg: ChatMessage;
  aiAvatarKey: string | null | undefined;
  aiAvatarUrl: string | null | undefined;
  onLongPress: () => void;
}) {
  const isUser = msg.role === 'user';
  const reactionEmoji = REACTIONS.find((r) => r.key === msg.reaction)?.emoji;

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={[styles.bubble, styles.bubbleUser]}>
          <Text style={styles.bubbleTextUser}>{msg.content}</Text>
          {reactionEmoji ? (
            <View style={styles.reactionBadgeUser}>
              <Text style={styles.reactionBadgeText}>{reactionEmoji}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.aiRow}>
      <Avatar size={28} url={aiAvatarUrl} presetKey={aiAvatarKey} kind="ai" />
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={250}
        style={({ pressed }) => [
          styles.bubble,
          styles.bubbleAssistant,
          pressed && styles.bubblePressed,
        ]}
      >
        <Text style={styles.bubbleText}>{msg.content}</Text>
        {reactionEmoji ? (
          <View style={styles.reactionBadge}>
            <Text style={styles.reactionBadgeText}>{reactionEmoji}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function TypingBubble({
  avatarKey,
  avatarUrl,
}: {
  avatarKey: string | null | undefined;
  avatarUrl: string | null | undefined;
}) {
  return (
    <View style={styles.aiRow}>
      <Avatar size={28} url={avatarUrl} presetKey={avatarKey} kind="ai" />
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typing]}>
        <Text style={styles.typingDot}>•</Text>
        <Text style={styles.typingDot}>•</Text>
        <Text style={styles.typingDot}>•</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, marginLeft: spacing.md },
  headerTitle: { ...typography.title, fontSize: 17, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textMuted },
  listPad: { padding: spacing.lg, gap: spacing.sm },
  userRow: { alignItems: 'flex-end' },
  aiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  bubblePressed: { opacity: 0.85 },
  bubbleUser: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextUser: { ...typography.body, color: colors.textInverse },
  reactionBadge: {
    position: 'absolute',
    bottom: -10,
    right: -4,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  reactionBadgeUser: {
    position: 'absolute',
    bottom: -10,
    left: -4,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  reactionBadgeText: { fontSize: 14 },
  typing: { flexDirection: 'row', gap: 6, paddingVertical: spacing.md },
  typingDot: { ...typography.title, color: colors.textMuted, lineHeight: 14 },
  emptyHost: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emojiBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  emojiBarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  emojiCellPressed: {
    backgroundColor: colors.surface,
    transform: [{ scale: 0.92 }],
  },
  emojiCellText: { fontSize: 24 },
  emojiToggle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderRadius: radius.xl,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.accentSoft },
  reactionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,15,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 26 },
});
