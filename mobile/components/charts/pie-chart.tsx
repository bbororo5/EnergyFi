import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { colors } from '@/constants/theme';
import { SurfaceCard } from '@/components/ui/card';

interface PieChartProps {
  title: string;
  data: { value: number; color: string; text?: string; label?: string }[];
  donut?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  centerLabel?: string;
}

export function PieChartCard({
  title,
  data,
  donut = true,
  innerRadius = 50,
  outerRadius = 80,
  showLegend = true,
  centerLabel,
}: PieChartProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 405;
  const chartRadius = isCompact ? Math.max(outerRadius - 16, 58) : outerRadius;
  const chartInnerRadius = isCompact ? Math.max(innerRadius - 12, 38) : innerRadius;

  return (
    <SurfaceCard>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.chartRow, isCompact && styles.chartRowCompact]}>
        <PieChart
          data={data}
          donut={donut}
          innerRadius={chartInnerRadius}
          radius={chartRadius}
          innerCircleColor={colors.surfaceMuted}
          centerLabelComponent={
            centerLabel
              ? () => (
                  <View style={styles.centerLabel}>
                    <Text style={styles.centerText}>{centerLabel}</Text>
                  </View>
                )
              : undefined
          }
        />
        {showLegend ? (
          <View style={[styles.legend, isCompact && styles.legendCompact]}>
            {data.map((item) => (
              <View key={item.label ?? item.text} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label ?? item.text}</Text>
                <Text style={styles.legendValue}>{item.value}%</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  chartRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  centerLabel: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendCompact: {
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
