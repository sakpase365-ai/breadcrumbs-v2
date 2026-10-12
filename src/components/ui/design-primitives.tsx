'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

interface ScreenContainerProps {
  children: ReactNode;
  className?: string;
}

export function ScreenContainer({ children, className }: ScreenContainerProps) {
  return (
    <main className={clsx('screen-main', className)}>
      {children}
    </main>
  );
}

interface ScreenContentProps {
  children: ReactNode;
  className?: string;
}

export function ScreenContent({ children, className }: ScreenContentProps) {
  return (
    <div className={clsx('screen-content space-y-8', className)}>
      {children}
    </div>
  );
}

interface ScreenHeaderProps {
  title: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  titleClassName?: string;
}

export function ScreenHeader({ title, leftAction, rightAction, titleClassName }: ScreenHeaderProps) {
  return (
    <header className="flex items-center justify-between pt-2">
      <div className="min-w-[64px]">{leftAction}</div>
      <h1 className={clsx('font-display text-xl text-foreground', titleClassName)}>{title}</h1>
      <div className="min-w-[64px] flex justify-end">{rightAction}</div>
    </header>
  );
}

interface SectionHeadingProps {
  id?: string;
  title: string;
  description?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function SectionHeading({
  id,
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: SectionHeadingProps) {
  return (
    <div className={clsx('space-y-1 px-1', className)}>
      <p className={clsx('type-label text-muted-foreground', titleClassName)} id={id}>
        {title}
      </p>
      {description ? (
        <p className={clsx('text-xs text-muted-foreground/60 leading-relaxed', descriptionClassName)}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <div className={clsx('w-full border border-border/70 bg-card rounded-2xl', className)}>
      {children}
    </div>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Row({ title, subtitle, right, onClick, disabled = false, className }: RowProps) {
  const content = (
    <div className={clsx('flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]', className)}>
      <div className="space-y-0.5 flex-1 min-w-0">
        <p className="text-[0.9375rem] text-foreground leading-snug">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0 flex items-center">{right}</div> : null}
    </div>
  );

  if (!onClick || disabled) {
    return <div className={disabled ? 'opacity-60' : ''} aria-disabled={disabled || undefined}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className="w-full text-left hover:bg-[#3B82F6]/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35"
    >
      {content}
    </button>
  );
}

interface RowDividerProps {
  className?: string;
}

export function RowDivider({ className }: RowDividerProps = {}) {
  return <div className={className ?? 'h-px bg-border/40 mx-4'} />;
}

interface ToggleVisualProps {
  checked: boolean;
  label: string;
}

export function ToggleVisual({ checked, label: _ }: ToggleVisualProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors',
        checked ? 'bg-[#3B82F6] border-[#3B82F6]' : 'bg-transparent border-border',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 rounded-full transition-transform',
          checked ? 'translate-x-5 bg-background' : 'translate-x-1 bg-muted-foreground/50',
        )}
      />
    </div>
  );
}

interface SegmentedOptionProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

export function SegmentedOption({ active, label, onClick }: SegmentedOptionProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'flex-1 min-w-[60px] px-3 py-2.5 text-sm border rounded-sm transition text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35',
        active
          ? 'border-[#3B82F6] text-foreground bg-[#3B82F6]/10'
          : 'border-border text-muted-foreground hover:border-[#3B82F6]/45 hover:text-foreground/80',
      )}
    >
      {label}
    </button>
  );
}

interface InlineActionProps {
  children: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}

export function InlineAction({ children, onClick, ariaLabel }: InlineActionProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="text-sm text-muted-foreground hover:text-foreground transition min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 rounded-sm"
    >
      {children}
    </button>
  );
}
