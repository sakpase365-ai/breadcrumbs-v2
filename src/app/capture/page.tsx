'use client';

import { useState, useEffect, useRef, Suspense, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DESCENDENT_ROLES } from '@/lib/roles';
import { firstName } from '@/lib/nameUtils';
import {
  VALUE_TAGS,
  CAPTURE_INTENT_OPTIONS,
} from '@/lib/breadcrumbs';
import { formatTagForDisplay } from '@/lib/breadcrumb-tags';
import {
  DEFAULT_USER_SETTINGS,
  readUserSettings,
  type UserSettings,
} from '@/lib/user-settings';
import VoiceWaveform from '@/components/VoiceWaveform';
import AudioPlayer   from '@/components/AudioPlayer';

const DRAFT_KEY     = 'breadcrumbs_draft';
const PREFILL_KEY   = 'breadcrumbs_prefill';
const HESITATION_MS = 10_000;

type Stage        = 'loading' | 'capture' | 'follow-up' | 'done' | 'error';
type CaptureStage = 'write' | 'voice';

const STAGE_ORDER: CaptureStage[] = ['write', 'voice'];

interface Profile {
  id:                string;
  name:              string;
  family_name:       string | null;
  role:              string;
  custom_role_label: string | null;
}

interface FamilyMember {
  id:                string;
  name:              string;
  role:              string;
  custom_role_label: string | null;
  birth_date:        string | null;
}

