'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

const WORD = 'Breadcrumbs';

type Props = {
  /** Tailwind classes for visual scale (default matches login / signup). */
  className?: string;
  /**
   * `logo` — full word + animated "..." (default brand lockup).
   * `intro` — typewriter reveal, then animated "..." (home / first impression).
   */
  mode?: 'logo' | 'intro';
};

/**
 * Brand wordmark: **Breadcrumbs** with animated "..." at the end.
 */
export default function AnimatedWordmark({
  className = 'text-4xl sm:text-5xl font-serif font-light tracking-tight text-foreground',
  mode = 'logo',
}: Props) {
  const [visibleCount, setVisibleCount] = useState(mode === 'logo' ? WORD.length : 0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settingsReduce =
      typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce';
    if (mq.matches || settingsReduce) {
      setReducedMotion(true);
      setVisibleCount(WORD.length);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'intro' || reducedMotion) return;
    if (visibleCount >= WORD.length) return;
    const delay = visibleCount === 0 ? 140 : 82;
    const id = window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, WORD.length));
    }, delay);
    return () => clearTimeout(id);
  }, [mode, reducedMotion, visibleCount]);

  const showEllipsis = visibleCount >= WORD.length;
  const displayWord = mode === 'logo' || reducedMotion ? WORD : WORD.slice(0, visibleCount);

  return (
    <h1
      className={`${className} inline-flex max-w-full flex-nowrap items-baseline whitespace-nowrap`}
      aria-label="Breadcrumbs"
    >
      <span className="min-h-[1.15em] shrink-0">{displayWord}</span>
      {showEllipsis ? (
        <span className="wordmark-ellipsis shrink-0 select-none" aria-hidden="true">
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="wordmark-dot"
              style={{ animationDelay: `${d * 0.24}s` }}
            >
              .
            </span>
          ))}
        </span>
      ) : null}
    </h1>
  );
}
