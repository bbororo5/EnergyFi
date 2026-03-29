import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommonHeader } from '@/components/navigation/common-header';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('CommonHeader', () => {
  it('emits the bell anchor rect from the shared actions layout and bell layout', () => {
    const onBellAnchorChange = jest.fn();

    const { getByTestId } = render(
      <CommonHeader
        title="Portfolio"
        onBellAnchorChange={onBellAnchorChange}
        identity={{ label: 'Demo Investor' }}
        actions={{
          bell: {
            onPress: jest.fn(),
            unreadCount: 1,
          },
          more: {
            onPress: jest.fn(),
          },
        }}
      />,
    );

    fireEvent(getByTestId('header-actions'), 'layout', {
      nativeEvent: { layout: { x: 286, y: 12, width: 104, height: 40 } },
    });
    fireEvent(getByTestId('header-bell-anchor'), 'layout', {
      nativeEvent: { layout: { x: 42, y: 0, width: 40, height: 40 } },
    });

    expect(onBellAnchorChange).toHaveBeenLastCalledWith({
      x: 328,
      y: 12,
      width: 40,
      height: 40,
    });
  });
});
