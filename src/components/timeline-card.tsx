import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { DailyBlog } from '@/types';

type Props = {
  blog: DailyBlog;
  location?: string | null;
};

export function TimelineCard({ blog, location }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  function confirmDelete() {
    Alert.alert(
      'Xoá ký ức này?',
      'Blog ngày này sẽ biến mất khỏi nhật ký. Hành động không thể hoàn tác.',
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
      const { error } = await supabase.from('daily_blogs').delete().eq('id', blog.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['archive', blog.user_id] });
      setOpen(false);
    } catch (e) {
      Alert.alert('Không xoá được', e instanceof Error ? e.message : 'Thử lại sau nhé.');
    } finally {
      setDeleting(false);
    }
  }
  const summary = (blog.body_md ?? '').replace(/[#*_`>]/g, '').slice(0, 200);
  const cover = blog.cover_photo_urls ?? [];
  const { day, monthLine, fullDate } = splitDate(blog.date);

  return (
    <Animated.View entering={FadeInUp.duration(280)} style={styles.card}>
      <Pressable
        onPress={() => setOpen(true)}
        onLongPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={`Xem chi tiết ngày ${fullDate} — nhấn giữ để xoá`}
        style={({ pressed }) => [styles.inner, pressed && styles.pressed]}
      >
        <View style={styles.headerRow}>
          <View style={styles.folderRow}>
            <Text style={styles.folderEmoji}>📔</Text>
            <Text style={styles.folder}>Nhật ký</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dayNum}>{day}</Text>
            <Text style={styles.monthLine}>{monthLine}</Text>
          </View>
        </View>

        {location ? (
          <View style={styles.locHero}>
            <Ionicons name="location" size={16} color={colors.accent} />
            <Text style={styles.locHeroText} numberOfLines={1}>
              #{location.replace(/,\s*/g, ' · ')}
            </Text>
          </View>
        ) : null}

        {blog.title ? <Text style={styles.title}>{blog.title}</Text> : null}

        {summary ? (
          <Text style={styles.summary} numberOfLines={3}>
            {summary}
          </Text>
        ) : null}

        {cover.length > 0 ? (
          <View style={styles.thumbsRow}>
            {cover.slice(0, 3).map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
            ))}
          </View>
        ) : null}

        {blog.hashtags && blog.hashtags.length > 0 ? (
          <View style={styles.tagRow}>
            {blog.hashtags.slice(0, 4).map((t) => (
              <Text key={t} style={styles.tag}>
                {t.startsWith('#') ? t : `#${t}`}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footerRow}>
          {blog.mood_emoji ? <Text style={styles.mood}>{blog.mood_emoji}</Text> : null}
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingTop: insets.top + spacing.lg }]}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={styles.sheetDate}>{fullDate}</Text>
                {blog.title ? <Text style={styles.sheetTitle}>{blog.title}</Text> : null}
              </View>
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={confirmDelete}
                  hitSlop={12}
                  accessibilityLabel="Xoá ký ức"
                  disabled={deleting}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={deleting ? colors.textMuted : colors.danger}
                  />
                </Pressable>
                <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Đóng">
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.sheetBody}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
              showsVerticalScrollIndicator={false}
            >
              {cover.length > 0 ? (
                <View style={styles.sheetCovers}>
                  {cover.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.sheetCover} contentFit="cover" />
                  ))}
                </View>
              ) : null}

              {blog.body_md ? (
                <Text style={styles.sheetText}>
                  {blog.body_md.replace(/[#*_`>]/g, '').trim()}
                </Text>
              ) : null}

              {location ? (
                <View style={styles.sheetLocHero}>
                  <Ionicons name="location" size={18} color={colors.accent} />
                  <Text style={styles.sheetLocHeroText} numberOfLines={1}>
                    #{location.replace(/,\s*/g, ' · ')}
                  </Text>
                </View>
              ) : null}

              <View style={styles.sheetMetaRow}>
                {blog.mood_emoji ? <Text style={styles.sheetMood}>{blog.mood_emoji}</Text> : null}
              </View>

              {blog.hashtags && blog.hashtags.length > 0 ? (
                <View style={styles.tagRow}>
                  {blog.hashtags.map((t) => (
                    <Text key={t} style={styles.sheetTag}>
                      {t.startsWith('#') ? t : `#${t}`}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function splitDate(iso: string): { day: string; monthLine: string; fullDate: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return { day: iso, monthLine: '', fullDate: iso };
  const day = d.getDate().toString();
  const monthLine = `Tháng ${d.getMonth() + 1} · ${d.getFullYear()}`;
  const fullDate = `${day}/${d.getMonth() + 1}/${d.getFullYear()}`;
  return { day, monthLine, fullDate };
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
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  folderEmoji: { fontSize: 14 },
  folder: { ...typography.caption, color: colors.textSecondary },
  dateBlock: { alignItems: 'flex-end' },
  dayNum: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
    lineHeight: 26,
    fontWeight: '600',
  },
  monthLine: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  summary: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  tag: {
    ...typography.caption,
    color: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  mood: { fontSize: 18 },
  locHero: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  locHeroText: {
    ...typography.bodySm,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    fontSize: 14,
    letterSpacing: 0.2,
    maxWidth: 220,
  },
  sheetLocHero: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  sheetLocHeroText: {
    ...typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    fontSize: 16,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,15,0.55)',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sheetDate: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.textPrimary,
    fontSize: 20,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  sheetBody: {},
  sheetCovers: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sheetCover: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  sheetText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  sheetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sheetMood: { fontSize: 22 },
  sheetTag: {
    ...typography.caption,
    color: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
  },
});
