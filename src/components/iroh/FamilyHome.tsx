'use client';

import { ArrowUpRight, ChevronRight, Mic, PenLine, BookOpen, MessageCircle, ShieldCheck, Sparkles, Plus } from 'lucide-react';
import { memoryRingGradient, type TopicCount } from '@/lib/memory-overview';

export function MemoryRing({ topics, large = false }: { topics: TopicCount[]; large?: boolean }) {
  const total = topics.reduce((sum, topic) => sum + topic.count, 0);
  return <div role="img" aria-label={`${total} breadcrumbs across ${topics.length} topics: ${topics.map((topic) => `${topic.topic}, ${topic.count}`).join('; ')}`} className={`iroh-ring ${large ? 'iroh-ring-large' : ''}`} style={{ background: memoryRingGradient(topics) }}><div><span className="text-foreground font-semibold text-lg tabular-nums">{total}</span></div></div>;
}

export function FamilyHome({ name, topics, recent, sample = false, onNavigate, onWrite, onRecord }: {
  name: string;
  topics: TopicCount[];
  recent?: { content: string; recipient?: string | null } | null;
  sample?: boolean;
  onNavigate: (view: 'library' | 'hear' | 'story') => void;
  onWrite: () => void;
  onRecord: () => void;
}) {
  const count = topics.reduce((sum, topic) => sum + topic.count, 0);
  return <div className="space-y-6">
    <div className="pt-2 space-y-2"><h1 className="text-[30px] font-semibold tracking-[-0.035em]">Hey, {name}.</h1><p className="text-xs text-muted-foreground">{count ? `${count} breadcrumbs, held for your family.` : 'Your family memory begins with you.'}</p></div>
    <section className="space-y-2.5" aria-label="Capture actions">
      <div className="grid grid-cols-2 gap-2.5"><button onClick={onWrite} className="iroh-action-card"><span className="iroh-action-icon"><PenLine size={17} /></span><span className="font-medium text-sm">Write</span><span className="text-[11px] text-muted-foreground">Leave your own words</span><ArrowUpRight size={15} className="absolute top-4 right-4 text-muted-foreground" /></button><button onClick={onRecord} className="iroh-action-card"><span className="iroh-action-icon"><Mic size={17} /></span><span className="font-medium text-sm">Record Audio</span><span className="text-[11px] text-muted-foreground">Let them hear your voice</span><ArrowUpRight size={15} className="absolute top-4 right-4 text-muted-foreground" /></button></div>
    </section>
    <button onClick={() => onNavigate('library')} className="iroh-memory-card w-full text-left"><MemoryRing topics={topics} /><div className="flex-1 min-w-0 space-y-1"><p className="text-sm font-medium">Your family memory</p><p className="text-xs text-muted-foreground leading-relaxed">{topics.length ? `${topics.length} topics, connected by your stories.` : 'Messages, memories, and lessons, all in one place.'}</p></div><ChevronRight size={16} className="text-muted-foreground shrink-0" /></button>
    <section className="space-y-2.5"><h2 className="iroh-eyebrow">Things to try</h2><button onClick={() => onNavigate('hear')} className="iroh-suggestion"><span className="iroh-small-icon"><MessageCircle size={16} /></span><span className="flex-1">Hear a familiar perspective<span className="block text-[10px] text-muted-foreground mt-0.5">Ask from what they’ve shared</span></span><ChevronRight size={15} /></button><button onClick={() => onNavigate('library')} className="iroh-suggestion"><span className="iroh-small-icon"><BookOpen size={16} /></span><span className="flex-1">Find something worth remembering<span className="block text-[10px] text-muted-foreground mt-0.5">Open the original words</span></span><ChevronRight size={15} /></button><button onClick={() => onNavigate('story')} className="iroh-suggestion"><span className="iroh-small-icon"><Sparkles size={16} /></span><span className="flex-1">Add a little more of your story<span className="block text-[10px] text-muted-foreground mt-0.5">Grow your family’s context</span></span><ChevronRight size={15} /></button></section>
    {recent ? <section className="space-y-2.5"><h2 className="iroh-eyebrow">A recent breadcrumb</h2><button onClick={() => onNavigate('library')} className="iroh-recent w-full text-left"><p className="text-[10px] text-muted-foreground mb-2">For {recent.recipient || 'the whole family'}</p><p className="text-sm text-foreground/85 leading-relaxed line-clamp-2">“{recent.content}”</p></button></section> : null}
    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck size={12} />{sample ? 'Fictional sample family · entries last for this visit' : 'Only your family can access your breadcrumbs'}</p>
  </div>;
}

export function HomeComposer({ onWrite, onRecord }: { onWrite: () => void; onRecord: () => void }) {
  return <div className="iroh-dock"><div className="iroh-composer"><button onClick={onWrite} className="w-full text-left text-sm text-muted-foreground py-3 px-1">Something you want them to remember?</button><div className="flex items-center justify-between"><button onClick={onWrite} aria-label="Write a breadcrumb" className="iroh-icon-button"><Plus size={17} /></button><span className="text-[10px] text-muted-foreground mr-auto ml-2">Your family memory</span><button onClick={onRecord} aria-label="Record an audio breadcrumb" className="iroh-icon-button"><Mic size={18} /></button></div></div></div>;
}
