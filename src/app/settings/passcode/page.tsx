'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { readPasscodeData, savePasscode, disablePasscode } from '@/lib/passcode';

type Flow = 'loading' | 'disabled' | 'enabled' | 'setup-pin' | 'setup-confirm' | 'change-pin' | 'change-confirm';

export default function PasscodePage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [flow,         setFlow]         = useState<Flow>('loading');
  const [pin,          setPin]          = useState('');
  const [confirmedPin, setConfirmedPin] = useState('');
  const [error,        setError]        = useState('');
  const [saving,       setSaving]       = useState(false);
  const [showDisable,  setShowDisable]  = useState(false);

  useEffect(() => {
    const data = readPasscodeData();
    setFlow(data.enabled ? 'enabled' : 'disabled');
  }, []);

  useEffect(() => {
    if (flow === 'setup-pin' || flow === 'change-pin') {
      setPin(''); setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (flow === 'setup-confirm' || flow === 'change-confirm') {
      setConfirmedPin(''); setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [flow]);

  async function handleSavePin(p: string, confirmed: string) {
    if (p !== confirmed) {
      setError("PINs don't match. Try again.");
      setFlow(flow === 'change-confirm' ? 'change-pin' : 'setup-pin');
      return;
    }
    if (p.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setSaving(true);
    try { await savePasscode(p); setFlow('enabled'); }
    finally { setSaving(false); }
  }

  function handleDisable() {
    disablePasscode();
    setShowDisable(false);
    setFlow('disabled');
  }

  const PinDots = ({ value }: { value: string }) => (
    <div className="flex gap-4 justify-center py-4" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`w-3 h-3 rounded-full border-2 transition-colors ${i < value.length ? 'bg-foreground border-foreground' : 'bg-transparent border-border'}`} />
      ))}
    </div>
  );

  const isEnterFlow = flow === 'setup-pin' || flow === 'change-pin';
  const isConfirmFlow = flow === 'setup-confirm' || flow === 'change-confirm';
  const currentValue = isEnterFlow ? pin : confirmedPin;
  const setCurrentValue = isEnterFlow
    ? (v: string) => { setPin(v); setError(''); }
    : (v: string) => { setConfirmedPin(v); setError(''); };

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => {
            if (isConfirmFlow) setFlow(flow === 'change-confirm' ? 'change-pin' : 'setup-pin');
            else router.push('/settings');
          }} className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center" aria-label="Go back">
            ← Back
          </button>
          <h1 className="font-display text-xl text-foreground">Passcode Lock</h1>
          <div className="w-16" />
        </div>

        {flow === 'loading' && <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>}

        {flow === 'disabled' && (
          <div className="space-y-6 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-5 space-y-2">
              <p className="text-[15px] text-foreground">Passcode Lock is off</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Set a 4–6 digit PIN to protect your Breadcrumbs from others who may pick up your device.</p>
            </div>
            <button type="button" onClick={() => setFlow('setup-pin')} className="w-full py-4 border border-foreground text-foreground text-sm rounded-sm hover:bg-foreground hover:text-background transition min-h-[52px]">
              Turn On Passcode
            </button>
          </div>
        )}

        {(isEnterFlow || isConfirmFlow) && (
          <div className="space-y-6 pt-4 text-center">
            <p className="text-[15px] text-foreground">
              {isConfirmFlow ? 'Confirm your PIN' : flow === 'change-pin' ? 'Enter your new PIN' : 'Choose a PIN'}
            </p>
            <p className="text-sm text-muted-foreground">{isConfirmFlow ? 'Enter the same digits again.' : 'Use 4 to 6 digits.'}</p>
            <PinDots value={currentValue} />
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value.replace(/\D/g, ''))}
              className="sr-only"
              aria-label={isConfirmFlow ? 'Confirm new PIN' : 'Enter new PIN'}
              autoComplete="off"
            />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => {
                if (isConfirmFlow) setFlow(flow === 'change-confirm' ? 'change-pin' : 'setup-pin');
                else setFlow(flow === 'change-pin' ? 'enabled' : 'disabled');
              }} className="flex-1 py-3.5 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[52px]">
                {isConfirmFlow ? 'Back' : 'Cancel'}
              </button>
              {isConfirmFlow ? (
                <button type="button" onClick={() => void handleSavePin(pin, confirmedPin)} disabled={confirmedPin.length < 4 || saving} className="flex-1 py-3.5 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]">
                  {saving ? 'Saving…' : 'Set PIN'}
                </button>
              ) : (
                <button type="button" onClick={() => setFlow(flow === 'change-pin' ? 'change-confirm' : 'setup-confirm')} disabled={pin.length < 4} className="flex-1 py-3.5 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[52px]">
                  Next
                </button>
              )}
            </div>
            {error && <p className="text-sm text-red-400/80" role="alert">{error}</p>}
          </div>
        )}

        {flow === 'enabled' && (
          <div className="space-y-4 pt-4">
            <div className="border border-border/70 rounded-sm px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[15px] text-foreground">Passcode Lock is on</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your Breadcrumbs are protected.</p>
              </div>
              <span className="text-xs text-emerald-500/80 uppercase tracking-widest">Active</span>
            </div>
            <button type="button" onClick={() => { setPin(''); setFlow('change-pin'); }} className="w-full border border-border/70 rounded-sm px-5 py-4 text-left text-[15px] text-foreground hover:border-foreground/30 transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
              Change PIN →
            </button>
            {!showDisable ? (
              <button type="button" onClick={() => setShowDisable(true)} className="w-full border border-border/70 rounded-sm px-5 py-4 text-left text-[15px] text-muted-foreground hover:border-foreground/30 hover:text-foreground transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
                Turn Off Passcode
              </button>
            ) : (
              <div className="border border-border/70 rounded-sm px-5 py-4 space-y-3">
                <p className="text-sm text-foreground">Turn off Passcode Lock?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Anyone with access to your device will be able to open your Breadcrumbs.</p>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowDisable(false)} className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[44px]">Keep it on</button>
                  <button type="button" onClick={handleDisable} className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground hover:text-foreground transition min-h-[44px]">Turn off</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
