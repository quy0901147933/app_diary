import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  size?: number;
  count?: number;
  active?: boolean;
};

export function SparkleEffect({ size = 80, count = 6, active = true }: Props) {
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        delay: i * 90,
        offsetX: (Math.random() - 0.5) * size * 0.6,
        offsetY: (Math.random() - 0.5) * size * 0.6,
        scale: 0.6 + Math.random() * 0.6,
      })),
    [count, size],
  );

  return (
    <View pointerEvents="none" style={[styles.host, { width: size, height: size }]}>
      {seeds.map((s, idx) => (
        <Sparkle key={idx} {...s} active={active} />
      ))}
    </View>
  );
}

function Sparkle({
  delay,
  offsetX,
  offsetY,
  scale,
  active,
}: {
  delay: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  active: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [active, delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX * progress.value },
      { translateY: offsetY * progress.value },
      { scale: progress.value * scale },
    ],
    opacity: progress.value,
  }));

  return (
    <Animated.View style={[styles.particle, style]}>
      <Svg viewBox="0 0 24 24" width={14} height={14}>
        <Path
          d="M12 2 L13.5 9 L20 10.5 L13.5 12 L12 19 L10.5 12 L4 10.5 L10.5 9 Z"
          fill={colors.sparkleHi}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
