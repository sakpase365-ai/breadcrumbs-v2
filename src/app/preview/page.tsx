'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ChevronLeft, ChevronRight, Mic, PenLine, Search, Plus, Check, BookOpen } from 'lucide-react';
import { FamilyHome, HomeComposer, MemoryRing } from '@/components/iroh/FamilyHome';
import { useVoiceRecorder } from '@/components/iroh/useVoiceRecorder';
import VoiceWaveform from '@/components/VoiceWaveform';
import { SourceCard, GeneratedAnswer } from '@/components/MemoryExperience';
import { ReferenceCapture } from '@/components/iroh/ReferenceCapture';
import { PreviewTabs } from '@/components/BottomNav';
import { countMemoryTopics } from '@/lib/memory-overview';
import { SAMPLE_MEMORIES, matchPreviewMemories, type PreviewMemory } from '@/lib/preview-memories';

type View = 'home' | 'capture' | 'library' | 'hear' | 'story' | 'family';
const VIEWS: View[] = ['home', 'capture', 'library', 'hear', 'story', 'family'];

export default function PreviewPage() {
  const [view, setView] = useState<View>('capture');
  const [mode, setMode] = useState<'write' | 'voice'>('voice');
  const [recipient, setRecipient] = useState('');
  const [intent, setIntent] = useState('');
  const [text, setText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [memories, setMemories] = useState<PreviewMemory[]>(SAMPLE_MEMORIES);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [person, setPerson] = useState('all');
  const [topic, setTopic] = useState('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [sources, setSources] = useState<PreviewMemory[]>([]);
  const [story, setStory] = useState('I want my family to know that curiosity, kindness, and showing up for each other mattered most to me.');
  const [storySaved, setStorySaved] = useState(false);
  const audioUrls = useRef<string[]>([]);
  const recorder = useVoiceRecorder();
  const topics = countMemoryTopics(memories);

  const navigate = useCallback((next: View) => {
    setView(next);
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }, []);

  useEffect(() => {
    const onMenu = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (VIEWS.includes(next as View)) navigate(next as View);
    };
    const query = new URLSearchParams(window.location.search).get('view');
    if (query && VIEWS.includes(query as View)) navigate(query as View);
    window.addEventListener('breadcrumbs-preview-navigate', onMenu);
    return () => window.removeEventListener('breadcrumbs-preview-navigate', onMenu);
  }, [navigate]);
  useEffect(() => () => audioUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => { if (view !== 'capture' && recorder.recording) recorder.stop(); }, [view, recorder]);

  function openCapture(nextMode: 'write' | 'voice') { setMode(nextMode); setSaved(false); navigate('capture'); }
  function openLibrary(id?: string) { setPerson('all'); setTopic('all'); setSearch(''); setExpanded(id ?? null); navigate('library'); }
  function savePreview() {
    if (!recipient || !intent || (mode === 'write' ? !text.trim() : !recorder.blob)) return;
    const audio = mode === 'voice' && recorder.blob ? URL.createObjectURL(recorder.blob) : undefined;
    if (audio) audioUrls.current.push(audio);
    const memory: PreviewMemory = { id: `sample-${Date.now()}`, title: mode === 'voice' ? 'Something in my own voice' : text.trim().split(/[.!?\n]/)[0].slice(0, 65) || 'A little of me, for you', content: text.trim() || 'An original audio breadcrumb.', recipient, type: intent, domain: 'other', date: 'Just now', audio };
    setMemories((items) => [memory, ...items]); setExpanded(memory.id); setText(''); setIntent(''); setSaved(true); recorder.clear();
  }
  function askSample(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setSubmittedQuestion(question.trim()); setSources(matchPreviewMemories(question, memories)); setQuestion('');
    requestAnimationFrame(() => document.getElementById('sample-answer')?.scrollIntoView({ block: 'start' }));
  }
  const visible = memories.filter((memory) => (person === 'all' || memory.recipient === person) && (topic === 'all' || memory.domain === topic) && `${memory.title} ${memory.content} ${memory.domain}`.toLowerCase().includes(search.toLowerCase()));
  const back = <button className="iroh-back" onClick={() => navigate('home')}><ChevronLeft size={15} />Home</button>;
  const canSave = !!recipient && !!intent && (mode === 'write' ? !!text.trim() : !!recorder.blob) && !recorder.recording;

  return <main className={view === 'capture' ? 'reference-page' : 'iroh-page'}>
    {view !== 'capture' && <p className="iroh-preview-label mb-4">Separate design preview · fictional sample family</p>}

    {view === 'home' && <><FamilyHome name="Alex" sample topics={topics} recent={{ content: memories[0].content, recipient: memories[0].recipient }} onWrite={() => openCapture('write')} onRecord={() => openCapture('voice')} onNavigate={(next) => next === 'library' ? openLibrary() : navigate(next)} /><HomeComposer onWrite={() => openCapture('write')} onRecord={() => openCapture('voice')} /></>}

    {view === 'capture' && <>
      {saved ? <section className="space-y-5 py-10"><Check className="text-blue-200" size={30} /><h1 className="text-2xl">Your preview breadcrumb is saved.</h1><p className="text-sm text-muted-foreground">It stays in the sample library for this visit.</p><button className="btn-primary" onClick={() => openLibrary(expanded ?? undefined)}>Open your breadcrumb</button><button className="reference-text-action" onClick={() => setSaved(false)}>Leave another</button></section> : <ReferenceCapture
        recipients={['Maya', 'Leo'].map((name) => ({ id: name, name }))} recipient={recipient}
        onRecipient={setRecipient} mode={mode} recording={recorder.recording} requesting={recorder.requesting}
        onRecord={() => { if (mode === 'write') { setMode('voice'); return; } if (recorder.recording) recorder.stop(); else void recorder.start(); }}
        waveform={recorder.recording ? <VoiceWaveform active analyser={recorder.analyser} reducedMotion={false} /> : undefined}
        writing={<>{showPrompt && <p className="text-xs text-muted-foreground mb-4">What is a lesson you learned the hard way that you want them to know?</p>}<textarea aria-label="Your breadcrumb" placeholder="What do you want them to remember?" value={text} onChange={(event) => setText(event.target.value)} /></>}
        audioReview={recorder.url ? <div className="w-full space-y-4"><p className="text-sm">Your original recording</p><audio controls src={recorder.url} className="w-full" /><textarea aria-label="Words to accompany your recording" className="field-input" placeholder="Add words (optional)…" value={text} onChange={(event) => setText(event.target.value)} /><p className="text-[10px] text-muted-foreground">Audio stays on this page. Transcription is available in your account.</p><button onClick={recorder.clear} className="reference-text-action">Discard and record again</button></div> : undefined}
        onWrite={() => setMode('write')} onQuestion={() => { setMode('write'); setShowPrompt(true); }} onDraft={() => setMode('write')} hasDraft={!!text.trim()}
      >
        {recorder.error && <p role="alert" className="text-xs text-red-300 mt-4">{recorder.error}</p>}
        {(text.trim() || recorder.blob) && <div className="space-y-3 mt-5"><p className="iroh-eyebrow">What kind of breadcrumb is this?</p><div className="flex gap-2">{['message', 'memory', 'lesson'].map((type) => <button className="iroh-pill capitalize" key={type} aria-pressed={intent === type} onClick={() => setIntent(type)}>{type}</button>)}</div><button disabled={!canSave} className="btn-primary" onClick={savePreview}>Save preview breadcrumb</button></div>}
      </ReferenceCapture>}
      <p className="text-[9px] text-muted-foreground mt-4 text-center">Separate design preview · fictional family · <Link href="/login?next=/capture" className="underline">Sign in for real capture</Link></p>
    </>}

    {view === 'library' && <section className="space-y-5">
      {back}<div className="space-y-2"><h1 className="text-2xl font-semibold">Your family memory.</h1><p className="text-xs text-muted-foreground">Real words, ready to return to.</p></div>
      <div className="flex gap-5 items-center py-2"><MemoryRing topics={topics} large /><div className="space-y-1"><p className="text-lg font-medium">{memories.length} breadcrumbs</p><p className="text-xs text-muted-foreground">Across {topics.length} parts of your story</p><button onClick={() => openCapture('write')} className="text-xs text-blue-300 min-h-[44px]">Leave another <Plus size={12} className="inline" /></button></div></div>
      <div className="space-y-0">{topics.map((item) => <button key={item.topic} className="iroh-topic" aria-pressed={topic === item.topic} onClick={() => setTopic(topic === item.topic ? 'all' : item.topic)}><span className="w-2 h-2 rounded-full" style={{ background: item.color }} /><span className="flex-1 capitalize">{item.topic}</span><span className="text-xs text-muted-foreground">{item.count}</span><ChevronRight size={14} className="text-muted-foreground" /></button>)}</div>
      <div className="relative"><Search size={16} className="absolute left-3 top-4 text-muted-foreground" /><input aria-label="Search family memory" className="field-input !pl-10" type="search" placeholder="Search your family memory…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="flex gap-2 flex-wrap">{['all', 'Maya', 'Leo', 'Everyone'].map((name) => <button key={name} aria-pressed={person === name} onClick={() => setPerson(name)} className="iroh-pill">{name === 'all' ? 'All people' : name}</button>)}</div>
      {topic !== 'all' && <button className="text-xs text-blue-300 min-h-[44px]" onClick={() => setTopic('all')}>Clear {topic} filter</button>}
      <p role="status" className="iroh-eyebrow">{visible.length} {visible.length === 1 ? 'breadcrumb' : 'breadcrumbs'}</p>
      {visible.map((memory) => <article key={memory.id} className="iroh-document space-y-3"><div className="flex justify-between items-center gap-2"><p className="text-[10px] text-muted-foreground">For {memory.recipient} · {memory.date}</p><span className="text-[10px] text-blue-300 capitalize">{memory.type}</span></div><h2 className="text-sm font-medium">{memory.title}</h2><p className="text-[13px] text-foreground/80 leading-relaxed">{expanded === memory.id ? memory.content : memory.content.slice(0, 135) + (memory.content.length > 135 ? '…' : '')}</p>{expanded === memory.id && memory.audio && <audio controls src={memory.audio} className="w-full" />}<button aria-expanded={expanded === memory.id} onClick={() => setExpanded(expanded === memory.id ? null : memory.id)} className="text-xs text-blue-300 min-h-[44px] flex items-center gap-2"><BookOpen size={13} />{expanded === memory.id ? 'Close original' : 'Open original breadcrumb'}</button></article>)}
      {!visible.length && <p className="text-sm text-muted-foreground py-12 text-center">No memories match. Try another topic or search.</p>}
    </section>}

    {view === 'hear' && <section className="space-y-6">
      {back}<div className="space-y-2"><h1 className="text-2xl font-semibold">Hear from Alex.</h1><p className="text-xs text-muted-foreground">A perspective shaped by what they shared.</p></div>
      {!submittedQuestion && <div className="space-y-3"><p className="iroh-eyebrow">Things to ask</p>{['What did you believe about faith?', 'How did you handle fear when starting your business?', 'What did Sunday mornings mean to you?'].map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)} className="iroh-suggestion"><span className="flex-1">{prompt}</span><ChevronRight size={14} /></button>)}</div>}
      {submittedQuestion && <div id="sample-answer" className="space-y-6 scroll-mt-20"><div className="flex justify-end"><p className="bg-[#172340] rounded-xl px-4 py-3 text-sm max-w-[85%]">{submittedQuestion}</p></div>{sources.length ? <><GeneratedAnswer sample answer={sources.map((memory) => memory.content).join('\n\n')} /><p className="iroh-eyebrow">Original sources</p>{sources.map((memory) => <SourceCard key={memory.id} title={memory.title} excerpt={memory.content.slice(0, 160)} truncated={memory.content.length > 160} contributorLabel={`From Alex · ${memory.date}`} href={`/preview?entry=${memory.id}`} onOpen={() => openLibrary(memory.id)} />)}</> : <p className="text-sm text-muted-foreground leading-relaxed">There is not enough relevant sample context to answer this. Try asking about faith, work, money, family, or starting a business.</p>}</div>}
      <div className="iroh-dock"><form onSubmit={askSample} className="iroh-composer"><textarea aria-label="Ask from the sample family memory" placeholder="Ask from your family memory…" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={2} className="w-full" /><div className="flex justify-between items-center"><p className="text-[10px] text-muted-foreground pl-2">Sample retrieval · no AI request</p><button type="submit" aria-label="Ask sample question" disabled={!question.trim()} className="iroh-send"><ArrowUp size={19} /></button></div></form></div>
    </section>}

    {view === 'family' && <section className="space-y-5"><h1 className="text-2xl font-semibold">Your family.</h1><p className="text-sm text-muted-foreground">The people these stories are for.</p>{['Maya', 'Leo'].map((name) => <button key={name} onClick={() => { setRecipient(name); openCapture('voice'); }} className="iroh-suggestion"><span className="reference-avatar">{name[0]}</span><span className="flex-1">{name}</span><ChevronRight size={16} /></button>)}<button onClick={() => navigate('story')} className="iroh-suggestion">Your Story<ChevronRight size={16} /></button><button onClick={() => navigate('home')} className="reference-text-action">Explore the family dashboard</button></section>}
    {view === 'story' && <section className="space-y-6">{back}<div className="space-y-2"><h1 className="text-2xl font-semibold">A little more of you.</h1><p className="text-xs text-muted-foreground">Your family’s context grows one answer at a time.</p></div><label className="block iroh-document space-y-3"><span className="text-sm font-medium">What matters most to you?</span><textarea aria-label="Your sample family values" className="field-input min-h-[170px]" value={story} onChange={(event) => { setStory(event.target.value); setStorySaved(false); }} /></label><button disabled={!story.trim()} className="btn-primary" onClick={() => setStorySaved(true)}>Save sample answer</button>{storySaved && <p role="status" className="text-xs text-blue-300">Your answer is kept for this preview session.</p>}</section>}
    {view !== 'home' && view !== 'capture' && view !== 'hear' && <div className="iroh-dock"><div className="iroh-composer flex items-center justify-between px-3"><button onClick={() => openCapture('write')} className="min-h-[48px] text-xs flex items-center gap-2"><PenLine size={15} />Leave a breadcrumb</button><button aria-label="Record an audio breadcrumb" onClick={() => openCapture('voice')} className="iroh-icon-button"><Mic size={18} /></button></div></div>}
    {view === 'home' && <Link href="/login?next=/home" className="inline-flex items-center gap-1 text-xs text-blue-300 mt-5 min-h-[44px]">Open your real family account<ChevronRight size={13} /></Link>}
    <PreviewTabs view={view} onNavigate={(next) => navigate(next as View)} />
  </main>;
}
