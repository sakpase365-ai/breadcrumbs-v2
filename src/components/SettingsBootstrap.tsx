'use client';

import { useEffect } from 'react';
import { applyDisplaySettings, readUserSettings } from '@/lib/user-settings';

export default function SettingsBootstrap() {
  useEffect(() => {
    applyDisplaySettings(readUserSettings());
  }, []);

  return null;
}
