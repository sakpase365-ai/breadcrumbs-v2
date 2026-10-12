'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import AnimatedWordmark from '@/components/AnimatedWordmark';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import { ScreenContainer, ScreenContent } from '@/components/ui/design-primitives';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import type { StructuredLocation } from '@/lib/location';
import { maskPhone } from '@/lib/phone';

const INPUT =
  'w-full min-h-[48px] bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground/60 focus:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 transition rounded-xl shadow-sm';

const PRIMARY_BUTTON =
  'w-full min-h-[52px] border border-[#3B82F6] bg-[#3B82F6] text-white text-sm font-medium tracking-wide shadow-[0_12px_32px_rgba(59,130,246,0.22)] hover:border-[#2563EB] hover:bg-[#2563EB] hover:-translate-y-0.5 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45';

const SECONDARY_BUTTON =
  'w-full min-h-[48px] border border-border bg-card/60 text-foreground text-sm tracking-wide hover:border-[#3B82F6]/55 hover:text-[#3B82F6] transition rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35';

const LINK_BUTTON =
  'min-h-[44px] px-3 text-xs text-muted-foreground/75 hover:text-[#3B82F6] transition rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35';

const FAMILY_ROLE_OPTIONS = [
  {
    value: 'parent',
    label: 'Parent / Guardian',
    backendRole: 'parent',
    description: 'Starting or stewarding Breadcrumbs for children and family.',
  },
  {
    value: 'grandparent',
    label: 'Grandparent',
    backendRole: 'grandparent',
    description: 'Leaving stories, values, and guidance across generations.',
  },
  {
    value: 'child',
    label: 'Child',
    backendRole: 'child',
    description: 'Receiving from elders and contributing your own Breadcrumbs.',
  },
  {
    value: 'spouse',
    label: 'Spouse',
    backendRole: 'spouse',
    description: 'Helping build the family foundation with your partner.',
  },
  {
    value: 'other',
    label: 'Other Family Member',
    backendRole: 'sibling',
    customRoleLabel: 'Other Family Member',
    description: 'Joining as part of the family graph, not a fixed account type.',
  },
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const WHEEL_ITEM_HEIGHT = 44;
const SELECTION_FEEDBACK_MS = 320;
const SELECTION_CLEAR_MS = 620;

type FamilyRoleChoice = typeof FAMILY_ROLE_OPTIONS[number];
type IdentityPage =
  | 'name'
  | 'family-call-name'
  | 'birth-date'
  | 'birthplace'
  | 'childhood-place'
  | 'family-name';
type RelationshipPage = 'spouse-partner' | 'children' | 'parents' | 'grandparents';
type Step =
  | 'role'
  | 'path'
  | 'identity'
  | 'relationships'
  | 'started'
  | 'verify-phone';

interface DateParts {
  month: number;
  day: number;
  year: number;
}

interface FamilyMemberDraft {
  localId: string;
  firstName: string;
  lastName: string;
  birthDate: DateParts;
  birthDateTouched: boolean;
}

interface WheelOption {
  value: number;
  label: string;
}

const IDENTITY_PAGES: IdentityPage[] = [
  'name',
  'family-call-name',
  'birth-date',
  'birthplace',
  'childhood-place',
  'family-name',
];

const RELATIONSHIP_PAGES: RelationshipPage[] = [
  'spouse-partner',
  'children',
  'parents',
  'grandparents',
];

const QUESTION_PAGE_VARIANTS = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 30, filter: 'blur(3px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (direction: number) => ({ opacity: 0, x: direction * -24, filter: 'blur(2px)' }),
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function nextLocalId() {
  return `${Date.now()}-${Math.random()}`;
}

function createFamilyMemberDraft(yearOffset: number): FamilyMemberDraft {
  return {
    localId: nextLocalId(),
    firstName: '',
    lastName: '',
    birthDate: defaultDateParts(yearOffset),
    birthDateTouched: false,
  };
}

function fullName(person: Pick<FamilyMemberDraft, 'firstName' | 'lastName'>) {
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
}

function defaultDateParts(yearOffset: number): DateParts {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
    year: CURRENT_YEAR - yearOffset,
  };
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function clampDateParts(parts: DateParts): DateParts {
  const month = Math.min(12, Math.max(1, parts.month));
  const year = Math.min(CURRENT_YEAR, Math.max(CURRENT_YEAR - 120, parts.year));
  const day = Math.min(daysInMonth(month, year), Math.max(1, parts.day));
  return { month, day, year };
}

function datePartsToIso(parts: DateParts) {
  const clamped = clampDateParts(parts);
  const month = String(clamped.month).padStart(2, '0');
  const day = String(clamped.day).padStart(2, '0');
  return `${clamped.year}-${month}-${day}`;
}

function formatDateParts(parts: DateParts) {
  const clamped = clampDateParts(parts);
  return `${MONTHS[clamped.month - 1]} ${clamped.day}, ${clamped.year}`;
}

function buildNumberOptions(min: number, max: number): WheelOption[] {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;
    return { value, label: String(value) };
  });
}

