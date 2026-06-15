'use client';

import { useState, useRef, useEffect } from 'react';

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  src: string;
}

export default function AudioPlayer({ src }: Props) {
  const audioRef              = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onDuration = () => { if (isFinite(audio.duration)) setDuration(audio.duration); };
    const onTime     = () => setCurrent(audio.currentTime);
    const onEnded    = () => {
      setPlaying(false);
      setCurrent(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('ended',          onEnded);
    return () => {
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('ended',          onEnded);
    };
  }, []);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrent(val);
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="w-full">
      {/* Hidden native audio — handles decoding only */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Custom player */}
      <div className="flex items-center gap-4 px-5 py-4 rounded-sm border border-border/50 bg-card/50">

        {/* Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full border border-foreground/25 text-foreground/60 hover:border-foreground/50 hover:text-foreground/90 transition"
        >
          {playing ? (
            <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true">
              <rect x="0"  y="0" width="3.5" height="13" rx="1"/>
              <rect x="7.5" y="0" width="3.5" height="13" rx="1"/>
            </svg>
          ) : (
            <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true" style={{ marginLeft: '1px' }}>
              <path d="M0 0L11 6.5L0 13V0Z"/>
            </svg>
          )}
        </button>

        {/* Scrubber + times */}
        <div className="flex-1 space-y-2">
          {/* Progress track — h-5 gives 20px touch area, visual is 2px */}
          <div className="relative h-5 flex items-center">
            <div className="w-full h-[2px] rounded-full bg-foreground/[0.10] relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/50 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={current}
              onChange={handleScrub}
              aria-label="Seek"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {/* Times */}
          <div className="flex justify-between">
            <span className="text-[0.6875rem] text-foreground/30 tabular-nums">{fmt(current)}</span>
            <span className="text-[0.6875rem] text-foreground/30 tabular-nums">{fmt(duration)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
