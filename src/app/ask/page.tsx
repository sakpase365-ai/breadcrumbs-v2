'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { firstName } from '@/lib/nameUtils';
import BottomNav from '@/components/BottomNav';
import {
  ScreenContainer,
  ScreenContent,
  ScreenHeader,
  SectionHeading,
  SurfaceCard,
} from '@/components/ui/design-primitives';

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

function chipCls(active: boolean) {
  return `px-3 py-2 text-sm rounded-full border transition min-h-[44px] ${
    active
      ? 'border-foreground text-foreground'
      : 'border-border text-foreground/50 hover:border-foreground/40 hover:text-foreground/80'
  }`;
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
      <ScreenContainer className="flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ScreenContainer>
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
    <ScreenContainer className="screen-main-safe !py-0">
      <ScreenContent className="space-y-8 !pb-28">

        <div className="space-y-2">
          <ScreenHeader
            title={discovery?.contributorName ? contributorFirst : 'Hear'}
            titleClassName="font-display text-xl font-light tracking-tight"
          />
          {groundingLine ? (
            <p className="text-center text-sm text-muted-foreground">{groundingLine}</p>
          ) : !discovery?.contributorName ? (
            <p className="text-center text-sm text-muted-foreground">
              Draws from everything they&apos;ve shared — their Foundation and their Breadcrumbs.
            </p>
          ) : null}
        </div>

        {discovery?.featuredExcerpt && !result && (
          <blockquote className="border-l-2 border-foreground/15 pl-4 space-y-1">
            <p className="type-label text-muted-foreground">
              From {contributorFirst} — {formatMonthYear(discovery.featuredExcerpt.created_at)}
            </p>
            <p className="text-sm font-display text-foreground/70 leading-relaxed italic">
              &ldquo;{discovery.featuredExcerpt.content.trimEnd()}
              {discovery.featuredExcerpt.content.length >= 180 ? '…' : '”'}
            </p>
          </blockquote>
        )}

        {discoveryDomains.length > 0 && !result && (
          <div className="space-y-3">
            <SectionHeading title={`Explore what ${contributorFirst} shared`} />
            <div className="flex flex-wrap gap-2">
              {discoveryDomains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setQuestion(domainPrompt(domain, discovery!.contributorName))}
                  className="text-xs px-3 py-2 border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition rounded-full min-h-[44px]"
                >
                  {domainPrompt(domain, discovery!.contributorName)}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about faith, work, how they handled hard times…"
            rows={4}
            maxLength={1000}
            disabled={loading}
            className="field-input resize-none bg-transparent"
          />

          {familyMembers.length > 0 && (
            <div className="space-y-2">
              <SectionHeading title="About (optional)" />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  disabled={loading}
                  className={chipCls(selectedRecipient === null)}
                >
                  Everyone
                </button>
                {familyMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedRecipient(m.id)}
                    disabled={loading}
                    className={chipCls(selectedRecipient === m.id)}
                  >
                    {firstName(m.name)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="space-y-4">
            <SurfaceCard className="px-6 py-5">
              <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{result.answer}</p>
            </SurfaceCard>

            {result.breadcrumbExcerpts.length > 0 && (
              <div className="space-y-3 pt-1">
                <SectionHeading title={`In ${contributorFirst}'s own words`} />
                {result.breadcrumbExcerpts.map((bc, i) => (
                  <blockquote key={i} className="border-l-2 border-foreground/15 pl-4 space-y-1">
                    <p className="text-sm font-display text-foreground/70 leading-relaxed italic">
                      &ldquo;{bc.excerpt}{bc.truncated ? '…' : '”'}
                    </p>
                    <p className="text-[0.625rem] text-muted-foreground/50">{bc.contributorLabel}</p>
                  </blockquote>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => { setResult(null); setQuestion(''); }}
              className="text-xs text-muted-foreground/40 hover:text-foreground transition min-h-[44px]"
            >
              ← Ask something else
            </button>
          </div>
        )}

      </ScreenContent>
      <BottomNav />
    </ScreenContainer>
  );
}
