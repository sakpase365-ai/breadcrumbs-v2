'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CaptureIntro, GeneratedAnswer, SourceCard } from '@/components/MemoryExperience';

type View = 'capture' | 'library' | 'hear';
type Memory = { id: string; title: string; content: string; recipient: string; type: string; topic: string; date: string };

const EXAMPLES: Memory[] = [
  { id: 'example-courage', title: 'When the next step feels big', content: 'Maya, when I started my first business, I was scared too. I did not wait until the fear went away. I chose one small thing I could do that day, and then another the next day. You do not need to see the whole path to take the next step. I believe in you.', recipient: 'Maya', type: 'lesson', topic: 'Resilience', date: 'October 8, 2026' },
  { id: 'example-memory', title: 'Our Sunday mornings', content: 'Leo, my favorite part of Sundays was making pancakes with you. You always insisted the first one belonged to the dog. I hope you remember that we were never in a hurry on those mornings. Those little moments meant everything to me.', recipient: 'Leo', type: 'memory', topic: 'Family', date: 'October 4, 2026' },
  { id: 'example-message', title: 'Something I want you both to know', content: 'You never have to earn your place in this family. Whether life is going well or feels difficult, you can always come home. We will find a way through it together.', recipient: 'Everyone', type: 'message', topic: 'Love', date: 'September 28, 2026' },
];

const chip = (active: boolean) => `min-h-[44px] rounded-full border px-4 text-sm transition ${active ? 'border-blue-500/50 bg-blue-500/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`;

