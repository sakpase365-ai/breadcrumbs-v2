'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { StructuredLocation } from '@/lib/location';
import { customLocation } from '@/lib/location';

const DEBOUNCE_MS = 300;

const INPUT_CLASS =
  'w-full min-h-[48px] rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 transition focus:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35';

type SearchState = 'idle' | 'loading' | 'done' | 'error';

export interface LocationAutocompleteProps {
  value: StructuredLocation | null;
  onChange: (location: StructuredLocation | null) => void;
  placeholder?: string;
  label?: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing a city or place…',
  label,
}: LocationAutocompleteProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [suggestions, setSuggestions] = useState<StructuredLocation[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setInputValue(value?.label ?? '');
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSearchState('idle');
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSearchState('loading');
    try {
      const res = await fetch(
        `/api/location-search?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal },
      );
      if (!res.ok) throw new Error('search failed');
      const data = await res.json() as { results: StructuredLocation[] };
      setSuggestions(data.results ?? []);
      setOpen(true);
      setSearchState('done');
      setActiveIndex(-1);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setSuggestions([]);
      setSearchState('error');
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputValue(q);
    onChange(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSearch(q), DEBOUNCE_MS);
  }

  function selectSuggestion(loc: StructuredLocation) {
    onChange(loc);
    setInputValue(loc.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function selectCustom() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    selectSuggestion(customLocation(trimmed));
  }

  // Total options = suggestions + optional "use as typed" row
  const showCustomRow = open && searchState === 'done' && inputValue.trim().length >= 2;
  const totalOptions = suggestions.length + (showCustomRow ? 1 : 0);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || totalOptions === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalOptions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + totalOptions) % totalOptions);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        selectCustom();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleBlur() {
    // Delay so mousedown on list items fires before the blur hides them
    setTimeout(() => {
      if (document.activeElement === inputRef.current) return;
      if (listRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      if (inputValue.trim() && !value) {
        selectCustom();
      }
    }, 160);
  }

  const showDropdown = open && (suggestions.length > 0 || showCustomRow);

  return (
    <div className="relative">
      {label && (
        <p className="mb-1 text-xs text-muted-foreground/70">{label}</p>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={INPUT_CLASS}
          autoComplete="off"
          spellCheck={false}
        />
        {searchState === 'loading' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/40"
          >
            ···
          </span>
        )}
      </div>

      {showDropdown && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        >
          {suggestions.map((loc, i) => (
            <li
              key={loc.placeId ?? `s-${i}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(loc); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-4 py-3 text-sm transition ${
                i === activeIndex
                  ? 'bg-[#3B82F6]/10 text-[#2563EB]'
                  : 'text-muted-foreground hover:bg-[#3B82F6]/[0.07] hover:text-foreground'
              }`}
            >
              {loc.label}
            </li>
          ))}

          {showCustomRow && (
            <li
              id={`${listId}-opt-${suggestions.length}`}
              role="option"
              aria-selected={activeIndex === suggestions.length}
              onMouseDown={(e) => { e.preventDefault(); selectCustom(); }}
              onMouseEnter={() => setActiveIndex(suggestions.length)}
              className={`cursor-pointer px-4 py-3 text-sm transition ${
                suggestions.length > 0 ? 'border-t border-border/40' : ''
              } ${
                activeIndex === suggestions.length
                  ? 'bg-[#3B82F6]/10 text-[#2563EB]'
                  : 'text-muted-foreground/60 hover:bg-[#3B82F6]/[0.07] hover:text-foreground'
              }`}
            >
              Use &ldquo;{inputValue.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
