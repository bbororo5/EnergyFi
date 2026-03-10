import { colors } from './theme';

export const chartTheme = {
  // Axes
  xAxisColor: colors.borderLight,
  yAxisColor: 'transparent',
  xAxisLabelColor: colors.textSecondary,
  yAxisLabelColor: colors.textSecondary,
  labelFontSize: 12,

  // Grid
  dashWidth: 4,
  dashGap: 4,
  rulesColor: colors.borderLight,
  rulesType: 'dashed' as const,

  // Tooltip
  tooltipBg: colors.surfaceMuted,
  tooltipBorder: colors.border,

  // Common props
  backgroundColor: 'transparent',
  hideRules: false,
  spacing: 40,
  initialSpacing: 10,
  endSpacing: 10,
  noOfSections: 4,
  maxValue: undefined,
  height: 180,

  // Colors
  colors: {
    primary: colors.primary,
    secondary: colors.chart2,
    tertiary: colors.chart3,
    quaternary: colors.chart4,
    success: colors.success,
    error: colors.error,
  },
} as const;
