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
import {
  SPARK_LIBRARY,
  getSparkHistoryTexts,
  saveSparkToHistory,
  saveSelectionState,
} from '@/lib/spark-library';
import VoiceWaveform   from '@/components/VoiceWaveform';
import AudioPlayer    from '@/components/AudioPlayer';
import SettingsSheet  from '@/components/SettingsSheet';
import BottomNav      from '@/components/BottomNav';
import { CaptureIntro } from '@/components/MemoryExperience';
import { InlineAction, ScreenContainer, ScreenContent, ScreenHeader } from '@/components/ui/design-primitives';

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
  return `px-3 py-1.5 ${text} border rounded-sm transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 ${
    active
      ? 'border-[#3B82F6] bg-[#3B82F6] text-white'
      : 'border-border text-muted-foreground hover:border-[#3B82F6]/45 hover:text-foreground'
  }`;
}

function recipientChipCls(active: boolean) {
  return `px-3 py-2 text-sm rounded-full border transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 ${
    active
      ? 'border-[#3B82F6] text-foreground bg-[#3B82F6]/10'
      : 'border-border text-foreground/50 hover:border-[#3B82F6]/45 hover:text-foreground/75'
  }`;
}

const SAVE_BTN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35';

function CaptureFlow() {
  const router = useRouter();

  const [profile,            setProfile]           = useState<Profile | null>(null);
  const [familyMembers,      setFamilyMembers]     = useState<FamilyMember[]>([]);
  const [selectedRecipient,  setSelectedRecipient] = useState<FamilyMember | null>(null);
  const [recipientChosen, setRecipientChosen] = useState(false);
  const [preparingVoice, setPreparingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceMediaRef, setVoiceMediaRef] = useState<string | null>(null);
  const voiceGeneration = useRef(0);
  const saveInFlight = useRef(false);
  const draftKeyRef = useRef<string | null>(null);
  const [draftStatus, setDraftStatus] = useState('');
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
  const [settingsOpen,       setSettingsOpen]      = useState(false);

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

  // Stop microphone and flush/clear timers when leaving the screen.
  useEffect(() => () => {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.onstop = null;
      mr.stream.getTracks().forEach((track) => track.stop());
      if (mr.state !== 'inactive') mr.stop();
    }
    void audioContextRef.current?.close();
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (hesitationTimerRef.current) clearTimeout(hesitationTimerRef.current);
    voiceGeneration.current += 1;
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
  }, [audioBlob, captureStage]);

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
    if (saveInFlight.current) return;
    if (next !== 'voice' && captureStage === 'voice' && !audioBlob) cleanupAudio();
    clearHesitationTimer();
    setShowHesitationHint(false);
    setRecordError('');
    setCaptureStage(next);
  }


  function cleanupAudio() {
    voiceGeneration.current += 1;
    setPreparingVoice(false);
    setVoiceMediaRef(null);
    setVoiceTranscript('');
    analyserRef.current = null;
    try { void audioContextRef.current?.close(); } catch { /* noop */ }
    audioContextRef.current = null;
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    try {
      const mr = mediaRecorderRef.current;
      if (mr) {
        mr.onstop = null;
        mr.stream.getTracks().forEach((track) => track.stop());
        if (mr.state !== 'inactive') mr.stop();
      }
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

  useEffect(() => { setUserSettings(readUserSettings()); }, []);

  function restoreDraft(viewerId: string) {
    const key = `${DRAFT_KEY}:v2:${viewerId}`;
    draftKeyRef.current = key;
    try {
      const prefillRaw = localStorage.getItem(PREFILL_KEY);
      if (prefillRaw) {
        const prefill = JSON.parse(prefillRaw) as { content?: string };
        if (prefill.content) {
          setEntry(prefill.content);
          setCharCount(prefill.content.length);
          setPrefillRestored(true);
          setCaptureStage('write');
        }
        localStorage.removeItem(PREFILL_KEY);
        return;
      }
      const saved = localStorage.getItem(key);
      if (saved) {
        setEntry(saved);
        setCharCount(saved.length);
        setDraftRestored(true);
      }
    } catch { setDraftStatus('Draft storage is unavailable on this device.'); }
  }

  function excludePriorPromptsForFetch(currentPrompt: string): string[] | undefined {
    const seen = new Set<string>();
    const out: string[] = [];
    // Merge 60-day localStorage history with session memory
    for (const t of [...getSparkHistoryTexts(), ...recentPromptsRef.current]) {
      const s = t.trim();
      if (s && !seen.has(s)) { seen.add(s); out.push(s); }
    }
    const cur = currentPrompt.trim();
    if (cur && !seen.has(cur)) out.push(cur);
    const slice = out.slice(-20);
    return slice.length ? slice : undefined;
  }

  function recordShownPrompt(text: string): void {
    saveSparkToHistory(text);
    recentPromptsRef.current = [...recentPromptsRef.current, text].slice(-8);
    // If this prompt came from the library, persist its category/weight for balancing
    const found = SPARK_LIBRARY.find((p) => p.question === text);
    if (found) saveSelectionState(found);
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
      recordShownPrompt(next);
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
        const { profile: p, familyMembers: fm, access } = await res.json();
        if (access?.viewerUserId) restoreDraft(access.viewerUserId);
        setProfile(p);
        setFamilyMembers(fm ?? []);
        setStage('capture');
        setPromptLoading(true);
        try {
          const excludes = excludePriorPromptsForFetch('');
          const prompt = await fetchPromptText(null, excludes);
          setAiPrompt(prompt);
          recordShownPrompt(prompt);
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
    const key = draftKeyRef.current;
    if (!key) return;
    try {
      if (userSettings.autoSaveDrafts && value.trim()) {
        localStorage.setItem(key, value);
        setDraftStatus('Draft saved on this device');
      } else {
        localStorage.removeItem(key);
        setDraftStatus('');
      }
    } catch { setDraftStatus('Draft could not be saved on this device. Keep this screen open.'); }
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

  async function prepareVoice() {
    if (!audioBlob || preparingVoice) return;
    if (audioBlob.size > 6 * 1024 * 1024) {
      setRecordError('Recording is too large. Try a shorter clip.');
      return;
    }
    const generation = voiceGeneration.current;
    setPreparingVoice(true);
    setRecordError('');
    try {
      const b64 = await blobToBase64(audioBlob);
      const res = await fetch('/api/upload-voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: b64, mimeType: audioBlob.type || 'audio/webm' }),
      });
      const data = await res.json() as { error?: string; url?: string; path?: string; transcript?: string | null };
      if (generation !== voiceGeneration.current) return;
      if (!res.ok || !(data.path || data.url)) throw new Error(data.error || 'Could not prepare your recording.');
      setVoiceMediaRef(data.path || data.url || null);
      setVoiceTranscript(data.transcript?.trim() || '');
    } catch (err) {
      if (generation === voiceGeneration.current) setRecordError(err instanceof Error ? err.message : 'Could not prepare recording. Try again.');
    } finally {
      if (generation === voiceGeneration.current) setPreparingVoice(false);
    }
  }

  async function handleSave() {
    const textOk  = captureStage === 'write' && entry.trim().length > 0;
    const audioOk = captureStage === 'voice' && !!audioBlob;
    if ((!textOk && !audioOk) || saving || saveInFlight.current) return;
    if (!breadcrumbType || (familyMembers.length > 0 && !recipientChosen)) return;
    if (audioOk && !voiceMediaRef) { setRecordError('Review your transcript before saving.'); return; }
    if (userSettings.confirmBeforePublishing && !confirmingSave) {
      setConfirmingSave(true);
      return;
    }
    setConfirmingSave(false);
    saveInFlight.current = true;
    setSaving(true);
    setSaveError('');
    try {
      let payload: Record<string, unknown> = {
        recipientId:     selectedRecipient?.id ?? null,
        breadcrumb_type: breadcrumbType ?? 'message',
        tags:            selectedTags,
      };

      if (audioOk) {
        payload = { ...payload, content: voiceTranscript.trim() || 'Voice note — something I want them to hear.', contentType: 'audio', mediaUrl: voiceMediaRef };
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
      try { if (draftKeyRef.current) localStorage.removeItem(draftKeyRef.current); } catch { /* remote save already succeeded */ }
      setStage('follow-up');
    } catch {
      setSaveError('Network error. Check your connection and try again.');
      setStage('error');
    } finally {
      saveInFlight.current = false;
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

  const hasContent = captureStage === 'voice' ? !!audioBlob : entry.trim().length > 0;

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
              className="field-input !min-h-0 rounded-sm px-3 py-2 text-sm"
              placeholder="parenting, gratitude, life-lesson"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveTagsEdit()}
                disabled={tagSaving}
                className="text-xs px-3 py-1.5 border border-[#3B82F6] bg-[#3B82F6] text-white rounded-sm hover:bg-[#2563EB] hover:border-[#2563EB] disabled:opacity-40"
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
    <ScreenContainer className="screen-main-safe !px-5 sm:!px-6 !py-0 flex flex-col items-center justify-start">
      <ScreenContent className="space-y-5 !pb-28">

        <ScreenHeader
          title={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          titleClassName="text-xs font-sans font-normal text-muted-foreground/50 uppercase tracking-widest"
          rightAction={(
            <InlineAction onClick={() => setSettingsOpen(true)} ariaLabel="Open settings">
              <span className="text-sm">Settings</span>
            </InlineAction>
          )}
        />

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

            <CaptureIntro name={firstName(profile.name)} />

            {/* Recipient — always visible, not gated by content */}
            {familyMembers.length > 0 && (
              <div className="space-y-2">
                <p className="type-label text-muted-foreground">Who are you speaking to today?</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {familyMembers.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      aria-pressed={selectedRecipient?.id === m.id}
                      onClick={() => { setSelectedRecipient(m); setRecipientChosen(true); }}
                      className={recipientChipCls(selectedRecipient?.id === m.id)}
                    >
                      {firstName(m.name)}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={recipientChosen && !selectedRecipient}
                    onClick={() => { setSelectedRecipient(null); setRecipientChosen(true); }}
                    className={recipientChipCls(recipientChosen && !selectedRecipient)}
                  >
                    Everyone
                  </button>
                </div>
              </div>
            )}

            {/* Stage navigation — Write / Voice only */}
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-1.5" role="tablist" aria-label="Capture mode">
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={captureStage === s}
                  disabled={saving || preparingVoice || recording}
                  onClick={() => handleStageChange(s)}
                  className={`flex-1 text-sm tracking-wide transition border min-h-[48px] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 rounded-sm ${
                    captureStage === s
                      ? 'text-foreground bg-blue-500/15 border-blue-500/30'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {s === 'voice' ? 'Record Audio' : 'Write'}
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
                      aria-label="Your breadcrumb"
                      ref={writeAreaRef}
                      className="w-full min-h-[30vh] sm:min-h-[34vh] bg-card border border-border/70 rounded-2xl px-5 py-4 text-foreground text-[1.0625rem] leading-[1.55] tracking-[-0.01em] placeholder:text-foreground/18 focus:outline-none resize-none"
                      placeholder="What do you want them to remember?"
                      value={entry}
                      onChange={onWriteAreaChange}
                      onFocus={() => {
                        setShowHesitationHint(false);
                        if (!entry.trim()) scheduleWriteHesitation();
                      }}
                      onBlur={clearHesitationTimer}
                    />

                    {/* Inline prompt card — shown after 10s hesitation, hidden once writing starts */}
                    {showHesitationHint && entry.trim().length < 20 && (aiPrompt || promptLoading) && (
                      <div className="border-t border-border/40 pt-3 space-y-2" aria-live="polite">
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
                            className={`text-xs text-foreground/20 hover:text-foreground/50 transition min-h-[44px] px-2 ${SAVE_BTN}`}
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
                        aria-label="Recording duration"
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
                            : 'border-[#3B82F6]/35 text-foreground/60 hover:border-[#3B82F6]/55 hover:text-foreground/85'
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
                        {!voiceMediaRef ? (
                          <button type="button" onClick={() => void prepareVoice()} disabled={preparingVoice} className="btn-primary">
                            {preparingVoice ? 'Preparing transcript…' : 'Review transcript'}
                          </button>
                        ) : (
                          <label className="block space-y-2 text-sm text-muted-foreground">
                            Review your words
                            <textarea aria-label="Review voice transcript" value={voiceTranscript} onChange={(e) => setVoiceTranscript(e.target.value)} className="field-input mt-2 min-h-[160px]" placeholder="Transcription unavailable. Add your words here, or save the original audio." />
                            <span className="block text-xs">Your original recording stays with this breadcrumb.</span>
                          </label>
                        )}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            disabled={preparingVoice || saving}
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

            {draftStatus && <p role="status" className="text-xs text-muted-foreground">{draftStatus}</p>}

            {/* Draft / prefill notices */}
            {(draftRestored || prefillRestored) && (
              <div className="text-xs text-foreground/28">
                {draftRestored   && <p>Draft restored.</p>}
                {prefillRestored && <p>From your Family Foundation.</p>}
              </div>
            )}

            {/* Pre-save — appears when content exists */}
            {hasContent && (
              <div className="space-y-5 border-t border-border/40 pt-5">

                {/* Type picker — required before save */}
                <div className="space-y-2.5">
                  <p className="type-label text-foreground/30 text-center">What kind of breadcrumb is this?</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {CAPTURE_INTENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={breadcrumbType === opt.value}
                        onClick={() => setBreadcrumbType(opt.value)}
                        className={`px-4 py-2 text-sm border rounded-sm transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 ${
                          breadcrumbType === opt.value
                            ? 'border-[#3B82F6] text-foreground bg-[#3B82F6]/10'
                            : 'border-border text-foreground/40 hover:border-[#3B82F6]/45 hover:text-foreground/70'
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

                {/* Save action — inline, right after type picker */}
                <div className="space-y-2">
                  {confirmingSave ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmingSave(false)}
                        className={`flex-1 py-3.5 text-sm border border-border text-muted-foreground rounded-sm hover:border-[#3B82F6]/45 hover:text-foreground transition min-h-[44px] ${SAVE_BTN}`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className={`flex-1 py-3.5 text-sm border border-[#3B82F6] bg-[#3B82F6] text-white rounded-sm hover:bg-[#2563EB] hover:border-[#2563EB] transition disabled:opacity-30 min-h-[44px] ${SAVE_BTN}`}
                      >
                        {saving ? 'Saving…' : 'Yes, save it'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={!breadcrumbType || saving || preparingVoice || recording || (familyMembers.length > 0 && !recipientChosen) || (captureStage === 'voice' && !!audioBlob && !voiceMediaRef)}
                      className={`w-full py-4 text-sm border border-[#3B82F6] bg-[#3B82F6] text-white rounded-sm hover:bg-[#2563EB] hover:border-[#2563EB] transition disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] ${SAVE_BTN}`}
                    >
                      {saving ? 'Saving…' : 'Save Breadcrumb'}
                    </button>
                  )}
                  {familyMembers.length > 0 && !recipientChosen && <p className="text-xs text-center text-muted-foreground">Choose who this is for, or select Everyone.</p>}
                  {!breadcrumbType && (
                    <p className="text-xs text-center text-foreground/30">
                      Choose a breadcrumb type above to save
                    </p>
                  )}
                </div>

                {/* Tag hints — optional, below save */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-foreground/22">
                      {audioBlob ? 'Voice note ready' : `${charCount} characters`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTags(!showTags)}
                      className="text-xs text-foreground/22 hover:text-foreground/50 transition"
                    >
                      {showTags ? '− Hide tag hints' : '+ Tag hints'}
                    </button>
                  </div>
                  {showTags && (
                    <div className="flex flex-wrap gap-2">
                      {VALUE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 text-xs border rounded-sm transition ${
                            selectedTags.includes(tag)
                              ? 'border-[#3B82F6] text-foreground bg-[#3B82F6]/10'
                              : 'border-border text-foreground/30 hover:border-[#3B82F6]/45 hover:text-foreground/60'
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
            <div role="status" className="rounded-2xl bg-blue-500/10 border border-blue-500/25 p-5 space-y-2">
              <p className="font-display text-xl">Your breadcrumb is saved.</p>
              <button type="button" onClick={() => router.push(`/archive?entry=${encodeURIComponent(savedBreadcrumbId ?? '')}`)} className="text-sm text-blue-400 min-h-[44px]">Open it in your library →</button>
            </div>
            {renderTagEditor('tag-draft-followup')}
            {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}

            <div className="glass-card px-6 py-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">One more thought</p>
              <p className="text-base leading-[1.6] tracking-[-0.005em] text-foreground/88 font-normal">{followUp}</p>
            </div>

            <textarea
              className="field-input h-40 !min-h-[10rem] rounded-sm px-5 py-4 text-base leading-relaxed resize-none"
              placeholder="Add to your entry (optional)…"
              value={followUpAddition}
              onChange={(e) => setFollowUpAddition(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage('done')}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-[#3B82F6]/45 hover:text-foreground disabled:opacity-30 transition"
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
                      return;
                    }
                    setStage('done');
                  } catch {
                    setSaveError('Network error while saving follow-up. Try again.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-[#3B82F6] bg-[#3B82F6] text-white text-sm tracking-wide disabled:opacity-30 hover:bg-[#2563EB] hover:border-[#2563EB] transition"
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
                className="py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-[#3B82F6]/45 hover:text-foreground transition"
              >
                Family Library
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="py-3 px-6 border border-[#3B82F6] bg-[#3B82F6] text-white text-sm tracking-wide hover:bg-[#2563EB] hover:border-[#2563EB] transition"
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
                setShowHesitationHint(false);
                setConfirmingSave(false);
                setStage('capture');
              }}
              className="mt-4 py-3 px-6 border border-[#3B82F6] bg-[#3B82F6] text-white text-sm tracking-wide hover:bg-[#2563EB] hover:border-[#2563EB] transition"
            >
              Try again
            </button>
          </div>
        )}

      </ScreenContent>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BottomNav />
    </ScreenContainer>
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
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
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
          <main className="min-h-screen flex flex-col items-center justify-center px-6">
            <p className="text-muted-foreground text-sm">Loading…</p>
          </main>
        )}
      >
        <CapturePageGate />
      </Suspense>
    </ErrorBoundary>
  );
}
