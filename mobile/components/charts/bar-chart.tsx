import { Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { colors } from '@/constants/theme';
import { SurfaceCard } from '@/components/ui/card';

interface BarChartProps {
  title: string;
  data: { value: number; label?: string; frontColor?: string }[];
  color?: string;
  height?: number;
  width?: number; // Added dynamic width
  barWidth?: number;
}

export function BarChartCard({
  title,
  data,
  color = colors.primary,
  height = 180,
  width = 300,
  barWidth = 24,
}: BarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    frontColor: d.frontColor ?? color,
    topLabelComponent: undefined,
  }));

  // Dynamic spacing
  const spacing = (width - (data.length * barWidth)) / (data.length + 1);

  return (
    <SurfaceCard>
      <Text style={styles.title}>{title}</Text>
      <BarChart
        data={chartData}
        height={height}
        width={width}
        barWidth={barWidth}
        barBorderTopLeftRadius={4}
        barBorderTopRightRadius={4}
        xAxisColor="transparent"
        yAxisColor="transparent"
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
        rulesColor="rgba(255,255,255,0.05)"
        rulesType="dashed"
        dashWidth={4}
        dashGap={4}
        noOfSections={3}
        spacing={spacing}
        initialSpacing={spacing / 2}
      />
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
  axisLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
