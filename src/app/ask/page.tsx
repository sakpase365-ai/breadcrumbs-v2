'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { firstName } from '@/lib/nameUtils';
import BottomNav from '@/components/BottomNav';

interface FamilyMember { id: string; name: string; role: string; }

type AgentResult = {
  answer: string;
  breadcrumbExcerpts: { excerpt: string; contributorLabel: string; truncated: boolean }[];
};

type Discovery = {
  contributorName:   string;
  contributorRole:   string | null;
  breadcrumbCount:   number;
  lastWrittenAt:     string | null;
  featuredExcerpt:   { content: string; created_at: string } | null;
  availableDomains:  string[];
};

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function domainPrompt(domain: string, contributorName: string): string {
  const name = firstName(contributorName);
  const prompts: Record<string, string> = {
    relationships: `What ${name} believed about relationships`,
    finances:      `What ${name} said about money`,
    resilience:    `How ${name} handled hard times`,
    career:        `What ${name} believed about work`,
    identity:      `How ${name} saw themselves`,
    faith:         `What ${name} believed about faith`,
    health:        `What ${name} said about health`,
  };
  return prompts[domain] ?? '';
}

export default function HearPage() {
  const router = useRouter();

  const [familyMembers,     setFamilyMembers]     = useState<FamilyMember[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
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
        body:    JSON.stringify({ question: question.trim(), recipientId: selectedRecipient }),
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

  const contributorFirst = firstName(discovery?.contributorName);
  const groundingLine = discovery?.lastWrittenAt
    ? `Last wrote ${formatMonthYear(discovery.lastWrittenAt)}`
    : discovery && discovery.breadcrumbCount > 0
      ? `${discovery.breadcrumbCount} breadcrumbs`
      : null;

  const discoveryDomains = (discovery?.availableDomains ?? [])
    .filter((d) => domainPrompt(d, discovery?.contributorName ?? ''));

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10 sm:py-16 pb-28">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Contributor presence header */}
        {discovery?.contributorName && (
          <div className="space-y-1">
            <h1 className="text-2xl font-serif font-light tracking-tight">{contributorFirst}</h1>
            {groundingLine && (
              <p className="text-sm text-muted-foreground">{groundingLine}</p>
            )}
          </div>
        )}

        {!discovery?.contributorName && (
          <div className="space-y-1">
            <h1 className="text-2xl font-serif font-light tracking-tight">Hear from them</h1>
            <p className="text-sm text-muted-foreground">
              Draws from everything they&apos;ve shared — their Foundation and their Breadcrumbs.
            </p>
          </div>
        )}

        {/* Discovery — featured excerpt */}
        {discovery?.featuredExcerpt && !result && (
          <div className="border-l-2 border-foreground/10 pl-4 space-y-1">
            <p className="text-[0.625rem] text-muted-foreground/60 uppercase tracking-widest">
              From {contributorFirst} — {formatMonthYear(discovery.featuredExcerpt.created_at)}
            </p>
            <p className="text-sm font-display text-foreground/60 leading-relaxed italic">
              &ldquo;{discovery.featuredExcerpt.content.trimEnd()}
              {discovery.featuredExcerpt.content.length >= 180 ? '…' : '”'}
            </p>
          </div>
        )}

        {/* Discovery — domain shortcuts */}
        {discoveryDomains.length > 0 && !result && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/40 uppercase tracking-widest">
              Explore what {contributorFirst} shared
            </p>
            <div className="flex flex-wrap gap-2">
              {discoveryDomains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setQuestion(domainPrompt(domain, discovery!.contributorName))}
                  className="text-xs px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition rounded-sm"
                >
                  {domainPrompt(domain, discovery!.contributorName)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about faith, work, how they handled hard times…"
            rows={4}
            maxLength={1000}
            disabled={loading}
            className="w-full bg-transparent border border-border text-sm text-foreground placeholder:text-muted-foreground/50 px-4 py-3 resize-none focus:outline-none focus:border-foreground/40 transition"
          />

          {familyMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  disabled={loading}
                  className={`text-xs px-3 py-1.5 border rounded-sm transition ${
                    selectedRecipient === null
                      ? 'border-foreground text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  Everyone
                </button>
                {familyMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedRecipient(m.id)}
                    disabled={loading}
                    className={`text-xs px-3 py-1.5 border rounded-sm transition ${
                      selectedRecipient === m.id
                        ? 'border-foreground text-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {firstName(m.name)}
                  </button>
                ))}
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
                  In {contributorFirst}&apos;s own words
                </p>
                {result.breadcrumbExcerpts.map((bc, i) => (
                  <blockquote key={i} className="border-l-2 border-foreground/10 pl-4 space-y-1">
                    <p className="text-sm font-display text-foreground/70 leading-relaxed italic">
                      &ldquo;{bc.excerpt}{bc.truncated ? '…' : '”'}
                    </p>
                    <p className="text-[0.625rem] text-muted-foreground/40">{bc.contributorLabel}</p>
                  </blockquote>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => { setResult(null); setQuestion(''); }}
              className="text-xs text-muted-foreground/40 hover:text-foreground transition"
            >
              ← Ask something else
            </button>
          </div>
        )}

      </div>
      <BottomNav />
    </main>
  );
}