function collectiveLabel(members: FamilyMember[]): string {
  return members.filter((m) => DESCENDENT_ROLES.has(m.role)).length === 0
    ? 'your family'
    : 'your children';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function fetchPromptText(recipientId: string | null, excludePriorPrompts?: string[]): Promise<string> {
  const body: Record<string, unknown> = { recipientId };
  if (excludePriorPrompts?.length) body.excludePriorPrompts = excludePriorPrompts;
  const res = await fetch('/api/generate-prompt', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error('prompt fetch failed');
  const { prompt } = await res.json();
  return prompt as string;
}

function chipCls(active: boolean, size: 'sm' | 'xs' = 'sm') {
  const text = size === 'xs' ? 'text-xs' : 'text-sm';
  return `px-3 py-1.5 ${text} border rounded-sm transition ${
    active
      ? 'border-foreground bg-foreground text-background'
      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
  }`;
}

function CaptureFlow() {
  const router = useRouter();

  const [profile,            setProfile]           = useState<Profile | null>(null);
  const [familyMembers,      setFamilyMembers]     = useState<FamilyMember[]>([]);
  const [selectedRecipient,  setSelectedRecipient] = useState<FamilyMember | null>(null);
  const [selectedTags,       setSelectedTags]      = useState<string[]>([]);
  const [showTags,           setShowTags]          = useState(false);
  const [stage,              setStage]             = useState<Stage>('loading');
  const [captureStage,       setCaptureStage]      = useState<CaptureStage>('write');
  const [entry,              setEntry]             = useState('');
  const [charCount,          setCharCount]         = useState(0);
  const [draftRestored,      setDraftRestored]     = useState(false);
  const [prefillRestored,    setPrefillRestored]   = useState(false);
  const [showHesitationHint, setShowHesitationHint] = useState(false);
  const [audioBlob,          setAudioBlob]         = useState<Blob | null>(null);
  const [audioPreviewUrl,    setAudioPreviewUrl]   = useState<string | null>(null);
  const [recording,          setRecording]         = useState(false);
  const [recordSec,          setRecordSec]         = useState(0);
  const [recordError,        setRecordError]       = useState('');
  const [saving,             setSaving]            = useState(false);
  const [saveError,          setSaveError]         = useState('');
  const [followUp,           setFollowUp]          = useState('');
  const [followUpAddition,   setFollowUpAddition]  = useState('');
  const [savedBreadcrumbId,  setSavedBreadcrumbId] = useState<string | null>(null);
  const [savedAt,            setSavedAt]           = useState<string | null>(null);
  const [savedTags,          setSavedTags]         = useState<string[]>([]);
  const [tagEditorOpen,      setTagEditorOpen]     = useState(false);
  const [tagDraft,           setTagDraft]          = useState('');
  const [tagSaving,          setTagSaving]         = useState(false);
  const [aiPrompt,           setAiPrompt]          = useState<string | null>(null);
  const [promptLoading,      setPromptLoading]     = useState(false);
  const [breadcrumbType,     setBreadcrumbType]    = useState<string | null>(null);
  const [userSettings,       setUserSettings]      = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [confirmingSave,     setConfirmingSave]    = useState(false);

  const autosaveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hesitationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const audioChunksRef     = useRef<BlobPart[]>([]);
  const audioObjectUrlRef  = useRef<string | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const audioContextRef    = useRef<AudioContext | null>(null);
  const writeAreaRef       = useRef<HTMLTextAreaElement | null>(null);
  const recentPromptsRef   = useRef<string[]>([]);
  const swipeContainerRef  = useRef<HTMLDivElement>(null);
  const captureStageRef    = useRef<CaptureStage>('write');
  const touchStartX        = useRef<number>(0);
  const touchStartY        = useRef<number>(0);

  // Revoke object URL on unmount
  useEffect(() => () => {
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
  }, []);

  // Recording duration ticker
  useEffect(() => {
    if (!recording) { setRecordSec(0); return; }
    const started = Date.now();
    const tick = () => setRecordSec(Math.floor((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [recording]);

  // Keep stage ref in sync for native swipe listener
  useEffect(() => { captureStageRef.current = captureStage; }, [captureStage]);

  // Native swipe listener — passive:false on touchmove so we can preventDefault
  // for horizontal swipes even inside the textarea
  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;

    function onStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }

    function onMove(e: TouchEvent) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > dy && dx > 10) e.preventDefault();
    }

    function onEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 50) return;
      const idx = STAGE_ORDER.indexOf(captureStageRef.current);
      if (dx < 0 && idx < STAGE_ORDER.length - 1) handleStageChange(STAGE_ORDER[idx + 1]);
      if (dx > 0 && idx > 0)                       handleStageChange(STAGE_ORDER[idx - 1]);
    }

    el.addEventListener('touchstart', onStart,  { passive: true });
    el.addEventListener('touchmove',  onMove,   { passive: false });
    el.addEventListener('touchend',   onEnd,    { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus textarea when entering write stage
  useEffect(() => {
    if (captureStage !== 'write') return;
    const id = requestAnimationFrame(() => writeAreaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [captureStage]);

  function clearHesitationTimer() {
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  }

  function scheduleWriteHesitation() {
    clearHesitationTimer();
    if (captureStage !== 'write') return;
    hesitationTimerRef.current = setTimeout(() => {
      hesitationTimerRef.current = null;
      setShowHesitationHint(true);
    }, HESITATION_MS);
  }

  function handleStageChange(next: CaptureStage) {
    if (next !== 'voice' && captureStage === 'voice' && !audioBlob) cleanupAudio();
    clearHesitationTimer();
    setShowHesitationHint(false);
    setRecordError('');
    setCaptureStage(next);
  }


  function cleanupAudio() {
    analyserRef.current = null;
    try { void audioContextRef.current?.close(); } catch { /* noop */ }
    audioContextRef.current = null;
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
    } catch { /* noop */ }
    mediaRecorderRef.current = null;
    audioChunksRef.current   = [];
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecording(false);
  }

  async function startRecording() {
    setRecordError('');
    if (typeof MediaRecorder === 'undefined') {
      setRecordError('Voice recording is not available in this browser.');
      return;
    }
    cleanupAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Wire up AudioContext + AnalyserNode for live waveform (non-fatal if unavailable)
      try {
        const AudioCtx =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const source   = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize              = 128;
          analyser.smoothingTimeConstant = 0.78;
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current     = analyser;
        }
      } catch { /* waveform visualization unavailable — falls back to placeholder */ }

      const mime   = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) audioChunksRef.current.push(ev.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
        const u = URL.createObjectURL(blob);
        audioObjectUrlRef.current = u;
        setAudioPreviewUrl(u);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setShowHesitationHint(false);
      setRecording(true);
    } catch {
      setRecordError('Microphone access was denied.');
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  // Restore draft or prefill from Foundation
  useEffect(() => {
    setUserSettings(readUserSettings());
    const prefillRaw = localStorage.getItem(PREFILL_KEY);
    if (prefillRaw) {
      try {
        const prefill = JSON.parse(prefillRaw) as { content?: string; breadcrumbType?: string };
        if (prefill.content) {
          setEntry(prefill.content);
          setCharCount(prefill.content.length);
          setPrefillRestored(true);
          setCaptureStage('write');
        }
        localStorage.removeItem(PREFILL_KEY);
        localStorage.removeItem(DRAFT_KEY);
        return;
      } catch { /* ignore */ }
    }
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      setEntry(saved);
      setCharCount(saved.length);
      setDraftRestored(true);
      setCaptureStage('write');
    }
  }, []);

  function excludePriorPromptsForFetch(currentPrompt: string): string[] | undefined {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of recentPromptsRef.current) {
      const s = t.trim();
      if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    }
    const cur = currentPrompt.trim();
    if (cur && !seen.has(cur)) out.push(cur);
    const slice = out.slice(-5);
    return slice.length ? slice : undefined;
  }

  async function handleNewPrompt() {
    if (promptLoading) return;
    setPromptLoading(true);
    try {
      const cur  = aiPrompt ?? '';
      const next = await fetchPromptText(
        selectedRecipient?.id ?? null,
        excludePriorPromptsForFetch(cur),
      );
      setAiPrompt(next);
      recentPromptsRef.current = [...recentPromptsRef.current, next].slice(-8);
    } catch { /* keep existing prompt */ } finally {
      setPromptLoading(false);
    }
  }

  // Load profile + initial prompt suggestion
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) { router.push('/login?next=/capture'); return; }
        if (res.status === 422) { router.push('/setup'); return; }
        if (!res.ok) { setStage('error'); return; }
        const { profile: p, familyMembers: fm } = await res.json();
        setProfile(p);
        setFamilyMembers(fm ?? []);
        setStage('capture');
        setPromptLoading(true);
        try {
          const prompt = await fetchPromptText(null);
          setAiPrompt(prompt);
          recentPromptsRef.current = [prompt];
        } catch { /* non-fatal */ } finally {
          setPromptLoading(false);
        }
      } catch {
        setStage('error');
      }
    })();
  }, [router]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleEntryChange(value: string) {
    setEntry(value);
    setCharCount(value.length);
    if (!userSettings.autoSaveDrafts) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (value.trim()) localStorage.setItem(DRAFT_KEY, value);
      else              localStorage.removeItem(DRAFT_KEY);
    }, 500);
  }

  function onWriteAreaChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    clearHesitationTimer();
    setShowHesitationHint(false);
    handleEntryChange(value);
    requestAnimationFrame(() => {
      if (writeAreaRef.current === document.activeElement && !value.trim()) {
        scheduleWriteHesitation();
      }
    });
  }

  async function handleSave() {
    const textOk  = entry.trim().length > 0;
    const audioOk = !!audioBlob;
    if ((!textOk && !audioOk) || saving) return;
    if (userSettings.confirmBeforePublishing && !confirmingSave) {
      setConfirmingSave(true);
      return;
    }
    setConfirmingSave(false);
    setSaving(true);
    setSaveError('');
    try {
      let payload: Record<string, unknown> = {
        recipientId:     selectedRecipient?.id ?? null,
        breadcrumb_type: breadcrumbType ?? 'message',
        tags:            selectedTags,
      };

      if (audioBlob) {
        if (audioBlob.size > 6 * 1024 * 1024) {
          setSaveError('Recording is too large. Try a shorter clip.');
          return;
        }
        const b64  = await blobToBase64(audioBlob);
        const up   = await fetch('/api/upload-voice', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ audioBase64: b64, mimeType: audioBlob.type || 'audio/webm' }),
        });
        const upData = (await up.json()) as { error?: string; url?: string; path?: string };
        if (!up.ok) {
          setSaveError(typeof upData.error === 'string' ? upData.error : 'Could not upload recording.');
          setStage('error');
          return;
        }
        // url is a signed URL (preferred); path is the raw storage path returned when signing fails
        const mediaRef = upData.url ?? upData.path;
        payload = { ...payload, content: 'Voice note — something I want them to hear.', contentType: 'audio', mediaUrl: mediaRef };
      } else {
        payload = { ...payload, content: entry };
      }

      const res  = await fetch('/api/save-entry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; detail?: string; breadcrumb?: unknown; followUp?: string };
      if (!res.ok) {
        setSaveError(
          data.error ??
          (typeof data.detail === 'string' ? data.detail : null) ??
          `Could not save (${res.status}). Try again.`,
        );
        setStage('error');
        return;
      }
      const bc = data.breadcrumb as { id: string; created_at?: string; tags?: unknown };
      setFollowUp(data.followUp ?? '');
      setSavedBreadcrumbId(bc.id);
      setSavedAt(bc.created_at ?? new Date().toISOString());
      setSavedTags(Array.isArray(bc.tags) ? bc.tags : []);
      setTagEditorOpen(false);
      localStorage.removeItem(DRAFT_KEY);
      setStage('follow-up');
    } catch {
      setSaveError('Network error. Check your connection and try again.');
      setStage('error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTagsEdit() {
    if (!savedBreadcrumbId || tagSaving) return;
    const parts = tagDraft.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    setTagSaving(true);
    try {
      const res  = await fetch('/api/save-entry', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ breadcrumbId: savedBreadcrumbId, tags: parts }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { tags?: string[] };
      setSavedTags(Array.isArray(data.tags) ? data.tags : parts);
      setTagEditorOpen(false);
    } finally {
      setTagSaving(false);
    }
  }

  const hasContent = entry.trim().length > 0 || !!audioBlob;

  const collective = collectiveLabel(familyMembers);
  const doneLine   = selectedRecipient
    ? `${firstName(selectedRecipient.name)} will have this when the time is right.`
    : `${collective === 'your family' ? 'Your family' : 'Your children'} will have this when the time is right.`;

  function renderTagEditor(inputId: string) {
    if (savedTags.length === 0) return null;
    return (
      <div className="space-y-3 rounded-sm border border-border/60 bg-card/30 px-4 py-3">
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">Tags: </span>
          {savedTags.map((t, i) => (
            <span key={t}>{i > 0 ? ', ' : ''}{formatTagForDisplay(t)}</span>
          ))}
        </p>
        {!tagEditorOpen ? (
          <button
            type="button"
            onClick={() => { setTagDraft(savedTags.join(', ')); setTagEditorOpen(true); }}
            className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
          >
            Edit tags
          </button>
        ) : (
          <div className="space-y-2">
            <label htmlFor={inputId} className="sr-only">Edit tags</label>
            <input
              id={inputId}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              className="w-full bg-card border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/60 outline-none"
              placeholder="parenting, gratitude, life-lesson"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveTagsEdit()}
                disabled={tagSaving}
                className="text-xs px-3 py-1.5 border border-foreground text-foreground rounded-sm disabled:opacity-40"
              >
                {tagSaving ? 'Saving…' : 'Save tags'}
              </button>
              <button
                type="button"
                onClick={() => setTagEditorOpen(false)}
                className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main
      className="min-h-screen bg-background flex flex-col items-center justify-start px-5 sm:px-6 pb-28"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <div className="max-w-lg w-full space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Back
          </button>
          <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/settings')}
              className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition"
            >
              Settings
            </button>
            <button
              onClick={async () => {
                const supabase = getBrowserSupabase();
                if (supabase) await supabase.auth.signOut();
                router.push('/login');
              }}
              className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Loading */}
        {stage === 'loading' && (
          <div className="py-24 text-center">
            <p className="text-foreground/30 text-sm">
              <span className="inline-flex">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0.4, 1] }}
                    transition={{ delay: i * 0.3, duration: 1.5, times: [0, 0.1, 0.5, 0.75, 1], repeat: Infinity, repeatDelay: 0.5 }}
                  >
                    ·
                  </motion.span>
                ))}
              </span>
            </p>
          </div>
        )}

        {/* ── CAPTURE ── */}
        {stage === 'capture' && profile && (
          <div ref={swipeContainerRef} className="space-y-5" style={{ touchAction: 'pan-y' }}>

            {/* Recipient — always visible, not gated by content */}
            {familyMembers.length > 0 && (
              <div className="space-y-2">
                <p className="type-label text-foreground/35 text-center">Who are you writing to?</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {familyMembers.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedRecipient(selectedRecipient?.id === m.id ? null : m)}
                      className={`px-3 py-1 text-sm rounded-full border transition ${
                        selectedRecipient?.id === m.id
                          ? 'border-foreground text-foreground'
                          : 'border-foreground/20 text-foreground/50 hover:border-foreground/45 hover:text-foreground/75'
                      }`}
                    >
                      {firstName(m.name)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedRecipient(null)}
                    className={`px-3 py-1 text-sm rounded-full border transition ${
                      !selectedRecipient
                        ? 'border-foreground text-foreground'
                        : 'border-foreground/20 text-foreground/50 hover:border-foreground/45 hover:text-foreground/75'
                    }`}
                  >
                    Everyone
                  </button>
                </div>
              </div>
            )}

            {/* Stage navigation — Write / Voice only */}
            <div className="flex items-center justify-center gap-6">
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStageChange(s)}
                  className={`text-xs tracking-wide capitalize transition border-b pb-px ${
                    captureStage === s
                      ? 'text-foreground border-foreground/55'
                      : 'text-foreground/28 border-transparent hover:text-foreground/55'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Stage content */}
            <div>
              <AnimatePresence mode="wait" initial={false}>

                {/* ── WRITE ── */}
                {captureStage === 'write' && (
                  <motion.div
                    key="write"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <textarea
                      ref={writeAreaRef}
                      className="w-full min-h-[38vh] sm:min-h-[42vh] bg-transparent border-0 px-0 py-2 text-foreground text-[1.0625rem] leading-[1.55] tracking-[-0.01em] placeholder:text-foreground/18 focus:outline-none resize-none"
                      placeholder="What do you want them to remember?"
                      value={entry}
                      onChange={onWriteAreaChange}
                      onFocus={() => {
                        setShowHesitationHint(false);
                        if (!entry.trim()) scheduleWriteHesitation();
                      }}
                      onBlur={clearHesitationTimer}
                    />

                    {/* Inline prompt card — always visible in write stage */}
                    {(aiPrompt || promptLoading) && (
                      <div className="border-t border-foreground/[0.06] pt-3 space-y-2">
                        <p className="type-label text-foreground/22">Today&apos;s Spark</p>
                        {promptLoading ? (
                          <p className="text-xs text-foreground/18">···</p>
                        ) : (
                          <AnimatePresence mode="wait">
                            <motion.p
                              key={aiPrompt ?? 'prompt'}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.3 }}
                              className="text-sm leading-[1.65] text-foreground/50"
                            >
                              {aiPrompt}
                            </motion.p>
                          </AnimatePresence>
                        )}
                        {!promptLoading && (
                          <button
                            type="button"
                            onClick={() => void handleNewPrompt()}
                            className="text-xs text-foreground/20 hover:text-foreground/50 transition"
                          >
                            ↻ New spark
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── VOICE ── */}
                {captureStage === 'voice' && (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-[44vh] sm:min-h-[48vh] flex flex-col items-center justify-center py-8 gap-7"
                  >
                    {recordError && (
                      <p className="text-xs text-red-400/75 text-center">{recordError}</p>
                    )}

                    {/* Waveform zone — reserved height prevents layout jump */}
                    {!audioBlob && (
                      <div
                        className={`transition-opacity duration-500 ${recording ? 'opacity-100' : 'opacity-0'}`}
                        aria-hidden="true"
                      >
                        <VoiceWaveform
                          analyser={analyserRef.current}
                          active={recording}
                          reducedMotion={userSettings.reduceMotion}
                        />
                      </div>
                    )}

                    {/* Timer */}
                    {recording && (
                      <span
                        className="text-sm text-foreground/40 tabular-nums tracking-widest"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {`${Math.floor(recordSec / 60)}:${String(recordSec % 60).padStart(2, '0')}`}
                      </span>
                    )}

                    {/* Idle helper text */}
                    {!audioBlob && !recording && (
                      <p className="text-xs text-foreground/30 text-center tracking-wide">
                        Say it in your own voice.
                      </p>
                    )}

                    {/* Record / Stop — large pill */}
                    {!audioBlob && (
                      <motion.button
                        type="button"
                        onClick={recording ? stopRecording : () => void startRecording()}
                        aria-label={recording ? 'Stop recording' : 'Start recording'}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                        className={`flex items-center justify-center gap-3 px-10 rounded-full border transition-colors min-h-[64px] min-w-[176px] text-[0.9375rem] select-none ${
                          recording
                            ? 'border-[#c45c5c]/55 text-foreground/85 bg-[#c45c5c]/[0.07]'
                            : 'border-foreground/28 text-foreground/60 hover:border-foreground/50 hover:text-foreground/85'
                        }`}
                      >
                        {recording ? (
                          <>
                            <motion.span
                              className="w-3.5 h-3.5 rounded-full bg-[#c45c5c] shrink-0"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                              aria-hidden="true"
                            />
                            Stop
                          </>
                        ) : (
                          <>
                            <motion.span
                              className="w-3.5 h-3.5 rounded-full bg-[#c45c5c] shrink-0"
                              animate={{ opacity: [0.5, 1, 0.5], scale: [0.88, 1.12, 0.88] }}
                              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                              aria-hidden="true"
                            />
                            Record
                          </>
                        )}
                      </motion.button>
                    )}

                    {/* Playback preview after recording */}
                    {audioPreviewUrl && !recording && (
                      <div className="w-full space-y-5">
                        <AudioPlayer src={audioPreviewUrl} />
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => { cleanupAudio(); setRecordError(''); }}
                            className="text-xs text-foreground/25 hover:text-foreground/55 transition"
                          >
                            Discard and try again
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Draft / prefill notices */}
            {(draftRestored || prefillRestored) && (
              <div className="text-xs text-foreground/28">
                {draftRestored   && <p>Draft restored.</p>}
                {prefillRestored && <p>From your Family Foundation.</p>}
              </div>
            )}

            {/* Pre-save — appears when content exists */}
            {hasContent && (
              <div className="space-y-5 border-t border-foreground/[0.07] pt-5">

                {/* Type picker — required before save */}
                <div className="space-y-2.5">
                  <p className="type-label text-foreground/30 text-center">What kind of breadcrumb is this?</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {CAPTURE_INTENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBreadcrumbType(opt.value)}
                        className={`px-4 py-1.5 text-sm border rounded-sm transition ${
                          breadcrumbType === opt.value
                            ? 'border-foreground text-foreground bg-foreground/5'
                            : 'border-foreground/18 text-foreground/40 hover:border-foreground/45 hover:text-foreground/70'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {breadcrumbType && (
                    <motion.p
                      key={breadcrumbType}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="text-xs text-foreground/28"
                    >
                      {CAPTURE_INTENT_OPTIONS.find((o) => o.value === breadcrumbType)?.description}
                    </motion.p>
                  )}
                </div>

                <p className="text-xs text-foreground/22">
                  {audioBlob ? 'Voice note ready' : `${charCount} characters`}
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowTags(!showTags)}
                    className="text-xs text-foreground/22 hover:text-foreground/50 transition"
                  >
                    {showTags ? '− Hide tag hints' : '+ Tag hints'}
                  </button>
                  {showTags && (
                    <div className="flex flex-wrap gap-2">
                      {VALUE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 text-xs border rounded-sm transition ${
                            selectedTags.includes(tag)
                              ? 'border-foreground/60 text-foreground/80 bg-foreground/5'
                              : 'border-foreground/15 text-foreground/30 hover:border-foreground/35 hover:text-foreground/60'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

        {/* Fixed bottom bar */}
        {stage === 'capture' && (
          <div
            className="fixed bottom-0 left-0 right-0 bg-background border-t border-foreground/[0.07] px-5 pt-3 flex items-center justify-between"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
          >
            <button
              type="button"
              onClick={() => void handleNewPrompt()}
              disabled={promptLoading}
              className="text-sm text-foreground/35 hover:text-foreground/65 transition disabled:opacity-30"
            >
              ↻ Spark
            </button>
            <a
              href="/ask"
              className="text-xs text-foreground/22 hover:text-foreground/50 transition"
            >
              Family Agent
            </a>
            {confirmingSave ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingSave(false)}
                  className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-sm hover:border-foreground/40 hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-1.5 text-xs border border-foreground text-foreground rounded-sm hover:bg-foreground hover:text-background transition disabled:opacity-30"
                >
                  {saving ? 'Saving…' : 'Yes, save it'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasContent || !breadcrumbType || saving}
                className="px-5 py-1.5 text-sm border border-foreground/50 text-foreground/75 rounded-sm disabled:opacity-25 hover:border-foreground hover:text-foreground transition"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        )}

        {/* Follow-up */}
        {stage === 'follow-up' && (
          <div className="space-y-6">
            {renderTagEditor('tag-draft-followup')}

            <div className="glass-card px-6 py-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">One more thought</p>
              <p className="text-base leading-[1.6] tracking-[-0.005em] text-foreground/88 font-normal">{followUp}</p>
            </div>

            <textarea
              className="w-full h-40 bg-card border border-border rounded-sm px-5 py-4 text-foreground text-base leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 focus:outline-none transition resize-none"
              placeholder="Add to your entry (optional)…"
              value={followUpAddition}
              onChange={(e) => setFollowUpAddition(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage('done')}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground hover:text-foreground disabled:opacity-30 transition"
              >
                Skip — I&apos;m done
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!followUpAddition.trim() || !savedBreadcrumbId) { setStage('done'); return; }
                  setSaving(true);
                  setSaveError('');
                  try {
                    const res = await fetch('/api/save-entry', {
                      method:  'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body:    JSON.stringify({ breadcrumbId: savedBreadcrumbId, appendContent: followUpAddition }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({})) as { error?: string };
                      setSaveError(data.error ?? `Could not append follow-up (${res.status}).`);
                      setStage('error');
                      return;
                    }
                    setStage('done');
                  } catch {
                    setSaveError('Network error while saving follow-up. Try again.');
                    setStage('error');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
              >
                {saving ? 'Saving…' : 'Add and finish'}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {stage === 'done' && profile && (
          <div className="py-20 text-center space-y-6">
            <div className="w-12 h-px bg-foreground/25 mx-auto" />
            <p className="font-display text-foreground text-[1.375rem] font-[400] tracking-[-0.01em] leading-[1.35]">{doneLine}</p>
            <div className="max-w-md mx-auto text-left">
              {renderTagEditor('tag-draft-done')}
            </div>
            {savedAt && (
              <p className="text-xs text-muted-foreground/50">
                Saved {new Date(savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' '}at {new Date(savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
            <div className="flex gap-4 justify-center pt-4">
              <button
                type="button"
                onClick={() => router.push('/archive')}
                className="py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground hover:text-foreground transition"
              >
                Family Library
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="py-3 px-6 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="py-20 text-center space-y-4">
            <p className="font-serif text-foreground text-xl">Something went wrong.</p>
            {saveError
              ? <p className="text-red-400/90 text-sm max-w-md mx-auto">{saveError}</p>
              : <p className="text-muted-foreground text-sm">Check your connection and try again.</p>
            }
            <button
              type="button"
              onClick={() => {
                setSaveError('');
                cleanupAudio();
                setCaptureStage('write');
                setShowHesitationHint(false);
                setEntry('');
                setCharCount(0);
                setBreadcrumbType(null);
                setConfirmingSave(false);
                setStage('capture');
              }}
              className="mt-4 py-3 px-6 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}

function CompleteMagicLinkFromCapture({ code }: { code: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(
      `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent('/capture')}`,
    );
  }, [code, router]);
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <p className="text-muted-foreground text-sm">Completing sign-in…</p>
    </main>
  );
}

function CapturePageGate() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  return code ? <CompleteMagicLinkFromCapture code={code} /> : <CaptureFlow />;
}

export default function CapturePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={(
          <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
            <p className="text-muted-foreground text-sm">Loading…</p>
          </main>
        )}
      >
        <CapturePageGate />
      </Suspense>
    </ErrorBoundary>
  );
}
