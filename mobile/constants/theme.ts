import { Platform, TextStyle } from 'react-native';

// ─── Color Tokens ───────────────────────────────────────────────────
// Ported from Design Code/src/styles/theme.css
export const colors = {
  // Primary
  primary: '#0EA5E9',
  primaryLight: '#7DD3FC',
  primaryDark: '#0284C7',

  // Accent
  accent: '#4ADE80',
  accentLight: '#86EFAC',

  // Backgrounds
  background: '#0B0E14',
  backgroundDeep: '#090B11',
  surface: '#151924',
  surfaceSecondary: '#1E2333',
  surfaceCard: 'rgba(22,27,38,0.6)',
  surfaceMuted: '#1A1E2B',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textTertiary: '#475569',
  textMuted: '#64748B',

  // Borders
  border: '#1E293B',
  borderLight: '#334155',
  borderSubtle: 'rgba(255,255,255,0.05)',
  borderMedium: 'rgba(255,255,255,0.10)',

  // Status
  success: '#4ADE80',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#0EA5E9',

  // Chart
  chart1: '#0EA5E9',
  chart2: '#6366F1',
  chart3: '#8B5CF6',
  chart4: '#F59E0B',

  // Semantic
  sky400: '#38BDF8',
  sky500: '#0EA5E9',
  emerald400: '#34D399',
  emerald500: '#10B981',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  rose500: '#F43F5E',
  fuchsia400: '#E879F9',
  red500: '#EF4444',

  // Apple-style allocation
  appleBlue: '#0A84FF',
  appleIndigo: '#5E5CE6',
  appleGreen: '#30D158',
  appleOrange: '#FF9F0A',

  // Transparent
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ─── Spacing ────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

// ─── Border Radius ──────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  full: 9999,
} as const;

// ─── Typography ─────────────────────────────────────────────────────
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography: Record<string, TextStyle> = {
  h1: {
    fontFamily,
    fontSize: 36,
    fontWeight: '600',
    lineHeight: 43,
    letterSpacing: -0.72,
  },
  h2: {
    fontFamily,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
    letterSpacing: -0.28,
  },
  h3: {
    fontFamily,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 34,
  },
  h4: {
    fontFamily,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
  },
  body: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyBold: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  label: {
    fontFamily,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
  labelBold: {
    fontFamily,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  caption: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  captionBold: {
    fontFamily,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  micro: {
    fontFamily,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  tabLabel: {
    fontFamily,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} as const;

// ─── Shadows ────────────────────────────────────────────────────────
export const shadows = Platform.select({
  ios: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.5,
      shadowRadius: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.6,
      shadowRadius: 25,
    },
    glow: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 15,
    },
    glowEmerald: {
      shadowColor: colors.emerald500,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
  },
  default: {
    sm: { elevation: 2 },
    md: { elevation: 4 },
    lg: { elevation: 8 },
    xl: { elevation: 12 },
    glow: { elevation: 6 },
    glowEmerald: { elevation: 6 },
  },
})!;

// ─── Legacy Colors Export (template compat) ─────────────────────────
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: colors.primary,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: colors.primary,
  },
  dark: {
    text: colors.textPrimary,
    background: colors.background,
    tint: colors.primary,
    icon: colors.textSecondary,
    tabIconDefault: colors.textTertiary,
    tabIconSelected: colors.primary,
  },
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
