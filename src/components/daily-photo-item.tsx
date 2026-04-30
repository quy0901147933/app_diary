import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { PHOTO_BUCKET, supabase } from '@/services/supabase';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import { GlassOverlay } from './glass-overlay';
import { SparkleEffect } from './sparkle-effect';
import type { Photo } from '@/types';

type Props = {
  photo: Photo;
  hashtags: string[]; // EXIF-derived fallback (#location #time)
  locationHashtags?: string[]; // always-on #City #Country
};

export function DailyPhotoItem({ photo, hashtags, locationHashtags = [] }: Props) {
  const aiReady = photo.status === 'ready' && !!photo.ai_commentary;
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const baseTags =
    photo.ai_hashtags && photo.ai_hashtags.length > 0 ? photo.ai_hashtags : hashtags;
  const displayTags = Array.from(new Set([...locationHashtags, ...baseTags]));
  const timeLabel = formatTime(photo.taken_at ?? photo.created_at);

  function confirmDelete() {
    Alert.alert(
      'Xoá khoảnh khắc này?',
      'Hành động này không thể hoàn tác. Ảnh sẽ bị xoá khỏi nhật ký.',
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
      const objectPath = extractStorageKey(photo.storage_path);
      if (objectPath) {
        await supabase.storage.from(PHOTO_BUCKET).remove([objectPath]);
      }
      const { error } = await supabase.from('photos').delete().eq('id', photo.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['photos', 'today', photo.user_id] });
      setOpen(false);
    } catch (e) {
      Alert.alert('Không xoá được', e instanceof Error ? e.message : 'Thử lại sau nhé.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Animated.View entering={FadeInUp.duration(320)} style={styles.card}>
      <View style={styles.timeRow}>
        <View style={styles.timePill}>
          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.timeText}>{timeLabel}</Text>
        </View>
        {photo.location_text ? (
          <View style={styles.locPill}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.timeText}>{photo.location_text}</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        onLongPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={aiReady ? 'Xem chi tiết khoảnh khắc' : 'AI đang phân tích — nhấn giữ để xoá'}
        style={({ pressed }) => [styles.cardInner, pressed && styles.cardPressed]}
      >
        <Image source={{ uri: photo.storage_path }} style={styles.image} contentFit="cover" />

        {!aiReady ? <SparkleEffect size={96} active /> : null}

        {aiReady ? (
          <View style={styles.overlayHost} pointerEvents="none">
            <GlassOverlay>
              <View style={styles.commentaryRow}>
                <Text style={styles.commentary} numberOfLines={2}>
                  {photo.ai_commentary}
                </Text>
                {photo.ai_mood ? <Text style={styles.mood}>{photo.ai_mood}</Text> : null}
              </View>
              {displayTags.length > 0 ? (
                <View style={styles.tagRow}>
                  {displayTags.map((t) => (
                    <Text key={t} style={styles.tag}>
                      {t}
                    </Text>
                  ))}
                </View>
              ) : null}
            </GlassOverlay>
          </View>
        ) : (
          <View style={styles.thinking}>
            <Text style={styles.thinkingText}>AI đang ngắm bức ảnh…</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {aiReady ? 'Lumina ngắm thấy…' : photo.status === 'failed' ? 'Chưa phân tích được' : 'Đang phân tích…'}
              </Text>
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={confirmDelete}
                  hitSlop={12}
                  accessibilityLabel="Xoá khoảnh khắc"
                  disabled={deleting}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={deleting ? colors.textMuted : colors.danger}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setOpen(false)}
                  hitSlop={12}
                  accessibilityLabel="Đóng"
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <Image source={{ uri: photo.storage_path }} style={styles.sheetImage} contentFit="cover" />

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {aiReady ? (
                <Text style={styles.sheetText}>{photo.ai_commentary}</Text>
              ) : photo.status === 'failed' ? (
                <Text style={styles.sheetTextMuted}>
                  Lumina chưa nhìn được bức ảnh này lần đầu — sẽ tự thử lại sau ít phút. Nếu vẫn không
                  được, bạn có thể xoá để giữ nhật ký gọn gàng.
                </Text>
              ) : (
                <Text style={styles.sheetTextMuted}>
                  Lumina đang ngắm bức ảnh này… Lời bình sẽ hiện trong giây lát.
                </Text>
              )}

              {displayTags.length > 0 || photo.ai_mood ? (
                <View style={styles.sheetTagRow}>
                  {displayTags.map((t) => (
                    <Text key={t} style={styles.sheetTag}>
                      {t}
                    </Text>
                  ))}
                  {photo.ai_mood ? <Text style={styles.sheetMood}>{photo.ai_mood}</Text> : null}
                </View>
              ) : null}

              {photo.note ? (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>Ghi chú của bạn</Text>
                  <Text style={styles.noteText}>{photo.note}</Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

function extractStorageKey(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return publicUrl.slice(idx + marker.length);
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardInner: {
    width: '100%',
  },
  cardPressed: {
    opacity: 0.92,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
  },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
  },
  timeText: { ...typography.caption, color: colors.textSecondary },
  commentaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: colors.surfaceAlt,
  },
  overlayHost: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  commentary: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tag: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  mood: {
    ...typography.caption,
    color: colors.accent,
  },
  thinking: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.overlay,
    borderRadius: radius.full,
  },
  thinkingText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,15,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.textPrimary,
  },
  sheetImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surfaceAlt,
  },
  sheetBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  sheetTextMuted: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sheetTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sheetTag: {
    ...typography.caption,
    color: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
  },
  sheetMood: {
    fontSize: 18,
    alignSelf: 'center',
  },
  noteBlock: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  noteLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  noteText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
