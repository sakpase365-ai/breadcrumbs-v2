'use client';

import { useState, useEffect, useRef, Suspense, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReferenceCapture } from '@/components/iroh/ReferenceCapture';
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
import { ScreenContainer, ScreenContent } from '@/components/ui/design-primitives';

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
  return `px-3 py-1.5 ${text} border rounded-xl transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 ${
    active
      ? 'border-[#3B82F6] bg-[#3B82F6] text-white'
      : 'border-border text-muted-foreground hover:border-[#3B82F6]/45 hover:text-foreground'
  }`;
}

function CaptureFlow({ initialMode = 'voice' }: { initialMode?: CaptureStage }) {
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
  const [captureStage,       setCaptureStage]      = useState<CaptureStage>(initialMode);
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
      <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 px-4 py-3">
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
              className="field-input !min-h-0 rounded-xl px-3 py-2 text-sm"
              placeholder="parenting, gratitude, life-lesson"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveTagsEdit()}
                disabled={tagSaving}
                className="text-xs px-3 py-1.5 border border-[#3B82F6] bg-[#3B82F6] text-white rounded-xl hover:bg-[#2563EB] hover:border-[#2563EB] disabled:opacity-40"
              >
                {tagSaving ? 'Saving…' : 'Save tags'}
              </button>
              <button
                type="button"
                onClick={() => setTagEditorOpen(false)}
                className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded-xl"
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
    <ScreenContainer className="reference-live !px-5 sm:!px-6 !py-0 flex flex-col items-center justify-start">
      <ScreenContent className="space-y-5 !pb-48">


        {/* Loading */}
        {stage === 'loading' && (
          <div className="py-24 text-center">
            <p className="text-muted-foreground text-sm">
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

        {stage === 'capture' && profile && (
          <div ref={swipeContainerRef}>
            <ReferenceCapture recipients={familyMembers.map((member) => ({ id: member.id, name: firstName(member.name) }))}
              recipient={recipientChosen ? selectedRecipient?.id ?? 'everyone' : ''}
              onRecipient={(id) => { setRecipientChosen(true); setSelectedRecipient(familyMembers.find((member) => member.id === id) ?? null); }}
              mode={captureStage} recording={recording} requesting={preparingVoice || saving}
              onRecord={() => { if (captureStage === 'write') { handleStageChange('voice'); return; } if (recording) stopRecording(); else void startRecording(); }}
              waveform={recording ? <div className="space-y-2"><VoiceWaveform analyser={analyserRef.current} active reducedMotion={userSettings.reduceMotion} /><p className="text-xs text-center text-muted-foreground tabular-nums">{Math.floor(recordSec / 60)}:{String(recordSec % 60).padStart(2, '0')}</p></div> : undefined}
              writing={<textarea ref={writeAreaRef} aria-label="Your breadcrumb" placeholder="What do you want them to remember?" value={entry} onChange={onWriteAreaChange} onFocus={() => { if (!entry.trim()) scheduleWriteHesitation(); }} onBlur={clearHesitationTimer} />}
              audioReview={audioPreviewUrl ? <div className="w-full space-y-4"><AudioPlayer src={audioPreviewUrl} />{!voiceMediaRef ? <button type="button" onClick={() => void prepareVoice()} disabled={preparingVoice} className="btn-primary">{preparingVoice ? 'Preparing transcript…' : 'Review transcript'}</button> : <label className="block text-sm text-muted-foreground">Review your words<textarea aria-label="Review voice transcript" value={voiceTranscript} onChange={(event) => setVoiceTranscript(event.target.value)} className="field-input mt-2 min-h-[130px]" placeholder="Add words, or save your original audio." /><span className="text-xs">Your original audio is preserved.</span></label>}<button type="button" onClick={cleanupAudio} disabled={preparingVoice || saving} className="reference-text-action">Discard and record again</button></div> : undefined}
              onWrite={() => { if (!recording) handleStageChange('write'); }}
              onQuestion={() => { if (recording) return; handleStageChange('write'); setShowHesitationHint(true); }}
              onDraft={() => { if (!recording) handleStageChange('write'); }} hasDraft={!!entry.trim()}
            >
              {recordError && <p role="alert" className="text-xs text-red-300 mt-4">{recordError}</p>}
              {showHesitationHint && captureStage === 'write' && <div className="glass-card p-4 mt-4 space-y-3"><p className="type-label text-muted-foreground">A question to start with</p><p className="text-sm">{promptLoading ? 'Finding a question…' : aiPrompt}</p><button onClick={() => void handleNewPrompt()} className="reference-text-action" disabled={promptLoading}>Try another question</button></div>}
              {draftStatus && <p role="status" className="text-xs text-muted-foreground mt-3">{draftStatus}</p>}
              {(draftRestored || prefillRestored) && <p className="text-xs text-muted-foreground mt-2">{draftRestored ? 'Draft restored.' : 'From your Family Foundation.'}</p>}
              {hasContent && <div className="space-y-3 mt-5"><p className="type-label text-muted-foreground">What kind of breadcrumb is this?</p><div className="flex gap-2">{CAPTURE_INTENT_OPTIONS.map((option) => <button key={option.value} aria-pressed={breadcrumbType === option.value} onClick={() => setBreadcrumbType(option.value)} className="iroh-pill">{option.label}</button>)}</div><button onClick={() => setShowTags(!showTags)} className="reference-text-action">{showTags ? 'Hide tag hints' : 'Add tag hints'}</button>{showTags && <div className="flex flex-wrap gap-2">{VALUE_TAGS.map((tag) => <button key={tag} aria-pressed={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} className="iroh-pill">{tag}</button>)}</div>}{confirmingSave ? <div className="flex gap-2"><button onClick={() => setConfirmingSave(false)} className="iroh-pill">Cancel</button><button onClick={() => void handleSave()} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Yes, save it'}</button></div> : <button onClick={() => void handleSave()} disabled={!breadcrumbType || !recipientChosen || saving || preparingVoice || recording || (captureStage === 'voice' && !voiceMediaRef)} className="btn-primary">{saving ? 'Saving…' : 'Save Breadcrumb'}</button>}</div>}
            </ReferenceCapture>
          </div>
        )}

        {/* Follow-up */}
        {stage === 'follow-up' && (
          <div className="space-y-6">
            <div role="status" className="rounded-xl bg-blue-500/10 border border-blue-500/25 p-5 space-y-2">
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
              className="field-input h-40 !min-h-[10rem] rounded-xl px-5 py-4 text-base leading-relaxed resize-none"
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
                if (!profile) { window.location.reload(); return; }
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
  return code ? <CompleteMagicLinkFromCapture code={code} /> : <CaptureFlow initialMode={searchParams.get('mode') === 'write' ? 'write' : 'voice'} />;
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
