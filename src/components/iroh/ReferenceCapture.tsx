'use client';

import { type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CircleHelp, FileText, Mic, Pencil, Square } from 'lucide-react';

export interface CaptureRecipient { id: string; name: string }

export function BreadcrumbMark() {
  return <svg width="38" height="22" viewBox="0 0 38 22" aria-hidden="true"><g fill="currentColor"><rect x="3" y="13" width="9" height="6" rx="2" transform="rotate(-40 7.5 16)" /><rect x="14" y="8" width="9" height="6" rx="2" transform="rotate(40 18.5 11)" /><rect x="26" y="3" width="9" height="6" rx="2" transform="rotate(-40 30.5 6)" /></g></svg>;
}

export function ReferenceCapture({ recipients, recipient, onRecipient, recording, requesting = false, onRecord, waveform, audioReview, writing, onWrite, onQuestion, onDraft, hasDraft, mode, children }: {
  recipients: CaptureRecipient[];
  recipient: string;
  onRecipient: (id: string) => void;
  recording: boolean;
  requesting?: boolean;
  onRecord: () => void;
  waveform?: ReactNode;
  audioReview?: ReactNode;
  writing?: ReactNode;
  onWrite: () => void;
  onQuestion: () => void;
  onDraft: () => void;
  hasDraft: boolean;
  mode: 'write' | 'voice';
  children?: ReactNode;
}) {
  const selected = recipients.find((person) => person.id === recipient);
  return <div className="reference-capture">
    <div className="reference-brand"><span><BreadcrumbMark /></span><p>Breadcrumbs</p></div>
    <h1>What would you like to<br /> leave behind today?</h1>
    <div className="reference-recipient"><span className="reference-avatar" aria-hidden="true">{selected?.name[0] ?? (recipient === 'everyone' ? 'B' : '?')}</span><label className="sr-only" htmlFor="capture-recipient">Who are you speaking to today?</label><select id="capture-recipient" value={recipient} onChange={(event) => onRecipient(event.target.value)}><option value="" disabled>Choose recipient</option>{recipients.map((person) => <option key={person.id} value={person.id}>For {person.name}</option>)}<option value="everyone">For everyone</option></select><ChevronDown size={20} aria-hidden="true" /></div>
    {mode === 'voice' ? <section className="reference-voice-card" aria-label="Voice capture">
      {audioReview || <>
        <div className="reference-waveform">{waveform || <div className="reference-idle-wave" aria-hidden="true">{Array.from({ length: 25 }, (_, index) => <span key={index} />)}</div>}</div>
        <button className="reference-mic" disabled={requesting || !recipient} onClick={onRecord} aria-label={recording ? 'Stop recording' : 'Start recording'}>{recording ? <Square size={28} fill="currentColor" /> : <Mic size={31} strokeWidth={2.1} />}</button>
        <p role="status">{requesting ? 'Preparing your microphone…' : recording ? 'Recording your breadcrumb…' : 'Leave a breadcrumb.'}</p>
        {!recipient && <p className="reference-helper">Choose who you are speaking to first.</p>}
      </>}
    </section> : <section className="reference-write-card" aria-label="Written capture">{writing}<button className="reference-text-action" onClick={onRecord}><Mic size={15} />Switch to voice recording</button></section>}
    {children}
    <div className="reference-actions">
      <button onClick={onWrite}><FileText size={24} /><span>Write a letter</span><ChevronRight size={20} /></button>
      <button onClick={onQuestion}><CircleHelp size={25} /><span>Answer a question</span><ChevronRight size={20} /></button>
      <button onClick={onDraft} disabled={!hasDraft}><Pencil size={24} /><span>{hasDraft ? 'Continue draft' : 'Continue draft'}<small>{hasDraft ? null : 'No draft yet'}</small></span><ChevronRight size={20} /></button>
    </div>
  </div>;
}
