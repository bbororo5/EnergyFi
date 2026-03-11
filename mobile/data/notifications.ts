export interface Notification {
  id: number;
  type: 'success' | 'info' | 'alert';
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export const notifications: Notification[] = [
  {
    id: 1,
    type: 'success',
    title: 'Dividend Payment Completed',
    message: 'February dividend of $682.50 has been deposited.',
    time: '5m ago',
    unread: true,
  },
  {
    id: 2,
    type: 'info',
    title: 'New Portfolio Listed',
    message: 'Incheon Phase 2 Portfolio added to Explore menu.',
    time: '1h ago',
    unread: true,
  },
  {
    id: 3,
    type: 'success',
    title: 'Station Maintenance Complete',
    message: 'Seoul Phase 1 - Gangnam Station regular maintenance completed.',
    time: '2h ago',
    unread: false,
  },
  {
    id: 4,
    type: 'alert',
    title: 'Yield Rate Change Alert',
    message: 'Busan A Portfolio yield rate increased by +3.2% this month.',
    time: '1d ago',
    unread: false,
  },
  {
    id: 5,
    type: 'info',
    title: 'Data Update',
    message: 'All portfolio operational data has been updated.',
    time: '1d ago',
    unread: false,
  },
];
