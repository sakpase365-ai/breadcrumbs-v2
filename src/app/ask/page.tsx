'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import BottomNav from '@/components/BottomNav';

interface FamilyMember { id: string; name: string; role: string; }

type AgentResult = {
  answer: string;
  warnings: string[];
  contextSources: { source: string; id: string }[];
  breadcrumbExcerpts: { excerpt: string; recipientLabel: string; truncated: boolean }[];
};

type Discovery = {
  featuredExcerpt: { content: string; created_at: string } | null;
  availableDomains: string[];
};

const DOMAIN_PROMPTS: Record<string, string> = {
  relationships: 'What did they believe about relationships?',
  finances:      'What did they say about money?',
  resilience:    'How did they handle hard times?',
  career:        'What did they believe about work?',
  identity:      'How did they see themselves?',
  faith:         'What did they believe about faith?',
  health:        'What did they say about health?',
};

export default function HearPage() {
  const router = useRouter();

  const [familyMembers,     setFamilyMembers]     = useState<FamilyMember[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [question,          setQuestion]          = useState('');
  const [result,            setResult]            = useState<AgentResult | null>(null);
  const [discovery,         setDiscovery]         = useState<Discovery | null>(null);
  const [error,             setError]             = useState<string | null>(null);
  const [loading,           setLoading]           = useState(false);
  const [profileLoading,    setProfileLoading]    = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        if (!supabase) { router.push('/login?next=/ask'); return; }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login?next=/ask'); return; }

        const [profileRes, discoverRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/discover'),
        ]);

        if (profileRes.status === 401) { router.push('/login?next=/ask'); return; }
        if (profileRes.ok) {
          const data = await profileRes.json();
          setFamilyMembers((data.familyMembers ?? []) as FamilyMember[]);
        }
        if (discoverRes.ok) {
          setDiscovery(await discoverRes.json() as Discovery);
        }
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/family-agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: question.trim(), recipientId: selectedRecipient || null }),
      });

      if (res.status === 401) { router.push('/login?next=/ask'); return; }
      if (res.status === 429) {
        setError("You've asked too many questions recently. Please wait a moment.");
        return;
      }
      if (!res.ok) { setError('Something went wrong. Please try again.'); return; }

      const data = await res.json();
      setResult({
        answer:             data.answer as string,
        warnings:           (data.warnings          ?? []) as string[],
        contextSources:     (data.contextSources     ?? []) as { source: string; id: string }[],
        breadcrumbExcerpts: (data.breadcrumbExcerpts ?? []) as AgentResult['breadcrumbExcerpts'],
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const discoveryDomains = (discovery?.availableDomains ?? []).filter((d) => DOMAIN_PROMPTS[d]);
  const breadcrumbCount  = result?.contextSources.filter((s) => s.source === 'breadcrumbs').length ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10 sm:py-16 pb-28">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-light tracking-tight">Hear from them</h1>
          <p className="text-sm text-muted-foreground">
            Draws from everything they&apos;ve shared — their Foundation and their Breadcrumbs.
          </p>
        </div>

        {/* Discovery — featured excerpt */}
        {discovery?.featuredExcerpt && !result && (
          <div className="border-l-2 border-foreground/10 pl-4">
            <p className="text-sm font-display text-foreground/60 leading-relaxed italic">
              &ldquo;{discovery.featuredExcerpt.content.trimEnd()}
              {discovery.featuredExcerpt.content.length >= 180 ? '…' : '”'}
            </p>
            <p className="text-[0.625rem] text-muted-foreground/40 mt-1">
              {new Date(discovery.featuredExcerpt.created_at).toLocaleDateString('en-US', {
                month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        )}

        {/* Discovery — domain shortcuts */}
        {discoveryDomains.length > 0 && !result && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">
              Explore what they shared
            </p>
            <div className="flex flex-wrap gap-2">
              {discoveryDomains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setQuestion(DOMAIN_PROMPTS[domain])}
                  className="text-xs px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition rounded-sm"
                >
                  {DOMAIN_PROMPTS[domain]}
                </button>
              ))}
            </div>
          </div>
        )}

        {(discovery?.featuredExcerpt || discoveryDomains.length > 0) && !result && (
          <p className="text-xs text-muted-foreground/30">Or ask something specific:</p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you believe about handling failure?"
            rows={4}
            maxLength={1000}
            disabled={loading}
            className="w-full bg-transparent border border-border text-sm text-foreground placeholder:text-muted-foreground/50 px-4 py-3 resize-none focus:outline-none focus:border-foreground/40 transition"
          />

          {familyMembers.length > 0 && (
            <div className="space-y-1">
              <label className="block text-xs text-muted-foreground">About (optional)</label>
              <select
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
                disabled={loading}
                className="bg-background border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:border-foreground/40 transition"
              >
                <option value="">The whole family</option>
                {familyMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="w-full py-4 px-8 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Answer */}
        {result && (
          <div className="space-y-3">
            <div className="border border-border px-6 py-5">
              <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            </div>

            {result.breadcrumbExcerpts.length > 0 && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">
                  In their own words
                </p>
                {result.breadcrumbExcerpts.map((bc, i) => (
                  <blockquote key={i} className="border-l-2 border-foreground/10 pl-4 space-y-1">
                    <p className="text-sm font-display text-foreground/70 leading-relaxed italic">
                      &ldquo;{bc.excerpt}{bc.truncated ? '…' : '”'}
                    </p>
                    <p className="text-[0.625rem] text-muted-foreground/40">{bc.recipientLabel}</p>
                  </blockquote>
                ))}
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70">{w}</p>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground/50">
              {breadcrumbCount > 0 ? (
                <>
                  Answered using {breadcrumbCount} saved{' '}
                  {breadcrumbCount === 1 ? 'breadcrumb' : 'breadcrumbs'} from your{' '}
                  <Link href="/archive" className="underline underline-offset-2 hover:text-muted-foreground transition">
                    Family Library
                  </Link>
                  .
                </>
              ) : (
                'Answers are based on your saved Family Foundation and Breadcrumbs.'
              )}
            </p>

            <button
              type="button"
              onClick={() => { setResult(null); setQuestion(''); }}
              className="text-xs text-muted-foreground/40 hover:text-foreground transition"
            >
              ← Ask another
            </button>
          </div>
        )}

      </div>
      <BottomNav />
    </main>
  );
}