export default function PreviewPage() {
  const [view, setView] = useState<View>('capture');
  const [recipient, setRecipient] = useState('');
  const [intent, setIntent] = useState('');
  const [text, setText] = useState('');
  const [memories, setMemories] = useState(EXAMPLES);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState('Everyone');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const visible = memories.filter((entry) => (filter === 'Everyone' || entry.recipient === filter) && (typeFilter === 'all' || entry.type === typeFilter) && `${entry.content} ${entry.title} ${entry.topic}`.toLowerCase().includes(search.toLowerCase()));

  function navigate(next: View) {
    setView(next);
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  function saveExample() {
    if (!text.trim() || !recipient || !intent) return;
    const memory = { id: `example-${Date.now()}`, title: 'A little of you, for them', content: text.trim(), recipient, type: intent, topic: 'Your words', date: 'Just now' };
    setMemories((items) => [memory, ...items]);
    setExpanded(memory.id);
    setText('');
    setIntent('');
    setSaved(true);
  }

  return (
    <main className="screen-main-safe px-5 min-h-screen">
      <div className="max-w-xl mx-auto space-y-7 pb-24">
        <header className="flex justify-between items-center gap-3">
          <Link href="/" className="font-display text-xl">Breadcrumbs</Link>
          <Link href="/capture" className="text-sm text-blue-400 min-h-[44px] flex items-center">Open your account →</Link>
        </header>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 space-y-1">
          <p className="text-xs text-blue-400 font-medium">INTERACTIVE PREVIEW · SAMPLE FAMILY</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Explore the updated experience with fictional memories. Preview entries last only while this page is open. Sign in to save real breadcrumbs or record audio.</p>
        </div>

        {view === 'capture' && <section className="space-y-6">
          <CaptureIntro name="Alex" />
          {saved ? <div role="status" className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 space-y-3">
            <p className="font-display text-xl">Your preview breadcrumb is ready.</p>
            <p className="text-sm text-muted-foreground">It is in the sample library for this session.</p>
            <button onClick={() => { navigate('library'); setFilter('Everyone'); setTypeFilter('all'); setSearch(''); }} className="min-h-[44px] text-blue-400 text-sm">Open it in the library →</button>
            <button onClick={() => setSaved(false)} className="block min-h-[44px] text-sm text-muted-foreground">Leave another</button>
          </div> : <>
            <div className="space-y-3">
              <p className="type-label text-muted-foreground">Who are you speaking to today?</p>
              <div className="flex flex-wrap gap-2">{['Maya', 'Leo', 'Everyone'].map((name) => <button key={name} aria-pressed={recipient === name} onClick={() => setRecipient(name)} className={chip(recipient === name)}>{name}</button>)}</div>
            </div>
            <div className="flex rounded-2xl bg-card border border-border/70 p-1.5 gap-2">
              <span className="flex-1 rounded-xl min-h-[48px] flex justify-center items-center text-sm bg-blue-500/15 border border-blue-500/30">Write</span>
              <Link href="/capture" className="flex-1 min-h-[48px] flex items-center justify-center text-muted-foreground text-sm">Record Audio</Link>
            </div>
            <textarea aria-label="Your preview breadcrumb" className="field-input !p-5 !rounded-2xl min-h-[210px] !text-base" placeholder="What do you want them to remember?" value={text} onChange={(event) => setText(event.target.value)} />
            {text.trim() ? <div className="space-y-4">
              <p className="type-label text-muted-foreground">What kind of breadcrumb is this?</p>
              <div className="flex gap-2">{['message', 'memory', 'lesson'].map((type) => <button key={type} aria-pressed={intent === type} onClick={() => setIntent(type)} className={`${chip(intent === type)} capitalize`}>{type}</button>)}</div>
              <button className="btn-primary" disabled={!recipient || !intent} onClick={saveExample}>Save preview breadcrumb</button>
            </div> : <p className="text-xs text-muted-foreground">Start with something small. It does not have to be perfect.</p>}
          </>}
        </section>}

        {view === 'library' && <section className="space-y-5">
          <div className="space-y-2"><p className="type-label text-muted-foreground">Saved for the moments that matter</p><h1 className="font-display text-4xl">Family Library</h1><p className="text-sm text-muted-foreground">Their stories. Their lessons. Their own words.</p></div>
          <input type="search" aria-label="Search preview library" placeholder="Search a story, a lesson, a feeling…" value={search} onChange={(event) => setSearch(event.target.value)} className="field-input" />
          <div className="flex gap-2 flex-wrap">{['Everyone', 'Maya', 'Leo'].map((name) => <button key={name} aria-pressed={filter === name} onClick={() => setFilter(name)} className={chip(filter === name)}>{name === 'Everyone' ? 'All people' : name}</button>)}</div>
          <select aria-label="Filter preview type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="field-input"><option value="all">All types</option>{['message', 'memory', 'lesson'].map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <p role="status" className="text-xs text-muted-foreground">{visible.length} breadcrumbs</p>
          {visible.map((entry) => <article key={entry.id} className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">For {entry.recipient} · {entry.date}</p><p className="text-xs text-blue-400 capitalize">{entry.type}</p></div>
            <h2 className="font-display text-xl">{entry.title}</h2>
            <p className="font-display text-foreground/85 leading-relaxed text-sm">{expanded === entry.id ? entry.content : entry.content.slice(0, 130) + (entry.content.length > 130 ? '…' : '')}</p>
            <button aria-expanded={expanded === entry.id} onClick={() => setExpanded(expanded === entry.id ? null : entry.id)} className="text-sm text-blue-400 min-h-[44px]">{expanded === entry.id ? 'Close original' : 'Read original →'}</button>
          </article>)}
          {!visible.length && <p className="text-muted-foreground py-10 text-center">No breadcrumbs match. Try another search or filter.</p>}
        </section>}

        {view === 'hear' && <section className="space-y-6">
          <div className="space-y-2"><p className="type-label text-muted-foreground">A familiar perspective</p><h1 className="font-display text-4xl">Hear from Alex.</h1><p className="text-sm text-muted-foreground leading-relaxed">Explore what they shared, with their original words always close by.</p></div>
          <div className="rounded-2xl bg-card border border-border/70 p-5 space-y-4"><p className="text-base">What would you say when I feel afraid to start?</p><button onClick={() => setShowAnswer(true)} className="btn-primary">Show example answer</button></div>
          {showAnswer && <div className="space-y-5"><GeneratedAnswer sample answer="Maya, you do not need to wait for fear to disappear. When I started my first business, I felt it too. Choose one small step you can take today. You do not have to see the whole path. I believe in you." /><p className="type-label text-muted-foreground">In Alex’s own words</p><SourceCard title={EXAMPLES[0].title} contributorLabel="From Alex · October 8, 2026" excerpt={EXAMPLES[0].content} href="/preview" onOpen={() => { navigate('library'); setExpanded(EXAMPLES[0].id); setFilter('Everyone'); setTypeFilter('all'); setSearch(''); }} /></div>}
        </section>}
      </div>
      <nav aria-label="Preview navigation" className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}><div className="max-w-xl mx-auto flex">{(['capture', 'library', 'hear'] as const).map((tab) => <button key={tab} onClick={() => navigate(tab)} aria-current={view === tab ? 'page' : undefined} className={`flex-1 min-h-[64px] capitalize text-sm ${view === tab ? 'text-blue-400' : 'text-muted-foreground'}`}>{tab}</button>)}</div></nav>
    </main>
  );
}
