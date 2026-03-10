import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { LucideIcon } from 'lucide-react-native';

type BadgeVariant = 'featured' | 'new' | 'upcoming' | 'live' | 'info' | 'success' | 'alert';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  icon?: LucideIcon;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; dot?: string }> = {
  featured: { bg: 'rgba(251,191,36,0.15)', text: colors.amber400, dot: colors.amber400 },
  new: { bg: 'rgba(14,165,233,0.15)', text: colors.sky400, dot: colors.sky400 },
  upcoming: { bg: 'rgba(99,102,241,0.15)', text: colors.indigo400, dot: colors.indigo400 },
  live: { bg: 'rgba(16,185,129,0.15)', text: colors.emerald400, dot: colors.emerald400 },
  info: { bg: 'rgba(14,165,233,0.1)', text: colors.sky400 },
  success: { bg: 'rgba(16,185,129,0.1)', text: colors.emerald400 },
  alert: { bg: 'rgba(244,63,94,0.1)', text: colors.rose500 },
};

export function Badge({ label, variant = 'info', dot, icon: Icon, style }: BadgeProps) {
  const c = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      {Icon && <Icon size={12} color={c.text} />}
      {dot && !Icon && (
        <View style={[styles.dot, { backgroundColor: c.dot ?? c.text }]} />
      )}
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
