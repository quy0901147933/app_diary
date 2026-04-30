import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: ViewStyle;
};

export function GlassOverlay({ children, intensity = 45, tint = 'light', style }: Props) {
  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.host, style]}>
      <View style={styles.tint}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  host: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  tint: {
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
});
