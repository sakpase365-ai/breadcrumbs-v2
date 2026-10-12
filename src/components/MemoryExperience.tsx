'use client';

import Link from 'next/link';

export function CaptureIntro({ name }: { name: string }) {
  return (
    <div className="space-y-3 pt-3 pb-2">
      <p className="type-label text-muted-foreground">A little of you, for them</p>
      <h2 className="font-display text-3xl sm:text-4xl leading-tight">What would you like<br />to leave behind, {name}?</h2>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">A story. A lesson. Something you want them to hear in your own words.</p>
    </div>
  );
}

export function SourceCard({ title, excerpt, contributorLabel, href, truncated, onOpen }: {
  title?: string | null;
  excerpt: string;
  contributorLabel: string;
  href: string;
  truncated?: boolean;
  onOpen?: () => void;
}) {
  return (
    <Link href={href} onClick={onOpen ? (event) => { event.preventDefault(); onOpen(); } : undefined} className="block rounded-2xl border border-border/70 bg-card p-4 space-y-3 hover:border-blue-500/50 transition">
      <p className="text-xs text-muted-foreground">{contributorLabel}</p>
      {title ? <p className="font-display text-lg">{title}</p> : null}
      <blockquote className="font-display text-sm text-foreground/85 leading-relaxed">“{excerpt}{truncated ? '…' : ''}”</blockquote>
      <p className="text-xs text-blue-400">Open original breadcrumb →</p>
    </Link>
  );
}

export function GeneratedAnswer({ answer, warnings = [], sample = false }: { answer: string; warnings?: string[]; sample?: boolean }) {
  return (
    <section className="rounded-2xl border border-blue-500/20 bg-card px-5 py-5 space-y-4" aria-label="Family agent answer">
      <p className="type-label text-blue-400">{sample ? 'Sample reflection · no AI request' : 'AI reflection · based on saved family context'}</p>
      <p className="text-base leading-relaxed whitespace-pre-wrap">{answer}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{sample ? 'This example shows how an answer and its original source appear together.' : 'This is an AI-generated reflection, not an original message. Read the sources below for their own words.'}</p>
      {warnings.length ? <div role="status" className="border-t border-border pt-3 space-y-2">{warnings.map((warning) => <p key={warning} className="text-xs text-amber-300 leading-relaxed">{warning}</p>)}</div> : null}
    </section>
  );
}
