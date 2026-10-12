'use client';

import Link from 'next/link';

export function CaptureIntro({ name }: { name: string }) {
  return (
    <div className="space-y-2 pt-1 pb-1">
      <h2 className="text-2xl font-semibold tracking-tight">Hey, {name}.</h2>
      <p className="text-xs text-muted-foreground">Leave a little of yourself for the people you love.</p>
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
    <Link href={href} onClick={onOpen ? (event) => { event.preventDefault(); onOpen(); } : undefined} className="block rounded-xl border border-border/70 bg-card p-4 space-y-2 hover:border-blue-500/50 transition">
      <p className="text-xs text-muted-foreground">{contributorLabel}</p>
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      <blockquote className="text-sm text-foreground/85 leading-relaxed">“{excerpt}{truncated ? '…' : ''}”</blockquote>
      <p className="text-xs text-blue-400">Open original breadcrumb →</p>
    </Link>
  );
}

export function GeneratedAnswer({ answer, warnings = [], sample = false }: { answer: string; warnings?: string[]; sample?: boolean }) {
  return (
    <section className="space-y-4 py-2" aria-label="Family agent answer">
      <p className="text-[10px] text-muted-foreground">{sample ? 'Sample reflection · no AI request' : 'AI reflection · based on saved family context'}</p>
      <p className="text-base leading-relaxed whitespace-pre-wrap">{answer}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{sample ? 'This example shows how an answer and its original source appear together.' : 'This is an AI-generated reflection, not an original message. Read the sources below for their own words.'}</p>
      {warnings.length ? <div role="status" className="border-t border-border pt-3 space-y-2">{warnings.map((warning) => <p key={warning} className="text-xs text-amber-300 leading-relaxed">{warning}</p>)}</div> : null}
    </section>
  );
}
