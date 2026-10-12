'use client';

import { useEffect, useRef, useState } from 'react';

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const objectUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const permissionPending = useRef(false);

  function clear() {
    generation.current += 1;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setBlob(null); setUrl(null); setAnalyser(null); setRecording(false); setSeconds(0); setError(''); setRequesting(false);
  }

  useEffect(() => () => {
    generation.current += 1;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    void context.current?.close().catch(() => {});
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 300);
    return () => clearInterval(timer);
  }, [recording]);

  async function start() {
    if (permissionPending.current || recording) return;
    clear();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is unavailable in this browser. You can still write a breadcrumb.'); return;
    }
    permissionPending.current = true;
    setRequesting(true);
    const currentGeneration = generation.current;
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== currentGeneration) { input.getTracks().forEach((track) => track.stop()); return; }
      stream.current = input;
      try {
        const audioContext = new AudioContext();
        context.current = audioContext;
        const node = audioContext.createAnalyser();
        node.fftSize = 128;
        audioContext.createMediaStreamSource(input).connect(node);
        setAnalyser(node);
      } catch { /* Recording remains available without visualization. */ }
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const next = new MediaRecorder(input, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        input.getTracks().forEach((track) => track.stop());
        void context.current?.close().catch(() => {});
        context.current = null;
        if (generation.current !== currentGeneration) return;
        const audio = new Blob(chunks, { type: next.mimeType || 'audio/webm' });
        if (!audio.size) { setError('No audio was captured. Try recording again.'); setRecording(false); return; }
        const previewUrl = URL.createObjectURL(audio);
        objectUrl.current = previewUrl;
        setUrl(previewUrl); setBlob(audio); setRecording(false); setAnalyser(null);
      };
      next.onerror = () => { clear(); setError('Recording was interrupted. Please try again.'); };
      recorder.current = next;
      next.start();
      setRecording(true);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      if (generation.current === currentGeneration) setError('Microphone access was unavailable. Check permissions, or switch to Write.');
    } finally {
      permissionPending.current = false;
      if (generation.current === currentGeneration) setRequesting(false);
    }
  }

  function stop() { if (recorder.current?.state === 'recording') recorder.current.stop(); }
  return { recording, seconds, blob, url, error, requesting, analyser, start, stop, clear };
}
