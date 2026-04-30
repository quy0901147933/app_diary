import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
};

export function SegmentedTabs({ options, value, onChange }: Props) {
  return (
    <View style={styles.host}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.caption,
    fontSize: 14,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});
