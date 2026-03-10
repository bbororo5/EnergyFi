import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { documentTitles, documentContents, DocumentType } from '@/data/documents';

export default function DocumentScreen() {
  const { type = 'terms' } = useLocalSearchParams<{ type: string }>();
  const insets = useSafeAreaInsets();
  const docType = type as DocumentType;
  const title = documentTitles[docType] ?? 'Document';
  const content = documentContents[docType] ?? '';

  const lines = content.split('\n');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
        >
          <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.docCard}>
          {lines.map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              const text = line.slice(2, -2);
              return (
                <Text key={i} style={styles.sectionTitle}>
                  {text}
                </Text>
              );
            }
            if (line.trim() === '') {
              return <View key={i} style={styles.spacer} />;
            }
            return (
              <Text key={i} style={styles.bodyText}>
                {line}
              </Text>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(9,11,17,0.8)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.h4, color: colors.textPrimary, letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  docCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  spacer: { height: 8 },
  bodyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
