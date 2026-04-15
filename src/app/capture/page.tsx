'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Stage = 'loading' | 'prompted' | 'writing' | 'follow-up' | 'done' | 'error';

// ── Hard-coded demo profile (replace with Supabase auth session in production) ──
const DEMO_PROFILE = {
  parentId:  'demo-parent-001',
  parentName: 'Sak',
  childName:  'Cairo',
  childDob:   '2014-01-01', // adjust to Cairo's actual DOB
};

export default function CapturePage() {
  const router = useRouter();
  const [stage,             setStage]             = useState<Stage>('loading');
  const [prompt,            setPrompt]            = useState('');
  const [entry,             setEntry]             = useState('');
  const [followUp,          setFollowUp]          = useState('');
  const [followUpAddition,  setFollowUpAddition]  = useState('');
  const [savedEntryId,      setSavedEntryId]      = useState<string | null>(null);
  const [saving,            setSaving]            = useState(false);
  const [charCount,         setCharCount]         = useState(0);

  // ── Load daily prompt on mount ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/generate-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(DEMO_PROFILE),
        });
        const data = await res.json();
        setPrompt(data.prompt);
        setStage('prompted');
      } catch {
        setStage('error');
      }
    })();
  }, []);

  // ── Save entry → receive follow-up ───────────────────────
  async function handleSave() {
    if (!entry.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/save-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId:  DEMO_PROFILE.parentId,
          childName: DEMO_PROFILE.childName,
          childDob:  DEMO_PROFILE.childDob,
          content:   entry,
        }),
      });
      const data = await res.json();
      setFollowUp(data.followUp);
      setSavedEntryId(data.entry.id);
      setStage('follow-up');
    } catch {
      setStage('error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-warm flex flex-col items-center justify-start px-6 py-16">
      <div className="max-w-xl w-full space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-muted hover:text-navy transition"
          >
            ← Back
          </button>
          <span className="text-xs text-muted uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Loading */}
        {stage === 'loading' && (
          <div className="py-24 text-center">
            <p className="text-muted text-sm animate-pulse">Preparing today's prompt…</p>
          </div>
        )}

        {/* Prompt + Writing area */}
        {(stage === 'prompted' || stage === 'writing') && (
          <div className="space-y-6">
            <div className="border-l-4 border-gold pl-5 py-1">
              <p className="text-navy text-xl font-serif leading-relaxed">{prompt}</p>
            </div>

            <textarea
              className="w-full h-64 bg-white border border-gray-200 rounded-sm px-5 py-4 text-navy text-base leading-relaxed placeholder:text-gray-300 focus:border-gold focus:ring-0 transition"
              placeholder={`Write to ${DEMO_PROFILE.childName}…`}
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value);
                setCharCount(e.target.value.length);
                if (stage === 'prompted') setStage('writing');
              }}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{charCount} characters</span>
              <button
                onClick={handleSave}
                disabled={!entry.trim() || saving}
                className="py-3 px-8 bg-navy text-warm text-sm font-semibold rounded-sm disabled:opacity-40 hover:bg-opacity-90 transition"
              >
                {saving ? 'Saving…' : 'Save this letter'}
              </button>
            </div>
          </div>
        )}

        {/* Follow-up stage */}
        {stage === 'follow-up' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-sm px-6 py-5">
              <p className="text-xs text-muted uppercase tracking-widest mb-3">One more thought</p>
              <p className="text-navy text-lg font-serif leading-relaxed">{followUp}</p>
            </div>

            <textarea
              className="w-full h-40 bg-white border border-gray-200 rounded-sm px-5 py-4 text-navy text-base leading-relaxed placeholder:text-gray-300 focus:border-gold focus:ring-0 transition"
              placeholder="Add to your entry (optional)…"
              value={followUpAddition}
              onChange={(e) => setFollowUpAddition(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStage('done')}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-navy text-navy text-sm font-semibold rounded-sm hover:bg-navy hover:text-warm disabled:opacity-40 transition"
              >
                Skip — I'm done
              </button>
              <button
                onClick={async () => {
                  if (!followUpAddition.trim() || !savedEntryId) { setStage('done'); return; }
                  setSaving(true);
                  try {
                    await fetch('/api/save-entry', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ entryId: savedEntryId, appendContent: followUpAddition }),
                    });
                  } finally {
                    setSaving(false);
                    setStage('done');
                  }
                }}
                disabled={saving}
                className="flex-1 py-3 px-6 bg-navy text-warm text-sm font-semibold rounded-sm disabled:opacity-40 hover:bg-opacity-90 transition"
              >
                {saving ? 'Saving…' : 'Add and finish'}
              </button>
            </div>
          </div>
        )}

        {/* Done state */}
        {stage === 'done' && (
          <div className="py-16 text-center space-y-6">
            <div className="w-12 h-0.5 bg-gold mx-auto" />
            <p className="text-navy text-2xl font-serif">
              {DEMO_PROFILE.childName} will have this when the time is right.
            </p>
            <p className="text-muted text-sm">Your entry has been saved and filed.</p>
            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={() => router.push('/archive')}
                className="py-3 px-6 border border-navy text-navy text-sm font-semibold rounded-sm hover:bg-navy hover:text-warm transition"
              >
                View archive
              </button>
              <button
                onClick={() => router.push('/')}
                className="py-3 px-6 bg-navy text-warm text-sm font-semibold rounded-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {stage === 'error' && (
          <div className="py-16 text-center space-y-4">
            <p className="text-navy text-lg">Something went wrong.</p>
            <p className="text-muted text-sm">Check your API keys and Supabase connection.</p>
            <button
              onClick={() => { setStage('loading'); setEntry(''); }}
              className="mt-4 py-3 px-6 bg-navy text-warm text-sm font-semibold rounded-sm"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
