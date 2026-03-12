import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { NotificationPopover } from '@/components/navigation/notification-popover';

const mockAnchoredPopover = jest.fn(({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
));

jest.mock('@/components/navigation/anchored-popover', () => ({
  AnchoredPopover: (props: { children: React.ReactNode }) => mockAnchoredPopover(props),
}));

const notifications = [
  {
    id: 1,
    type: 'info' as const,
    title: 'Monthly record published',
    message: 'April revenue was published for KR11.',
    time: '1m ago',
    unread: true,
  },
];

describe('NotificationPopover', () => {
  beforeEach(() => {
    mockAnchoredPopover.mockClear();
  });

  it('forwards anchor placement to AnchoredPopover and keeps the inbox CTA working', () => {
    const onViewAll = jest.fn();
    const anchorRect = { x: 280, y: 24, width: 40, height: 40 };

    const { getByText, getByLabelText } = render(
      <NotificationPopover
        visible
        notifications={notifications}
        unreadCount={1}
        anchorRect={anchorRect}
        containerWidth={390}
        containerHeight={844}
        onClose={() => {}}
        onViewAll={onViewAll}
      />,
    );

    expect(mockAnchoredPopover.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        visible: true,
        anchorRect,
        containerWidth: 390,
        containerHeight: 844,
        placement: 'bottom-end',
      }),
    );
    expect(getByText('Monthly record published')).toBeTruthy();

    fireEvent.press(getByLabelText('View All Updates'));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});
