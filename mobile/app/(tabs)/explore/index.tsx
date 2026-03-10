import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Search, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonHeader } from '@/components/navigation/common-header';
import { SurfaceCard } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { FilterChips } from '@/components/screens/explore/filter-chips';
import { RegionStoryCard } from '@/components/screens/explore/region-story-card';
import { colors, radius } from '@/constants/theme';
import { hasLiveReputationRegistry } from '@/constants/contracts';
import { useRegionStories, type ExploreFilterValue } from '@/hooks/use-region-stories';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExploreFilterValue>('all');
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const { stories, isLoading, isRefreshing, errorMessage, publishedCount, latestPublishedPeriod, refresh } = useRegionStories();

  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      const matchesSearch =
        deferredSearch.length === 0
        || story.name.toLowerCase().includes(deferredSearch)
        || story.fullName.toLowerCase().includes(deferredSearch)
        || story.code.toLowerCase().includes(deferredSearch);

      if (!matchesSearch) {
        return false;
      }

      if (activeFilter === 'all') {
        return true;
      }
      if (activeFilter === 'published') {
        return story.published;
      }
      if (activeFilter === 'awaiting') {
        return !story.published;
      }
      return story.primarySiteFilter === activeFilter;
    });
  }, [activeFilter, deferredSearch, stories]);

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <CommonHeader
        title="Explore"
        onNotificationPress={() => router.push('/(tabs)/account/notifications')}
      />

      <FlatList
        data={filteredStories}
        keyExtractor={(item) => item.regionId}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 104 }]}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <Animated.View entering={FadeInDown.duration(360)}>
              <LinearGradient
                colors={['rgba(7,22,42,0.98)', 'rgba(11,14,20,0.92)', 'rgba(9,11,17,0.94)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroEyebrow}>Story Browser</Text>
                    <Text style={styles.heroTitle}>Regional character, not rankings</Text>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Chain live</Text>
                  </View>
                </View>

                <Text style={styles.heroBody}>
                  Explore reads each region through three neutral lenses: operational trust, revenue rhythm, and site character. Story text is composed from monthly on-chain reputation snapshots.
                </Text>

                <View style={styles.heroStats}>
                  <View style={styles.heroStatCard}>
                    <Text style={styles.heroStatLabel}>Published</Text>
                    <Text style={styles.heroStatValue}>{publishedCount}</Text>
                    <Text style={styles.heroStatCaption}>monthly region snapshots</Text>
                  </View>
                  <View style={styles.heroStatCard}>
                    <Text style={styles.heroStatLabel}>Latest Period</Text>
                    <Text style={styles.heroStatValueSmall}>{latestPublishedPeriod}</Text>
                    <Text style={styles.heroStatCaption}>highest published periodId</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by region or code..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <FilterChips value={activeFilter} onSelect={setActiveFilter} />

            <SectionHeader
              eyebrow="REPUTATION SNAPSHOTS"
              title="Live region stories"
              icon={<Compass size={18} color={colors.sky400} />}
              style={styles.sectionHeader}
            />

            {errorMessage ? (
              <SurfaceCard style={styles.messageCard}>
                <Text style={styles.messageEyebrow}>ON-CHAIN STATUS</Text>
                <Text style={styles.messageText}>{errorMessage}</Text>
              </SurfaceCard>
            ) : null}

            {!hasLiveReputationRegistry ? (
              <SurfaceCard style={styles.messageCard}>
                <Text style={styles.messageEyebrow}>CONFIGURATION</Text>
                <Text style={styles.messageText}>
                  `ReputationRegistry` address is not wired yet. The screen stays neutral until the EnergyFi testnet deployment is configured.
                </Text>
              </SurfaceCard>
            ) : null}
          </View>
        )}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(80 + index * 28).duration(320)}>
            <RegionStoryCard
              story={item}
              onPress={item.published ? () => router.push(`/(tabs)/portfolio/${item.code}`) : undefined}
            />
          </Animated.View>
        )}
        ListEmptyComponent={(
          <SurfaceCard style={styles.emptyCard}>
            <Sparkles size={18} color={colors.sky400} />
            <Text style={styles.emptyTitle}>{isLoading ? 'Loading monthly snapshots' : 'No regions match this filter'}</Text>
            <Text style={styles.emptyText}>
              {isLoading
                ? 'On-chain snapshot reads are in progress.'
                : 'Try another filter or clear the search term.'}
            </Text>
          </SurfaceCard>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  backgroundGlowTop: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  backgroundGlowBottom: {
    position: 'absolute',
    bottom: 80,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  headerBlock: {
    paddingBottom: 16,
  },
  heroCard: {
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
    letterSpacing: -0.5,
    maxWidth: 240,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emerald400,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  heroBody: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    minWidth: 0,
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  heroStatValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },
  heroStatValueSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  heroStatCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: 'rgba(11,14,20,0.78)',
    borderRadius: radius['2xl'],
    paddingLeft: 46,
    paddingRight: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    marginTop: 20,
  },
  messageCard: {
    marginBottom: 12,
  },
  messageEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
