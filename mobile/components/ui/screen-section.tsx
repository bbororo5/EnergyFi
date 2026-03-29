import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { SectionHeader } from '@/components/ui/section-header';

interface ScreenSectionProps {
  title: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  intro?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ScreenSection({
  title,
  icon,
  rightElement,
  intro,
  children,
  style,
  contentStyle,
}: ScreenSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <SectionHeader title={title} icon={icon} rightElement={rightElement} />
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  intro: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -2,
    lineHeight: 18,
  },
  content: {
    gap: spacing.sm,
  },
});
