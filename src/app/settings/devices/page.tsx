'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

interface CurrentDevice {
  signedInAt: string;
  email:      string;
}

export default function DevicesPage() {
  const router = useRouter();

  const [device,      setDevice]      = useState<CurrentDevice | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [signingOut,  setSigningOut]  = useState(false);
  const [signedOut,   setSignedOut]   = useState(false);
  const [error,       setError]       = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login?next=/settings/devices'); return; }
      setDevice({ signedInAt: new Date().toISOString(), email: session.user.email ?? '' });
      setLoading(false);
    })();
  }, [router]);

  async function handleSignOutOthers() {
    const supabase = getBrowserSupabase();
    if (!supabase || signingOut) return;
    setSigningOut(true); setError('');
    try {
      const { error: err } = await supabase.auth.signOut({ scope: 'others' });
      if (err) { setError('Could not sign out other devices. Try again.'); return; }
      setSignedOut(true); setShowConfirm(false);
    } finally { setSigningOut(false); }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-xl mx-auto space-y-8 pb-20">

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => router.push('/settings')} className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center" aria-label="Back to Settings">← Back</button>
          <h1 className="font-display text-xl text-foreground">Manage Devices</h1>
          <div className="w-16" />
        </div>

        {loading && <p className="text-sm text-muted-foreground/50 animate-pulse">Loading…</p>}

        {!loading && device && (
          <div className="space-y-4">
            <div>
              <p className="type-label text-muted-foreground px-1 pt-2 pb-2">This device</p>
              <div className="border border-border/70 rounded-sm px-5 py-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] text-foreground">Current session</p>
                  <span className="text-xs text-emerald-500/80 uppercase tracking-widest">Active</span>
                </div>
                <p className="text-xs text-muted-foreground">{device.email}</p>
                <p className="text-xs text-muted-foreground/50">Signed in {formatDate(device.signedInAt)}</p>
              </div>
            </div>

            <div>
              <p className="type-label text-muted-foreground px-1 pt-2 pb-2">Other devices</p>
              {signedOut ? (
                <div className="border border-border/70 rounded-sm px-5 py-4">
                  <p className="text-[15px] text-foreground">All other devices signed out.</p>
                  <p className="text-xs text-muted-foreground mt-1">Only this device has access to your Breadcrumbs now.</p>
                </div>
              ) : !showConfirm ? (
                <button type="button" onClick={() => setShowConfirm(true)} className="w-full border border-border/70 rounded-sm px-5 py-4 text-left hover:border-foreground/30 transition min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[15px] text-foreground">Sign out all other devices</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Removes access from any other browsers or devices.</p>
                    </div>
                    <span className="text-muted-foreground/60 shrink-0">→</span>
                  </div>
                </button>
              ) : (
                <div className="border border-border/70 rounded-sm px-5 py-4 space-y-3">
                  <p className="text-sm text-foreground">Sign out all other devices?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">This will end all other active sessions. You will remain signed in on this device.</p>
                  {error && <p className="text-xs text-red-400/80" role="alert">{error}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowConfirm(false)} className="flex-1 py-3 border border-border text-muted-foreground text-sm rounded-sm hover:border-foreground/40 transition min-h-[44px]">Cancel</button>
                    <button type="button" onClick={() => void handleSignOutOthers()} disabled={signingOut} className="flex-1 py-3 border border-foreground text-foreground text-sm rounded-sm disabled:opacity-30 hover:bg-foreground hover:text-background transition min-h-[44px]">
                      {signingOut ? 'Signing out…' : 'Sign out others'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
