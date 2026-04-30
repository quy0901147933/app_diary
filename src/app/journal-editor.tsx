import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSaveJournalEntry } from '@/hooks/use-journal';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, spacing, typography } from '@/theme';

const MOODS = [
  '😊', '😐', '😔', '😍', '🥰', '🤔', '😴', '🌧', '☀️', '🌸', '✨', '☕',
  '😂', '🥹', '😭', '😎', '🔥', '🌙', '⭐', '🍀', '🍂', '🌊', '💗', '🤍',
];

const EMOJI_QUICK = [
  '❤️', '🔥', '✨', '🌸', '☕', '🌙', '⭐', '🍀', '🌊', '🌧', '😂', '🥹',
  '🤍', '🌻', '🥰', '😴', '☀️', '🍂',
];

const HASHTAG_SUGGESTIONS = [
  '#cafe', '#sángbìnhyên', '#chiềunhẹ', '#đêmkhuya', '#deepwork',
  '#study', '#weekend', '#travel', '#food', '#cooking',
  '#family', '#friends', '#selfcare', '#workout', '#walk',
  '#grateful', '#tired', '#happy', '#calm', '#growth',
  '#nostalgia', '#latenight', '#sunday', '#monday', '#mood',
];

const PROMPTS: { icon: string; label: string; insert: string }[] = [
  { icon: '🌻', label: 'Bạn đang học gì?', insert: '🌻 Hôm nay mình học được… ' },
  { icon: '🔌', label: 'Tiến độ', insert: '🔌 Tiến độ gần đây của mình… ' },
  { icon: '💡', label: 'Quan sát', insert: '💡 Một quan sát nhỏ trong ngày… ' },
  { icon: '📌', label: 'Kế hoạch', insert: '📌 Kế hoạch sắp tới… ' },
  { icon: '🌧', label: 'Cảm xúc', insert: '🌧 Mình đang cảm thấy… ' },
  { icon: '☕', label: 'Một ngày bình yên', insert: '☕ Hôm nay mình thấy bình yên vì… ' },
  { icon: '🔥', label: 'Năng lượng cao', insert: '🔥 Hôm nay mình hừng hực vì… ' },
  { icon: '🥹', label: 'Biết ơn', insert: '🥹 Mình biết ơn vì… ' },
];

