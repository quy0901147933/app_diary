import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '@/theme';

type Props = {
  height?: number;
  style?: ViewStyle;
};

export function SkeletonCard({ height = 280, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.4 * progress.value,
  }));

  return (
    <Animated.View style={[styles.card, { height }, animated, style]}>
      <View style={styles.shimmer} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  shimmer: {
    flex: 1,
    backgroundColor: colors.background,
    opacity: 0.4,
  },
});
