import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import LegacyAnalyticsRegionRedirect from '@/app/(tabs)/analytics/[id]';
import { useLocalSearchParams } from 'expo-router';

const mockRedirect = jest.fn(({ href }: { href: string }) => <Text>{href}</Text>);

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  Redirect: (props: { href: string }) => mockRedirect(props),
}));

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;

describe('LegacyAnalyticsRegionRedirect', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('renders a redirect to the canonical region route', () => {
    mockedUseLocalSearchParams.mockReturnValue({ id: 'KR11' });

    render(<LegacyAnalyticsRegionRedirect />);

    expect(mockRedirect.mock.calls[0]?.[0]).toEqual({ href: '/region/KR11' });
  });
});