export default function JournalEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = useAuthStore((s) => s.session?.user.id);
  const saveMut = useSaveJournalEntry(userId);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [hashtagInput, setHashtagInput] = useState('');
  const [showMoodPicker, setShowMoodPicker] = useState(false);

  const today = new Date();

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    void supabase
      .from('journal_entries')
      .select('*')
      .eq('id', params.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setTitle(data.title ?? '');
        setBody(data.body_md ?? '');
        setMood(data.mood_emoji ?? null);
        setHashtagInput((data.hashtags ?? []).join(' '));
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function insertPrompt(text: string) {
    setBody((b) => (b ? `${b}\n\n${text}` : text));
  }

  function insertEmoji(e: string) {
    setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}${e}`);
  }

  function toggleUppercase() {
    setBody((b) => {
      if (!b) return b;
      return b === b.toUpperCase() ? b.toLowerCase() : b.toUpperCase();
    });
  }

  const activeTags = hashtagInput
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));

  function toggleHashtag(tag: string) {
    const norm = tag.toLowerCase();
    const exists = activeTags.some((t) => t.toLowerCase() === norm);
    const next = exists
      ? activeTags.filter((t) => t.toLowerCase() !== norm)
      : [...activeTags, tag];
    setHashtagInput(next.join(' '));
  }

  async function save(asDraft: boolean) {
    if (!body.trim() && !title.trim()) {
      Alert.alert('Trang còn trống', 'Viết một dòng gì đó trước khi lưu nhé.');
      return;
    }
    try {
      const tags = hashtagInput
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter(Boolean)
        .map((t) => `#${t}`);

      await saveMut.mutateAsync({
        id: params.id,
        entry_date: today.toISOString().slice(0, 10),
        title: title.trim() || null,
        body_md: body.trim() || null,
        mood_emoji: mood,
        hashtags: tags.length > 0 ? tags : null,
        is_draft: asDraft,
      });
      router.back();
    } catch (e) {
      Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Thử lại nhé.');
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Quay lại">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={() => save(false)}
          disabled={saveMut.isPending}
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
          accessibilityLabel="Lưu"
        >
          <Text style={styles.saveLabel}>{saveMut.isPending ? 'ĐANG LƯU…' : 'LƯU'}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollPad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dateRow}>
            <Text style={styles.dayBig}>{today.getDate()}</Text>
            <View style={styles.dateRight}>
              <Text style={styles.month}>Th{today.getMonth() + 1}</Text>
              <Text style={styles.year}>{today.getFullYear()}</Text>
            </View>
            <View style={styles.spacer} />
            <Pressable
              onPress={() => setShowMoodPicker((v) => !v)}
              style={styles.moodBtn}
              accessibilityLabel="Chọn tâm trạng"
            >
              <Text style={styles.moodEmoji}>{mood ?? '😐'}</Text>
            </Pressable>
          </View>

          {showMoodPicker ? (
            <View style={styles.moodGrid}>
              {MOODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMood(m);
                    setShowMoodPicker(false);
                  }}
                  style={[styles.moodCell, mood === m && styles.moodCellActive]}
                >
                  <Text style={styles.moodCellEmoji}>{m}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Tiêu đề"
            placeholderTextColor={colors.textMuted}
          />

          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="Hôm nay bạn cảm thấy thế nào?"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.sectionLabel}>Gợi ý mở đầu</Text>
          <View style={styles.promptRow}>
            {PROMPTS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => insertPrompt(p.insert)}
                style={styles.promptBtn}
              >
                <Text style={styles.promptEmoji}>{p.icon}</Text>
                <Text style={styles.promptLabel}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Emoji nhanh</Text>
          <View style={styles.emojiRow}>
            {EMOJI_QUICK.map((e) => (
              <Pressable key={e} onPress={() => insertEmoji(e)} style={styles.emojiCell}>
                <Text style={styles.emojiCellText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Hashtag</Text>
          <TextInput
            style={styles.tagInput}
            value={hashtagInput}
            onChangeText={setHashtagInput}
            placeholder="#cafe #thinking — cách bằng dấu phẩy hoặc khoảng trắng"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.tagSuggestRow}>
            {HASHTAG_SUGGESTIONS.map((tag) => {
              const active = activeTags.some((t) => t.toLowerCase() === tag.toLowerCase());
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleHashtag(tag)}
                  style={[styles.tagSuggest, active && styles.tagSuggestActive]}
                >
                  <Text style={[styles.tagSuggestText, active && styles.tagSuggestTextActive]}>
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.toolbar}>
          <ToolBtn icon="text" label="Aa" onPress={toggleUppercase} />
          <ToolBtn icon="list-outline" onPress={() => setBody((b) => `${b}${b && !b.endsWith('\n') ? '\n' : ''}• `)} />
          <View style={styles.toolSpacer} />
          <Pressable onPress={() => save(true)} style={styles.draftBtn}>
            <Text style={styles.draftLabel}>Lưu nháp</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ToolBtn({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toolBtn, active && styles.toolBtnActive]}
      hitSlop={6}
    >
      {label ? (
        <Text style={styles.toolBtnText}>{label}</Text>
      ) : (
        <Ionicons name={icon} size={20} color={colors.textPrimary} />
      )}
    </Pressable>
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
  },
  saveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  saveBtnPressed: { opacity: 0.85 },
  saveLabel: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1,
  },
  scrollPad: { padding: spacing.lg, paddingBottom: spacing.xxl },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  dayBig: {
    ...typography.display,
    fontSize: 56,
    color: colors.textPrimary,
    lineHeight: 60,
    fontWeight: '700',
  },
  dateRight: { marginLeft: spacing.sm, marginBottom: 8 },
  month: { ...typography.body, color: colors.textSecondary },
  year: { ...typography.caption, color: colors.textMuted },
  spacer: { flex: 1 },
  moodBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: { fontSize: 26 },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  moodCell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodCellActive: { backgroundColor: colors.accentSoft },
  moodCellEmoji: { fontSize: 22 },
  titleInput: {
    ...typography.title,
    fontSize: 22,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  bodyInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 200,
    lineHeight: 24,
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  promptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
  },
  promptEmoji: { fontSize: 14 },
  promptLabel: { ...typography.caption, color: colors.textPrimary },
  tagInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellText: { fontSize: 22 },
  tagSuggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tagSuggest: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagSuggestActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  tagSuggestText: { ...typography.caption, color: colors.textSecondary, fontSize: 13 },
  tagSuggestTextActive: { color: colors.textPrimary, fontWeight: '600' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: colors.accentSoft },
  toolBtnText: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  toolSpacer: { flex: 1 },
  draftBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  draftLabel: { ...typography.caption, color: colors.textPrimary },
});
