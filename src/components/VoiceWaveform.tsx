'use client';

import { useRef, useEffect } from 'react';

interface Props {
  analyser:      AnalyserNode | null;
  active:        boolean;
  reducedMotion: boolean;
}

const BAR_COUNT = 24;
const BAR_GAP   = 3;
const W         = 240;
const H         = 48;

export default function VoiceWaveform({ analyser, active, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const phaseRef  = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset canvas buffer (also clears it)
    const dpr     = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    if (!active) return;

    const barW = (W - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;

    if (reducedMotion) {
      // Static minimal bars — recording is indicated by text/button, not animation
      ctx.fillStyle = 'rgba(245,240,232,0.22)';
      for (let i = 0; i < BAR_COUNT; i++) {
        const barH = 3;
        ctx.fillRect(i * (barW + BAR_GAP), (H - barH) / 2, barW, barH);
      }
      return;
    }

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(245,240,232,0.48)';

      if (dataArray && analyser) {
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < BAR_COUNT; i++) {
          const idx  = Math.floor((i / BAR_COUNT) * dataArray.length * 0.6);
          const amp  = dataArray[idx] / 255;
          const barH = Math.max(3, amp * H * 0.88);
          ctx.fillRect(i * (barW + BAR_GAP), (H - barH) / 2, barW, barH);
        }
      } else {
        // Organic sine placeholder — only shown when analyser unavailable
        phaseRef.current += 0.048;
        const p = phaseRef.current;
        for (let i = 0; i < BAR_COUNT; i++) {
          const t    = i / BAR_COUNT;
          const amp  =
            0.22 + 0.30 * Math.sin(p + t * Math.PI * 2.2)
                 + 0.18 * Math.sin(p * 1.65 + t * Math.PI * 4.5);
          const barH = Math.max(3, amp * H * 0.88);
          ctx.fillRect(i * (barW + BAR_GAP), (H - barH) / 2, barW, barH);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, active, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      aria-hidden="true"
      style={{ width: `${W}px`, height: `${H}px` }}
      className="mx-auto block"
    />
  );
}
