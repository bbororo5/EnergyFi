import { StyleSheet, Text } from 'react-native';
import { SurfaceCard } from '@/components/ui/card';
import { colors, typography } from '@/constants/theme';

interface MessageStateCardProps {
  message: string;
  tone?: 'info' | 'warning' | 'error' | 'neutral';
}

const toneStyles = {
  info: {
    borderColor: 'rgba(14,165,233,0.12)',
    backgroundColor: 'rgba(14,165,233,0.04)',
    color: colors.textSecondary,
  },
  warning: {
    borderColor: 'rgba(245,158,11,0.14)',
    backgroundColor: 'rgba(245,158,11,0.06)',
    color: colors.warning,
  },
  error: {
    borderColor: 'rgba(239,68,68,0.16)',
    backgroundColor: 'rgba(239,68,68,0.06)',
    color: '#FCA5A5',
  },
  neutral: {
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(22,27,38,0.4)',
    color: colors.textSecondary,
  },
} as const;

export function MessageStateCard({ message, tone = 'neutral' }: MessageStateCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <SurfaceCard style={[styles.card, { borderColor: toneStyle.borderColor, backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.message, { color: toneStyle.color }]}>{message}</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 2,
  },
  message: {
    ...typography.captionBold,
    lineHeight: 20,
  },
});
