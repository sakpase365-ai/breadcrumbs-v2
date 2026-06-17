'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FOUNDATION_QUESTIONS } from '@/lib/breadcrumbs';
import BottomNav from '@/components/BottomNav';


interface Profile { name: string; family_name: string | null; }

export default function FoundationPage() {
  const router = useRouter();
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [stage,        setStage]        = useState<'loading' | 'ready' | 'error'>('loading');
  const [answers,      setAnswers]      = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [saving,          setSaving]          = useState<Set<string>>(new Set());
  const [saveErrors,      setSaveErrors]      = useState<Record<string, string>>({});
  const [crumbing,        setCrumbing]        = useState<Set<string>>(new Set());
  const [crumbSaved,      setCrumbSaved]      = useState<Set<string>>(new Set());
  const [crumbErrors,     setCrumbErrors]     = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      try {
        const profileRes = await fetch('/api/profile');
        if (profileRes.status === 401) { router.push('/login?next=/foundation'); return; }
        if (profileRes.status === 422) { router.push('/setup'); return; }
        if (!profileRes.ok) { setStage('error'); return; }
        const { profile: p } = await profileRes.json();
        setProfile(p);

        const foundationRes = await fetch('/api/foundation');
        if (foundationRes.ok) {
          const { answers: saved } = await foundationRes.json() as {
            answers: Record<string, { content: string }>;
          };
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(saved)) flat[k] = v.content;
          setAnswers(flat);
          setSavedAnswers(flat);
        }
        setStage('ready');
      } catch {
        setStage('error');
      }
    })();
  }, [router]);

  function handleChange(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));

    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      if (value.trim()) saveAnswer(key, value);
    }, 1500);
  }

  async function saveAnswer(key: string, content: string) {
    setSaving((prev) => new Set(prev).add(key));
    setSaveErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const res = await fetch('/api/foundation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: key, content }),
      });
      if (!res.ok) throw new Error();
      setSavedAnswers((prev) => ({ ...prev, [key]: content }));
    } catch {
      setSaveErrors((prev) => ({ ...prev, [key]: 'Failed to save' }));
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  async function turnIntoBreadcrumb(key: string, question: string) {
    const content = savedAnswers[key];
    if (!content || crumbing.has(key)) return;
    setCrumbing((prev) => new Set(prev).add(key));
    setCrumbErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const res = await fetch('/api/save-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          breadcrumb_type: 'story',
          title: question.slice(0, 200),
        }),
      });
      if (!res.ok) throw new Error();
      setCrumbSaved((prev) => new Set(prev).add(key));
    } catch {
      setCrumbErrors((prev) => ({ ...prev, [key]: 'Could not save — try again' }));
    } finally {
      setCrumbing((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  const answeredCount = FOUNDATION_QUESTIONS.filter((q) => savedAnswers[q.key]?.trim()).length;

  if (stage === 'loading') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading your Foundation…</p>
      </main>
    );
  }

  if (stage === 'error') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="font-serif text-foreground text-xl">Something went wrong.</p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <div className="max-w-xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-end justify-end">
          <div className="text-right">
            <h1 className="font-serif text-2xl text-foreground">Your Story</h1>
            {profile?.family_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{profile.family_name}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The core stories, values, and moments that define your family. Answer at your own pace — your answers are saved automatically.
          </p>
          <p className="text-xs text-muted-foreground/60">
            {answeredCount} of {FOUNDATION_QUESTIONS.length} answered
          </p>
        </div>

        <div className="w-full h-px bg-border" />

        {/* Questions */}
        <div className="space-y-10">
          {FOUNDATION_QUESTIONS.map(({ key, question }, i) => {
            const isSaving   = saving.has(key);
            const isSaved    = Boolean(savedAnswers[key]?.trim());
            const hasError   = Boolean(saveErrors[key]);
            const isDirty    = answers[key] !== savedAnswers[key];

            return (
              <div key={key} className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground/40 mt-0.5 shrink-0 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-foreground text-base leading-relaxed">{question}</p>
                </div>

                <textarea
                  value={answers[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={4}
                  placeholder="Write your answer…"
                  className="w-full bg-card border border-border rounded-sm px-5 py-4 text-foreground text-sm leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 transition resize-none"
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/50">
                    {isSaving && 'Saving…'}
                    {!isSaving && isSaved && !isDirty && !hasError && 'Saved'}
                    {hasError && <span className="text-red-400/70">{saveErrors[key]}</span>}
                  </span>

                  {isSaved && !isDirty && (
                    crumbSaved.has(key) ? (
                      <span className="text-xs text-muted-foreground/60">Saved as breadcrumb</span>
                    ) : (
                      <button
                        onClick={() => turnIntoBreadcrumb(key, question)}
                        disabled={crumbing.has(key)}
                        className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-40"
                      >
                        {crumbing.has(key) ? 'Saving…' : crumbErrors[key] ?? 'Turn this into a breadcrumb →'}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 pb-24 flex gap-4">
          <button
            onClick={() => router.push('/capture')}
            className="flex-1 py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
          >
            Start writing breadcrumbs →
          </button>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
