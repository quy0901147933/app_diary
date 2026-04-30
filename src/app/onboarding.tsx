import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
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
import { useSavePersona, useUserPersona } from '@/hooks/use-persona';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, spacing, typography } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const AGE_OPTIONS = [
  { key: 'student', emoji: '📚', label: 'Sinh viên / Đi học', hint: 'Áp lực deadline, đồ án' },
  { key: 'young-adult', emoji: '✨', label: 'Mới đi làm', hint: 'Tự lập, định hình mình' },
  { key: 'working', emoji: '💼', label: 'Đi làm ổn định', hint: 'Cân bằng đời sống' },
  { key: 'parent', emoji: '👨‍👩‍👧', label: 'Có gia đình', hint: 'Bận rộn, ít thời gian riêng' },
  { key: 'senior', emoji: '🌿', label: 'Trung niên / Lớn tuổi', hint: 'Sống chậm, suy ngẫm' },
];

const INTERESTS = [
  '#Code', '#NgheNhạcLofi', '#ChơiGame', '#ĐọcSách', '#Cafe', '#PhimẢnh',
  '#NấuĂn', '#ChụpẢnh', '#DuLịch', '#YogaThiền', '#TậpGym', '#HọcNgoạiNgữ',
  '#VẽVời', '#Anime', '#KPop', '#BóngĐá', '#Chó/Mèo', '#ThiênNhiên',
];

const GOALS = [
  { key: 'tam-su', emoji: '💬', label: 'Cần người tâm sự', hint: 'Có ai đó lắng nghe' },
  { key: 'xa-stress', emoji: '🧘', label: 'Xả stress', hint: 'Trút bớt áp lực' },
  { key: 'luu-ky-niem', emoji: '📔', label: 'Lưu kỷ niệm', hint: 'Nhật ký ảnh đẹp' },
  { key: 'tu-phat-trien', emoji: '🌱', label: 'Tự phát triển', hint: 'Phản chiếu, tiến bộ' },
];

const AI_GENDERS = [
  { key: 'female', emoji: '🌸', label: 'Nữ' },
  { key: 'male', emoji: '🌟', label: 'Nam' },
  { key: 'neutral', emoji: '🌈', label: 'Phi giới tính' },
];

const AI_RELATIONSHIPS = [
  { key: 'best_friend', emoji: '🤝', label: 'Bạn thân', hint: 'Cà khịa, vui vẻ, ngang hàng' },
  { key: 'lover', emoji: '💗', label: 'Người thương', hint: 'Nhẹ nhàng, quan tâm, dỗ dành' },
  { key: 'mentor', emoji: '🦉', label: 'Tiền bối', hint: 'Định hướng, nghiêm khắc' },
];

