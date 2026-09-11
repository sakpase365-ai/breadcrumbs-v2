# Location Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four plain-text location inputs in `/setup` (birthplace, where-you-grew-up, where-you-consider-home, important family locations) with a reusable, provider-backed `LocationAutocomplete` component that stores structured location data alongside the existing display-label strings, without breaking `/api/setup` or `/api/foundation`.

**Architecture:** A new `StructuredLocation` type and a Geoapify HTTP adapter live in `src/lib/`. A server-only Next.js route (`/api/location-autocomplete`) proxies Geoapify so the API key never reaches the browser and the route degrades to `{ suggestions: [] }` when no key is configured. A client hook (`useLocationSearch` + pure helpers) owns debouncing, request cancellation, and keyboard-nav math. A presentational `LocationAutocomplete` component wires the hook to an accessible combobox styled with the same tokens already used on `/setup`. `setup/page.tsx` swaps its four location `useState<string>` fields for `useState<StructuredLocation | null>` (plus an array for the repeatable family-locations list) and continues to send plain-text labels to `/api/foundation` and `sessionStorage`, with the full structured objects added alongside in `sessionStorage` only.

**Tech Stack:** Next.js App Router route handler, React 18 client hook/component, Geoapify Autocomplete HTTP API, Vitest (existing `node` environment for logic, per-file `jsdom` override for the two files that render/mount React).

## Global Constraints

- Preserve `/api/setup` and `/api/foundation` request/response contracts exactly — no schema migrations. (source: user spec "Persistence")
- Store the display label in the existing compatible string fields (`/api/foundation` content, `sessionStorage.birthplace`/`childhoodPlace`); store full `StructuredLocation` objects only in `sessionStorage` under new keys. (source: user spec "Persistence")
- No hardcoded static city list; suggestions must come from a real provider-backed API route. (source: user spec)
- Debounce requests and cancel stale ones (AbortController). (source: user spec)
- Support ArrowUp/ArrowDown/Enter/Escape, mouse/touch selection, and free-text custom entry when nothing matches. (source: user spec)
- If `GEOAPIFY_API_KEY` is absent, degrade gracefully to custom-entry-only — never block onboarding. (source: user spec)
- Visual language must match existing `/setup` inputs: dark `#171516` background (already `--background` in `src/app/globals.css:8`), warm off-white foreground, `bg-card`/`border-border`/`rounded-sm`/`focus-visible:ring-foreground/40` tokens — no black-on-black text. (source: user spec + `src/app/globals.css`)
- Do not touch `Parent/Guardian`, `Child` role semantics, Foundation Status UI, or any of the other "Maintain current decisions" items — this plan only touches location fields. (source: user spec)
- `npm run lint`, `npm run test`, `npm run build` must pass; `curl -I --max-time 10 http://127.0.0.1:3000/setup` must return a successful status; `next-env.d.ts` must not show incidental churn in the final diff. (source: user spec "Validation")

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/location.ts` | `StructuredLocation` type, `createCustomLocation()`, `locationLabel()` |
| `src/lib/location-provider.ts` | Geoapify HTTP call + response-to-`StructuredLocation` mapping (server-only, uses `fetch`) |
| `src/app/api/location-autocomplete/route.ts` | Authenticated GET proxy route; degrades to empty suggestions when key absent or provider errors |
| `src/hooks/useLocationAutocomplete.ts` | `useLocationSearch()` hook (debounce + abort + fetch), `buildLocationListItems()`, `getNextHighlightedIndex()` — the last two are pure and independently testable |
| `src/components/ui/LocationAutocomplete.tsx` | Presentational combobox: input + dropdown, loading/empty/error/custom states, keyboard + mouse/touch handling |
| `src/app/setup/page.tsx` | Modified: 4 location fields wired to `LocationAutocomplete`, `saveInitialFoundationAnswers()` and the `sessionStorage` payload updated |
| `package.json` | New devDependencies: `jsdom`, `@testing-library/react`, `@testing-library/user-event` |

---

### Task 1: Add test tooling for component/hook rendering

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `jsdom`, `@testing-library/react`, `@testing-library/user-event` available as devDependencies for later tasks. No global Vitest config change — `vitest.config.ts` stays `environment: 'node'`; individual test files that need a DOM opt in with a `// @vitest-environment jsdom` docblock at the top of the file.

- [ ] **Step 1: Install the packages**

Run:
```bash
npm install --save-dev jsdom@^24 @testing-library/react@^14 @testing-library/user-event@^14
```

- [ ] **Step 2: Verify the existing suite is unaffected**

