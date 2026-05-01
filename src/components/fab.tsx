import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  position?: 'right' | 'left';
};

export function Fab({ icon, label, onPress, variant = 'primary', position = 'right' }: Props) {
  const isPrimary = variant === 'primary';
  const positionStyle = position === 'right' ? styles.right : styles.left;
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, spacing.md) + spacing.xl;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.host,
        { bottom: bottomOffset },
        positionStyle,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label ?? icon.toString()}
    >
      <View style={styles.row}>
        <Ionicons
          name={icon}
          size={22}
          color={isPrimary ? colors.textInverse : colors.textPrimary}
        />
        {label && isPrimary ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    minWidth: 56,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
  right: { right: spacing.lg },
  left: { left: spacing.lg },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface },
  pressed: { opacity: 0.85 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textInverse,
    fontSize: 14,
  },
});