const AI_SOUL_AGES = [
  { key: 'peer', emoji: '🫶', label: 'Bằng tuổi', hint: 'Ngang hàng' },
  { key: 'older', emoji: '🌳', label: 'Lớn hơn', hint: 'Trưởng thành, vững chãi' },
  { key: 'younger', emoji: '🐣', label: 'Nhỏ hơn', hint: 'Đáng yêu, hồn nhiên' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const saveMut = useSavePersona(userId);
  const existing = useUserPersona(userId).data;
  const isEdit = !!existing?.completed_at;
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);

  const [nickname, setNickname] = useState('');
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [goal, setGoal] = useState<string | null>(null);
  const [aiGender, setAiGender] = useState<string | null>(null);
  const [aiRelationship, setAiRelationship] = useState<string | null>(null);
  const [aiEnergy, setAiEnergy] = useState(0);
  const [aiStyle, setAiStyle] = useState(-25);
  const [aiSoulAge, setAiSoulAge] = useState<string>('peer');
  const [hydrated, setHydrated] = useState(false);

  // Pre-fill from existing persona when editing.
  useEffect(() => {
    if (!existing || hydrated) return;
    if (existing.user_nickname) setNickname(existing.user_nickname);
    if (existing.user_age_group) setAgeGroup(existing.user_age_group);
    if (existing.user_interests && existing.user_interests.length > 0) {
      setInterests(existing.user_interests);
    }
    if (existing.user_goal) setGoal(existing.user_goal);
    if (existing.ai_gender) setAiGender(existing.ai_gender);
    if (existing.ai_relationship) setAiRelationship(existing.ai_relationship);
    if (typeof existing.ai_energy === 'number') setAiEnergy(existing.ai_energy);
    if (typeof existing.ai_response_style === 'number') setAiStyle(existing.ai_response_style);
    if (existing.ai_soul_age) setAiSoulAge(existing.ai_soul_age);
    setHydrated(true);
  }, [existing, hydrated]);

  const totalSteps = 7;

  function goTo(next: number) {
    const target = Math.max(0, Math.min(totalSteps - 1, next));
    setStep(target);
    scrollRef.current?.scrollTo({ x: target * SCREEN_W, animated: true });
  }

  function toggleInterest(tag: string) {
    setInterests((curr) =>
      curr.includes(tag)
        ? curr.filter((t) => t !== tag)
        : curr.length >= 3
          ? curr
          : [...curr, tag],
    );
  }

  const canAdvance = (() => {
    switch (step) {
      case 0: return true;
      case 1: return nickname.trim().length > 0 && !!ageGroup;
      case 2: return interests.length >= 1;
      case 3: return !!goal;
      case 4: return !!aiGender && !!aiRelationship;
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  })();

  async function finish() {
    try {
      await saveMut.mutateAsync({
        user_nickname: nickname.trim() || null,
        user_age_group: ageGroup,
        user_interests: interests,
        user_goal: goal,
        ai_gender: aiGender as 'female' | 'male' | 'neutral' | null,
        ai_relationship: aiRelationship as 'best_friend' | 'lover' | 'mentor' | null,
        ai_energy: aiEnergy,
        ai_response_style: aiStyle,
        ai_soul_age: aiSoulAge as 'peer' | 'older' | 'younger',
        completed_at: existing?.completed_at ?? new Date().toISOString(),
      });
      if (isEdit) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (e) {
      Alert.alert('Lỗi lưu', e instanceof Error ? e.message : 'Thử lại nhé.');
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.progressRow}>
        {isEdit ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Đóng"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <View style={styles.dotsHost}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i <= step && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.closeBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
        >
          {/* 0. Welcome */}
          <Page>
            <Text style={styles.hero}>✨</Text>
            <Text style={styles.title}>
              {isEdit ? 'Chỉnh lại bộ gen\ncủa Lumina' : 'Chào bạn,\nmình là Lumina.'}
            </Text>
            <Text style={styles.subtitle}>
              {isEdit
                ? 'Bạn có thể đổi tên gọi, sở thích, mối quan hệ và tính cách của Lumina bất kỳ lúc nào. Các giá trị hiện tại đã được điền sẵn.'
                : 'Để mình hiểu bạn hơn — và trở thành người bạn đồng hành mà bạn cần — hãy dành 1 phút kể mình nghe vài điều nhé.'}
            </Text>
          </Page>

          {/* 1. Tên + tuổi */}
          <Page>
            <Text style={styles.title}>Mình gọi bạn là gì?</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Khoa, Linh, sếp…"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.sectionLabel}>Bạn đang ở giai đoạn nào?</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {AGE_OPTIONS.map((o) => (
                <SelectCard
                  key={o.key}
                  emoji={o.emoji}
                  label={o.label}
                  hint={o.hint}
                  active={ageGroup === o.key}
                  onPress={() => setAgeGroup(o.key)}
                />
              ))}
            </ScrollView>
          </Page>

          {/* 2. Sở thích */}
          <Page>
            <Text style={styles.title}>Sở thích của bạn</Text>
            <Text style={styles.subtitle}>
              Chọn 1-3 tag — để mình biết câu chuyện nào sẽ khiến bạn vui.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.tagWrap}>
                {INTERESTS.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => toggleInterest(t)}
                    style={[styles.tag, interests.includes(t) && styles.tagActive]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        interests.includes(t) && styles.tagTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helper}>Đã chọn {interests.length}/3</Text>
            </ScrollView>
          </Page>

          {/* 3. Mục tiêu */}
          <Page>
            <Text style={styles.title}>Bạn muốn dùng Lumina vì…</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {GOALS.map((g) => (
                <SelectCard
                  key={g.key}
                  emoji={g.emoji}
                  label={g.label}
                  hint={g.hint}
                  active={goal === g.key}
                  onPress={() => setGoal(g.key)}
                />
              ))}
            </ScrollView>
          </Page>

          {/* 4. AI gender + relationship */}
          <Page>
            <Text style={styles.title}>Mình sẽ là ai?</Text>
            <Text style={styles.sectionLabel}>Giới tính</Text>
            <View style={styles.genderRow}>
              {AI_GENDERS.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setAiGender(g.key)}
                  style={[styles.genderCell, aiGender === g.key && styles.genderCellActive]}
                >
                  <Text style={styles.genderEmoji}>{g.emoji}</Text>
                  <Text style={styles.genderLabel}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Mối quan hệ</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {AI_RELATIONSHIPS.map((r) => (
                <SelectCard
                  key={r.key}
                  emoji={r.emoji}
                  label={r.label}
                  hint={r.hint}
                  active={aiRelationship === r.key}
                  onPress={() => setAiRelationship(r.key)}
                />
              ))}
            </ScrollView>
          </Page>

          {/* 5. Personality sliders + soul age */}
          <Page>
            <Text style={styles.title}>Tính cách & độ tuổi tâm hồn</Text>
            <Slider
              label="Năng lượng"
              left="Trầm tĩnh"
              right="Tăng động"
              value={aiEnergy}
              onChange={setAiEnergy}
            />
            <Slider
              label="Phản hồi"
              left="Lắng nghe chữa lành"
              right="Cà khịa hài hước"
              value={aiStyle}
              onChange={setAiStyle}
            />
            <Text style={styles.sectionLabel}>Độ tuổi tâm hồn</Text>
            <View style={styles.genderRow}>
              {AI_SOUL_AGES.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => setAiSoulAge(s.key)}
                  style={[styles.genderCell, aiSoulAge === s.key && styles.genderCellActive]}
                >
                  <Text style={styles.genderEmoji}>{s.emoji}</Text>
                  <Text style={styles.genderLabel}>{s.label}</Text>
                  <Text style={styles.genderHint}>{s.hint}</Text>
                </Pressable>
              ))}
            </View>
          </Page>

          {/* 6. Summary */}
          <Page>
            <Text style={styles.title}>Bộ gen của Lumina</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLine}>
                Mình sẽ gọi bạn là <Text style={styles.summaryHi}>{nickname || '…'}</Text>.
              </Text>
              <Text style={styles.summaryLine}>
                Mình là <Text style={styles.summaryHi}>{describeRelationship(aiGender, aiRelationship)}</Text>{' '}
                — {describePersonality(aiEnergy, aiStyle)}, {soulAgeLabel(aiSoulAge)}.
              </Text>
              <Text style={styles.summaryLine}>
                Bạn đang {ageGroupLabel(ageGroup)}, dùng nhật ký để{' '}
                <Text style={styles.summaryHi}>{goalLabel(goal)}</Text>.
              </Text>
              <Text style={styles.summaryLine}>
                Sở thích: {interests.join(' ') || '—'}.
              </Text>
            </View>
            <Pressable
              onPress={finish}
              disabled={saveMut.isPending}
              style={[styles.cta, saveMut.isPending && styles.ctaDisabled]}
            >
              <Text style={styles.ctaLabel}>
                {saveMut.isPending
                  ? 'Đang lưu…'
                  : isEdit
                    ? 'Cập nhật bộ gen ✨'
                    : 'Bắt đầu hành trình ✨'}
              </Text>
            </Pressable>
          </Page>
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable onPress={() => goTo(step - 1)} style={styles.footerBack}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              <Text style={styles.footerBackLabel}>Quay lại</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {step < totalSteps - 1 ? (
            <Pressable
              onPress={() => goTo(step + 1)}
              disabled={!canAdvance}
              style={[styles.footerNext, !canAdvance && styles.footerNextDisabled]}
            >
              <Text style={styles.footerNextLabel}>Tiếp</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
            </Pressable>
          ) : (
            <View />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <View style={[styles.page, { width: SCREEN_W }]}>{children}</View>;
}

function SelectCard({
  emoji,
  label,
  hint,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  hint?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.selectCard, active && styles.selectCardActive]}
    >
      <Text style={styles.selectEmoji}>{emoji}</Text>
      <View style={styles.selectTextHost}>
        <Text style={styles.selectLabel}>{label}</Text>
        {hint ? <Text style={styles.selectHint}>{hint}</Text> : null}
      </View>
      {active ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
      ) : null}
    </Pressable>
  );
}

