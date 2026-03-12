import { Fragment, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/constants/theme';
import { formatKrwShort } from '@/lib/domain/analytics';
import type { HomeHeroPoint } from '@/hooks/use-home-dashboard';

interface HeroRevenueChartProps {
  data: HomeHeroPoint[];
}

interface ChartPointLayout extends HomeHeroPoint {
  x: number;
  y: number;
}

const CHART_HEIGHT = 188;
const PLOT_LEFT = 18;
const PLOT_RIGHT = 18;
const PLOT_TOP = 18;
const LABEL_BAND = 34;
const BASELINE_OFFSET = 8;
const LABEL_WIDTH = 44;
const TOOLTIP_WIDTH = 88;
const TOOLTIP_HEIGHT = 28;
const TOOLTIP_OFFSET_X = 10;
const TOOLTIP_OFFSET_Y = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildSmoothLinePath(points: ChartPointLayout[]) {
  if (points.length < 2) {
    return '';
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` Q ${controlX} ${current.y} ${next.x} ${next.y}`;
  }

  return path;
}

function buildAreaPath(linePath: string, points: ChartPointLayout[], baselineY: number) {
  if (!linePath || points.length === 0) {
    return '';
  }

  const first = points[0];
  const last = points[points.length - 1];

  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export function HeroRevenueChart({ data }: HeroRevenueChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const width = containerWidth > 0 ? containerWidth : Math.max(220, windowWidth - 128);
  const baselineY = CHART_HEIGHT - LABEL_BAND - BASELINE_OFFSET;
  const plotWidth = Math.max(width - PLOT_LEFT - PLOT_RIGHT, 1);
  const plotHeight = Math.max(baselineY - PLOT_TOP, 1);
  const minValue = data.length > 0 ? Math.min(...data.map((item) => item.value)) : 0;
  const maxValue = data.length > 0 ? Math.max(...data.map((item) => item.value)) : 0;
  const effectiveRange = Math.max(maxValue - minValue, 1);
  const scaleMin = Math.max(0, minValue - effectiveRange * 0.22);
  const scaleMax = maxValue + effectiveRange * 0.18;
  const scaleRange = Math.max(scaleMax - scaleMin, 1);

  const points = useMemo<ChartPointLayout[]>(() => {
    if (data.length === 0) {
      return [];
    }

    const slotWidth = data.length === 1 ? 0 : plotWidth / (data.length - 1);

    return data.map((item, index) => {
      const x = data.length === 1
        ? PLOT_LEFT + plotWidth / 2
        : PLOT_LEFT + slotWidth * index;
      const normalized = (item.value - scaleMin) / scaleRange;
      const y = clamp(baselineY - normalized * plotHeight, PLOT_TOP + 4, baselineY - 6);

      return {
        ...item,
        x,
        y,
      };
    });
  }, [baselineY, data, plotHeight, plotWidth, scaleMin, scaleRange]);

  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);
  const areaPath = useMemo(() => buildAreaPath(linePath, points, baselineY), [baselineY, linePath, points]);
  const selectedPoint = selectedIndex != null ? points[selectedIndex] : null;

  const tooltipStyle = selectedPoint
    ? {
      left: clamp(selectedPoint.x + TOOLTIP_OFFSET_X, 8, width - TOOLTIP_WIDTH - 8),
      top: clamp(selectedPoint.y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET_Y, 8, baselineY - TOOLTIP_HEIGHT - 6),
    }
    : null;

  const resolveIndex = (locationX: number) => {
    if (points.length === 0) {
      return null;
    }

    if (points.length === 1) {
      return 0;
    }

    const relative = clamp(locationX, PLOT_LEFT, width - PLOT_RIGHT) - PLOT_LEFT;
    const slotWidth = plotWidth / (points.length - 1);

    return clamp(Math.round(relative / Math.max(slotWidth, 1)), 0, points.length - 1);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Published monthly revenue history"
      accessibilityHint="Drag across the chart to inspect the published value for each month"
      onLayout={handleLayout}
      onStartShouldSetResponder={() => points.length > 0}
      onMoveShouldSetResponder={() => points.length > 0}
      onResponderGrant={(event) => {
        const nextIndex = resolveIndex(event.nativeEvent.locationX);
        if (nextIndex != null) {
          setSelectedIndex(nextIndex);
        }
      }}
      onResponderMove={(event) => {
        const nextIndex = resolveIndex(event.nativeEvent.locationX);
        if (nextIndex != null) {
          setSelectedIndex(nextIndex);
        }
      }}
      onResponderRelease={() => setSelectedIndex(null)}
      onResponderTerminate={() => setSelectedIndex(null)}
    >
      {selectedPoint && tooltipStyle ? (
        <View pointerEvents="none" style={[styles.tooltip, tooltipStyle]}>
          <Text style={styles.tooltipText} numberOfLines={1}>
            {formatKrwShort(selectedPoint.rawKrw)}
          </Text>
        </View>
      ) : null}

      <Svg width={width} height={CHART_HEIGHT} pointerEvents="none">
        <Defs>
          <LinearGradient id="heroRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="rgba(56,189,248,0.28)" />
            <Stop offset="100%" stopColor="rgba(56,189,248,0)" />
          </LinearGradient>
        </Defs>

        <Line
          x1={PLOT_LEFT}
          y1={baselineY}
          x2={width - PLOT_RIGHT}
          y2={baselineY}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {areaPath ? <Path d={areaPath} fill="url(#heroRevenueFill)" /> : null}
        {linePath ? (
          <Path
            d={linePath}
            fill="none"
            stroke={colors.sky400}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((point, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Fragment key={`${point.periodLabel}-${index}`}>
              {isSelected ? (
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={10}
                  fill="rgba(56,189,248,0.12)"
                  stroke="rgba(56,189,248,0.4)"
                  strokeWidth={1}
                />
              ) : null}
              <Circle cx={point.x} cy={point.y} r={isSelected ? 6 : 4.5} fill={colors.white} />
            </Fragment>
          );
        })}
      </Svg>

      {points.map((point, index) => (
        <Text
          key={`${point.periodLabel}-label`}
          numberOfLines={1}
          style={[
            styles.label,
            {
              left: clamp(point.x - LABEL_WIDTH / 2, 0, width - LABEL_WIDTH),
              color: index === data.length - 1 ? colors.white : colors.textMuted,
            },
          ]}
        >
          {point.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 12,
    height: CHART_HEIGHT,
    borderRadius: 20,
    backgroundColor: 'rgba(9,11,17,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    height: TOOLTIP_HEIGHT,
    zIndex: 10,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(9,11,17,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.24)',
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  label: {
    position: 'absolute',
    bottom: 10,
    width: LABEL_WIDTH,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
