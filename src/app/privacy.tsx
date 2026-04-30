import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinPad } from '@/components/pin-pad';
import {
  hasPin,
  removePin,
  setPin as savePin,
  verifyPin,
  type LockKey,
} from '@/services/privacy-lock';
import { usePrivacyStore } from '@/stores/privacy-store';
import { colors, radius, spacing, typography } from '@/theme';

type Step =
  | { kind: 'idle' }
  | { kind: 'create-1'; key: LockKey }
  | { kind: 'create-2'; key: LockKey; first: string }
  | { kind: 'disable'; key: LockKey };

const LABEL: Record<LockKey, { title: string; hint: string }> = {
  lumina: {
    title: 'Khóa Lumina',
    hint: 'Yêu cầu PIN trước khi mở chatbox với Lumina',
  },
  archive: {
    title: 'Khóa Ký ức đã đóng gói',
    hint: 'Yêu cầu PIN trước khi xem ký ức AI đã đóng gói',
  },
};

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enabled = usePrivacyStore((s) => s.enabled);
  const setEnabled = usePrivacyStore((s) => s.setEnabled);
  const lockAll = usePrivacyStore((s) => s.lockAll);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    void Promise.all([hasPin('lumina'), hasPin('archive')]).then(([l, a]) => {
      setEnabled('lumina', l);
      setEnabled('archive', a);
    });
  }, [setEnabled]);

  function close() {
    setStep({ kind: 'idle' });
    setError(null);
    setResetSignal((n) => n + 1);
  }

  function onToggle(key: LockKey, next: boolean) {
    if (next) setStep({ kind: 'create-1', key });
    else setStep({ kind: 'disable', key });
  }

  async function handlePin(pin: string) {
    if (step.kind === 'create-1') {
      setStep({ kind: 'create-2', key: step.key, first: pin });
      setResetSignal((n) => n + 1);
      return;
    }
    if (step.kind === 'create-2') {
      if (pin !== step.first) {
        setError('PIN không khớp. Nhập lại.');
        setResetSignal((n) => n + 1);
        return;
      }
      await savePin(step.key, pin);
      setEnabled(step.key, true);
      lockAll();
      close();
      return;
    }
    if (step.kind === 'disable') {
      const ok = await verifyPin(step.key, pin);
      if (!ok) {
        setError('PIN không đúng. Thử lại.');
        setResetSignal((n) => n + 1);
        return;
      }
      await removePin(step.key);
      setEnabled(step.key, false);
      close();
      return;
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Quyền riêng tư</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          PIN 6 số được mã hoá và lưu cục bộ trong thiết bị của bạn (Keychain / Keystore).
          Khi đăng xuất, các khóa cũng sẽ được xoá.
        </Text>

        <View style={styles.card}>
          {(['lumina', 'archive'] as LockKey[]).map((k, i) => (
            <View key={k} style={[styles.row, i === 0 && styles.rowDivider]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{LABEL[k].title}</Text>
                <Text style={styles.rowHint}>{LABEL[k].hint}</Text>
              </View>
              <Switch
                value={enabled[k]}
                onValueChange={(v) => onToggle(k, v)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={step.kind !== 'idle'} animationType="slide" onRequestClose={close}>
        <View style={[styles.modalSafe, { paddingTop: insets.top + spacing.lg }]}>
          <Pressable style={styles.modalClose} onPress={close} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.modalBody}>
            <PinPad
              title={pinTitle(step)}
              subtitle={pinSubtitle(step)}
              error={error}
              resetSignal={resetSignal}
              onComplete={handlePin}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function pinTitle(step: Step) {
  switch (step.kind) {
    case 'create-1':
      return 'Đặt PIN 6 số';
    case 'create-2':
      return 'Xác nhận PIN';
    case 'disable':
      return 'Nhập PIN để tắt khóa';
    default:
      return '';
  }
}

function pinSubtitle(step: Step) {
  if (step.kind === 'create-1') return 'PIN sẽ được dùng để mở khóa nội dung này.';
  if (step.kind === 'create-2') return 'Nhập lại 6 số vừa rồi để xác nhận.';
  return undefined;
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
  scroll: { padding: spacing.lg },
  intro: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalClose: { paddingHorizontal: spacing.lg, alignSelf: 'flex-start' },
  modalBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.xxl },
});
