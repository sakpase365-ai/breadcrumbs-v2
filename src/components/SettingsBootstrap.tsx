'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { applyDisplaySettings, readUserSettings } from '@/lib/user-settings';
import { readPasscodeData, isUnlockedThisSession } from '@/lib/passcode';

const PASSCODE_EXEMPT_PREFIXES = [
  '/login',
  '/signup',
  '/auth/',
  '/unlock',
  '/invite',
  '/privacy-policy',
  '/terms-of-service',
];

function isExempt(path: string): boolean {
  return PASSCODE_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export default function SettingsBootstrap() {
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    applyDisplaySettings(readUserSettings());

    if (isExempt(pathname)) return;
    const passcode = readPasscodeData();
    if (passcode.enabled && !isUnlockedThisSession()) {
      router.replace(`/unlock?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  return null;
}
