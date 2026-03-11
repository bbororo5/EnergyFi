export interface Notification {
  id: number;
  type: 'success' | 'info' | 'alert';
  title: string;
  message: string;
  time: string;
  unread: boolean;
}
