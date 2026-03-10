import { FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius } from '@/constants/theme';
import type { ExploreFilterValue } from '@/hooks/use-region-stories';

const chips: { value: ExploreFilterValue; label: string }[] = [
  { value: 'all', label: 'All Regions' },
  { value: 'published', label: 'Published' },
  { value: 'awaiting', label: 'Awaiting Data' },
  { value: 'residential', label: 'Residential' },
  { value: 'workplace', label: 'Workplace' },
  { value: 'public-commercial', label: 'Public-Commercial' },
  { value: 'mixed', label: 'Mixed' },
];

interface FilterChipsProps {
  value: ExploreFilterValue;
  onSelect: (value: ExploreFilterValue) => void;
}

export function FilterChips({ value, onSelect }: FilterChipsProps) {
  return (
    <FlatList
      horizontal
      data={chips}
      keyExtractor={(item) => item.value}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const isActive = item.value === value;

        return (
          <Pressable style={[styles.chip, isActive && styles.chipActive]} onPress={() => onSelect(item.value)}>
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,14,20,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(14,165,233,0.16)',
    borderColor: 'rgba(14,165,233,0.32)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.4,
  },
  chipTextActive: {
    color: colors.white,
  },
});
