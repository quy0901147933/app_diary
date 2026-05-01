import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoodChart } from '@/components/mood-chart';
import { MoodMessageCard } from '@/components/mood-message-card';
import { useMoodChart } from '@/hooks/use-mood-chart';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, spacing, typography } from '@/theme';

export default function MoodScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const query = useMoodChart(userId);

  const refreshing = query.isFetching && !query.isLoading;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bản đồ tâm trạng</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        {query.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.hint}>
              Đang tổng hợp 7 ngày…
              {'\n'}
              <Text style={styles.hintMuted}>
                Lần đầu mở có thể đợi ~30s nếu server vừa nghỉ.
              </Text>
            </Text>
          </View>
        ) : query.isError ? (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
            <Text style={styles.errorTitle}>Chưa lấy được dữ liệu</Text>
            <Text style={styles.errorHint}>
              {query.error instanceof Error ? query.error.message : 'Thử lại sau nhé.'}
            </Text>
            <Pressable style={styles.retry} onPress={() => void query.refetch()}>
              <Text style={styles.retryLabel}>Thử lại</Text>
            </Pressable>
          </View>
        ) : query.data ? (
          <>
            <MoodChart days={query.data.days} />
            <MoodMessageCard message={query.data.message} />
            <DominantEmotionsRow days={query.data.days} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DominantEmotionsRow({
  days,
}: {
  days: { label: string; dominant_emotion: string | null }[];
}) {
  const tags = days.filter((d) => d.dominant_emotion);
  if (tags.length === 0) return null;
  return (
    <View style={styles.tagsCard}>
      <Text style={styles.tagsTitle}>Cảm xúc chủ đạo từng ngày</Text>
      <View style={styles.tagRow}>
        {tags.map((d) => (
          <View key={d.label} style={styles.tag}>
            <Text style={styles.tagWeek}>{d.label}</Text>
            <Text style={styles.tagEmotion}>{d.dominant_emotion}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  center: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.md },
  hint: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  hintMuted: { ...typography.caption, color: colors.textMuted },
  errorBox: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorTitle: { ...typography.title, fontSize: 16, color: colors.textPrimary },
  errorHint: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  retryLabel: { ...typography.bodySm, color: colors.textInverse, fontWeight: '600' },

  tagsCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
  },
  tagsTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagWeek: { ...typography.caption, color: colors.textMuted },
  tagEmotion: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
});
