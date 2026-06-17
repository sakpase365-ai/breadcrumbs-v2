'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BREADCRUMB_TYPE_LABEL } from '@/lib/breadcrumbs';
import SettingsSheet from '@/components/SettingsSheet';
import BottomNav     from '@/components/BottomNav';
import { formatTagForDisplay } from '@/lib/breadcrumb-tags';
import { firstName } from '@/lib/nameUtils';

const DOMAIN_ACCENT: Record<string, string> = {
  relationships: 'bg-rose-700/60',
  finances:      'bg-emerald-700/60',
  resilience:    'bg-amber-700/60',
  career:        'bg-blue-700/60',
  identity:      'bg-purple-700/60',
  faith:         'bg-sky-700/60',
  health:        'bg-teal-700/60',
};

const DOMAIN_TEXT: Record<string, string> = {
  relationships: 'text-rose-400',
  finances:      'text-emerald-400',
  resilience:    'text-amber-400',
  career:        'text-blue-400',
  identity:      'text-purple-400',
  faith:         'text-sky-400',
  health:        'text-teal-400',
};

interface EntryCard {
  id:              string;
  title:           string | null;
  summary:         string;
  content:         string;
  content_type:    string;
  media_url:       string | null;
  domain:          string;
  relevant_age:    number;
  delivery_type:   string;
  breadcrumb_type: string;
  tags:            string[];
  created_at:      string;
  delivered_at?:   string;
  recipient_name:  string | null;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

function deliveryRevealLabel(
  deliveryType: string,
  relevantAge: number,
  recipientName: string | null,
  deliveredAt: string | undefined,
): string | null {
  if (deliveredAt) return null;
  if (deliveryType === 'age-locked') {
    const name = firstName(recipientName, 'them');
    return `Opens when ${name} turns ${relevantAge}`;
  }
  if (deliveryType === 'milestone') return 'For a future milestone';
  return null;
}

const LockIcon = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function ArchivePage() {
  const router = useRouter();
  const [entries,       setEntries]       = useState<EntryCard[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [activeFilter,  setActiveFilter]  = useState<string>('all');
  const [recipients,    setRecipients]    = useState<string[]>([]);
  const [settingsOpen,  setSettingsOpen]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/entries');
        if (res.status === 401) { router.push('/login?next=/archive'); return; }
        if (!res.ok) { setError(true); return; }
        const data = await res.json();
        const list: EntryCard[] = data.entries ?? [];
        setEntries(list);

        const seen = new Set<string>();
        const names: string[] = [];
        for (const e of list) {
          if (e.recipient_name && !seen.has(e.recipient_name)) {
            seen.add(e.recipient_name);
            names.push(e.recipient_name);
          }
        }
        setRecipients(names);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return entries;
    if (activeFilter === 'everyone') return entries.filter((e) => !e.recipient_name);
    return entries.filter((e) => e.recipient_name === activeFilter);
  }, [entries, activeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, EntryCard[]>();
    for (const e of filtered) {
      const key = monthKey(e.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <main className="min-h-screen bg-background">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ←
          </button>
          <h1 className="font-display text-base tracking-tight text-foreground">Family Library</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/capture')}
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              + New
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-sm text-muted-foreground/60 hover:text-foreground transition min-h-[44px] px-1 flex items-center"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Filter pills */}
        {entries.length > 0 && (
          <div className="max-w-xl mx-auto px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { key: 'all',      label: `All ${entries.length}` },
              { key: 'everyone', label: 'Everyone'              },
              ...recipients.map((r) => ({ key: r, label: r.split(' ')[0] })),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`shrink-0 px-3 py-1 text-xs rounded-full border transition ${
                  activeFilter === key
                    ? 'border-foreground text-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-xl mx-auto px-5 py-8 pb-28 space-y-10">

        {loading && (
          <div className="py-24 text-center">
            <p className="text-muted-foreground/40 text-sm animate-pulse">Loading…</p>
          </div>
        )}

        {error && (
          <div className="py-24 text-center">
            <p className="text-muted-foreground text-sm">Failed to load. Check your connection.</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="py-28 text-center space-y-5"
          >
            <p className="font-display text-foreground text-3xl font-light">No letters yet.</p>
            <p className="text-muted-foreground text-sm">Your first entry is one prompt away.</p>
            <button
              onClick={() => router.push('/capture')}
              className="mt-2 inline-block py-3 px-8 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Leave A Breadcrumb
            </button>
          </motion.div>
        )}

        {!loading && filtered.length === 0 && entries.length > 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground/50 text-sm">No breadcrumbs match this filter.</p>
          </div>
        )}

        {/* Grouped entries */}
        {!loading && grouped.map(([month, monthEntries], gi) => (
          <motion.section
            key={month}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: gi * 0.06 }}
          >
            {/* Month header */}
            <div className="flex items-center gap-3 mb-5">
              <span className="type-label text-muted-foreground/40">{month}</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            <div className="space-y-3">
              {monthEntries.map((e) => {
                const isExpanded  = expandedId === e.id;
                const typeLabel   = BREADCRUMB_TYPE_LABEL[e.breadcrumb_type] ?? e.breadcrumb_type;
                const isAudio     = e.content_type === 'audio' && e.media_url;
                const hasBody     = !!(e.content?.trim()) || isAudio;
                const accentColor = DOMAIN_ACCENT[e.domain] ?? 'bg-border';
                const textColor   = DOMAIN_TEXT[e.domain] ?? 'text-muted-foreground';

                return (
                  <motion.article
                    key={e.id}
                    layout
                    className="relative overflow-hidden rounded-sm border border-border/60 bg-card"
                  >
                    {/* Domain accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentColor}`} />

                    <div className="pl-4 pr-5 py-4 space-y-2.5">

                      {/* Top row: recipient + date + type */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          {e.recipient_name ? (
                            <p className="font-display text-foreground text-sm font-medium tracking-tight">
                              For {e.recipient_name.split(' ')[0]}
                            </p>
                          ) : (
                            <p className="font-display text-foreground/50 text-sm italic">For everyone</p>
                          )}
                          <p className="text-xs text-muted-foreground/50">{formatDate(e.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <span className={`text-xs font-medium ${textColor}`}>{e.domain}</span>
                          <span className="text-muted-foreground/20 text-xs">·</span>
                          <span className="text-xs text-muted-foreground/50">{typeLabel}</span>
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="font-display text-foreground/85 text-[0.9375rem] leading-[1.6] tracking-[-0.005em]">
                        {e.summary}
                      </p>

                      {/* Expanded body */}
                      <AnimatePresence>
                        {isExpanded && hasBody && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border/50 pt-3 mt-1 space-y-3">
                              {isAudio && e.media_url ? (
                                <audio src={e.media_url} controls className="w-full" preload="metadata" />
                              ) : null}
                              {e.content?.trim() ? (
                                <p className="text-foreground/70 text-sm leading-loose whitespace-pre-wrap font-display">
                                  {e.content}
                                </p>
                              ) : null}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Tags */}
                      {e.tags && e.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {e.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[0.625rem] px-1.5 py-0.5 border border-border/40 text-muted-foreground/40 rounded-sm"
                            >
                              {formatTagForDisplay(tag)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer: delivery reveal / delivered badge + expand */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div>
                          {e.delivered_at ? (
                            <span className="text-[0.625rem] px-1.5 py-0.5 border border-emerald-800/60 text-emerald-500/70 rounded-sm">
                              Delivered
                            </span>
                          ) : (() => {
                            const label = deliveryRevealLabel(e.delivery_type, e.relevant_age, e.recipient_name, e.delivered_at);
                            return label ? (
                              <span className="inline-flex items-center gap-1 text-[0.625rem] text-muted-foreground/40">
                                {LockIcon}
                                {label}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {hasBody && (
                          <button
                            onClick={() => toggleExpand(e.id)}
                            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition"
                          >
                            {isExpanded
                              ? 'Close ↑'
                              : isAudio
                                ? 'Listen →'
                                : 'Read →'}
                          </button>
                        )}
                      </div>

                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.section>
        ))}

      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BottomNav />
    </main>
  );
}
