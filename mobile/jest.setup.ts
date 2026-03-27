jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  Redirect: ({ href }: { href: string }) => href,
  useLocalSearchParams: jest.fn(() => ({})),
}));

global.setImmediate = global.setImmediate ?? ((callback: (...args: any[]) => void, ...args: any[]) => {
  return setTimeout(callback, 0, ...args) as unknown as number;
});

const existingWindow = (global as typeof global & { window?: Record<string, unknown> }).window ?? {};

Object.defineProperty(global, 'window', {
  value: {
    ...existingWindow,
    location: {
      origin: 'http://localhost:8090',
    },
    setTimeout,
    clearTimeout,
  },
  writable: true,
});
