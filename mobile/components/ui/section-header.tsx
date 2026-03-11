import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '@/constants/theme';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ eyebrow, title, icon, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View>
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {icon && <View style={styles.iconCircle}>{icon}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
