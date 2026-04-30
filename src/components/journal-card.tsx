import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { JournalEntry } from '@/types';

type Props = {
  entry: JournalEntry;
  onPress?: () => void;
};

export function JournalCard({ entry, onPress }: Props) {
  const summary = (entry.body_md ?? '').replace(/[#*_`>]/g, '').slice(0, 200);
  const { day, monthYear } = splitDate(entry.entry_date);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  function confirmDelete() {
    Alert.alert(
      'Xoá trang nhật ký này?',
      'Trang viết sẽ biến mất khỏi nhật ký. Hành động không thể hoàn tác.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: doDelete },
      ],
    );
  }

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['journal', entry.user_id] });
    } catch (e) {
      Alert.alert('Không xoá được', e instanceof Error ? e.message : 'Thử lại sau nhé.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Animated.View entering={FadeInUp.duration(280)} style={styles.card}>
      <Pressable
        onPress={onPress}
        onLongPress={confirmDelete}
        disabled={!onPress}
        style={({ pressed }) => [styles.inner, pressed && onPress && styles.pressed]}
      >
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Ionicons name="create-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.badgeText}>
              Tự viết{entry.is_draft ? ' · Bản nháp' : ''}
            </Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dayNum}>{day}</Text>
            <Text style={styles.monthYear}>{monthYear}</Text>
          </View>
        </View>

        {entry.title ? <Text style={styles.title}>{entry.title}</Text> : null}

        {summary ? (
          <Text style={styles.summary} numberOfLines={3}>
            {summary}
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          {entry.mood_emoji ? <Text style={styles.mood}>{entry.mood_emoji}</Text> : null}
          {entry.hashtags && entry.hashtags.length > 0 ? (
            <View style={styles.tagRow}>
              {entry.hashtags.slice(0, 3).map((t) => (
                <Text key={t} style={styles.tag}>
                  {t.startsWith('#') ? t : `#${t}`}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>

    </Animated.View>
  );
}

function splitDate(iso: string): { day: string; monthYear: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return { day: iso, monthYear: '' };
  return { day: d.getDate().toString(), monthYear: `Th${d.getMonth() + 1} · ${d.getFullYear()}` };
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    ...shadow.card,
  },
  inner: { padding: spacing.lg },
  pressed: { opacity: 0.95 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: { ...typography.caption, color: colors.textSecondary },
  dateBlock: { alignItems: 'flex-end' },
  dayNum: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
    lineHeight: 26,
    fontWeight: '600',
  },
  monthYear: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  title: { ...typography.title, color: colors.textPrimary, marginTop: spacing.xs },
  summary: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.sm },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  mood: { fontSize: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, flex: 1 },
  tag: {
    ...typography.caption,
    color: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
  },
});