Run: `npm run test`
Expected: All existing tests still pass (they all run under `environment: 'node'`, unchanged).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jsdom + testing-library devDependencies for component tests"
```

---

### Task 2: `StructuredLocation` type and helpers

**Files:**
- Create: `src/lib/location.ts`
- Test: `__tests__/location.test.ts`

**Interfaces:**
- Produces:
  - `type LocationProvider = 'geoapify' | 'custom'`
  - `interface StructuredLocation { label: string; placeId: string | null; provider: LocationProvider; latitude: number | null; longitude: number | null; city: string | null; region: string | null; country: string | null; countryCode: string | null; raw: unknown; isCustom: boolean; }`
  - `createCustomLocation(label: string): StructuredLocation`
  - `locationLabel(location: StructuredLocation | null | undefined): string`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/location.test.ts
import { describe, it, expect } from 'vitest';
import { createCustomLocation, locationLabel } from '../src/lib/location';

describe('createCustomLocation', () => {
  it('trims the label and marks the location as custom', () => {
    const loc = createCustomLocation('  Brooklyn, NY  ');
    expect(loc.label).toBe('Brooklyn, NY');
    expect(loc.isCustom).toBe(true);
    expect(loc.provider).toBe('custom');
    expect(loc.placeId).toBeNull();
    expect(loc.latitude).toBeNull();
    expect(loc.longitude).toBeNull();
    expect(loc.city).toBeNull();
    expect(loc.region).toBeNull();
    expect(loc.country).toBeNull();
    expect(loc.countryCode).toBeNull();
  });
});

describe('locationLabel', () => {
  it('returns the label of a structured location', () => {
    expect(locationLabel(createCustomLocation('Miami'))).toBe('Miami');
  });

  it('returns an empty string for null or undefined', () => {
    expect(locationLabel(null)).toBe('');
    expect(locationLabel(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/location'"

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/location.ts
export type LocationProvider = 'geoapify' | 'custom';

export interface StructuredLocation {
  label:       string;
  placeId:     string | null;
  provider:    LocationProvider;
  latitude:    number | null;
  longitude:   number | null;
  city:        string | null;
  region:      string | null;
  country:     string | null;
  countryCode: string | null;
  raw:         unknown;
  isCustom:    boolean;
}

export function createCustomLocation(label: string): StructuredLocation {
  return {
    label:       label.trim(),
    placeId:     null,
    provider:    'custom',
    latitude:    null,
    longitude:   null,
    city:        null,
    region:      null,
    country:     null,
    countryCode: null,
    raw:         null,
    isCustom:    true,
  };
}

export function locationLabel(location: StructuredLocation | null | undefined): string {
  return location?.label ?? '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/location.ts __tests__/location.test.ts
git commit -m "feat(location): add StructuredLocation type and helpers"
```

---

### Task 3: Geoapify provider adapter

**Files:**
- Create: `src/lib/location-provider.ts`
- Test: `__tests__/location-provider.test.ts`

**Interfaces:**
- Consumes: `StructuredLocation` from `src/lib/location.ts` (Task 2)
- Produces:
  - `mapGeoapifyResult(result: GeoapifyResult): StructuredLocation | null` (exported for testing)
  - `searchGeoapifyLocations(query: string, apiKey: string, signal?: AbortSignal): Promise<StructuredLocation[]>`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/location-provider.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapGeoapifyResult, searchGeoapifyLocations } from '../src/lib/location-provider';

describe('mapGeoapifyResult', () => {
  it('maps a Geoapify result into a StructuredLocation', () => {
    const location = mapGeoapifyResult({
      formatted:    'Brooklyn, NY, USA',
      place_id:     'abc123',
      lat:          40.6782,
      lon:          -73.9442,
      city:         'Brooklyn',
      state:        'New York',
      country:      'United States',
      country_code: 'us',
    });

    expect(location).toEqual({
      label:       'Brooklyn, NY, USA',
      placeId:     'abc123',
      provider:    'geoapify',
      latitude:    40.6782,
      longitude:   -73.9442,
      city:        'Brooklyn',
      region:      'New York',
      country:     'United States',
      countryCode: 'US',
      raw:         expect.any(Object),
      isCustom:    false,
    });
  });

  it('returns null when the result has no formatted label', () => {
    expect(mapGeoapifyResult({})).toBeNull();
  });

  it('falls back to county when state is absent', () => {
    const location = mapGeoapifyResult({ formatted: 'Somewhere', county: 'Some County' });
    expect(location?.region).toBe('Some County');
  });
});

describe('searchGeoapifyLocations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and maps results from Geoapify', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({
        results: [{ formatted: 'Miami, FL, USA', place_id: 'p1', lat: 25.77, lon: -80.19 }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const results = await searchGeoapifyLocations('miami', 'test-key');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('text=miami'),
      expect.objectContaining({ signal: undefined }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Miami, FL, USA');
  });

  it('throws when the provider responds with a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(searchGeoapifyLocations('miami', 'test-key')).rejects.toThrow('429');
  });

  it('filters out results with no formatted label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok:   true,
        json: async () => ({ results: [{ place_id: 'no-label' }, { formatted: 'Ok Place' }] }),
      }),
    );
    const results = await searchGeoapifyLocations('ok', 'test-key');
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Ok Place');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location-provider.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/location-provider'"

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/location-provider.ts
import type { StructuredLocation } from './location';