function formatFamilyMemberDrafts(people: FamilyMemberDraft[]) {
  return people
    .filter((person) => fullName(person))
    .map((person) => {
      const name = fullName(person);
      return person.birthDateTouched
        ? `${name} (birthday: ${datePartsToIso(person.birthDate)})`
        : name;
    })
    .join('\n');
}

function parseInviteHref(raw: string) {
  const value = raw.trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/invite\/([^/?#]+)/);
    if (match?.[1]) return `/invite/${encodeURIComponent(decodeURIComponent(match[1]))}`;
  } catch {
    // Continue with path or token parsing below.
  }

  const pathMatch = value.match(/(?:^|\/)invite\/([^/?#]+)/);
  if (pathMatch?.[1]) return `/invite/${encodeURIComponent(pathMatch[1])}`;

  const token = value.replace(/^\/+/, '').split(/[/?#]/)[0];
  return token ? `/invite/${encodeURIComponent(token)}` : '';
}

function Progress({ step }: { step: Step }) {
  const steps: Step[] = ['role', 'path', 'identity', 'relationships'];
  const current = step === 'verify-phone' || step === 'started' ? steps.length : Math.max(1, steps.indexOf(step) + 1);

  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${current} of ${steps.length}`}>
      {steps.map((item, index) => (
        <span
          key={item}
          className={cx(
            'h-1 rounded-full transition-all',
            index < current
              ? 'w-8 bg-[#3B82F6] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
              : 'w-4 bg-foreground/15',
          )}
        />
      ))}
    </div>
  );
}

function StepIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-3 text-center">
      <motion.p
        className="type-label text-[#3B82F6]"
        initial={{ opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        {eyebrow}
      </motion.p>
      <motion.h1
        className="font-display text-3xl leading-tight text-foreground"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        {title}
      </motion.h1>
      <motion.p
        className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground"
        initial={{ opacity: 0, y: 9 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {body}
      </motion.p>
      <motion.div
        aria-hidden="true"
        className="mx-auto flex w-fit items-center gap-1.5 pt-1"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.16 } },
        }}
      >
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className={cx('h-1.5 rounded-full bg-[#3B82F6]', dot === 1 ? 'w-5' : 'w-1.5')}
            variants={{
              hidden: { opacity: 0, scaleX: 0 },
              visible: { opacity: 0.72, scaleX: 1 },
            }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </motion.div>
    </div>
  );
}

function OptionCard({
  active,
  animating,
  label,
  description,
  onClick,
}: {
  active?: boolean;
  animating?: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  const selected = Boolean(active || animating);

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      animate={animating ? { y: [0, -2, 0], scale: [1, 1.012, 1] } : { y: 0, scale: 1 }}
      transition={{ duration: SELECTION_FEEDBACK_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        'relative w-full min-h-[82px] overflow-hidden rounded-xl border px-4 py-3.5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40',
        selected
          ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-foreground shadow-[0_10px_28px_rgba(59,130,246,0.12)]'
          : 'border-border bg-card/80 text-foreground hover:border-[#3B82F6]/45 hover:bg-card',
      )}
    >
      <AnimatePresence>
        {animating && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 bg-[#3B82F6]/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: SELECTION_FEEDBACK_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>
      <span className="relative flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
            selected ? 'border-[#3B82F6] bg-[#3B82F6] text-white' : 'border-border text-transparent',
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.span
                className="h-2.5 w-1.5 rotate-45 border-b border-r border-current"
                initial={{ opacity: 0, scale: 0.4, y: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4, y: -2 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>
        </span>
      </span>
    </motion.button>
  );
}

function CalendarGlyph() {
  return (
    <span
      aria-hidden="true"
      className="relative h-4 w-4 shrink-0 rounded-[2px] border border-current opacity-80"
    >
      <span className="absolute inset-x-0 top-1 border-t border-current" />
      <span className="absolute left-1 top-[-3px] h-1.5 border-l border-current" />
      <span className="absolute right-1 top-[-3px] h-1.5 border-l border-current" />
    </span>
  );
}

function WheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const index = options.findIndex((option) => option.value === value);
    if (index < 0) return;
    scrollRef.current?.scrollTo({
      top: index * WHEEL_ITEM_HEIGHT,
      behavior: hasMountedRef.current ? 'smooth' : 'auto',
    });
    hasMountedRef.current = true;
  }, [options, value]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  function handleScroll() {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      const index = Math.min(options.length - 1, Math.max(0, Math.round(scrollTop / WHEEL_ITEM_HEIGHT)));
      const nextValue = options[index]?.value;
      if (nextValue !== undefined && nextValue !== value) onChange(nextValue);
    }, 90);
  }

  return (
    <div className="relative min-w-0">
      <p className="sr-only">{label}</p>
      <div className="pointer-events-none absolute inset-x-0 top-11 z-10 h-px bg-foreground/22" />
      <div className="pointer-events-none absolute inset-x-0 top-[88px] z-10 h-px bg-foreground/22" />
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        className="date-wheel-scroll h-[132px] overflow-y-auto overscroll-contain scroll-smooth snap-y snap-mandatory py-11 text-center"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cx(
                'block h-11 w-full snap-center truncate rounded-lg px-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35',
                active ? 'text-lg text-foreground' : 'text-muted-foreground/42 hover:text-muted-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateWheelPicker({
  value,
  onChange,
  label,
  selected = true,
  placeholder = 'Select date',
}: {
  value: DateParts;
  onChange: (value: DateParts) => void;
  label: string;
  selected?: boolean;
  placeholder?: string;
}) {
  const pickerId = useId();
  const [open, setOpen] = useState(false);
  const clamped = clampDateParts(value);
  const monthOptions = useMemo(
    () => MONTHS.map((month, index) => ({ value: index + 1, label: month })),
    [],
  );
  const dayOptions = useMemo(
    () => buildNumberOptions(1, daysInMonth(clamped.month, clamped.year)),
    [clamped.month, clamped.year],
  );
  const yearOptions = useMemo(() => buildNumberOptions(CURRENT_YEAR - 120, CURRENT_YEAR), []);

  return (
    <div
      className="space-y-2"
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <p className="text-xs text-muted-foreground/70">{label}</p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition hover:border-[#3B82F6]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35"
      >
        <span className="flex min-w-0 items-center gap-3">
          <CalendarGlyph />
          <span className={cx('truncate', !selected && 'text-muted-foreground/60')}>
            {selected ? formatDateParts(clamped) : placeholder}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'h-2 w-2 shrink-0 border-b border-r border-current transition-transform',
            open ? 'rotate-[225deg]' : 'rotate-45',
          )}
        />
      </button>
      {open && (
        <div
          id={pickerId}
          className="space-y-3 rounded-xl border border-border bg-card/90 px-3 py-3 shadow-lg"
        >
          <div className="grid grid-cols-3 gap-2">
            <WheelColumn
              label="Month"
              options={monthOptions}
              value={clamped.month}
              onChange={(month) => onChange(clampDateParts({ ...clamped, month }))}
            />
            <WheelColumn
              label="Day"
              options={dayOptions}
              value={clamped.day}
              onChange={(day) => onChange(clampDateParts({ ...clamped, day }))}
            />
            <WheelColumn
              label="Year"
              options={yearOptions}
              value={clamped.year}
              onChange={(year) => onChange(clampDateParts({ ...clamped, year }))}
            />
          </div>
          <button type="button" onClick={() => setOpen(false)} className={SECONDARY_BUTTON}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function FamilyMemberCard({
  person,
  birthdayLabel,
  birthdayPlaceholder,
  removeLabel,
  onChange,
  onRemove,
}: {
  person: FamilyMemberDraft;
  birthdayLabel: string;
  birthdayPlaceholder: string;
  removeLabel: string;
  onChange: (person: FamilyMemberDraft) => void;
  onRemove: () => void;
}) {
  const memberInput =
    'w-full min-h-[48px] bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground/60 focus:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 transition rounded-none shadow-sm';

  return (
    <div className="space-y-3 rounded-none border border-border bg-card/85 px-4 py-4 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="First name"
            value={person.firstName}
            onChange={(e) => onChange({ ...person, firstName: e.target.value })}
            className={memberInput}
            autoComplete="given-name"
          />
          <input
            type="text"
            placeholder="Last name"
            value={person.lastName}
            onChange={(e) => onChange({ ...person, lastName: e.target.value })}
            className={memberInput}
            autoComplete="family-name"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="min-h-[48px] min-w-[48px] shrink-0 rounded-none border border-border text-muted-foreground transition hover:border-red-400/60 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
        >
          x
        </button>
      </div>
      <DateWheelPicker
        label={birthdayLabel}
        value={person.birthDate}
        selected={person.birthDateTouched}
        placeholder={birthdayPlaceholder}
        onChange={(birthDate) => onChange({ ...person, birthDate, birthDateTouched: true })}
      />
    </div>
  );
}

function RelationshipQuestion({
  eyebrow,
  title,
  body,
  addLabel,
  emptyTitle,
  emptyBody,
  people,
  yearOffset,
  removeLabel,
  onChange,
}: {
  eyebrow: string;
  title: string;
  body: string;
  addLabel: string;
  emptyTitle: string;
  emptyBody: string;
  people: FamilyMemberDraft[];
  yearOffset: number;
  removeLabel: string;
  onChange: (people: FamilyMemberDraft[]) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <>
      <StepIntro eyebrow={eyebrow} title={title} body={body} />
      <div className="space-y-3">
        <p className="type-label text-muted-foreground/70">
          {people.length === 0 ? 'Optional' : `${people.length} added`}
        </p>

        <AnimatePresence initial={false} mode="popLayout">
          {people.length === 0 ? (
            <motion.button
              type="button"
              key="empty"
              aria-label={addLabel}
              onClick={() => onChange([...people, createFamilyMemberDraft(yearOffset)])}
              whileTap={{ scale: 0.985 }}
              className="relative w-full overflow-hidden rounded-xl border border-dashed border-[#3B82F6]/30 bg-[#3B82F6]/[0.055] px-5 py-7 text-center transition hover:border-[#3B82F6]/60 hover:bg-[#3B82F6]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <motion.span
                aria-hidden="true"
                className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#3B82F6]/25 bg-[#3B82F6]/10 text-xl text-[#3B82F6]"
                animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                +
              </motion.span>
              <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{emptyBody}</p>
            </motion.button>
          ) : (
            <motion.div key="people" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {people.map((person, index) => (
                <motion.div
                  key={person.localId}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 18, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <FamilyMemberCard
                    person={person}
                    birthdayLabel="Birthday, optional"
                    birthdayPlaceholder="Add birthday"
                    removeLabel={removeLabel}
                    onChange={(updated) =>
                      onChange(people.map((item, personIndex) => (personIndex === index ? updated : item)))
                    }
                    onRemove={() => onChange(people.filter((_, personIndex) => personIndex !== index))}
                  />
                </motion.div>
              ))}
              <motion.button
                type="button"
                onClick={() => onChange([...people, createFamilyMemberDraft(yearOffset)])}
                whileTap={{ scale: 0.985 }}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#3B82F6]/30 bg-[#3B82F6]/[0.035] text-sm text-[#3B82F6] transition hover:border-[#3B82F6]/60 hover:bg-[#3B82F6]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                <span>{addLabel}</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function SetupPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('role');
  const [identityPage, setIdentityPage] = useState<IdentityPage>('name');
  const [relationshipPage, setRelationshipPage] = useState<RelationshipPage>('spouse-partner');
  const [pageDirection, setPageDirection] = useState(1);
  const [roleChoice, setRoleChoice] = useState<FamilyRoleChoice>(FAMILY_ROLE_OPTIONS[0]);
  const [inviteLink, setInviteLink] = useState('');

  const [familyName, setFamilyName] = useState('');
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [familyCallName, setFamilyCallName] = useState('');
  const [ownerBirthDate, setOwnerBirthDate] = useState<DateParts>(() => defaultDateParts(40));
  const [ownerBirthDateTouched, setOwnerBirthDateTouched] = useState(false);
  const [birthplace, setBirthplace] = useState<StructuredLocation | null>(null);
  const [childhoodPlace, setChildhoodPlace] = useState<StructuredLocation | null>(null);

  const [spousePartners, setSpousePartners] = useState<FamilyMemberDraft[]>([]);
  const [children, setChildren] = useState<FamilyMemberDraft[]>([]);
  const [parentFigures, setParentFigures] = useState<FamilyMemberDraft[]>([]);
  const [grandparents, setGrandparents] = useState<FamilyMemberDraft[]>([]);

  const [setupPhone, setSetupPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [phoneCode, setPhoneCode] = useState('');
  const [phoneVerifyBusy, setPhoneVerifyBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneResendCountdown, setPhoneResendCountdown] = useState(0);
  const phoneCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectionFeedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSelection, setActiveSelection] = useState<string | null>(null);

  useEffect(() => () => {
    if (phoneCountdownRef.current) clearInterval(phoneCountdownRef.current);
    if (selectionFeedbackRef.current) clearTimeout(selectionFeedbackRef.current);
  }, []);

  function playSelectionFeedback(selectionKey: string, after?: () => void) {
    if (selectionFeedbackRef.current) clearTimeout(selectionFeedbackRef.current);

    setActiveSelection(selectionKey);
    selectionFeedbackRef.current = setTimeout(() => {
      setActiveSelection(null);
      selectionFeedbackRef.current = null;
      after?.();
    }, after ? SELECTION_FEEDBACK_MS : SELECTION_CLEAR_MS);
  }

  function startPhoneCountdown() {
    setPhoneResendCountdown(30);
    phoneCountdownRef.current = setInterval(() => {
      setPhoneResendCountdown((v) => {
        if (v <= 1) {
          clearInterval(phoneCountdownRef.current!);
          phoneCountdownRef.current = null;
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function triggerPhoneVerification() {
    const supabase = getBrowserSupabase();
    if (!supabase) { setStep('started'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const phone = (session?.user?.user_metadata?.phone as string | undefined) ?? '';
    if (!phone) { setStep('started'); return; }
    setSetupPhone(phone);
    const { error: phoneUpdateError } = await supabase.auth.updateUser({ phone });
    if (phoneUpdateError) { setStep('started'); return; }
    startPhoneCountdown();
    setStep('verify-phone');
  }

  async function verifyPhoneCode(digits: string) {
    const supabase = getBrowserSupabase();
    if (!supabase || phoneVerifyBusy) return;
    setPhoneVerifyBusy(true);
    setPhoneError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: setupPhone,
      token: digits,
      type: 'phone_change',
    });
    if (verifyError) {
      setPhoneError("That code didn't match. Try again.");
      setPhoneCode('');
      setPhoneVerifyBusy(false);
      return;
    }
    router.push('/capture');
  }

  function handleInviteContinue(e: React.FormEvent) {
    e.preventDefault();
    const href = parseInviteHref(inviteLink);
    if (!href) {
      setError('Paste the invite link you received, or ask the family admin to send it again.');
      return;
    }
    router.push(href);
  }

  function handleIdentityPageNext(e: React.FormEvent) {
    e.preventDefault();
    if (identityPage === 'name' && !ownerFirstName.trim()) {
      setError('Add your first name so your family knows who this foundation starts with.');
      return;
    }

    setError('');
    const currentIndex = IDENTITY_PAGES.indexOf(identityPage);
    const nextPage = IDENTITY_PAGES[currentIndex + 1];
    if (nextPage) {
      setPageDirection(1);
      setIdentityPage(nextPage);
      return;
    }
    setPageDirection(1);
    setRelationshipPage('spouse-partner');
    setStep('relationships');
  }

  function handleIdentityBack() {
    setError('');
    const currentIndex = IDENTITY_PAGES.indexOf(identityPage);
    const previousPage = IDENTITY_PAGES[currentIndex - 1];
    if (previousPage) {
      setPageDirection(-1);
      setIdentityPage(previousPage);
      return;
    }
    setPageDirection(-1);
    setStep('path');
  }

  function validateFamilyMemberDrafts(label: string, people: FamilyMemberDraft[]) {
    const hasEmptyRow = people.some((person) => !person.firstName?.trim());
    if (hasEmptyRow) {
      setError(`Each ${label} needs a first name, or remove the empty row.`);
      return false;
    }
    return true;
  }

  function handleRelationshipPageNext(e: React.FormEvent) {
    e.preventDefault();
    const valid =
      relationshipPage === 'spouse-partner'
        ? validateFamilyMemberDrafts('spouse or partner', spousePartners)
        : relationshipPage === 'children'
          ? validateFamilyMemberDrafts('child', children)
          : relationshipPage === 'parents'
            ? validateFamilyMemberDrafts('parent or parental figure', parentFigures)
            : validateFamilyMemberDrafts('grandparent or older family member', grandparents);
    if (!valid) return;

    setError('');
    const currentIndex = RELATIONSHIP_PAGES.indexOf(relationshipPage);
    const nextPage = RELATIONSHIP_PAGES[currentIndex + 1];
    if (nextPage) {
      setPageDirection(1);
      setRelationshipPage(nextPage);
      return;
    }
    void handleFinalSubmit(e);
  }

  function handleRelationshipBack() {
    setError('');
    const currentIndex = RELATIONSHIP_PAGES.indexOf(relationshipPage);
    const previousPage = RELATIONSHIP_PAGES[currentIndex - 1];
    if (previousPage) {
      setPageDirection(-1);
      setRelationshipPage(previousPage);
      return;
    }
    setPageDirection(-1);
    setIdentityPage('family-name');
    setStep('identity');
  }

  async function saveInitialFoundationAnswers() {
    const rootsParts = [
      familyCallName.trim() ? `What family members call me: ${familyCallName.trim()}` : '',
      ownerBirthDateTouched ? `Date of birth: ${datePartsToIso(ownerBirthDate)}` : '',
      birthplace?.label ? `Birthplace: ${birthplace.label}` : '',
      childhoodPlace?.label ? `Where I spent most of my childhood: ${childhoodPlace.label}` : '',
    ].filter(Boolean);
    const parentFigureSummary = formatFamilyMemberDrafts(parentFigures);
    const grandparentSummary = formatFamilyMemberDrafts(grandparents);
    const heritageParts = [
      parentFigureSummary ? `Parents or parental figures:\n${parentFigureSummary}` : '',
      grandparentSummary ? `Grandparents or older family members:\n${grandparentSummary}` : '',
    ].filter(Boolean);
    const payloads = [
      rootsParts.length > 0 ? { category: 'roots_upbringing', content: rootsParts.join('\n') } : null,
      heritageParts.length > 0 ? { category: 'heritage_origins', content: heritageParts.join('\n') } : null,
    ].filter((payload): payload is { category: string; content: string } => Boolean(payload));

    if (payloads.length === 0) return;

    await Promise.allSettled(
      payloads.map((payload) =>
        fetch('/api/foundation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ),
    );
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!ownerFirstName.trim()) { setError('Add your first name to continue.'); return; }
    if (!validateFamilyMemberDrafts('spouse or partner', spousePartners)) return;
    if (!validateFamilyMemberDrafts('child', children)) return;
    if (!validateFamilyMemberDrafts('parent or parental figure', parentFigures)) return;
    if (!validateFamilyMemberDrafts('grandparent or older family member', grandparents)) return;

    setBusy(true);
    try {
      const customOwnerRole =
        ('customRoleLabel' in roleChoice ? (roleChoice as { customRoleLabel?: string | null }).customRoleLabel : null) ??
        (roleChoice.backendRole !== roleChoice.value ? roleChoice.label : null);
      const members = [
        ...spousePartners.map((spousePartner) => ({
          name: fullName(spousePartner),
          role: 'spouse',
          customRoleLabel: 'Spouse / Partner',
          birthDate: spousePartner.birthDateTouched ? datePartsToIso(spousePartner.birthDate) : null,
        })),
        ...children.map((c) => ({
          name: fullName(c),
          role: 'child',
          customRoleLabel: null,
          birthDate: c.birthDateTouched ? datePartsToIso(c.birthDate) : null,
        })),
        ...parentFigures.map((parentFigure) => ({
          name: fullName(parentFigure),
          role: 'parent',
          customRoleLabel: 'Parent / Parental Figure',
          birthDate: parentFigure.birthDateTouched ? datePartsToIso(parentFigure.birthDate) : null,
        })),
        ...grandparents.map((grandparent) => ({
          name: fullName(grandparent),
          role: 'grandparent',
          customRoleLabel: 'Grandparent / Older Family Member',
          birthDate: grandparent.birthDateTouched ? datePartsToIso(grandparent.birthDate) : null,
        })),
      ];

      try {
        window.sessionStorage.setItem(
          'breadcrumbs_onboarding_context',
          JSON.stringify({
            role: roleChoice.label,
            familyCallName: familyCallName.trim() || undefined,
            ownerBirthDate: ownerBirthDateTouched ? datePartsToIso(ownerBirthDate) : undefined,
            birthplace: birthplace?.label || undefined,
            childhoodPlace: childhoodPlace?.label || undefined,
            spousePartners: spousePartners
              .filter((spousePartner) => fullName(spousePartner))
              .map((spousePartner) => ({
                name: fullName(spousePartner),
                birthDate: spousePartner.birthDateTouched ? datePartsToIso(spousePartner.birthDate) : undefined,
              })),
            children: children
              .filter((child) => fullName(child))
              .map((child) => ({
                name: fullName(child),
                birthDate: child.birthDateTouched ? datePartsToIso(child.birthDate) : undefined,
              })),
            parentFigures: parentFigures
              .filter((parentFigure) => fullName(parentFigure))
              .map((parentFigure) => ({
                name: fullName(parentFigure),
                birthDate: parentFigure.birthDateTouched ? datePartsToIso(parentFigure.birthDate) : undefined,
              })),
            grandparents: grandparents
              .filter((grandparent) => fullName(grandparent))
              .map((grandparent) => ({
                name: fullName(grandparent),
                birthDate: grandparent.birthDateTouched ? datePartsToIso(grandparent.birthDate) : undefined,
              })),
          }),
        );
      } catch {
        // Local context is best-effort only; setup should not depend on storage.
      }

      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: `${ownerFirstName} ${ownerLastName}`.trim(),
          ownerRole: roleChoice.backendRole,
          customOwnerRole,
          familyName: familyName.trim() || null,
          members,
        }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      await saveInitialFoundationAnswers();
      await triggerPhoneVerification();
    } catch {
      setError('Could not save your family foundation. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer
      className="setup-shell setup-theme screen-main-safe flex items-start justify-center !px-5 !py-0 sm:!px-6"
    >
      <div className="setup-atmosphere" aria-hidden="true" />
      <ScreenContent className="relative z-10 max-w-md !pb-12 space-y-7">
        <header className="space-y-5 pt-2 text-center">
          <AnimatedWordmark className="text-3xl font-serif font-light tracking-tight text-foreground" />
          {step !== 'verify-phone' && <Progress step={step} />}
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(3px)' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
        {step === 'role' && (
          <section className="space-y-6">
            <StepIntro
              eyebrow="Step 1"
              title="Who are you in this family?"
              body="This is family context, not a permanent mode. You can receive Breadcrumbs and leave them for others."
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FAMILY_ROLE_OPTIONS.map((option) => (
                <OptionCard
                  key={option.value}
                  active={roleChoice.value === option.value}
                  animating={activeSelection === `role-${option.value}`}
                  label={option.label}
                  description={option.description}
                  onClick={() => {
                    setRoleChoice(option);
                    playSelectionFeedback(`role-${option.value}`);
                  }}
                />
              ))}
            </div>
            <button type="button" onClick={() => setStep('path')} className={PRIMARY_BUTTON}>
              Continue
            </button>
          </section>
        )}

        {step === 'path' && (
          <section className="space-y-6">
            <StepIntro
              eyebrow="Family Foundation"
              title="Start with the family."
              body="Create a new family foundation, or join an existing one through an invite link."
            />
            <div className="space-y-3">
              <OptionCard
                animating={activeSelection === 'path-create'}
                label="Create a new family"
                description="Set the family name, relationships, values, and the first context for future Breadcrumbs."
                onClick={() => {
                  setError('');
                  playSelectionFeedback('path-create', () => {
                    setIdentityPage('name');
                    setStep('identity');
                  });
                }}
              />
              <div className="rounded-xl border border-border bg-card/85 px-4 py-4 shadow-sm">
                <form onSubmit={handleInviteContinue} className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Join an existing family</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      An invite grafts you into a family that already exists. You will not recreate its foundation.
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="Paste invite link or token"
                    value={inviteLink}
                    onChange={(e) => { setInviteLink(e.target.value); setError(''); }}
                    className={INPUT}
                  />
                  <button type="submit" className={SECONDARY_BUTTON}>
                    Continue with invite
                  </button>
                </form>
              </div>
            </div>
            {error && <p className="text-sm text-red-400/90" role="alert">{error}</p>}
            <button type="button" onClick={() => setStep('role')} className={LINK_BUTTON}>
              Back
            </button>
          </section>
        )}

        {step === 'identity' && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.form
              key={identityPage}
              onSubmit={handleIdentityPageNext}
              className="space-y-7"
              custom={pageDirection}
              variants={QUESTION_PAGE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              {identityPage === 'name' && (
                <>
                  <StepIntro
                    eyebrow="Profile · 1 of 6"
                    title="What is your name?"
                    body={`${roleChoice.label} is your starting relationship. Begin with the name your family will recognize.`}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs text-muted-foreground/70">First name</span>
                      <input
                        type="text"
                        required
                        autoFocus
                        autoComplete="given-name"
                        placeholder="First name"
                        value={ownerFirstName}
                        onChange={(e) => { setOwnerFirstName(e.target.value); setError(''); }}
                        className={INPUT}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs text-muted-foreground/70">Last name</span>
                      <input
                        type="text"
                        autoComplete="family-name"
                        placeholder="Last name"
                        value={ownerLastName}
                        onChange={(e) => { setOwnerLastName(e.target.value); setError(''); }}
                        className={INPUT}
                      />
                    </label>
                  </div>
                </>
              )}

              {identityPage === 'family-call-name' && (
                <>
                  <StepIntro
                    eyebrow="Profile · 2 of 6"
                    title="What does family call you?"
                    body="Use the name that feels natural around the people closest to you."
                  />
                  <label className="block space-y-2">
                    <span className="text-xs text-muted-foreground/70">Family nickname, optional</span>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Sham, Uncle Jay, Nana"
                      value={familyCallName}
                      onChange={(e) => setFamilyCallName(e.target.value)}
                      className={INPUT}
                    />
                  </label>
                </>
              )}

              {identityPage === 'birth-date' && (
                <>
                  <StepIntro
                    eyebrow="Profile · 3 of 6"
                    title="When were you born?"
                    body="This helps Breadcrumbs place memories and generations in time."
                  />
                  <DateWheelPicker
                    label="Date of birth, optional"
                    value={ownerBirthDate}
                    selected={ownerBirthDateTouched}
                    placeholder="Add date of birth"
                    onChange={(birthDate) => {
                      setOwnerBirthDate(birthDate);
                      setOwnerBirthDateTouched(true);
                    }}
                  />
                </>
              )}

              {identityPage === 'birthplace' && (
                <>
                  <StepIntro
                    eyebrow="Profile · 4 of 6"
                    title="Where did your story begin?"
                    body="Add your birthplace so future stories carry a sense of origin."
                  />
                  <LocationAutocomplete
                    label="Birthplace, optional"
                    value={birthplace}
                    onChange={setBirthplace}
                    placeholder="e.g. Port-au-Prince, Haiti"
                  />
                </>
              )}

              {identityPage === 'childhood-place' && (
                <>
                  <StepIntro
                    eyebrow="Profile · 5 of 6"
                    title="Where did you grow up?"
                    body="The place that shaped your childhood may be different from where you were born."
                  />
                  <LocationAutocomplete
                    label="Childhood location, optional"
                    value={childhoodPlace}
                    onChange={setChildhoodPlace}
                    placeholder="e.g. Fort Lauderdale, FL"
                  />
                </>
              )}

              {identityPage === 'family-name' && (
                <>
                  <StepIntro
                    eyebrow="Profile · 6 of 6"
                    title="What should we call your family?"
                    body="Give this private family space a name everyone will recognize."
                  />
                  <label className="block space-y-2">
                    <span className="text-xs text-muted-foreground/70">Family name, optional</span>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. The Joseph Family"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      className={INPUT}
                    />
                  </label>
                </>
              )}

              {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleIdentityPageNext(e as unknown as React.FormEvent);
                  }}
                  className={PRIMARY_BUTTON}
                >
                  {identityPage === 'family-name' ? 'Continue to relationships' : 'Continue'}
                </button>
                {identityPage !== 'family-name' && (
                  <button type="button" onClick={() => {
                    if (!ownerFirstName.trim()) { setError('Add your first name to continue.'); return; }
                    setError(''); setPageDirection(1); setIdentityPage('family-name');
                  }} className={SECONDARY_BUTTON}>Add the rest of my story later</button>
                )}
                <button type="button" onClick={handleIdentityBack} className={LINK_BUTTON}>
                  Back
                </button>
              </div>
            </motion.form>
          </AnimatePresence>
        )}

        {step === 'relationships' && (
          <AnimatePresence mode="wait" initial={false} custom={pageDirection}>
            <motion.form
              key={relationshipPage}
              onSubmit={handleRelationshipPageNext}
              className="space-y-7"
              custom={pageDirection}
              variants={QUESTION_PAGE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {relationshipPage === 'spouse-partner' && (
                <RelationshipQuestion
                  eyebrow="Relationships · 1 of 4"
                  title="Is there a spouse or partner?"
                  body="Add the person or people who share this family foundation with you."
                  addLabel="Add spouse"
                  emptyTitle="No spouse or partner added"
                  emptyBody="Leave this blank if it does not apply. You can always add someone later."
                  people={spousePartners}
                  yearOffset={40}
                  removeLabel="Remove spouse or partner"
                  onChange={setSpousePartners}
                />
              )}

              {relationshipPage === 'children' && (
                <RelationshipQuestion
                  eyebrow="Relationships · 2 of 4"
                  title="Who are your children?"
                  body="Add each child who belongs in this first view of your family."
                  addLabel="Add child"
                  emptyTitle="No children added"
                  emptyBody="Skip this page if it does not apply. Family members can be added later."
                  people={children}
                  yearOffset={10}
                  removeLabel="Remove child"
                  onChange={setChildren}
                />
              )}

              {relationshipPage === 'parents' && (
                <RelationshipQuestion
                  eyebrow="Relationships · 3 of 4"
                  title="Who helped raise you?"
                  body="Add parents, guardians, step-parents, adoptive parents, or other parental figures."
                  addLabel="Add parent"
                  emptyTitle="No parental figures added"
                  emptyBody="This is optional. Add only the people you want represented in the family graph."
                  people={parentFigures}
                  yearOffset={65}
                  removeLabel="Remove parent or parental figure"
                  onChange={setParentFigures}
                />
              )}

              {relationshipPage === 'grandparents' && (
                <RelationshipQuestion
                  eyebrow="Relationships · 4 of 4"
                  title="Which elders should be remembered?"
                  body="Add grandparents or older family members whose stories connect generations."
                  addLabel="Add grandparent"
                  emptyTitle="No elders added"
                  emptyBody="This is optional. You can grow the family graph whenever more stories emerge."
                  people={grandparents}
                  yearOffset={85}
                  removeLabel="Remove grandparent or older family member"
                  onChange={setGrandparents}
                />
              )}

              {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={relationshipPage === 'grandparents' && busy}
                  onClick={(e) => {
                    e.preventDefault();
                    handleRelationshipPageNext(e as unknown as React.FormEvent);
                  }}
                  className={PRIMARY_BUTTON}
                >
                  {relationshipPage === 'grandparents'
                    ? busy ? 'Creating family foundation...' : 'Create family foundation'
                    : 'Continue'}
                </button>
                {relationshipPage !== 'grandparents' && (
                  <button type="button" disabled={busy} onClick={(event) => void handleFinalSubmit(event)} className={SECONDARY_BUTTON}>
                    {busy ? 'Creating family foundation…' : 'Start with these people — add others later'}
                  </button>
                )}
                <button type="button" onClick={handleRelationshipBack} className={LINK_BUTTON}>
                  Back
                </button>
              </div>
            </motion.form>
          </AnimatePresence>
        )}

        {step === 'started' && (
          <section className="space-y-6">
            <StepIntro
              eyebrow="Foundation Started"
              title="Your Family Foundation has started."
              body="This is the beginning of the Family Agent's context. It becomes more representative as Breadcrumbs, stories, clarifications, and corrections accumulate."
            />
            <div className="rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/[0.07] px-4 py-4 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Next best move</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Add one specific memory or lesson next. Specific stories are stronger evidence than isolated statements.
              </p>
            </div>
            <button type="button" onClick={() => router.push('/capture')} className={PRIMARY_BUTTON}>
              Leave the first Breadcrumb
            </button>
            <button type="button" onClick={() => router.push('/foundation')} className={SECONDARY_BUTTON}>
              Keep building the Foundation
            </button>
          </section>
        )}

        {step === 'verify-phone' && (
          <section className="space-y-6">
            <StepIntro
              eyebrow="Foundation Started"
              title="Your Family Foundation has started."
              body={
                setupPhone
                  ? `Enter the code we texted to ${maskPhone(setupPhone)}. The Family Agent will grow as your family leaves more Breadcrumbs.`
                  : 'Confirm your phone when you are ready. The Family Agent will grow as your family leaves more Breadcrumbs.'
              }
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="------"
              value={phoneCode}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPhoneCode(digits);
                if (digits.length === 6) void verifyPhoneCode(digits);
              }}
              disabled={phoneVerifyBusy}
              maxLength={6}
              className="w-full rounded-xl border border-border bg-card px-3 py-3 text-center text-2xl tracking-[0.5em] text-foreground shadow-sm placeholder:text-muted-foreground/30 transition focus:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35 disabled:opacity-50"
            />
            {phoneError && <p className="text-xs text-red-400 text-center">{phoneError}</p>}
            <div className="flex flex-col items-center gap-2">
              {phoneResendCountdown > 0 ? (
                <p className="text-xs text-muted-foreground">Resend in {phoneResendCountdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void triggerPhoneVerification()}
                  disabled={phoneVerifyBusy}
                  className={LINK_BUTTON}
                >
                  Resend code
                </button>
              )}
              <button type="button" onClick={() => router.push('/capture')} className={LINK_BUTTON}>
                Skip for now
              </button>
            </div>
          </section>
        )}
          </motion.div>
        </AnimatePresence>
      </ScreenContent>
    </ScreenContainer>
  );
}
