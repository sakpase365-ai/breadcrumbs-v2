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
          <p className="text-[15px] text-foreground leading-snug">{title}</p>
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
  external?: boolean;
  description?: string;
}

function LinkRow({ title, href, external = false, description }: LinkRowProps) {
  const cls =
    'w-full border border-border/70 rounded-sm px-4 py-4 text-left hover:border-foreground/30 transition flex items-center justify-between gap-3 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40';
  const content = (
    <>
      <div className="space-y-0.5 flex-1">
        <p className="text-[15px] text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <span className="text-muted-foreground/60 text-base shrink-0">
        {external ? '↗' : '→'}
      </span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {content}
    </Link>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="w-full border border-border/70 rounded-sm px-4 py-4 flex items-center justify-between gap-3 min-h-[52px]">
      <p className="text-[15px] text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function ComingSoonRow({ title, description }: { title: string; description?: string }) {
  return (
    <div className="w-full border border-border/70 rounded-sm px-4 py-4 flex items-start justify-between gap-3 min-h-[52px] opacity-60">
      <div className="space-y-0.5 flex-1">
        <p className="text-[15px] text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 pt-1">
        Coming Soon
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading]   = useState(true);

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
            Adjust how the app looks and feels across all screens.
          </SectionDescription>

          {/* Appearance */}
          <div className="border border-border/70 rounded-sm px-4 py-4 space-y-3">
            <p className="text-[15px] text-foreground">Appearance</p>
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
          <div className="border border-border/70 rounded-sm px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[15px] text-foreground">Text Size</p>
              <p className="text-xs text-muted-foreground capitalize">
                {settings.textSize === 'medium' ? 'Standard' : settings.textSize === 'xl' ? 'Extra Large' : settings.textSize}
              </p>
            </div>
            <div className="flex gap-2">
              <OptionButton<TextSizeSetting>
                value="small"
                current={settings.textSize}
                label="Small"
                onClick={(textSize) => updateSettings({ textSize })}
              />
              <OptionButton<TextSizeSetting>
                value="medium"
                current={settings.textSize}
                label="Standard"
                onClick={(textSize) => updateSettings({ textSize })}
              />
              <OptionButton<TextSizeSetting>
                value="large"
                current={settings.textSize}
                label="Large"
                onClick={(textSize) => updateSettings({ textSize })}
              />
              <OptionButton<TextSizeSetting>
                value="xl"
                current={settings.textSize}
                label="XL"
                description="Extra large text for easier reading"
                onClick={(textSize) => updateSettings({ textSize })}
              />
            </div>
            <p className="text-xs text-muted-foreground/50">
              Changes apply immediately across all screens.
            </p>
          </div>

          {/* Reduce Motion */}
          <ToggleRow
            title="Reduce Motion"
            description="Minimize animations and transitions throughout the app."
            checked={settings.reduceMotion}
            onChange={(reduceMotion) => updateSettings({ reduceMotion })}
          />
        </section>

        {/* ── 2. Capture ── */}
        <section className="space-y-3" aria-labelledby="section-capture">
          <SectionLabel>
            <span id="section-capture">Capture</span>
          </SectionLabel>
          <SectionDescription>
            Protect your memories and avoid accidental loss.
          </SectionDescription>

          <ToggleRow
            title="Auto-Save Drafts"
            description="Keep your writing safe if you leave the capture screen before saving."
            checked={settings.autoSaveDrafts}
            onChange={(autoSaveDrafts) => updateSettings({ autoSaveDrafts })}
          />
          <ToggleRow
            title="Confirm Before Saving"
            description="Show a confirmation step before a breadcrumb is saved to your library."
            checked={settings.confirmBeforePublishing}
            onChange={(confirmBeforePublishing) => updateSettings({ confirmBeforePublishing })}
          />
          <ToggleRow
            title="Audio Transcription"
            description="Automatically generate a text transcript of voice recordings to improve search and Family Agent answers."
            checked={settings.automaticAudioTranscription}
            onChange={(automaticAudioTranscription) => updateSettings({ automaticAudioTranscription })}
          />
        </section>

        {/* ── 3. Privacy & Security ── */}
        <section className="space-y-3" aria-labelledby="section-privacy">
          <SectionLabel>
            <span id="section-privacy">Privacy &amp; Security</span>
          </SectionLabel>
          <SectionDescription>
            Protect your family&apos;s most personal memories.
          </SectionDescription>

          <ComingSoonRow
            title="Passcode Lock"
            description="Require a PIN to open the app."
          />
          <ComingSoonRow
            title="Face ID / Touch ID"
            description="Use biometrics instead of typing your PIN."
          />
          <ComingSoonRow
            title="Two-Factor Authentication"
            description="Add a second layer of security to your account."
          />
          <ComingSoonRow
            title="Manage Devices"
            description="See where you're signed in and remove old sessions."
          />
        </section>

        {/* ── 4. Support ── */}
        <section className="space-y-3" aria-labelledby="section-support">
          <SectionLabel>
            <span id="section-support">Support</span>
          </SectionLabel>

          <LinkRow
            title="Help Center"
            description="Learn how to use Breadcrumbs."
            href="/help-center"
          />
          <LinkRow
            title="Contact Support"
            description="Reach our team directly."
            href="mailto:support@breadcrumbs.app"
            external
          />
          <LinkRow
            title="Report an Issue"
            description="Something not working? Let us know."
            href="mailto:support@breadcrumbs.app?subject=Issue%20Report"
            external
          />
        </section>

        {/* ── 5. About ── */}
        <section className="space-y-3" aria-labelledby="section-about">
          <SectionLabel>
            <span id="section-about">About</span>
          </SectionLabel>

          <InfoRow
            title="App Version"
            value={process.env.NEXT_PUBLIC_APP_VERSION ?? '2.0.0'}
          />
          <LinkRow title="Privacy Policy" href="/privacy-policy" />
          <LinkRow title="Terms of Service" href="/terms-of-service" />
        </section>

      </div>
    </main>
  );
}
