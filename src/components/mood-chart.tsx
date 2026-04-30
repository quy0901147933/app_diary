import { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import type { MoodDayPoint } from '@/services/ai-api';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type Props = {
  days: MoodDayPoint[];
};

export function MoodChart({ days }: Props) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.lg * 4;

  const data = useMemo(
    () =>
      days.map((d) => ({
        value: d.average_score ?? 0,
        label: d.label,
        labelTextStyle: chartLabelStyle,
      })),
    [days],
  );

  const hasAny = days.some((d) => d.average_score != null);
  const spacingX = Math.max(28, (chartWidth - 32) / Math.max(days.length - 1, 1));

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(232,217,184,0.55)', 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Text style={styles.title}>Bản đồ tâm trạng 7 ngày</Text>
      <Text style={styles.subtitle}>
        Lumina lặng lẽ ghi lại sắc thái mỗi ngày từ những khoảnh khắc và đoạn trò chuyện.
      </Text>

      {hasAny ? (
        <View style={styles.chartWrap}>
          <LineChart
            data={data}
            width={chartWidth}
            height={180}
            initialSpacing={16}
            spacing={spacingX}
            curved
            isAnimated
            animationDuration={900}
            thickness={4}
            color={colors.accent}
            hideRules
            yAxisColor="transparent"
            xAxisColor="transparent"
            yAxisTextStyle={yAxisStyle}
            yAxisLabelWidth={22}
            noOfSections={5}
            maxValue={10}
            stepValue={2}
            dataPointsColor={colors.accent}
            dataPointsRadius={5}
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Chưa có đủ dữ liệu cảm xúc — chụp thêm vài khoảnh khắc hoặc trò chuyện cùng Lumina nhé.
          </Text>
        </View>
      )}
    </View>
  );
}

const chartLabelStyle = {
  color: colors.textMuted,
  fontSize: 10,
  marginTop: 4,
} as const;

const yAxisStyle = {
  color: colors.textMuted,
  fontSize: 10,
} as const;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  title: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  chartWrap: {
    overflow: 'hidden',
    paddingRight: spacing.sm,
  },
  empty: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