function Slider({
  label,
  left,
  right,
  value,
  onChange,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // Discrete 5-step slider via tap on cells (no native slider dependency)
  const steps = [-50, -25, 0, 25, 50];
  return (
    <View style={styles.sliderHost}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        {steps.map((v) => (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={[styles.sliderCell, value === v && styles.sliderCellActive]}
          />
        ))}
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{left}</Text>
        <Text style={styles.sliderLabel}>{right}</Text>
      </View>
    </View>
  );
}

function describeRelationship(gender: string | null, rel: string | null): string {
  const base = rel === 'lover' ? 'người thương' : rel === 'mentor' ? 'tiền bối' : 'người bạn';
  const g = gender === 'female' ? 'nữ' : gender === 'male' ? 'nam' : 'thân thiện';
  return `${base} ${g}`;
}

function describePersonality(energy: number, style: number): string {
  const e = energy < -10 ? 'trầm tĩnh' : energy > 10 ? 'tăng động' : 'cân bằng';
  const s = style < -10 ? 'lắng nghe & chữa lành' : style > 10 ? 'cà khịa hài hước' : 'điềm đạm';
  return `${e}, ${s}`;
}

function soulAgeLabel(s: string): string {
  return s === 'older' ? 'lớn hơn bạn' : s === 'younger' ? 'nhỏ hơn bạn' : 'cùng tuổi';
}

function ageGroupLabel(a: string | null): string {
  return AGE_OPTIONS.find((o) => o.key === a)?.label.toLowerCase() ?? '…';
}

function goalLabel(g: string | null): string {
  return GOALS.find((x) => x.key === g)?.label.toLowerCase() ?? '…';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dotsHost: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 28,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.accent },
  page: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  hero: { fontSize: 64, textAlign: 'center', marginVertical: spacing.lg },
  title: {
    ...typography.display,
    fontSize: 28,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  input: {
    ...typography.title,
    fontSize: 22,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  selectCardActive: { backgroundColor: colors.accentSoft },
  selectEmoji: { fontSize: 26 },
  selectTextHost: { flex: 1 },
  selectLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  selectHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  tagActive: { backgroundColor: colors.accent },
  tagText: { ...typography.body, color: colors.textPrimary },
  tagTextActive: { color: colors.textInverse, fontWeight: '600' },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  genderCell: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    gap: 4,
  },
  genderCellActive: { backgroundColor: colors.accentSoft },
  genderEmoji: { fontSize: 28 },
  genderLabel: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  genderHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  sliderHost: { marginBottom: spacing.lg },
  sliderRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  sliderCell: {
    flex: 1,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  sliderCellActive: { backgroundColor: colors.accent },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { ...typography.caption, color: colors.textMuted },
  summaryCard: {
    padding: spacing.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  summaryLine: { ...typography.body, color: colors.textPrimary, lineHeight: 24 },
  summaryHi: { color: colors.accent, fontWeight: '700' },
  cta: {
    paddingVertical: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: colors.accentSoft },
  ctaLabel: { ...typography.body, fontWeight: '700', color: colors.textInverse },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footerBackLabel: { ...typography.body, color: colors.textPrimary },
  footerNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  footerNextDisabled: { backgroundColor: colors.accentSoft },
  footerNextLabel: { ...typography.body, fontWeight: '700', color: colors.textInverse },
});
