import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { DailyPhotoItem } from '@/components/daily-photo-item';
import { TimelineCard } from '@/components/timeline-card';
import { JournalCard } from '@/components/journal-card';
import { SkeletonCard } from '@/components/skeleton-card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { NewEntrySheet } from '@/components/new-entry-sheet';
import { useTodayPhotos } from '@/hooks/use-photos';
import { useArchive } from '@/hooks/use-archive';
import { useJournalEntries } from '@/hooks/use-journal';
import { usePackageDay, todayIsoDate } from '@/hooks/use-package-day';
import { PinPad } from '@/components/pin-pad';
import { useAuthStore } from '@/stores/auth-store';
import { usePrivacyStore } from '@/stores/privacy-store';
import { hasPin, verifyPin } from '@/services/privacy-lock';
import { formatHashtagFromExif, locationHashtagsFromExif } from '@/services/exif';
import { colors, radius, spacing, typography } from '@/theme';
import type { ExifData } from '@/types';

const TABS = [
  { key: 'today', label: 'Hành trình hôm nay' },
  { key: 'archive', label: 'Ký ức đã đóng gói' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'today' | 'archive'>('today');
  const userId = useAuthStore((s) => s.session?.user.id);

  const todayQuery = useTodayPhotos(userId);
  const archiveQuery = useArchive(userId);
  const journalQuery = useJournalEntries(userId);
  const packageMut = usePackageDay(userId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const archiveEnabled = usePrivacyStore((s) => s.enabled.archive);
  const archiveUnlocked = usePrivacyStore((s) => s.unlocked.archive);
  const unlockArchive = usePrivacyStore((s) => s.unlock);
  const setEnabledArchive = usePrivacyStore((s) => s.setEnabled);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(0);

  useEffect(() => {
    void hasPin('archive').then((exists) => setEnabledArchive('archive', exists));
  }, [setEnabledArchive]);

  async function tryUnlockArchive(pin: string) {
    const ok = await verifyPin('archive', pin);
    if (ok) {
      setPinError(null);
      unlockArchive('archive');
    } else {
      setPinError('PIN không đúng. Thử lại.');
      setPinReset((n) => n + 1);
    }
  }

  const archiveLocked = tab === 'archive' && archiveEnabled && !archiveUnlocked;

  type ArchiveItem =
    | { kind: 'ai'; key: string; date: string; blog: NonNullable<typeof archiveQuery.data>[number] }
    | { kind: 'journal'; key: string; date: string; entry: NonNullable<typeof journalQuery.data>[number] };

  const archiveItems: ArchiveItem[] = [
    ...(archiveQuery.data ?? []).map((b) => ({
      kind: 'ai' as const,
      key: `ai-${b.id}`,
      date: b.date,
      blog: b,
    })),
    ...(journalQuery.data ?? []).map((j) => ({
      kind: 'journal' as const,
      key: `j-${j.id}`,
      date: j.entry_date,
      entry: j,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: ['photos', 'today', userId] });
      void queryClient.invalidateQueries({ queryKey: ['archive', userId] });
    }, [queryClient, userId]),
  );

  async function packageToday() {
    try {
      await packageMut.mutateAsync(todayIsoDate());
      Alert.alert('Đã gói ghém', 'Hôm nay đã được Lumina viết thành một câu chuyện.');
      setTab('archive');
    } catch (e) {
      Alert.alert('Chưa thể gói ghém', e instanceof Error ? e.message : 'Thử lại sau nhé.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>Lumina</Text>
        <Pressable onPress={() => router.push('/profile')} hitSlop={12} accessibilityLabel="Của tôi">
          <Ionicons name="person-circle-outline" size={28} color={colors.textPrimary} />
        </Pressable>
      </View>

      <SegmentedTabs
        options={TABS}
        value={tab}
        onChange={(k) => setTab(k as 'today' | 'archive')}
      />

      {archiveLocked ? (
        <View style={styles.lockedPane}>
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={26} color={colors.accent} />
          </View>
          <PinPad
            title="Mở khóa Ký ức"
            subtitle="Nhập PIN 6 số để xem ký ức đã đóng gói."
            error={pinError}
            resetSignal={pinReset}
            onComplete={tryUnlockArchive}
          />
        </View>
      ) : tab === 'today' ? (
        todayQuery.isLoading ? (
          <View style={styles.skeletonCol}>
            <SkeletonCard />
            <SkeletonCard height={220} />
          </View>
        ) : (todayQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Hôm nay chưa có khoảnh khắc nào"
            hint="Bắt đầu bằng một bức ảnh — Lumina sẽ ngắm cùng bạn."
            cta={{ label: 'Lưu khoảnh khắc đầu tiên', onPress: () => router.push('/capture') }}
          />
        ) : (
          <FlatList
            data={todayQuery.data}
            keyExtractor={(p) => p.id}
            refreshControl={
              <RefreshControl
                refreshing={todayQuery.isFetching && !todayQuery.isLoading}
                onRefresh={() => void todayQuery.refetch()}
                tintColor={colors.accent}
              />
            }
            renderItem={({ item }) => (
              <DailyPhotoItem
                photo={item}
                hashtags={formatHashtagFromExif((item.exif ?? {}) as ExifData)}
                locationHashtags={locationHashtagsFromExif((item.exif ?? {}) as ExifData)}
              />
            )}
            ListFooterComponent={
              <Pressable
                style={[styles.packBtn, packageMut.isPending && styles.packBtnPending]}
                onPress={packageToday}
                disabled={packageMut.isPending}
              >
                <Ionicons name="sparkles" size={16} color={colors.textInverse} />
                <Text style={styles.packLabel}>
                  {packageMut.isPending ? 'Đang gói ghém…' : 'Gói ghém ngày hôm nay'}
                </Text>
              </Pressable>
            }
            contentContainerStyle={styles.listPad}
          />
        )
      ) : archiveQuery.isLoading ? (
        <View style={styles.skeletonCol}>
          <SkeletonCard height={180} />
          <SkeletonCard height={180} />
        </View>
      ) : archiveItems.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="Hành trình của bạn sẽ xuất hiện ở đây"
          hint="Mỗi tối lúc 22:00, Lumina sẽ tự gói ghém ngày của bạn — hoặc tự viết một trang nhật ký bằng nút + ở góc phải."
        />
      ) : (
        <FlatList
          data={archiveItems}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.kind === 'ai' ? (
              <TimelineCard blog={item.blog} location={item.blog.location_text} />
            ) : (
              <JournalCard
                entry={item.entry}
                onPress={() => router.push({ pathname: '/journal-editor', params: { id: item.entry.id } })}
              />
            )
          }
          contentContainerStyle={styles.listPad}
        />
      )}

      <Fab
        icon="add"
        label="Mới"
        variant="primary"
        position="right"
        onPress={() => setSheetOpen(true)}
      />
      <Fab
        icon="chatbubbles-outline"
        variant="secondary"
        position="left"
        onPress={() => router.push('/chat')}
      />

      <NewEntrySheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPickAi={() => {
          setSheetOpen(false);
          router.push('/capture');
        }}
        onPickWrite={() => {
          setSheetOpen(false);
          router.push('/journal-editor');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  brand: {
    ...typography.display,
    color: colors.textPrimary,
    fontSize: 28,
  },
  skeletonCol: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  listPad: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + 60,
  },
  packBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  packBtnPending: { opacity: 0.7 },
  packLabel: { ...typography.bodySm, fontWeight: '600', color: colors.textInverse },
  lockedPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
