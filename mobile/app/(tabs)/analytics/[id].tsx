import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyAnalyticsRegionRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <Redirect href={`/region/${id}`} />;
}