const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v1/geocode/autocomplete';
const RESULT_LIMIT = 6;

interface GeoapifyResult {
  formatted?:    string;
  place_id?:     string;
  lat?:          number;
  lon?:          number;
  city?:         string;
  county?:       string;
  state?:        string;
  country?:      string;
  country_code?: string;
}

interface GeoapifyResponse {
  results?: GeoapifyResult[];
}

export function mapGeoapifyResult(result: GeoapifyResult): StructuredLocation | null {
  if (!result.formatted) return null;

  return {
    label:       result.formatted,
    placeId:     result.place_id ?? null,
    provider:    'geoapify',
    latitude:    typeof result.lat === 'number' ? result.lat : null,
    longitude:   typeof result.lon === 'number' ? result.lon : null,
    city:        result.city ?? null,
    region:      result.state ?? result.county ?? null,
    country:     result.country ?? null,
    countryCode: result.country_code ? result.country_code.toUpperCase() : null,
    raw:         result,
    isCustom:    false,
  };
}

export async function searchGeoapifyLocations(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<StructuredLocation[]> {
  const url =
    `${GEOAPIFY_ENDPOINT}?text=${encodeURIComponent(query)}` +
    `&apiKey=${encodeURIComponent(apiKey)}&format=json&limit=${RESULT_LIMIT}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Geoapify request failed with status ${res.status}`);
  }

  const data = (await res.json()) as GeoapifyResponse;
  return (data.results ?? [])
    .map(mapGeoapifyResult)
    .filter((location): location is StructuredLocation => location !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location-provider.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/location-provider.ts __tests__/location-provider.test.ts
git commit -m "feat(location): add Geoapify search adapter"
```

---

### Task 4: `/api/location-autocomplete` route

**Files:**
- Create: `src/app/api/location-autocomplete/route.ts`
- Test: `__tests__/location-autocomplete.test.ts`

**Interfaces:**
- Consumes: `searchGeoapifyLocations` from `src/lib/location-provider.ts` (Task 3), `getSessionClient` from `@/lib/supabase`, `assertEnv` from `@/lib/env`, `logger` from `@/lib/logger`.
- Produces: `GET(req: NextRequest)` returning `NextResponse.json({ suggestions: StructuredLocation[]; providerAvailable: boolean })` or `{ error }` with 401.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/location-autocomplete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSessionClient: vi.fn(), getServiceClient: vi.fn() }));
vi.mock('@/lib/location-provider', () => ({ searchGeoapifyLocations: vi.fn() }));

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/location-autocomplete/route';
import { getSessionClient } from '@/lib/supabase';
import { searchGeoapifyLocations } from '@/lib/location-provider';

function makeSession(session: unknown) {
  return { auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) } };
}

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/location-autocomplete?q=${encodeURIComponent(query)}`);
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('GET /api/location-autocomplete', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);
    const res = await GET(makeRequest('miami'));
    expect(res.status).toBe(401);
  });

  it('returns empty suggestions for queries shorter than 2 characters', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession({ user: { id: 'u1' } }) as never);
    const res = await GET(makeRequest('m'));
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
    expect(searchGeoapifyLocations).not.toHaveBeenCalled();
  });

  it('degrades gracefully when GEOAPIFY_API_KEY is absent', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    vi.mocked(getSessionClient).mockResolvedValue(makeSession({ user: { id: 'u1' } }) as never);
    const res = await GET(makeRequest('miami'));
    const body = await res.json();
    expect(body).toEqual({ suggestions: [], providerAvailable: false });
    expect(searchGeoapifyLocations).not.toHaveBeenCalled();
  });

  it('returns mapped suggestions from the provider', async () => {
    process.env.GEOAPIFY_API_KEY = 'test-key';
    vi.mocked(getSessionClient).mockResolvedValue(makeSession({ user: { id: 'u1' } }) as never);
    vi.mocked(searchGeoapifyLocations).mockResolvedValue([
      {
        label: 'Miami, FL, USA', placeId: 'p1', provider: 'geoapify',
        latitude: 25.77, longitude: -80.19, city: 'Miami', region: 'Florida',
        country: 'United States', countryCode: 'US', raw: {}, isCustom: false,
      },
    ]);

    const res = await GET(makeRequest('miami'));
    const body = await res.json();

    expect(searchGeoapifyLocations).toHaveBeenCalledWith('miami', 'test-key');
    expect(body.providerAvailable).toBe(true);
    expect(body.suggestions).toHaveLength(1);
  });

  it('degrades to empty suggestions when the provider throws', async () => {
    process.env.GEOAPIFY_API_KEY = 'test-key';
    vi.mocked(getSessionClient).mockResolvedValue(makeSession({ user: { id: 'u1' } }) as never);
    vi.mocked(searchGeoapifyLocations).mockRejectedValue(new Error('boom'));

    const res = await GET(makeRequest('miami'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location-autocomplete.test.ts`
Expected: FAIL with "Cannot find module '../src/app/api/location-autocomplete/route'"

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/location-autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient } from '@/lib/supabase';
import { assertEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { searchGeoapifyLocations } from '@/lib/location-provider';

const MIN_QUERY_LENGTH = 2;

export async function GET(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const query = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [], providerAvailable: Boolean(apiKey) });
  }

  if (!apiKey) {
    return NextResponse.json({ suggestions: [], providerAvailable: false });
  }

  try {
    const suggestions = await searchGeoapifyLocations(query, apiKey);
    return NextResponse.json({ suggestions, providerAvailable: true });
  } catch (err) {
    logger.warn('location-autocomplete: provider request failed, degrading to custom entry', {
      route: 'location-autocomplete GET',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ suggestions: [], providerAvailable: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location-autocomplete.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/location-autocomplete/route.ts __tests__/location-autocomplete.test.ts
git commit -m "feat(location): add authenticated location-autocomplete API route"
```

---

### Task 5: `useLocationAutocomplete` hook + pure helpers

**Files:**
- Create: `src/hooks/useLocationAutocomplete.ts`
- Test: `__tests__/location-list-items.test.ts` (pure functions, `node` env)
- Test: `__tests__/useLocationSearch.test.ts` (hook, `jsdom` env via pragma)

**Interfaces:**
- Consumes: `StructuredLocation` from `src/lib/location.ts` (Task 2). Fetches `/api/location-autocomplete?q=` (Task 4) client-side.
- Produces:
  - `type LocationSearchStatus = 'idle' | 'loading' | 'success' | 'error'`
  - `useLocationSearch(query: string): { suggestions: StructuredLocation[]; status: LocationSearchStatus }`
  - `type LocationListItem = { kind: 'suggestion'; location: StructuredLocation } | { kind: 'custom'; label: string }`
  - `buildLocationListItems(suggestions: StructuredLocation[], rawQuery: string): LocationListItem[]`
  - `getNextHighlightedIndex(current: number, itemCount: number, key: 'ArrowDown' | 'ArrowUp'): number`

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/location-list-items.test.ts
import { describe, it, expect } from 'vitest';
import { buildLocationListItems, getNextHighlightedIndex } from '../src/hooks/useLocationAutocomplete';
import type { StructuredLocation } from '../src/lib/location';

function makeSuggestion(label: string): StructuredLocation {
  return {
    label, placeId: label, provider: 'geoapify', latitude: null, longitude: null,
    city: null, region: null, country: null, countryCode: null, raw: null, isCustom: false,
  };
}

describe('buildLocationListItems', () => {
  it('appends a custom entry option when the query has no exact match', () => {
    const items = buildLocationListItems([makeSuggestion('Miami, FL')], 'miam');
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({ kind: 'custom', label: 'miam' });
  });

  it('omits the custom entry option when a suggestion exactly matches the query', () => {
    const items = buildLocationListItems([makeSuggestion('Miami, FL')], 'Miami, FL');
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ kind: 'suggestion', location: makeSuggestion('Miami, FL') });
  });

  it('returns an empty list for a short query with no suggestions', () => {
    expect(buildLocationListItems([], 'm')).toEqual([]);
  });

  it('returns just the custom option when there are no suggestions and the query is long enough', () => {
    expect(buildLocationListItems([], 'Nowhereville')).toEqual([{ kind: 'custom', label: 'Nowhereville' }]);
  });
});

describe('getNextHighlightedIndex', () => {
  it('moves down from -1 to 0', () => {
    expect(getNextHighlightedIndex(-1, 3, 'ArrowDown')).toBe(0);
  });

  it('clamps at the last index moving down', () => {
    expect(getNextHighlightedIndex(2, 3, 'ArrowDown')).toBe(2);
  });

  it('clamps at 0 moving up', () => {
    expect(getNextHighlightedIndex(0, 3, 'ArrowUp')).toBe(0);
  });

  it('returns -1 for an empty list', () => {
    expect(getNextHighlightedIndex(-1, 0, 'ArrowDown')).toBe(-1);
  });
});
```

```ts
// __tests__/useLocationSearch.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLocationSearch } from '../src/hooks/useLocationAutocomplete';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useLocationSearch', () => {
  it('stays idle below the minimum query length', () => {
    const { result } = renderHook(() => useLocationSearch('m'));
    expect(result.current.status).toBe('idle');
    expect(result.current.suggestions).toEqual([]);
  });

  it('debounces and fetches suggestions for a valid query', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ suggestions: [{ label: 'Miami, FL' }], providerAvailable: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(({ q }) => useLocationSearch(q), { initialProps: { q: 'mi' } });

    expect(mockFetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('q=mi'), expect.any(Object));
    expect(result.current.suggestions).toHaveLength(1);
  });

  it('sets an error status when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { result } = renderHook(({ q }) => useLocationSearch(q), { initialProps: { q: 'mi' } });

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.suggestions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/location-list-items.test.ts __tests__/useLocationSearch.test.ts`
Expected: FAIL with "Cannot find module '../src/hooks/useLocationAutocomplete'"

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useLocationAutocomplete.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { StructuredLocation } from '@/lib/location';

export type LocationSearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface LocationSearchState {
  suggestions: StructuredLocation[];
  status:      LocationSearchStatus;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useLocationSearch(query: string): LocationSearchState {
  const [state, setState] = useState<LocationSearchState>({ suggestions: [], status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setState({ suggestions: [], status: 'idle' });
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((current) => ({ ...current, status: 'loading' }));

      fetch(`/api/location-autocomplete?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { suggestions?: StructuredLocation[] }) => {
          setState({ suggestions: data.suggestions ?? [], status: 'success' });
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({ suggestions: [], status: 'error' });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return state;
}

export type LocationListItem =
  | { kind: 'suggestion'; location: StructuredLocation }
  | { kind: 'custom'; label: string };

export function buildLocationListItems(
  suggestions: StructuredLocation[],
  rawQuery: string,
): LocationListItem[] {
  const items: LocationListItem[] = suggestions.map((location) => ({ kind: 'suggestion', location }));
  const trimmed = rawQuery.trim();
  const alreadyMatches = suggestions.some((s) => s.label.trim().toLowerCase() === trimmed.toLowerCase());

  if (trimmed.length >= MIN_QUERY_LENGTH && !alreadyMatches) {
    items.push({ kind: 'custom', label: trimmed });
  }

  return items;
}

export function getNextHighlightedIndex(
  current: number,
  itemCount: number,
  key: 'ArrowDown' | 'ArrowUp',
): number {
  if (itemCount === 0) return -1;
  if (key === 'ArrowDown') return current < itemCount - 1 ? current + 1 : itemCount - 1;
  return current > 0 ? current - 1 : 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/location-list-items.test.ts __tests__/useLocationSearch.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLocationAutocomplete.ts __tests__/location-list-items.test.ts __tests__/useLocationSearch.test.ts
git commit -m "feat(location): add useLocationSearch hook and keyboard-nav helpers"
```

---

### Task 6: `LocationAutocomplete` component

**Files:**
- Create: `src/components/ui/LocationAutocomplete.tsx`
- Test: `__tests__/LocationAutocomplete.test.tsx` (`jsdom` env via pragma)

**Interfaces:**
- Consumes: `StructuredLocation`, `createCustomLocation` from `src/lib/location.ts` (Task 2); `useLocationSearch`, `buildLocationListItems`, `getNextHighlightedIndex`, `LocationListItem` from `src/hooks/useLocationAutocomplete.ts` (Task 5).
- Produces: `LocationAutocomplete({ id?, label, placeholder?, value: StructuredLocation | null, onChange: (location: StructuredLocation | null) => void })` — a labeled combobox `<input role="combobox">` used directly in place of the old `INPUT`-styled `<input>` elements in `setup/page.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/LocationAutocomplete.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationAutocomplete } from '../src/components/ui/LocationAutocomplete';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubFetch(suggestions: Array<Record<string, unknown>>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ json: async () => ({ suggestions, providerAvailable: true }) }),
  );
}

