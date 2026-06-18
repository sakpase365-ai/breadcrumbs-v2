'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  readUserSettings,
  saveUserSettings,
  applyDisplaySettings,
  DEFAULT_USER_SETTINGS,
  type UserSettings,
  type AppearanceSetting,
  type TextSizeSetting,
} from '@/lib/user-settings';
import { readPasscodeData } from '@/lib/passcode';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { Row, RowDivider, SectionHeading, ToggleVisual } from '@/components/ui/design-primitives';

type SheetView = 'main' | 'appearance' | 'text-size';

export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

function Chevron() {
  return <span className="text-muted-foreground/50 text-sm">›</span>;
}

function Check() {
  return <span className="text-foreground text-base leading-none">✓</span>;
}

// ── Sub-views ──────────────────────────────────────────────────

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-2 pb-4 border-b border-border/30">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition min-w-[44px] min-h-[44px] flex items-center"
      >
        ← Back
      </button>
      <p className="text-[0.9375rem] font-medium text-foreground">{title}</p>
    </div>
  );
}

function AppearanceView({
  settings,
  onUpdate,
  onBack,
}: {
  settings: UserSettings;
  onUpdate: (p: Partial<UserSettings>) => void;
  onBack: () => void;
}) {
  const options: { value: AppearanceSetting; label: string; description: string }[] = [
    { value: 'system', label: 'System Default', description: 'Follows your device light or dark setting' },
    { value: 'light',  label: 'Light Mode',     description: 'Always use the warm light theme' },
    { value: 'dark',   label: 'Dark Mode',       description: 'Always use the dark theme' },
  ];
  return (
    <div>
      <SubHeader title="Appearance" onBack={onBack} />
      {options.map((opt, i) => (
        <div key={opt.value}>
          {i > 0 && <RowDivider className="mx-5 bg-border/30" />}
          <Row
            title={opt.label}
            subtitle={opt.description}
            right={settings.appearance === opt.value ? <Check /> : null}
            onClick={() => onUpdate({ appearance: opt.value })}
          />
        </div>
      ))}
      <div className="pb-8" />
    </div>
  );
}

