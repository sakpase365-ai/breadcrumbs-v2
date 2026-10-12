'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { firstName } from '@/lib/nameUtils';
import { ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { SourceCard, GeneratedAnswer } from '@/components/MemoryExperience';
import {
  ScreenContainer,
  ScreenContent,
  SectionHeading,
} from '@/components/ui/design-primitives';

interface FamilyMember { id: string; name: string; role: string; }

type AgentResult = {
  answer: string;
  warnings: string[];
  breadcrumbExcerpts: { id: string; title: string | null; href: string; excerpt: string; contributorLabel: string; truncated: boolean }[];
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
  const [askedQuestion, setAskedQuestion] = useState('');
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
      } catch {
        setError('Could not load family context. Please refresh to try again.');
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setAskedQuestion(question.trim());
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
        warnings:           (data.warnings ?? []) as string[],
        breadcrumbExcerpts: (data.breadcrumbExcerpts ?? []) as AgentResult['breadcrumbExcerpts'],
      });
      setQuestion('');
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
      <ScreenContent className="space-y-6 !pb-48">

        <button className="iroh-back" onClick={() => router.push('/home')}><ChevronLeft size={15} />Home</button>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{discovery?.contributorName ? `Hear from ${contributorFirst}.` : 'Hear a familiar perspective.'}</h1>
          <p className="text-xs text-muted-foreground">{groundingLine ?? 'A perspective shaped by what they have shared.'}</p>
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
            <div className="space-y-2">
              {discoveryDomains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setQuestion(domainPrompt(domain, discovery!.contributorName))}
                  className="iroh-suggestion"
                >
                  <span className="flex-1">{domainPrompt(domain, discovery!.contributorName)}</span><ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="iroh-dock"><form onSubmit={handleSubmit} className="iroh-composer">
          <textarea id="family-question" value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Ask the family agent" placeholder="Ask from your family memory…" rows={2} maxLength={1000} disabled={loading} className="w-full" />
          <div className="flex items-center justify-between gap-3 px-1">
            {familyMembers.length ? <select aria-label="Who this question is about" value={selectedRecipient ?? ''} onChange={(event) => setSelectedRecipient(event.target.value || null)} disabled={loading} className="bg-transparent text-[11px] text-muted-foreground max-w-[75%] min-h-[40px] rounded-md"><option value="">Everyone · family memory</option>{familyMembers.map((member) => <option key={member.id} value={member.id}>{firstName(member.name)}</option>)}</select> : <span className="text-[11px] text-muted-foreground">Family memory</span>}
            <button aria-label={loading ? 'Asking the family agent' : 'Ask'} type="submit" disabled={loading || !question.trim()} className="iroh-send"><ArrowUp size={19} /></button>
          </div>
        </form></div>

        {loading && <p role="status" className="text-xs text-muted-foreground">Reading your family memory…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="space-y-4">
            <div className="flex justify-end"><p className="text-sm bg-[#172340] px-4 py-3 rounded-xl max-w-[85%]">{askedQuestion}</p></div>
            <GeneratedAnswer answer={result.answer} warnings={result.warnings} />

            {result.breadcrumbExcerpts.length > 0 && (
              <div className="space-y-3 pt-1">
                <SectionHeading title={`In ${contributorFirst}'s own words`} />
                {result.breadcrumbExcerpts.map((bc) => (
                  <SourceCard key={bc.id} {...bc} />
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
