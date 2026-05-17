'use client';

import { useState, useEffect, useRef, Suspense, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DESCENDENT_ROLES } from '@/lib/roles';
import { firstName } from '@/lib/nameUtils';
import { CAPTURE_INTENT_OPTIONS, VALUE_TAGS, normalizePrefillBreadcrumbType } from '@/lib/breadcrumbs';
import { formatTagForDisplay } from '@/lib/breadcrumb-tags';

const DRAFT_KEY    = 'breadcrumbs_draft';
const PREFILL_KEY  = 'breadcrumbs_prefill';

/** Short, conversational sparks — inspiration only; user writes/records in the main surface */
const CAPTURE_INSPIRATION_PROMPTS = [
  'Tell them something you learned too late in life.',
  'Describe a moment that changed you.',
  'Tell them what kind of person matters most.',
] as const;

const HESITATION_MS = 10_000;

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

type Stage = 'loading' | 'prompted' | 'writing' | 'follow-up' | 'done' | 'error';

function collectiveLabel(members: FamilyMember[]): string {
  const descendants = members.filter((m) => DESCENDENT_ROLES.has(m.role));
  if (descendants.length === 0) return 'your family';
  return 'your children';
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

type CaptureMode = 'write' | 'record_audio';

/** Inline thinking dots — calm pulse on the title baseline */
function CaptureTitleThinkingDots() {
  return (
    <span className="inline-flex items-baseline select-none" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block text-muted-foreground/80"
          initial={{ opacity: 0.35 }}
          animate={{ opacity: [0.35, 0.95, 0.95, 0.45, 0.95] }}
          transition={{
            delay: i * 0.35,
            duration: 2.2,
            times: [0, 0.2, 0.45, 0.7, 1],
            repeat: Infinity,
            repeatDelay: 1.4,
            ease: 'easeInOut',
          }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

function CaptureFlow() {
  const router = useRouter();

  const [profile,             setProfile]            = useState<Profile | null>(null);
  const [familyMembers,       setFamilyMembers]      = useState<FamilyMember[]>([]);
  const [selectedRecipient,   setSelectedRecipient]  = useState<FamilyMember | null>(null);
  const [breadcrumbType,      setBreadcrumbType]     = useState<string>('message');
  const [selectedTags,        setSelectedTags]       = useState<string[]>([]);
  const [showTags,            setShowTags]           = useState(false);
  const [stage,               setStage]              = useState<Stage>('loading');
  const [entry,               setEntry]              = useState('');
  const [followUp,            setFollowUp]           = useState('');
  const [followUpAddition,    setFollowUpAddition]   = useState('');
  const [savedBreadcrumbId,   setSavedBreadcrumbId]  = useState<string | null>(null);
  const [savedAt,             setSavedAt]            = useState<string | null>(null);
  const [savedTags,          setSavedTags]         = useState<string[]>([]);
  const [saveError,          setSaveError]          = useState('');
  const [tagEditorOpen,       setTagEditorOpen]      = useState(false);
  const [tagDraft,            setTagDraft]           = useState('');
  const [tagSaving,           setTagSaving]          = useState(false);
  const [saving,              setSaving]             = useState(false);
  const [charCount,           setCharCount]          = useState(0);
  const [draftRestored,       setDraftRestored]      = useState(false);
  const [prefillRestored,     setPrefillRestored]    = useState(false);
  const [captureMode,         setCaptureMode]        = useState<CaptureMode>('write');
  const [helpExpanded,        setHelpExpanded]       = useState(false);
  const [showHesitationHint,  setShowHesitationHint] = useState(false);
  const [audioBlob,           setAudioBlob]          = useState<Blob | null>(null);
  const [audioPreviewUrl,     setAudioPreviewUrl]    = useState<string | null>(null);
  const [recording,           setRecording]          = useState(false);
  const [recordSec,          setRecordSec]          = useState(0);
  const [recordError,         setRecordError]        = useState('');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hesitationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioObjectUrlRef = useRef<string | null>(null);
  const writeAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordSurfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
  }, []);

  useEffect(() => {
    if (!recording) {
      setRecordSec(0);
      return;
    }
    const started = Date.now();
    const tick = () => {
      setRecordSec(Math.floor((Date.now() - started) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (captureMode !== 'write') return;
    const id = requestAnimationFrame(() => {
      writeAreaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [captureMode]);

  useEffect(() => {
    if (captureMode !== 'record_audio' || recording || audioBlob) return;
    const t = window.setTimeout(() => setShowHesitationHint(true), HESITATION_MS);
    return () => window.clearTimeout(t);
  }, [captureMode, recording, audioBlob]);

  function clearHesitationTimer() {
    if (hesitationTimerRef.current) {
      window.clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  }

  function scheduleWriteHesitation() {
    clearHesitationTimer();
    if (captureMode !== 'write') return;
    hesitationTimerRef.current = window.setTimeout(() => {
      hesitationTimerRef.current = null;
      setShowHesitationHint(true);
    }, HESITATION_MS);
  }

  function cleanupAudio() {
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
    } catch { /* noop */ }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecording(false);
  }

  function selectWriteMode() {
    cleanupAudio();
    clearHesitationTimer();
    setShowHesitationHint(false);
    setCaptureMode('write');
    setRecordError('');
  }

  function selectRecordMode() {
    setEntry('');
    setCharCount(0);
    localStorage.removeItem(DRAFT_KEY);
    cleanupAudio();
    clearHesitationTimer();
    setShowHesitationHint(false);
    setCaptureMode('record_audio');
    setRecordError('');
  }

  async function startRecording() {
    setRecordError('');
    if (typeof MediaRecorder === 'undefined') {
      setRecordError('Voice recording is not available in this browser. Try Write or Chrome.');
      return;
    }
    if (recording && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch { /* noop */ }
    }
    cleanupAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size) audioChunksRef.current.push(ev.data);
      };
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
      setRecordError('Microphone access was denied or recording is not supported here.');
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
    const prefillRaw = localStorage.getItem(PREFILL_KEY);
    if (prefillRaw) {
      try {
        const prefill = JSON.parse(prefillRaw) as {
          content?: string;
          breadcrumbType?: string;
        };
        if (prefill.content) {
          setEntry(prefill.content);
          setCharCount(prefill.content.length);
          setPrefillRestored(true);
          setCaptureMode('write');
        }
        if (prefill.breadcrumbType) setBreadcrumbType(normalizePrefillBreadcrumbType(prefill.breadcrumbType));
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
      setCaptureMode('write');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const profileRes = await fetch('/api/profile');
        if (profileRes.status === 401) { router.push('/login?next=/capture'); return; }
        if (profileRes.status === 422) { router.push('/setup'); return; }
        if (!profileRes.ok) { setStage('error'); return; }
        const { profile: p, familyMembers: fm } = await profileRes.json();
        setProfile(p);
        setFamilyMembers(fm ?? []);
        setStage('prompted');
      } catch {
        setStage('error');
      }
    })();
  }, [router]);

  function handleRecipientSelect(member: FamilyMember | null) {
    setSelectedRecipient(member);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleEntryChange(value: string) {
    setEntry(value);
    setCharCount(value.length);
    if (stage === 'prompted') setStage('writing');

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (value.trim()) {
        localStorage.setItem(DRAFT_KEY, value);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
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
    const textOk  = captureMode === 'write' && entry.trim().length > 0;
    const audioOk = captureMode === 'record_audio' && audioBlob;
    if ((!textOk && !audioOk) || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      let payload: Record<string, unknown> = {
        recipientId:     selectedRecipient?.id ?? null,
        breadcrumb_type: breadcrumbType,
        tags:            selectedTags,
      };

      if (captureMode === 'record_audio' && audioBlob) {
        if (audioBlob.size > 6 * 1024 * 1024) {
          setSaveError('Recording is too large. Try a shorter clip.');
          setSaving(false);
          return;
        }
        const b64 = await blobToBase64(audioBlob);
        const up = await fetch('/api/upload-voice', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ audioBase64: b64, mimeType: audioBlob.type || 'audio/webm' }),
        });
        const upData = (await up.json()) as { error?: string; url?: string };
        if (!up.ok) {
          const msg =
            typeof upData.error === 'string'
              ? upData.error
              : 'Could not upload recording.';
          setSaveError(msg);
          setStage('error');
          setSaving(false);
          return;
        }
        payload = {
          ...payload,
          content:     'Voice note — something I want them to hear.',
          contentType: 'audio',
          mediaUrl:    upData.url,
        };
      } else {
        payload = { ...payload, content: entry };
      }

      const res = await fetch('/api/save-entry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; detail?: string; breadcrumb?: unknown; followUp?: string };
      if (!res.ok) {
        const msg =
          data.error ??
          (typeof data.detail === 'string' ? data.detail : null) ??
          `Could not save (${res.status}). Try again.`;
        setSaveError(msg);
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
    const parts = tagDraft
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setTagSaving(true);
    try {
      const res = await fetch('/api/save-entry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breadcrumbId: savedBreadcrumbId, tags: parts }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { tags?: string[] };
      setSavedTags(Array.isArray(data.tags) ? data.tags : parts);
      setTagEditorOpen(false);
    } finally {
      setTagSaving(false);
    }
  }

  const hasContent =
    (captureMode === 'write' && entry.trim().length > 0)
    || (captureMode === 'record_audio' && !!audioBlob);

  const doneLine = selectedRecipient
    ? `${firstName(selectedRecipient.name)} will have this when the time is right.`
    : `${collectiveLabel(familyMembers) === 'your family' ? 'Your family' : 'Your children'} will have this when the time is right.`;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-start px-5 sm:px-6 py-10 sm:py-12">
      <div className="max-w-xl w-full space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Back
          </button>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={async () => {
              const supabase = getBrowserSupabase();
              if (supabase) await supabase.auth.signOut();
              router.push('/login');
            }}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
          >
            Sign out
          </button>
        </div>

        {/* Loading */}
        {stage === 'loading' && (
          <div className="py-24 text-center">
            <p className="text-muted-foreground text-sm">
              Loading
              <span className="inline-flex">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0.4, 1] }}
                    transition={{
                      delay: i * 0.3,
                      duration: 1.5,
                      times: [0, 0.1, 0.5, 0.75, 1],
                      repeat: Infinity,
                      repeatDelay: 0.5,
                    }}
                  >
                    .
                  </motion.span>
                ))}
              </span>
            </p>
          </div>
        )}

        {/* Capture: write / record → light inspiration → save when ready */}
        {(stage === 'prompted' || stage === 'writing') && profile && (
          <div className="space-y-3.5 sm:space-y-4">
            <div className="w-full flex justify-center px-1">
              <h1 className="font-serif text-2xl text-foreground tracking-tight sm:text-3xl inline-flex flex-nowrap items-baseline justify-center gap-1 text-center">
                <span className="whitespace-nowrap">Leave A Breadcrumb</span>
                <CaptureTitleThinkingDots />
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto w-full">
              <button
                type="button"
                aria-pressed={captureMode === 'write'}
                onClick={selectWriteMode}
                className={`px-4 py-2.5 text-sm font-normal border rounded-sm transition text-center ${
                  captureMode === 'write'
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                Write
              </button>
              <button
                type="button"
                aria-pressed={captureMode === 'record_audio'}
                onClick={selectRecordMode}
                className={`px-4 py-2.5 text-sm font-normal border rounded-sm transition text-center ${
                  captureMode === 'record_audio'
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                Record
              </button>
            </div>

            {captureMode === 'write' && (
              <textarea
                ref={writeAreaRef}
                className="w-full min-h-[14.5rem] sm:min-h-[17rem] bg-card/80 border border-border/80 rounded-sm px-5 py-5 text-foreground text-base leading-[1.65] placeholder:text-muted-foreground/55 focus:border-foreground/45 focus:outline-none transition shadow-none resize-y"
                placeholder="What do you want them to remember?"
                value={entry}
                onChange={onWriteAreaChange}
                onFocus={() => {
                  setShowHesitationHint(false);
                  if (!entry.trim()) scheduleWriteHesitation();
                }}
                onBlur={() => clearHesitationTimer()}
              />
            )}

            {captureMode === 'record_audio' && (
              <div
                ref={recordSurfaceRef}
                className="space-y-4 rounded-sm border border-border/35 bg-card/15 px-4 py-5"
              >
                <p className="text-sm text-muted-foreground/90 leading-relaxed text-center">
                  Record something they&apos;ll always have.
                </p>
                {recordError ? (
                  <p className="text-xs text-red-400/90 text-center">{recordError}</p>
                ) : null}
                {!audioBlob && !recording && (
                  <div className="flex justify-center pt-0.5">
                    <motion.button
                      type="button"
                      onClick={() => void startRecording()}
                      aria-label="Record a voice note"
                      animate={{ opacity: [0.88, 1, 0.88] }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm border border-foreground/90 text-foreground rounded-sm hover:bg-foreground hover:text-background transition w-auto max-w-full"
                    >
                      <span className="inline-block w-2 h-2 rounded-full bg-[#c45c5c] shadow-[0_0_10px_rgba(196,92,92,0.45)]" aria-hidden />
                      Record
                    </motion.button>
                  </div>
                )}
                {recording && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                      Recording{' '}
                      {`${Math.floor(recordSec / 60)}:${String(recordSec % 60).padStart(2, '0')}`}
                    </p>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-4 py-2 text-sm border border-foreground text-foreground rounded-sm hover:bg-foreground hover:text-background transition"
                    >
                      Stop
                    </button>
                  </div>
                )}
                {audioPreviewUrl && !recording && (
                  <div className="space-y-2">
                    <audio src={audioPreviewUrl} controls className="w-full max-w-full mx-auto" />
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => { cleanupAudio(); setRecordError(''); }}
                        className="text-xs tracking-wide text-muted-foreground hover:text-foreground border border-border/45 rounded-sm px-3 py-1.5"
                      >
                        Discard and try again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-1 space-y-2">
              {showHesitationHint ? (
                <p className="text-xs text-muted-foreground/75">
                  <button
                    type="button"
                    onClick={() => {
                      setHelpExpanded(true);
                      setShowHesitationHint(false);
                    }}
                    className="border-b border-muted-foreground/30 hover:border-foreground/50 hover:text-foreground text-left transition"
                  >
                    Need inspiration?
                  </button>
                </p>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  aria-expanded={helpExpanded}
                  aria-controls="capture-inspiration-panel"
                  onClick={() => {
                    setHelpExpanded((v) => !v);
                    setShowHesitationHint(false);
                  }}
                  className="text-left text-xs text-muted-foreground/90 hover:text-foreground border-b border-transparent hover:border-foreground/25 pb-0.5 transition w-full sm:w-auto sm:inline-block"
                >
                  Need help getting started?
                </button>
                {helpExpanded ? (
                  <div
                    id="capture-inspiration-panel"
                    className="pt-1 pl-0.5 border-l border-border/30 space-y-2"
                  >
                    {CAPTURE_INSPIRATION_PROMPTS.map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => {
                          if (captureMode === 'write') {
                            writeAreaRef.current?.focus();
                            writeAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } else {
                            recordSurfaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className="block w-full text-left text-sm text-foreground/85 leading-snug hover:text-foreground py-1.5 px-1 rounded-sm hover:bg-foreground/5 transition"
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {(draftRestored || prefillRestored) && (
              <div className="text-xs text-muted-foreground/55 space-y-0.5">
                {draftRestored ? <p>Draft restored.</p> : null}
                {prefillRestored ? <p>From your Family Foundation.</p> : null}
              </div>
            )}

            {hasContent && (
              <div className="space-y-4 border-t border-border/30 pt-5">
                {familyMembers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Who is this for?</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleRecipientSelect(null)}
                        className={`px-3 py-1.5 text-sm border rounded-sm transition ${
                          !selectedRecipient
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                        }`}
                      >
                        Everyone
                      </button>
                      {familyMembers.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => void handleRecipientSelect(m)}
                          className={`px-3 py-1.5 text-sm border rounded-sm transition ${
                            selectedRecipient?.id === m.id
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                          }`}
                        >
                          {firstName(m.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Save as a</p>
                  <div className="flex flex-wrap gap-2">
                    {CAPTURE_INTENT_OPTIONS.map((opt) => {
                      const selected = breadcrumbType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBreadcrumbType(opt.value)}
                          className={`px-3 py-1.5 text-xs border rounded-sm transition ${
                            selected
                              ? 'border-foreground text-foreground bg-foreground/5'
                              : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-xs text-muted-foreground order-2 sm:order-1">
                    {captureMode === 'record_audio' ? 'Voice note ready' : `${charCount} characters`}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="order-1 sm:order-2 py-3 px-8 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition sm:shrink-0 w-full sm:w-auto"
                  >
                    {saving ? 'Saving…' : 'Save Breadcrumb'}
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  <p className="text-xs text-muted-foreground/70">
                    Tags are organized automatically when you save. Optional hints below can guide the AI.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTags(!showTags)}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    {showTags ? '− Hide optional tag hints' : '+ Optional tag hints before save'}
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
                              ? 'border-foreground text-foreground bg-foreground/5'
                              : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
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

        {/* Follow-up */}
        {stage === 'follow-up' && (
          <div className="space-y-6">
            {savedTags.length > 0 && (
              <div className="space-y-3 rounded-sm border border-border/60 bg-card/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Saved with tags: </span>
                  {savedTags.map((t, i) => (
                    <span key={t}>
                      {i > 0 ? ', ' : ''}
                      {formatTagForDisplay(t)}
                    </span>
                  ))}
                </p>
                {!tagEditorOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTagDraft(savedTags.join(', '));
                      setTagEditorOpen(true);
                    }}
                    className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
                  >
                    Edit tags
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="tag-draft" className="sr-only">Edit tags</label>
                    <input
                      id="tag-draft"
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
                        onClick={() => { setTagEditorOpen(false); }}
                        className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="glass-card px-6 py-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">One more thought</p>
              <p className="font-serif text-foreground text-lg leading-relaxed">{followUp}</p>
            </div>

            <textarea
              className="w-full h-40 bg-card border border-border rounded-sm px-5 py-4 text-foreground text-base leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 transition"
              placeholder="Add to your entry (optional)…"
              value={followUpAddition}
              onChange={(e) => setFollowUpAddition(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStage('done')}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground hover:text-foreground disabled:opacity-30 transition"
              >
                Skip — I&apos;m done
              </button>
              <button
                onClick={async () => {
                  if (!followUpAddition.trim() || !savedBreadcrumbId) { setStage('done'); return; }
                  setSaving(true);
                  try {
                    await fetch('/api/save-entry', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ breadcrumbId: savedBreadcrumbId, appendContent: followUpAddition }),
                    });
                  } finally {
                    setSaving(false);
                    setStage('done');
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
            <div className="w-12 h-px bg-foreground/30 mx-auto" />
            <p className="font-serif text-foreground text-2xl">{doneLine}</p>
            {savedTags.length > 0 && (
              <div className="space-y-3 max-w-md mx-auto text-left rounded-sm border border-border/60 bg-card/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Tags: </span>
                  {savedTags.map((t, i) => (
                    <span key={t}>
                      {i > 0 ? ', ' : ''}
                      {formatTagForDisplay(t)}
                    </span>
                  ))}
                </p>
                {!tagEditorOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTagDraft(savedTags.join(', '));
                      setTagEditorOpen(true);
                    }}
                    className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
                  >
                    Edit tags
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="tag-draft-done" className="sr-only">Edit tags</label>
                    <input
                      id="tag-draft-done"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      className="w-full bg-card border border-border rounded-sm px-3 py-2 text-sm text-foreground outline-none"
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
            )}
            {savedAt && (
              <p className="text-xs text-muted-foreground">
                Saved {new Date(savedAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })} at {new Date(savedAt).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={() => router.push('/archive')}
                className="py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground hover:text-foreground transition"
              >
                Family Library
              </button>
              <button
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
            {saveError ? (
              <p className="text-red-400/90 text-sm max-w-md mx-auto">{saveError}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Check your connection and try again.</p>
            )}
            <button
              onClick={() => {
                setSaveError('');
                cleanupAudio();
                setCaptureMode('write');
                setHelpExpanded(false);
                setShowHesitationHint(false);
                setEntry('');
                setCharCount(0);
                setStage('prompted');
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

/**
 * Magic links must hit /auth/callback so exchangeCodeForSession runs.
 * If Supabase Site URL (or a template) sends ?code= to /capture, we forward here.
 */
function CompleteMagicLinkFromCapture({ code }: { code: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(
      `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent('/capture')}`
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
  const code           = searchParams.get('code');
  if (code) {
    return <CompleteMagicLinkFromCapture code={code} />;
  }
  return <CaptureFlow />;
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
