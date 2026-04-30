import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

const PIN_LEN = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

type Props = {
  title: string;
  subtitle?: string;
  error?: string | null;
  onComplete: (pin: string) => void;
  resetSignal?: number;
};

export function PinPad({ title, subtitle, error, onComplete, resetSignal }: Props) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, [resetSignal]);

  function press(k: (typeof KEYS)[number]) {
    if (k === '') return;
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      if (p.length >= PIN_LEN) return p;
      const next = p + k;
      if (next.length === PIN_LEN) {
        setTimeout(() => onComplete(next), 80);
      }
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.dots}>
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled, error && styles.dotError]}
          />
        ))}
      </View>

      <Text style={styles.error}>{error ?? ' '}</Text>

      <View style={styles.pad}>
        {KEYS.map((k, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [
              styles.key,
              k === '' && styles.keyHidden,
              pressed && k !== '' && styles.keyPressed,
            ]}
            onPress={() => press(k)}
            disabled={k === ''}
          >
            {k === 'del' ? (
              <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
            ) : (
              <Text style={styles.keyLabel}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const KEY_SIZE = 68;

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: spacing.xl },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotError: { borderColor: colors.danger },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
    minHeight: 16,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: KEY_SIZE * 3 + spacing.lg * 2,
    gap: spacing.lg,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyPressed: { backgroundColor: colors.surfaceAlt },
  keyHidden: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyLabel: { ...typography.title, fontSize: 22, color: colors.textPrimary },
});