function TextSizeView({
  settings,
  onUpdate,
  onBack,
}: {
  settings: UserSettings;
  onUpdate: (p: Partial<UserSettings>) => void;
  onBack: () => void;
}) {
  const options: { value: TextSizeSetting; label: string; description: string }[] = [
    { value: 'small',  label: 'Small',       description: 'Compact — fits more on screen' },
    { value: 'medium', label: 'Standard',    description: 'Default reading size' },
    { value: 'large',  label: 'Large',       description: 'Easier on the eyes' },
    { value: 'xl',     label: 'Extra Large', description: 'Comfortable reading at any age' },
  ];
  return (
    <div>
      <SubHeader title="Text Size" onBack={onBack} />
      {options.map((opt, i) => (
        <div key={opt.value}>
          {i > 0 && <RowDivider className="mx-5 bg-border/30" />}
          <Row
            title={opt.label}
            subtitle={opt.description}
            right={settings.textSize === opt.value ? <Check /> : null}
            onClick={() => onUpdate({ textSize: opt.value })}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground/40 px-5 pt-4 pb-8 leading-relaxed">
        Changes apply immediately across all screens and persist after you close the app.
      </p>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────

function MainView({
  settings,
  passcodeEnabled,
  onUpdate,
  onNavigate,
  navigatePage,
  confirmSignOut,
  setConfirmSignOut,
  signingOut,
  onSignOut,
}: {
  settings: UserSettings;
  passcodeEnabled: boolean;
  onUpdate: (p: Partial<UserSettings>) => void;
  onNavigate: (v: SheetView) => void;
  navigatePage: (path: string) => void;
  confirmSignOut: boolean;
  setConfirmSignOut: (v: boolean) => void;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const appearanceLabel =
    settings.appearance === 'system' ? 'System' :
    settings.appearance === 'light'  ? 'Light'  : 'Dark';

  const textSizeLabel =
    settings.textSize === 'small'  ? 'Small'       :
    settings.textSize === 'medium' ? 'Standard'    :
    settings.textSize === 'large'  ? 'Large'       : 'Extra Large';

  return (
    <div>
      {/* ── Experience ── */}
      <SectionHeading
        title="Experience"
        className="px-5 pt-6 pb-2"
        titleClassName="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground/50"
      />

      <Row
        title="Appearance"
        right={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{appearanceLabel}</span>
            <Chevron />
          </div>
        }
        onClick={() => onNavigate('appearance')}
      />
      <RowDivider className="mx-5 bg-border/30" />
      <Row
        title="Text Size"
        right={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{textSizeLabel}</span>
            <Chevron />
          </div>
        }
        onClick={() => onNavigate('text-size')}
      />
      <RowDivider className="mx-5 bg-border/30" />
      <Row
        title="Reduce Motion"
        subtitle="Minimize animations throughout the app"
        right={<ToggleVisual checked={settings.reduceMotion} label="Reduce Motion" />}
        onClick={() => onUpdate({ reduceMotion: !settings.reduceMotion })}
      />

      {/* ── Security ── */}
      <SectionHeading
        title="Security"
        className="px-5 pt-6 pb-2"
        titleClassName="text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground/50"
      />

      <Row
        title="Face ID / Touch ID"
        subtitle="Available in the Breadcrumbs app"
        right={
          <span className="text-[0.625rem] uppercase tracking-widest text-muted-foreground/50">
            App Only
          </span>
        }
        disabled
      />
      <RowDivider className="mx-5 bg-border/30" />
      <Row
        title="Passcode Lock"
        subtitle={passcodeEnabled ? 'PIN required to open your library' : 'Add a PIN to protect your library'}
        right={
          <div className="flex items-center gap-2">
            {passcodeEnabled && (
              <span className="text-xs text-emerald-500/80 uppercase tracking-widest">On</span>
            )}
            <Chevron />
          </div>
        }
        onClick={() => navigatePage('/settings/passcode')}
      />
      <RowDivider className="mx-5 bg-border/30" />
      <Row
        title="Two-Factor Authentication"
        subtitle="Add a second layer of security"
        right={<Chevron />}
        onClick={() => navigatePage('/settings/two-factor-auth')}
      />
      <RowDivider className="mx-5 bg-border/30" />
      <Row
        title="Manage Devices"
        subtitle="See where you're signed in"
        right={<Chevron />}
        onClick={() => navigatePage('/settings/devices')}
      />

      {/* ── Sign Out ── */}
      <div className="mt-5 mx-5 pt-5 border-t border-border/30 pb-safe">
        {!confirmSignOut ? (
          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="w-full py-3.5 text-[0.9375rem] text-muted-foreground hover:text-foreground transition text-left"
          >
            Sign Out
          </button>
        ) : (
          <div className="space-y-3 pb-2">
            <p className="text-[0.9375rem] text-foreground">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                className="flex-1 py-3 text-sm border border-border rounded-sm text-muted-foreground hover:border-foreground/30 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="flex-1 py-3 text-sm border border-foreground/40 rounded-sm text-foreground hover:bg-foreground/5 transition disabled:opacity-50"
              >
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Safe area bottom padding */}
      <div className="h-6" />
    </div>
  );
}

// ── Sheet ──────────────────────────────────────────────────────

export default function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const router = useRouter();
  const [view,           setView]           = useState<SheetView>('main');
  const [settings,       setSettings]       = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [passcodeEnabled,setPasscodeEnabled] = useState(false);
  const [confirmSignOut, setConfirmSignOut]  = useState(false);
  const [signingOut,     setSigningOut]      = useState(false);

  useEffect(() => {
    if (open) {
      setSettings(readUserSettings());
      setPasscodeEnabled(readPasscodeData().enabled);
      setConfirmSignOut(false);
    } else {
      const t = setTimeout(() => setView('main'), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

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
      onClose();
      router.push('/login');
    } finally {
      setSigningOut(false);
    }
  }

  function navigatePage(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 touch-none"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border/60" />
            </div>

            {/* Sheet header (main view only) */}
            {view === 'main' && (
              <div className="flex items-center justify-between px-5 pt-1 pb-2 flex-shrink-0">
                <h2 className="font-display text-xl text-foreground">Settings</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition min-w-[44px] min-h-[44px] flex items-center justify-end"
                >
                  Done
                </button>
              </div>
            )}

            {/* Scrollable body */}
            <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: '80vh' }}>
              <AnimatePresence mode="wait" initial={false}>
                {view === 'main' && (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MainView
                      settings={settings}
                      passcodeEnabled={passcodeEnabled}
                      onUpdate={updateSettings}
                      onNavigate={setView}
                      navigatePage={navigatePage}
                      confirmSignOut={confirmSignOut}
                      setConfirmSignOut={setConfirmSignOut}
                      signingOut={signingOut}
                      onSignOut={() => void handleSignOut()}
                    />
                  </motion.div>
                )}

                {view === 'appearance' && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.15 }}
                  >
                    <AppearanceView
                      settings={settings}
                      onUpdate={updateSettings}
                      onBack={() => setView('main')}
                    />
                  </motion.div>
                )}

                {view === 'text-size' && (
                  <motion.div
                    key="text-size"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.15 }}
                  >
                    <TextSizeView
                      settings={settings}
                      onUpdate={updateSettings}
                      onBack={() => setView('main')}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
