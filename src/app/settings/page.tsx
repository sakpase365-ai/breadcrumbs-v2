'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_USER_SETTINGS,
  applyDisplaySettings,
  readUserSettings,
  saveUserSettings,
  type AppearanceSetting,
  type TextSizeSetting,
  type UserSettings,
} from '@/lib/user-settings';
import { readPasscodeData } from '@/lib/passcode';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import {
  InlineAction,
  Row,
  RowDivider,
  ScreenContainer,
  ScreenContent,
  ScreenHeader,
  SectionHeading,
  SegmentedOption,
  SurfaceCard,
  ToggleVisual,
} from '@/components/ui/design-primitives';

interface SettingsLinkRowProps {
  title: string;
  href: string;
  description?: string;
  badge?: string;
}

function SettingsLinkRow({ title, href, description, badge }: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className="w-full border border-border/70 rounded-sm px-4 py-4 text-left hover:border-foreground/30 transition flex items-center justify-between gap-3 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
    >
      <div className="space-y-0.5 flex-1">
        <p className="text-[0.9375rem] text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge ? <span className="text-xs text-emerald-500/80 uppercase tracking-widest">{badge}</span> : null}
        <span className="text-muted-foreground/60 text-base">→</span>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [settings,        setSettings]        = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading,         setLoading]         = useState(true);
  const [passcodeEnabled, setPasscodeEnabled] = useState(false);
  const [confirmSignOut,  setConfirmSignOut]  = useState(false);
  const [signingOut,      setSigningOut]      = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) { router.push('/login?next=/settings'); return; }
        if (res.status === 422) { router.push('/setup'); return; }
      } finally {
        const restored = readUserSettings();
        setSettings(restored);
        applyDisplaySettings(restored);
        setPasscodeEnabled(readPasscodeData().enabled);
        setLoading(false);
      }
    })();
  }, [router]);

  function updateSettings(partial: Partial<UserSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveUserSettings(next);
      applyDisplaySettings(next);
      return next;
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = getBrowserSupabase();
      if (supabase) await supabase.auth.signOut();
      try { sessionStorage.removeItem('breadcrumbs_unlocked'); } catch { /* ignore */ }
      router.push('/login');
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer className="py-8">
        <ScreenContent className="space-y-4">
          <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>
        </ScreenContent>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenContent>
        <ScreenHeader
          title="Settings"
          leftAction={(
            <InlineAction onClick={() => router.back()} ariaLabel="Go back">
              <span className="text-sm">← Back</span>
            </InlineAction>
          )}
        />

        <section className="space-y-3" aria-labelledby="section-experience">
          <SectionHeading
            id="section-experience"
            title="Experience"
            description="Adjust how the app looks and feels."
          />

          <SurfaceCard className="px-4 py-4 space-y-3">
            <p className="text-[0.9375rem] text-foreground">Appearance</p>
            <div className="flex gap-2">
              <SegmentedOption
                active={settings.appearance === 'system'}
                label="System"
                onClick={() => updateSettings({ appearance: 'system' })}
              />
              <SegmentedOption
                active={settings.appearance === 'light'}
                label="Light"
                onClick={() => updateSettings({ appearance: 'light' })}
              />
              <SegmentedOption
                active={settings.appearance === 'dark'}
                label="Dark"
                onClick={() => updateSettings({ appearance: 'dark' })}
              />
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            {(
              [
                { value: 'small', label: 'Small', sub: 'Compact text' },
                { value: 'medium', label: 'Standard', sub: 'Default reading size' },
                { value: 'large', label: 'Large', sub: 'Easier on the eyes' },
                { value: 'xl', label: 'Extra Large', sub: 'Comfortable reading at any age' },
              ] as { value: TextSizeSetting; label: string; sub: string }[]
            ).map((opt, idx) => (
              <div key={opt.value}>
                {idx > 0 ? <RowDivider /> : null}
                <Row
                  title={opt.label}
                  subtitle={opt.sub}
                  onClick={() => updateSettings({ textSize: opt.value })}
                  right={settings.textSize === opt.value ? <span className="text-foreground text-base">✓</span> : null}
                />
              </div>
            ))}
          </SurfaceCard>

          <SurfaceCard>
            <Row
              title="Reduce Motion"
              subtitle="Minimize animations throughout the app."
              onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
              right={<ToggleVisual checked={settings.reduceMotion} label="Reduce Motion" />}
            />
          </SurfaceCard>
        </section>

        <section className="space-y-3" aria-labelledby="section-security">
          <SectionHeading
            id="section-security"
            title="Security"
            description="Protect your family's most personal memories."
          />

          <SurfaceCard>
            <Row
              title="Face ID / Touch ID"
              subtitle="Available in the Breadcrumbs app."
              right={<span className="text-[0.625rem] uppercase tracking-widest text-muted-foreground">App Only</span>}
              disabled
            />
          </SurfaceCard>

          <SettingsLinkRow
            title="Passcode Lock"
            description={passcodeEnabled ? 'PIN required to open your library.' : 'Add a PIN to protect your library.'}
            href="/settings/passcode"
            badge={passcodeEnabled ? 'On' : undefined}
          />

          <SettingsLinkRow
            title="Two-Factor Authentication"
            description="Add a second layer of security with an authenticator app."
            href="/settings/two-factor-auth"
          />

          <SettingsLinkRow
            title="Manage Devices"
            description="See where you're signed in and remove old sessions."
            href="/settings/devices"
          />
        </section>

        <section className="pt-2 border-t border-border/30">
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="w-full py-4 text-[0.9375rem] text-muted-foreground hover:text-foreground transition text-left px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded-sm"
            >
              Sign Out
            </button>
          ) : (
            <SurfaceCard className="px-4 py-4 space-y-4">
              <p className="text-[0.9375rem] text-foreground">Are you sure you want to sign out?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  className="flex-1 py-2.5 text-sm border border-border rounded-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="flex-1 py-2.5 text-sm border border-foreground/40 rounded-sm text-foreground hover:bg-foreground/5 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            </SurfaceCard>
          )}
        </section>
      </ScreenContent>
    </ScreenContainer>
  );
}
