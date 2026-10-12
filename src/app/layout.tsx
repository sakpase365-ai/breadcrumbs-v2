import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/400-italic.css';
import './globals.css';
import SettingsBootstrap from '@/components/SettingsBootstrap';
import { ClientProviders } from '@/components/ClientProviders';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D0D0D',
};

export const metadata: Metadata = {
  title: 'Breadcrumbs',
  description: 'Leave something that lasts.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Breadcrumbs',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="app-atmosphere" aria-hidden="true" />
        <ClientProviders>
          <SettingsBootstrap />
          <div className="relative z-10 min-h-screen">{children}</div>
        </ClientProviders>
      </body>
    </html>
  );
}
