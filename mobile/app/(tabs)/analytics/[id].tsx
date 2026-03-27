import { Redirect, useLocalSearchParams } from 'expo-router';
import { appRoutes } from '@/lib/navigation/routes';

export default function LegacyAnalyticsRegionRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <Redirect href={appRoutes.regionDetail(id)} />;
}