describe('LocationAutocomplete', () => {
  it('shows suggestions as the user types and selects one via keyboard', async () => {
    stubFetch([
      {
        label: 'Miami, FL, USA', placeId: 'p1', provider: 'geoapify',
        latitude: 25.77, longitude: -80.19, city: 'Miami', region: 'Florida',
        country: 'United States', countryCode: 'US', raw: {}, isCustom: false,
      },
    ]);
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<LocationAutocomplete label="Birthplace" value={null} onChange={onChange} />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'mia');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(screen.getByText('Miami, FL, USA')).toBeTruthy());

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Miami, FL, USA', isCustom: false }));
  });

  it('allows a custom entry when nothing matches', async () => {
    stubFetch([]);
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<LocationAutocomplete label="Birthplace" value={null} onChange={onChange} />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'Nowhereville');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(screen.getByText('Use "Nowhereville"')).toBeTruthy());

    await user.click(screen.getByText('Use "Nowhereville"'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Nowhereville', isCustom: true, provider: 'custom' }),
    );
  });

  it('closes the dropdown on Escape without clearing the input', async () => {
    stubFetch([]);
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<LocationAutocomplete label="Birthplace" value={null} onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;

    await user.type(input, 'Nowhereville');
    await vi.advanceTimersByTimeAsync(300);
    await user.keyboard('{Escape}');

    expect(input.value).toBe('Nowhereville');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('commits a custom location on blur when no suggestion was selected', async () => {
    stubFetch([]);
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <div>
        <LocationAutocomplete label="Birthplace" value={null} onChange={onChange} />
        <button type="button">elsewhere</button>
      </div>,
    );
    const input = screen.getByRole('combobox');

    await user.type(input, 'Cap-Haïtien');
    await vi.advanceTimersByTimeAsync(300);
    await user.click(screen.getByText('elsewhere'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Cap-Haïtien', isCustom: true }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/LocationAutocomplete.test.tsx`
Expected: FAIL with "Cannot find module '../src/components/ui/LocationAutocomplete'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/LocationAutocomplete.tsx
'use client';

import { useId, useMemo, useState } from 'react';
import { createCustomLocation, type StructuredLocation } from '@/lib/location';
import {
  buildLocationListItems,
  getNextHighlightedIndex,
  useLocationSearch,
  type LocationListItem,
} from '@/hooks/useLocationAutocomplete';

const INPUT_CLASS =
  'w-full min-h-[48px] bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground/60 focus:border-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 transition rounded-sm';

const OPTION_CLASS =
  'block w-full min-h-[44px] px-4 py-2.5 text-left text-sm text-foreground hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 transition';

const STATUS_CLASS = 'px-4 py-2.5 text-xs text-muted-foreground/70';

interface LocationAutocompleteProps {
  id?:          string;
  label:        string;
  placeholder?: string;
  value:        StructuredLocation | null;
  onChange:     (location: StructuredLocation | null) => void;
}

export function LocationAutocomplete({ id, label, placeholder, value, onChange }: LocationAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;

  const [query, setQuery] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const { suggestions, status } = useLocationSearch(open ? query : '');
  const items = useMemo(() => buildLocationListItems(suggestions, query), [suggestions, query]);

  function commitItem(item: LocationListItem) {
    const location = item.kind === 'suggestion' ? item.location : createCustomLocation(item.label);
    setQuery(location.label);
    onChange(location);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex((idx) => getNextHighlightedIndex(idx, items.length, e.key as 'ArrowDown' | 'ArrowUp'));
    } else if (e.key === 'Enter') {
      if (open && items.length > 0) {
        e.preventDefault();
        commitItem(items[highlightedIndex >= 0 ? highlightedIndex : 0]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setHighlightedIndex(-1);
      }
    }
  }

  function handleBlur() {
    setOpen(false);
    const trimmed = query.trim();
    if (!trimmed) {
      if (value !== null) onChange(null);
      return;
    }
    if (trimmed !== value?.label) {
      onChange(createCustomLocation(trimmed));
    }
  }

  return (
    <label className="block space-y-1" htmlFor={inputId}>
      <span className="text-xs text-muted-foreground/70">{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setOpen(query.trim().length > 0)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={INPUT_CLASS}
        />
        {open && query.trim().length >= 2 && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-sm border border-border bg-card shadow-lg">
            {status === 'loading' && <li className={STATUS_CLASS}>Searching…</li>}
            {status === 'error' && (
              <li className={STATUS_CLASS}>Couldn&apos;t load suggestions. You can still enter a custom location.</li>
            )}
            {status === 'success' && suggestions.length === 0 && <li className={STATUS_CLASS}>No matches.</li>}
            {status !== 'loading' &&
              items.map((item, index) => {
                const key = item.kind === 'suggestion' ? (item.location.placeId ?? item.location.label) : `custom:${item.label}`;
                const displayLabel = item.kind === 'suggestion' ? item.location.label : `Use "${item.label}"`;
                return (
                  <li key={key} role="option" aria-selected={index === highlightedIndex}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commitItem(item)}
                      className={`${OPTION_CLASS} ${index === highlightedIndex ? 'bg-foreground/5' : ''}`}
                    >
                      {displayLabel}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </label>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/LocationAutocomplete.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/LocationAutocomplete.tsx __tests__/LocationAutocomplete.test.tsx
git commit -m "feat(location): add LocationAutocomplete combobox component"
```

---

### Task 7: Wire `LocationAutocomplete` into `/setup`

**Files:**
- Modify: `src/app/setup/page.tsx:1-16` (imports), `:582-583` (state), `:716-755` (`saveInitialFoundationAnswers`), `:796-823` (sessionStorage payload), `:972-991` (identity step JSX), `:1076-1094` (relationships step JSX)

**Interfaces:**
- Consumes: `LocationAutocomplete` (Task 6), `StructuredLocation`, `createCustomLocation` (Task 2).
- Produces: no new exports — this task only changes internal page state/JSX. The `/api/setup` and `/api/foundation` request shapes are unchanged.

- [ ] **Step 1: Update imports and state**

In `src/app/setup/page.tsx`, add the import (after the existing `foundation-growth` import at line 16):

```ts
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { createCustomLocation, type StructuredLocation } from '@/lib/location';
```

Replace the two location `useState` lines (currently at lines 582-583):

```ts
const [birthplace, setBirthplace] = useState('');
const [childhoodPlace, setChildhoodPlace] = useState('');
```

with:

```ts
const [birthplace, setBirthplace] = useState<StructuredLocation | null>(null);
const [childhoodPlace, setChildhoodPlace] = useState<StructuredLocation | null>(null);
const [homeLocation, setHomeLocation] = useState<StructuredLocation | null>(null);
const [familyLocationDrafts, setFamilyLocationDrafts] = useState<FamilyLocationDraft[]>([]);
```

Add the `FamilyLocationDraft` interface next to the existing `ChildDraft` interface (near line 92):

```ts
interface FamilyLocationDraft {
  localId:  string;
  location: StructuredLocation | null;
}
```

- [ ] **Step 2: Update `saveInitialFoundationAnswers`**

Replace the `rootsParts` and `heritageParts` blocks inside `saveInitialFoundationAnswers` (currently lines 718-727):

```ts
const rootsParts = [
  familyCallName.trim() ? `What family members call me: ${familyCallName.trim()}` : '',
  ownerBirthDateTouched ? `Date of birth: ${datePartsToIso(ownerBirthDate)}` : '',
  birthplace ? `Birthplace: ${birthplace.label}` : '',
  childhoodPlace ? `Where I spent most of my childhood: ${childhoodPlace.label}` : '',
  homeLocation ? `Where I consider home: ${homeLocation.label}` : '',
].filter(Boolean);
const heritageParts = [
  parentFigures.trim() ? `Parents or parental figures: ${parentFigures.trim()}` : '',
  olderFamilyMembers.trim() ? `Grandparents or older family members: ${olderFamilyMembers.trim()}` : '',
  familyLocationDrafts.some((d) => d.location)
    ? `Important family locations: ${familyLocationDrafts
        .map((d) => d.location)
        .filter((l): l is StructuredLocation => l !== null)
        .map((l) => l.label)
        .join(', ')}`
    : '',
].filter(Boolean);
```

- [ ] **Step 3: Update the `sessionStorage` payload**

Replace the object passed to `window.sessionStorage.setItem('breadcrumbs_onboarding_context', ...)` (currently lines 798-819):

```ts
window.sessionStorage.setItem(
  'breadcrumbs_onboarding_context',
  JSON.stringify({
    role: roleChoice.label,
    familyCallName: familyCallName.trim() || undefined,
    ownerBirthDate: ownerBirthDateTouched ? datePartsToIso(ownerBirthDate) : undefined,
    birthplace: birthplace?.label || undefined,
    birthplaceLocation: birthplace ?? undefined,
    childhoodPlace: childhoodPlace?.label || undefined,
    childhoodPlaceLocation: childhoodPlace ?? undefined,
    homeLocation: homeLocation ?? undefined,
    familyLocations: familyLocationDrafts
      .map((d) => d.location)
      .filter((l): l is StructuredLocation => l !== null),
    children: children
      .filter((child) => child.name.trim())
      .map((child) => ({
        name: child.name.trim(),
        birthDate: child.birthDateTouched ? datePartsToIso(child.birthDate) : undefined,
      })),
    parentFigures: parseNameList(parentFigures),
    olderFamilyMembers: parseNameList(olderFamilyMembers),
    coreValues: [...coreValues, customValue.trim()].filter(Boolean),
    whyLeaving,
    learnFrom,
    foundationSaveModes,
    contributeNow,
    recipientAccess,
  }),
);
```

- [ ] **Step 4: Replace the identity-step location inputs**

In the `identity` step JSX, replace the three `<label>` blocks for birthplace, childhood place (currently lines 972-991) — leave the "What family members call you" and "Date of birth" fields above and the "Family name" field below untouched — with:

```tsx
<LocationAutocomplete
  label="Birthplace"
  placeholder="e.g. Port-au-Prince, Haiti"
  value={birthplace}
  onChange={setBirthplace}
/>
<LocationAutocomplete
  label="Where you spent most of your childhood"
  placeholder="e.g. Brooklyn, around my grandparents' house"
  value={childhoodPlace}
  onChange={setChildhoodPlace}
/>
<LocationAutocomplete
  label="Where you consider home, optional"
  placeholder="e.g. Miami, where my kids grew up"
  value={homeLocation}
  onChange={setHomeLocation}
/>
```

- [ ] **Step 5: Add the repeatable family-locations list to the relationships step**

In the `relationships` step JSX, immediately after the "Grandparents or older family members, if known" `<label>` block (ends around line 1094, right before the closing `</div>` of the `space-y-4` container), insert:

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between gap-4">
    <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
      Important family locations, optional
    </p>
    <button
      type="button"
      onClick={() =>
        setFamilyLocationDrafts((prev) => [...prev, { localId: nextLocalId(), location: null }])
      }
      className="min-h-[44px] rounded-sm px-3 text-xs text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
    >
      Add a location
    </button>
  </div>
  {familyLocationDrafts.length === 0 ? (
    <div className="rounded-sm border border-border bg-card px-4 py-4">
      <p className="text-sm text-foreground">No family locations added yet.</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Add places that matter to your family story — a homeland, a homestead, where relatives gathered.
      </p>
    </div>
  ) : (
    <div className="space-y-3">
      {familyLocationDrafts.map((draft, index) => (
        <div key={draft.localId} className="flex items-end gap-2">
          <div className="flex-1">
            <LocationAutocomplete
              label={`Family location ${index + 1}`}
              placeholder="e.g. Cap-Haïtien, Haiti"
              value={draft.location}
              onChange={(location) =>
                setFamilyLocationDrafts((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, location } : item)),
                )
              }
            />
          </div>
          <button
            type="button"
            onClick={() => setFamilyLocationDrafts((prev) => prev.filter((_, i) => i !== index))}
            aria-label="Remove family location"
            className="min-h-[48px] min-w-[48px] rounded-sm border border-border text-muted-foreground transition hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            x
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Type-check and lint the modified file**

Run:
```bash
npx tsc --noEmit
npm run lint
```
Expected: No errors. (`createCustomLocation` is imported but only used inside `LocationAutocomplete.tsx`/hook, not directly in `page.tsx` — if `npx tsc --noEmit` or ESLint flags it as an unused import in `page.tsx`, remove that half of the import there, keeping only `type StructuredLocation`.)

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, open `http://127.0.0.1:3000/setup`, click through to the identity step, type a few characters into "Birthplace" and confirm suggestions render (or, with no `GEOAPIFY_API_KEY` set locally, confirm typing still lets you tab/click away and the value is retained as a custom entry — no console errors, no black-on-black text).

- [ ] **Step 8: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat(setup): wire LocationAutocomplete into birthplace, home, and family-location fields"
```

---

### Task 8: Final validation

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: All tests pass, including the 6 new test files from Tasks 2-6.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No errors (`--max-warnings=0`).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Confirm `next-env.d.ts` has no incidental churn**

Run: `git status --porcelain next-env.d.ts`
Expected: No output (file untouched), or if Next.js regenerated it as part of `npm run build`, run `git checkout -- next-env.d.ts` to discard the incidental regeneration before committing anything else.

- [ ] **Step 5: Smoke-check the route**

Run:
```bash
npm run dev &
sleep 3
curl -I --max-time 10 http://127.0.0.1:3000/setup
kill %1
```
Expected: `HTTP/1.1 200 OK` (or a redirect to `/login` if unauthenticated — either is a successful response, not a timeout or 5xx).

- [ ] **Step 6: Note the optional env var**

`GEOAPIFY_API_KEY` is a new optional server-only env var. It is not in `REQUIRED` in `src/lib/env.ts` and there is no `.env.example` file in this repo to update — mention in the PR description that adding `GEOAPIFY_API_KEY` to `.env.local` (and to Netlify/Vercel env vars in production) enables live suggestions; without it, users get graceful custom-entry-only behavior.

---

## Self-Review Notes

- **Spec coverage:** dynamic suggestions (Task 6), keyboard nav (Task 5/6), touch/mouse selection (Task 6, `onClick` + `onMouseDown` preventDefault), custom entry (Task 2/5/6), no static city list (Task 3 calls a live API), structured type with all 11 fields (Task 2), reusable component (Task 6), provider-backed route (Task 4), graceful degradation without a key (Task 4), debounce + abort (Task 5), loading/empty/error/custom states (Task 6), unchanged `/api/setup`/`/api/foundation` contracts + structured data in sessionStorage only (Task 7).
- **Type consistency checked:** `StructuredLocation` (Task 2) is the single source of truth referenced identically in `location-provider.ts`, `useLocationAutocomplete.ts`, `LocationAutocomplete.tsx`, and `setup/page.tsx`. `LocationListItem` is defined once (Task 5) and consumed only in Task 6.
- **No placeholders:** every step above contains complete, runnable code.
