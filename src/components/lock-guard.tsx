import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PinPad } from '@/components/pin-pad';
import { hasPin, verifyPin, type LockKey } from '@/services/privacy-lock';
import { usePrivacyStore } from '@/stores/privacy-store';
import { colors, spacing } from '@/theme';

type Props = {
  lockKey: LockKey;
  title: string;
  subtitle?: string;
  onCancel?: () => void;
  children: React.ReactNode;
};

export function LockGuard({ lockKey, title, subtitle, onCancel, children }: Props) {
  const insets = useSafeAreaInsets();
  const unlocked = usePrivacyStore((s) => s.unlocked[lockKey]);
  const enabled = usePrivacyStore((s) => s.enabled[lockKey]);
  const setEnabled = usePrivacyStore((s) => s.setEnabled);
  const unlock = usePrivacyStore((s) => s.unlock);
  const [error, setError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void hasPin(lockKey).then((exists) => {
      setEnabled(lockKey, exists);
      setReady(true);
    });
  }, [lockKey, setEnabled]);

  if (!ready) return null;
  if (!enabled || unlocked) return <>{children}</>;

  async function handlePin(pin: string) {
    const ok = await verifyPin(lockKey, pin);
    if (ok) {
      setError(null);
      unlock(lockKey);
    } else {
      setError('PIN không đúng. Thử lại.');
      setResetSignal((n) => n + 1);
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top + spacing.lg }]}>
      {onCancel ? (
        <Pressable style={styles.close} onPress={onCancel} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      <View style={styles.body}>
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={28} color={colors.accent} />
        </View>
        <PinPad
          title={title}
          subtitle={subtitle}
          error={error}
          resetSignal={resetSignal}
          onComplete={handlePin}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  close: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.xxl },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
