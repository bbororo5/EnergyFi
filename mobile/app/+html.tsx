import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Custom HTML root for web builds.
 * Fixes bottom navigation cutoff on mobile browsers by:
 * 1. Using viewport-fit=cover for safe area inset support
 * 2. Overriding 100vh with 100dvh (dynamic viewport height)
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Expo's default reset (height:100%, overflow:hidden, etc.) */}
        <ScrollViewStyleReset />

        {/* Override viewport height for mobile browsers */}
        <style dangerouslySetInnerHTML={{ __html: viewportFixCSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const viewportFixCSS = `
@supports (height: 100dvh) {
  html, body, #root {
    height: 100dvh !important;
    max-height: 100dvh !important;
  }
}
`;
