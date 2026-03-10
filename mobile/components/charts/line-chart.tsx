import { Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '@/constants/theme';
import { SurfaceCard } from '@/components/ui/card';

interface LineChartProps {
  title: string;
  data: { value: number; label?: string }[];
  color?: string;
  height?: number;
  width?: number; // Added dynamic width
  yAxisSuffix?: string;
}

export function LineChartCard({
  title,
  data,
  color = colors.primary,
  height = 180,
  width = 300,
  yAxisSuffix = '',
}: LineChartProps) {
  // Emphasize subtle changes by calculating a dynamic offset
  const minVal = Math.min(...data.map(d => d.value));
  const maxVal = Math.max(...data.map(d => d.value));
  const range = maxVal - minVal;
  const offset = range > 0 ? Math.max(0, Math.floor(minVal - range * 0.2)) : Math.floor(minVal * 0.8);

  return (
    <SurfaceCard>
      <Text style={styles.title}>{title}</Text>
      <LineChart
        data={data}
        height={height}
        width={width}
        color={color}
        thickness={3}
        hideDataPoints={false}
        dataPointsColor={colors.white}
        dataPointsRadius={4}
        curved
        yAxisOffset={offset}
        xAxisColor="transparent"
        yAxisColor="transparent"
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
        rulesColor="rgba(255,255,255,0.05)"
        rulesType="dashed"
        dashWidth={4}
        dashGap={4}
        noOfSections={3}
        spacing={width / (data.length || 1)}
        initialSpacing={width / (data.length * 2)}
        yAxisLabelSuffix={yAxisSuffix}
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
