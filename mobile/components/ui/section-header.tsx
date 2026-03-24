import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '@/constants/theme';

interface SectionHeaderProps {
  /** Deprecated: section headers are title-only. */
  eyebrow?: string;
  title: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, icon, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.textWrap}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.title}>{title}</Text>
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
    marginBottom: 12,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    ...typography.sectionTitle,
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
