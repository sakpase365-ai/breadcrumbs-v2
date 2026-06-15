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

// ── Primitives ────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-label text-muted-foreground px-1 pt-2">{children}</p>
  );
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground/60 px-1 -mt-1 mb-1 leading-relaxed">{children}</p>
  );
}

function ToggleSwitch({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors ${
        checked
          ? 'bg-foreground border-foreground'
          : 'bg-transparent border-border'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full transition-transform ${
          checked
            ? 'translate-x-5 bg-background'
            : 'translate-x-1 bg-muted-foreground/50'
        }`}
      />
    </div>
  );
}

interface ToggleRowProps {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full border border-border/70 rounded-sm px-4 py-4 text-left hover:border-foreground/30 transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5 flex-1">
          <p className="text-[0.9375rem] text-foreground leading-snug">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
        </div>
        <ToggleSwitch checked={checked} label={title} />
      </div>
    </button>
  );
}

interface OptionButtonProps<T extends string> {
  value: T;
  current: T;
  label: string;
  description?: string;
  onClick: (value: T) => void;
}

function OptionButton<T extends string>({
  value,
  current,
  label,
  description,
  onClick,
}: OptionButtonProps<T>) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 min-w-[60px] px-3 py-2.5 text-sm border rounded-sm transition text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${
        active
          ? 'border-foreground text-foreground bg-foreground/5'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground/80'
      }`}
      aria-pressed={active}
      title={description}
    >
      {label}
    </button>
  );
}

interface LinkRowProps {
  title: string;
  href: string;
  description?: string;
  badge?: string;
}

function LinkRow({ title, href, description, badge }: LinkRowProps) {
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
        {badge && <span className="text-xs text-emerald-500/80 uppercase tracking-widest">{badge}</span>}
        <span className="text-muted-foreground/60 text-base">→</span>
      </div>
    </Link>
  );
}

function InfoRow({ title, description, tag }: { title: string; description: string; tag: string }) {
  return (
    <div className="w-full border border-border/70 rounded-sm px-4 py-4 flex items-start justify-between gap-3 min-h-[52px] opacity-55">
      <div className="space-y-0.5 flex-1">
        <p className="text-[0.9375rem] text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <span className="text-[0.625rem] uppercase tracking-widest text-muted-foreground shrink-0 pt-1">{tag}</span>
    </div>
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
      <main className="min-h-screen bg-background px-5 py-8">
        <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center"
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1 className="font-display text-xl text-foreground">Settings</h1>
          <div className="w-16" />
        </div>

        {/* ── 1. Experience ── */}
        <section className="space-y-3" aria-labelledby="section-experience">
          <SectionLabel>
            <span id="section-experience">Experience</span>
          </SectionLabel>
          <SectionDescription>
            Adjust how the app looks and feels.
          </SectionDescription>

          {/* Appearance */}
          <div className="border border-border/70 rounded-sm px-4 py-4 space-y-3">
            <p className="text-[0.9375rem] text-foreground">Appearance</p>
            <div className="flex gap-2">
              <OptionButton<AppearanceSetting>
                value="system"
                current={settings.appearance}
                label="System"
                description="Follow your device's light or dark setting"
                onClick={(appearance) => updateSettings({ appearance })}
              />
              <OptionButton<AppearanceSetting>
                value="light"
                current={settings.appearance}
                label="Light"
                description="Always use the light theme"
                onClick={(appearance) => updateSettings({ appearance })}
              />
              <OptionButton<AppearanceSetting>
                value="dark"
                current={settings.appearance}
                label="Dark"
                description="Always use the dark theme"
                onClick={(appearance) => updateSettings({ appearance })}
              />
            </div>
          </div>

          {/* Text Size */}
          <div className="border border-border/70 rounded-sm overflow-hidden">
            {(
              [
                { value: 'small',  label: 'Small',       sub: 'Compact text' },
                { value: 'medium', label: 'Standard',    sub: 'Default reading size' },
                { value: 'large',  label: 'Large',       sub: 'Easier on the eyes' },
                { value: 'xl',     label: 'Extra Large', sub: 'Comfortable reading at any age' },
              ] as { value: TextSizeSetting; label: string; sub: string }[]
            ).map((opt, i) => (
              <div key={opt.value}>
                {i > 0 && <div className="h-px bg-border/40 mx-4" />}
                <button
                  type="button"
                  onClick={() => updateSettings({ textSize: opt.value })}
                  aria-pressed={settings.textSize === opt.value}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px] text-left hover:bg-foreground/5 transition"
                >
                  <div>
                    <p className="text-[0.9375rem] text-foreground leading-snug">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </div>
                  {settings.textSize === opt.value && (
                    <span className="text-foreground text-base shrink-0">✓</span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Reduce Motion */}
          <ToggleRow
            title="Reduce Motion"
            description="Minimize animations throughout the app."
            checked={settings.reduceMotion}
            onChange={(reduceMotion) => updateSettings({ reduceMotion })}
          />
        </section>

        {/* ── 2. Security ── */}
        <section className="space-y-3" aria-labelledby="section-security">
          <SectionLabel>
            <span id="section-security">Security</span>
          </SectionLabel>
          <SectionDescription>
            Protect your family&apos;s most personal memories.
          </SectionDescription>

          <InfoRow
            title="Face ID / Touch ID"
            description="Available in the Breadcrumbs app."
            tag="App Only"
          />

          <LinkRow
            title="Passcode Lock"
            description={passcodeEnabled ? 'PIN required to open your library.' : 'Add a PIN to protect your library.'}
            href="/settings/passcode"
            badge={passcodeEnabled ? 'On' : undefined}
          />

          <LinkRow
            title="Two-Factor Authentication"
            description="Add a second layer of security with an authenticator app."
            href="/settings/two-factor-auth"
          />

          <LinkRow
            title="Manage Devices"
            description="See where you're signed in and remove old sessions."
            href="/settings/devices"
          />
        </section>

        {/* ── Sign Out ── */}
        <div className="pt-2 border-t border-border/30">
          {!confirmSignOut ? (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="w-full py-4 text-[0.9375rem] text-muted-foreground hover:text-foreground transition text-left px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 rounded-sm"
            >
              Sign Out
            </button>
          ) : (
            <div className="border border-border/70 rounded-sm px-4 py-4 space-y-4">
              <p className="text-[0.9375rem] text-foreground">
                Are you sure you want to sign out?
              </p>
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
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
