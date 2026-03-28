import React from 'react';
import { Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { TabScreenLayout } from '@/components/layout/tab-screen-layout';
import { appRoutes } from '@/lib/navigation/routes';

const mockAnchoredPopover = jest.fn(({ visible, children }: { visible: boolean; children: React.ReactNode }) => (
  visible ? <View>{children}</View> : null
));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/use-demo-notifications', () => ({
  useDemoNotifications: jest.fn(() => ({
    notifications: [
      {
        id: 'n1',
        type: 'info',
        title: 'Session update',
        message: 'A new session was published.',
        time: 'Just now',
        unread: true,
      },
    ],
    unreadCount: 1,
    isLoading: false,
  })),
}));

jest.mock('@/components/navigation/anchored-popover', () => ({
  AnchoredPopover: (props: { visible: boolean; children: React.ReactNode }) => mockAnchoredPopover(props),
}));

const mockedRouter = router as unknown as {
  push: jest.Mock;
};

describe('TabScreenLayout', () => {
  beforeEach(() => {
    mockedRouter.push.mockClear();
    mockAnchoredPopover.mockClear();
  });

  it('wires bell anchor layout into the notifications popover and keeps canonical portfolio routes', () => {
    const { getByLabelText, getByTestId, getByText } = render(
      <TabScreenLayout title="Portfolio">
        <Text>Body</Text>
      </TabScreenLayout>,
    );

    fireEvent(getByTestId('tab-screen-layout-root'), 'layout', {
      nativeEvent: { layout: { width: 390, height: 844 } },
    });
    fireEvent(getByTestId('header-actions'), 'layout', {
      nativeEvent: { layout: { x: 286, y: 12, width: 104, height: 40 } },
    });
    fireEvent(getByTestId('header-bell-anchor'), 'layout', {
      nativeEvent: { layout: { x: 42, y: 0, width: 40, height: 40 } },
    });

    fireEvent.press(getByLabelText('Open notifications'));

    const anchoredPopoverProps = mockAnchoredPopover.mock.calls.at(-1)?.[0];
    expect(anchoredPopoverProps).toEqual(
      expect.objectContaining({
        visible: true,
        containerWidth: 390,
        containerHeight: 844,
        anchorRect: {
          x: 328,
          y: 12,
          width: 40,
          height: 40,
        },
      }),
    );
    expect(getByText('Session update')).toBeTruthy();

    fireEvent.press(getByLabelText('View All Updates'));
    expect(mockedRouter.push).toHaveBeenCalledWith(appRoutes.portfolioNotifications);

    fireEvent.press(getByLabelText('Open more options'));
    expect(mockedRouter.push).toHaveBeenCalledWith(appRoutes.portfolioMore);
  });
});
