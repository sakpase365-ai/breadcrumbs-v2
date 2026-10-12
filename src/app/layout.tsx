import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './globals.css';
import VariantNavigation from '@/components/iroh/Navigation';
import SettingsBootstrap from '@/components/SettingsBootstrap';
import { ClientProviders } from '@/components/ClientProviders';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#070a13',
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
          <VariantNavigation />
          <div className="relative z-10 min-h-screen">{children}</div>
        </ClientProviders>
      </body>
    </html>
  );
}
