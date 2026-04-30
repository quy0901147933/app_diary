import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  cta?: { label: string; onPress: () => void };
};

export function EmptyState({ icon = 'sparkles-outline', title, hint, cta }: Props) {
  return (
    <View style={styles.host}>
      <View style={styles.iconHost}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {cta ? (
        <Pressable onPress={cta.onPress} style={styles.cta}>
          <Text style={styles.ctaLabel}>{cta.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconHost: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  ctaLabel: {
    ...typography.caption,
    fontSize: 14,
    color: colors.textInverse,
  },
});
