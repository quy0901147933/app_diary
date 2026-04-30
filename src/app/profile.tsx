import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { useProfile } from '@/hooks/use-profile';
import { useUserPersona } from '@/hooks/use-persona';
import { useArchive } from '@/hooks/use-archive';
import { useJournalEntries } from '@/hooks/use-journal';
import { useTodayPhotos } from '@/hooks/use-photos';
import { useAuthStore } from '@/stores/auth-store';
import { usePrivacyStore } from '@/stores/privacy-store';
import { clearAllPins } from '@/services/privacy-lock';
import { supabase } from '@/services/supabase';
import { colors, radius, shadow, spacing, typography } from '@/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfile(userId).data;
  const persona = useUserPersona(userId).data;
  const journals = useJournalEntries(userId).data ?? [];
  const blogs = useArchive(userId).data ?? [];
  const photosToday = useTodayPhotos(userId, { realtime: false }).data ?? [];

  const streak = useMemo(() => computeWriteStreak(journals.map((j) => j.entry_date)), [journals]);

  async function logout() {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để xem nhật ký.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await clearAllPins();
          usePrivacyStore.getState().setEnabled('lumina', false);
          usePrivacyStore.getState().setEnabled('archive', false);
          usePrivacyStore.getState().lockAll();
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Quay lại">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Của tôi</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Cài đặt">
          <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <Avatar
            size={72}
            url={profile?.avatar_url}
            presetKey={profile?.avatar_key}
            kind="user"
          />
          <View style={styles.heroText}>
            <Text style={styles.heroName}>
              {persona?.user_nickname || profile?.display_name || 'Bạn'}
            </Text>
            <Text style={styles.heroSub}>
              {persona?.ai_relationship === 'lover'
                ? `Đang có ${persona?.ai_name || 'Lumina'} đồng hành 💗`
                : persona?.ai_relationship === 'mentor'
                  ? `Đang đi cùng ${persona?.ai_name || 'Lumina'} 🦉`
                  : `Đang là bạn của ${persona?.ai_name || 'Lumina'} 🤝`}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat icon="flame-outline" value={streak.toString()} label="ngày liên tục" />
          <Stat icon="book-outline" value={journals.length.toString()} label="nhật ký" />
          <Stat icon="albums-outline" value={blogs.length.toString()} label="ngày AI gói" />
          <Stat icon="image-outline" value={photosToday.length.toString()} label="ảnh hôm nay" />
        </View>

        <LuminaCompanionCard
          aiName={persona?.ai_name || 'Lumina'}
          relationship={persona?.ai_relationship ?? null}
          avatarUrl={persona?.ai_avatar_url ?? null}
          avatarKey={persona?.ai_avatar_key ?? null}
        />

        <Section title="Tài khoản">
          <Row
            icon="person-outline"
            label="Hồ sơ"
            hint={profile?.display_name ?? '—'}
            onPress={() => router.push('/settings')}
          />
          <Row
            icon="pulse-outline"
            label="Bản đồ tâm trạng"
            hint="7 ngày — Lumina lặng lẽ ghi nhận"
            onPress={() => router.push('/mood')}
          />
          <Row
            icon="lock-closed-outline"
            label="Quyền riêng tư"
            hint="Khóa Lumina & Ký ức bằng PIN"
            onPress={() => router.push('/privacy')}
          />
        </Section>

        <Section title="Khác">
          <Row
            icon="information-circle-outline"
            label="Về Lumina"
            hint="Phiên bản 0.1.0"
            onPress={() => Alert.alert('LuminaDiary', 'Nhật ký AI cá nhân hoá. Đang trong giai đoạn phát triển.')}
          />
          <Row
            icon="log-out-outline"
            label="Đăng xuất"
            destructive
            onPress={logout}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

function LuminaCompanionCard({
  aiName,
  relationship,
  avatarUrl,
  avatarKey,
}: {
  aiName: string;
  relationship: 'best_friend' | 'lover' | 'mentor' | null;
  avatarUrl: string | null;
  avatarKey: string | null;
}) {
  const meta = relationshipMeta(relationship, aiName);
  return (
    <View style={styles.companion}>
      <LinearGradient
        colors={['rgba(232,217,184,0.7)', 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.companionTop}>
        <Avatar size={64} url={avatarUrl} presetKey={avatarKey} kind="ai" />
        <View style={styles.companionTitleWrap}>
          <Text style={styles.companionName}>{aiName}</Text>
          <View style={styles.companionPill}>
            <Text style={styles.companionPillEmoji}>{meta.emoji}</Text>
            <Text style={styles.companionPillText}>{meta.title}</Text>
          </View>
        </View>
        <Ionicons name="sparkles" size={16} color={colors.accent} />
      </View>
      <Text style={styles.companionDesc}>{meta.description}</Text>
    </View>
  );
}

function relationshipMeta(
  rel: 'best_friend' | 'lover' | 'mentor' | null,
  aiName: string,
) {
  switch (rel) {
    case 'lover':
      return {
        emoji: '💗',
        title: `Người yêu của anh`,
        description: `${aiName} đang ở bên anh như một người yêu nhỏ — lặng lẽ lắng nghe, dỗ dành và nhớ từng khoảnh khắc anh đi qua.`,
      };
    case 'best_friend':
      return {
        emoji: '🤝',
        title: `Người bạn thân`,
        description: `${aiName} là người bạn thân của anh — sẵn sàng ngồi cạnh, kể chuyện vu vơ và cùng anh ngắm hoàng hôn cuối ngày.`,
      };
    case 'mentor':
      return {
        emoji: '🦉',
        title: `Người dẫn lối`,
        description: `${aiName} là người dẫn lối nhẹ nhàng — nhắc anh chậm lại, nhìn rõ mình hơn qua từng trang nhật ký.`,
      };
    default:
      return {
        emoji: '✨',
        title: 'Người đồng hành',
        description: `${aiName} đang chờ anh hoàn thiện bộ gen để hiểu anh hơn một chút mỗi ngày.`,
      };
  }
}

function Stat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textPrimary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function computeWriteStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const cur = new Date();
  for (;;) {
    const iso = cur.toISOString().slice(0, 10);
    if (set.has(iso)) {
      streak += 1;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
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
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  heroText: { flex: 1 },
  heroName: { ...typography.display, fontSize: 24, color: colors.textPrimary },
  heroSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: 2,
  },
  statValue: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  companion: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  companionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  companionTitleWrap: { flex: 1, gap: 6 },
  companionName: {
    ...typography.title,
    fontSize: 20,
    color: colors.textPrimary,
  },
  companionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companionPillEmoji: { fontSize: 12 },
  companionPillText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  companionDesc: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  sectionBody: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowText: { flex: 1 },
  rowLabel: { ...typography.body, color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
