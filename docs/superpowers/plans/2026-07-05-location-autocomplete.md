# Location Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-text Birthplace and "Where you spent most of your childhood" inputs on `/setup` with a reusable `LocationAutocomplete` component backed by a real (optional) geocoding provider, without changing the `/api/setup` or `/api/foundation` contracts.

**Architecture:** A server-side adapter (`src/lib/location-provider.ts`) normalizes results from whichever provider is configured via env vars (Mapbox or Geoapify) into a typed `StructuredLocation`. A thin authenticated, rate-limited API route (`/api/location-search`) proxies to that adapter. A client component (`LocationAutocomplete`) debounces input, cancels stale requests, and renders a combobox with loading/empty/error/custom-entry states. When no provider key is configured, the route reports that once and the component silently stops calling it — the field behaves exactly like today's plain input for the rest of its lifetime. `/setup` keeps its existing `birthplace`/`childhoodPlace` string state (fed by `location.label`) and gains two new `StructuredLocation | null` state slots that ride along in the existing `sessionStorage` onboarding-context blob only.

**Tech Stack:** Next.js 16 App Router route handlers, React 18 client component, Vitest (node environment, no DOM test runner available in this repo).

## Global Constraints

- Do not change the request/response shape of `POST /api/setup` or `GET|POST /api/foundation` — both already covered by existing tests and consumed by `src/app/setup/page.tsx`.
- Do not add a database migration. Structured location data is session/onboarding-context only (`sessionStorage` key `breadcrumbs_onboarding_context`), never sent to `/api/setup` or `/api/foundation`.
- Do not add a hardcoded city list. Suggestions must come from a real provider adapter; absence of a provider key must degrade to custom free-text entry, never block onboarding.
- Debounce provider requests by 300ms; cancel the in-flight request (`AbortController`) whenever the query changes or the component unmounts.
- Only wire `LocationAutocomplete` into the two fields that exist today (Birthplace, "Where you spent most of your childhood"). Do not add "Where you consider home" or "Important family locations" as new fields/screens — confirmed with the user, out of scope for this change. Build the component generically so those fields can be added later.
- Visual parity: reuse the existing input styling tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `rounded-sm`) already defined against `#171516` background / `#F5F0E8` foreground in `src/app/globals.css`. Never render text at a contrast that produces black-on-black.
- This repo's Vitest config runs in `environment: 'node'` with no `jsdom`/`@testing-library/react` installed (`vitest.config.ts`, `package.json`). Do not add that dependency for this change — extract pure, DOM-free logic (keyboard nav index math, provider response mapping) into testable modules instead, and verify the component itself manually in a browser.
- Follow existing API route conventions: `getSessionClient()` + `session` check → 401 if missing, `checkRateLimit()` keyed by `session.user.id`, `logger` from `@/lib/logger` for the error path (see `src/app/api/generate-prompt/route.ts`). Do not call `assertEnv()` in the new route — its required-var list does not include location provider keys, and `/setup` runs before a `users` row exists so `resolveFamilyAccess()` must not be used here.
- Validation gate for the whole plan: `npm run lint`, `npm run test`, `npm run build`, `curl -I --max-time 10 http://127.0.0.1:3000/setup` against the dev server, and confirm `git diff` shows no unrelated changes to `next-env.d.ts`.

---

### Task 1: `StructuredLocation` type and custom-entry factory

**Files:**
- Create: `src/lib/location-types.ts`
- Test: `__tests__/location-types.test.ts`

**Interfaces:**
- Produces: `type LocationProviderId = 'mapbox' | 'geoapify' | 'custom'`; `interface StructuredLocation { label: string; placeId: string; provider: LocationProviderId; latitude: number | null; longitude: number | null; city: string | null; region: string | null; country: string | null; countryCode: string | null; raw: unknown; isCustom: boolean }`; `function createCustomLocation(label: string): StructuredLocation`.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/location-types.test.ts
import { describe, it, expect } from 'vitest';
import { createCustomLocation } from '../src/lib/location-types';

describe('createCustomLocation', () => {
  it('builds a custom StructuredLocation from a trimmed label', () => {
    const location = createCustomLocation('  Port-au-Prince, Haiti  ');
    expect(location).toEqual({
      label:       'Port-au-Prince, Haiti',
      placeId:     'custom:port-au-prince,-haiti',
      provider:    'custom',
      latitude:    null,
      longitude:   null,
      city:        null,
      region:      null,
      country:     null,
      countryCode: null,
      raw:         null,
      isCustom:    true,
    });
  });

  it('lowercases and dashes the placeId consistently for the same label', () => {
    const a = createCustomLocation('Brooklyn');
    const b = createCustomLocation('brooklyn');
    expect(a.placeId).toBe(b.placeId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location-types.test.ts`
Expected: FAIL with `Cannot find module '../src/lib/location-types'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/location-types.ts
export type LocationProviderId = 'mapbox' | 'geoapify' | 'custom';

export interface StructuredLocation {
  label:       string;
  placeId:     string;
  provider:    LocationProviderId;
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
  const trimmed = label.trim();
  return {
    label:       trimmed,
    placeId:     `custom:${trimmed.toLowerCase().replace(/\s+/g, '-')}`,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location-types.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/location-types.ts __tests__/location-types.test.ts
git commit -m "feat: add StructuredLocation type and custom-entry factory"
```

---

### Task 2: Provider adapter (Mapbox + Geoapify, env-selected)

**Files:**
- Create: `src/lib/location-provider.ts`
- Test: `__tests__/location-provider.test.ts`

**Interfaces:**
- Consumes: `StructuredLocation`, `LocationProviderId` from `src/lib/location-types.ts` (Task 1).
- Produces: `class LocationProviderNotConfiguredError extends Error`; `class LocationProviderError extends Error`; `function getConfiguredProvider(): LocationProviderId | null` (returns `'mapbox' | 'geoapify'`, never `'custom'`); `function mapMapboxFeatureToStructuredLocation(feature): StructuredLocation`; `function mapGeoapifyFeatureToStructuredLocation(feature): StructuredLocation`; `async function searchLocations(query: string): Promise<StructuredLocation[]>` — throws `LocationProviderNotConfiguredError` when no key is set, throws `LocationProviderError` on a non-OK provider response, otherwise resolves the mapped array. Consumed by Task 4's API route.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/location-provider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getConfiguredProvider,
  mapMapboxFeatureToStructuredLocation,
  mapGeoapifyFeatureToStructuredLocation,
  searchLocations,
  LocationProviderNotConfiguredError,
  LocationProviderError,
} from '../src/lib/location-provider';

describe('getConfiguredProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when no provider env vars are set', () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    vi.stubEnv('LOCATION_PROVIDER', '');
    expect(getConfiguredProvider()).toBeNull();
  });

  it('returns mapbox when MAPBOX_ACCESS_TOKEN is set', () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'token-123');
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    expect(getConfiguredProvider()).toBe('mapbox');
  });

  it('returns geoapify when only GEOAPIFY_API_KEY is set', () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('GEOAPIFY_API_KEY', 'key-456');
    expect(getConfiguredProvider()).toBe('geoapify');
  });

  it('honors an explicit LOCATION_PROVIDER override', () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'token-123');
    vi.stubEnv('GEOAPIFY_API_KEY', 'key-456');
    vi.stubEnv('LOCATION_PROVIDER', 'geoapify');
    expect(getConfiguredProvider()).toBe('geoapify');
  });
});

describe('mapMapboxFeatureToStructuredLocation', () => {
  it('maps a Mapbox geocoding feature into a StructuredLocation', () => {
    const feature = {
      id: 'place.123',
      place_name: 'Brooklyn, New York, United States',
      center: [-73.9442, 40.6782] as [number, number],
      text: 'Brooklyn',
      context: [
        { id: 'place.456', text: 'Brooklyn' },
        { id: 'region.789', text: 'New York' },
        { id: 'country.012', text: 'United States', short_code: 'us' },
      ],
    };
    expect(mapMapboxFeatureToStructuredLocation(feature)).toEqual({
      label:       'Brooklyn, New York, United States',
      placeId:     'place.123',
      provider:    'mapbox',
      latitude:    40.6782,
      longitude:   -73.9442,
      city:        'Brooklyn',
      region:      'New York',
      country:     'United States',
      countryCode: 'US',
      raw:         feature,
      isCustom:    false,
    });
  });
});

describe('mapGeoapifyFeatureToStructuredLocation', () => {
  it('maps a Geoapify feature into a StructuredLocation', () => {
    const feature = {
      properties: {
        place_id:     'geo-abc',
        formatted:    'Port-au-Prince, Haiti',
        lat:          18.5944,
        lon:          -72.3074,
        city:         'Port-au-Prince',
        state:        'Ouest',
        country:      'Haiti',
        country_code: 'ht',
      },
    };
    expect(mapGeoapifyFeatureToStructuredLocation(feature)).toEqual({
      label:       'Port-au-Prince, Haiti',
      placeId:     'geo-abc',
      provider:    'geoapify',
      latitude:    18.5944,
      longitude:   -72.3074,
      city:        'Port-au-Prince',
      region:      'Ouest',
      country:     'Haiti',
      countryCode: 'HT',
      raw:         feature,
      isCustom:    false,
    });
  });
});

describe('searchLocations', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('throws LocationProviderNotConfiguredError when no key is set', async () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', '');
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    await expect(searchLocations('Paris')).rejects.toBeInstanceOf(LocationProviderNotConfiguredError);
  });

  it('resolves mapped results when Mapbox is configured', async () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'token-123');
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          { id: 'place.1', place_name: 'Paris, France', center: [2.3522, 48.8566], text: 'Paris', context: [] },
        ],
      }),
    });
    const results = await searchLocations('Paris');
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Paris, France');
    expect(results[0].provider).toBe('mapbox');
  });

  it('throws LocationProviderError when the provider responds non-OK', async () => {
    vi.stubEnv('MAPBOX_ACCESS_TOKEN', 'token-123');
    vi.stubEnv('GEOAPIFY_API_KEY', '');
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });
    await expect(searchLocations('Paris')).rejects.toBeInstanceOf(LocationProviderError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location-provider.test.ts`
Expected: FAIL with `Cannot find module '../src/lib/location-provider'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/location-provider.ts
import type { LocationProviderId, StructuredLocation } from './location-types';

export class LocationProviderNotConfiguredError extends Error {
  constructor() {
    super('No location provider is configured.');
    this.name = 'LocationProviderNotConfiguredError';
  }
}

export class LocationProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationProviderError';
  }
}

export function getConfiguredProvider(): LocationProviderId | null {
  const explicit = process.env.LOCATION_PROVIDER?.toLowerCase();
  if (explicit === 'mapbox' || explicit === 'geoapify') return explicit;
  if (process.env.MAPBOX_ACCESS_TOKEN) return 'mapbox';
  if (process.env.GEOAPIFY_API_KEY) return 'geoapify';
  return null;
}

interface MapboxContextEntry {
  id: string;
  text: string;
  short_code?: string;
}

interface MapboxFeature {
  id:         string;
  place_name: string;
  center:     [number, number];
  text:       string;
  context?:   MapboxContextEntry[];
}

interface MapboxResponse {
  features: MapboxFeature[];
}

export function mapMapboxFeatureToStructuredLocation(feature: MapboxFeature): StructuredLocation {
  const context = feature.context ?? [];
  const findText = (prefix: string) => context.find((c) => c.id.startsWith(prefix))?.text ?? null;
  const countryEntry = context.find((c) => c.id.startsWith('country'));

  return {
    label:       feature.place_name,
    placeId:     feature.id,
    provider:    'mapbox',
    latitude:    feature.center?.[1] ?? null,
    longitude:   feature.center?.[0] ?? null,
    city:        findText('place') ?? findText('locality'),
    region:      findText('region'),
    country:     countryEntry?.text ?? null,
    countryCode: countryEntry?.short_code?.toUpperCase() ?? null,
    raw:         feature,
    isCustom:    false,
  };
}

async function searchMapbox(query: string): Promise<StructuredLocation[]> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) throw new LocationProviderNotConfiguredError();

  const params = new URLSearchParams({
    access_token: token,
    autocomplete: 'true',
    limit:        '6',
    types:        'place,locality,region,country',
  });
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new LocationProviderError(`Mapbox request failed with status ${res.status}`);

  const data = (await res.json()) as MapboxResponse;
  return (data.features ?? []).map(mapMapboxFeatureToStructuredLocation);
}

interface GeoapifyFeature {
  properties: {
    place_id:     string;
    formatted:    string;
    lat:          number;
    lon:          number;
    city?:        string;
    state?:       string;
    country?:     string;
    country_code?: string;
  };
}

interface GeoapifyResponse {
  features: GeoapifyFeature[];
}

export function mapGeoapifyFeatureToStructuredLocation(feature: GeoapifyFeature): StructuredLocation {
  const p = feature.properties;
  return {
    label:       p.formatted,
    placeId:     p.place_id,
    provider:    'geoapify',
    latitude:    p.lat ?? null,
    longitude:   p.lon ?? null,
    city:        p.city ?? null,
    region:      p.state ?? null,
    country:     p.country ?? null,
    countryCode: p.country_code?.toUpperCase() ?? null,
    raw:         feature,
    isCustom:    false,
  };
}

async function searchGeoapify(query: string): Promise<StructuredLocation[]> {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new LocationProviderNotConfiguredError();

  const params = new URLSearchParams({ text: query, apiKey: key, limit: '6' });
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new LocationProviderError(`Geoapify request failed with status ${res.status}`);

  const data = (await res.json()) as GeoapifyResponse;
  return (data.features ?? []).map(mapGeoapifyFeatureToStructuredLocation);
}

export async function searchLocations(query: string): Promise<StructuredLocation[]> {
  const provider = getConfiguredProvider();
  if (!provider) throw new LocationProviderNotConfiguredError();
  return provider === 'mapbox' ? searchMapbox(query) : searchGeoapify(query);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location-provider.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/location-provider.ts __tests__/location-provider.test.ts
git commit -m "feat: add Mapbox/Geoapify location provider adapter"
```

---

### Task 3: Pure keyboard-navigation index helper

**Files:**
- Create: `src/lib/location-keyboard-nav.ts`
- Test: `__tests__/location-keyboard-nav.test.ts`

**Interfaces:**
- Produces: `function nextHighlightIndex(current: number, key: 'ArrowDown' | 'ArrowUp', length: number): number`. Consumed by Task 5's `LocationAutocomplete` component. Index range is `-1` (nothing highlighted — the raw typed text is "selected") through `length - 1`.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/location-keyboard-nav.test.ts
import { describe, it, expect } from 'vitest';
import { nextHighlightIndex } from '../src/lib/location-keyboard-nav';

describe('nextHighlightIndex', () => {
  it('moves down from -1 to the first item', () => {
    expect(nextHighlightIndex(-1, 'ArrowDown', 3)).toBe(0);
  });

  it('clamps ArrowDown at the last index', () => {
    expect(nextHighlightIndex(2, 'ArrowDown', 3)).toBe(2);
  });

  it('moves up from the first item back to -1', () => {
    expect(nextHighlightIndex(0, 'ArrowUp', 3)).toBe(-1);
  });

  it('clamps ArrowUp at -1', () => {
    expect(nextHighlightIndex(-1, 'ArrowUp', 3)).toBe(-1);
  });

  it('returns -1 for an empty list regardless of key', () => {
    expect(nextHighlightIndex(-1, 'ArrowDown', 0)).toBe(-1);
    expect(nextHighlightIndex(0, 'ArrowUp', 0)).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location-keyboard-nav.test.ts`
Expected: FAIL with `Cannot find module '../src/lib/location-keyboard-nav'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/location-keyboard-nav.ts
export function nextHighlightIndex(
  current: number,
  key: 'ArrowDown' | 'ArrowUp',
  length: number,
): number {
  if (length <= 0) return -1;
  if (key === 'ArrowDown') return Math.min(current + 1, length - 1);
  return Math.max(current - 1, -1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location-keyboard-nav.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/location-keyboard-nav.ts __tests__/location-keyboard-nav.test.ts
git commit -m "feat: add pure combobox highlight-index helper"
```

---

### Task 4: `GET /api/location-search` route

**Files:**
- Create: `src/app/api/location-search/route.ts`
- Test: `__tests__/location-search-route.test.ts`

**Interfaces:**
- Consumes: `searchLocations`, `getConfiguredProvider`, `LocationProviderNotConfiguredError` from `src/lib/location-provider.ts` (Task 2); `getSessionClient` from `@/lib/supabase`; `checkRateLimit` from `@/lib/rate-limit`; `logger` from `@/lib/logger`.
- Produces: `GET` handler returning JSON `{ suggestions: StructuredLocation[]; providerConfigured: boolean; error?: string }` — 200 for all query/provider states (including "not configured"), 401 when unauthenticated, 429 when rate-limited, 502 when the provider call fails unexpectedly. Consumed by Task 5's `LocationAutocomplete` component via `fetch('/api/location-search?q=...')`.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/location-search-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 })),
}));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));
vi.mock('@/lib/location-provider', () => ({
  searchLocations:       vi.fn(),
  getConfiguredProvider: vi.fn(),
  LocationProviderNotConfiguredError: class LocationProviderNotConfiguredError extends Error {},
}));

import { GET } from '../src/app/api/location-search/route';
import { getSessionClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  searchLocations,
  getConfiguredProvider,
  LocationProviderNotConfiguredError,
} from '@/lib/location-provider';

const MOCK_SESSION = { user: { id: 'uid-1' } };

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/location-search${query}`);
}

function mockSession(session: unknown) {
  (getSessionClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
  });
}

describe('GET /api/location-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when there is no session', async () => {
    mockSession(null);
    const res = await GET(makeRequest('?q=Paris'));
    expect(res.status).toBe(401);
  });

  it('returns empty suggestions without calling the provider for short queries', async () => {
    mockSession(MOCK_SESSION);
    (getConfiguredProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue('mapbox');
    const res = await GET(makeRequest('?q=P'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ suggestions: [], providerConfigured: true });
    expect(searchLocations).not.toHaveBeenCalled();
  });

  it('returns providerConfigured:false without erroring when no provider is set', async () => {
    mockSession(MOCK_SESSION);
    (searchLocations as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new LocationProviderNotConfiguredError(),
    );
    const res = await GET(makeRequest('?q=Paris'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ suggestions: [], providerConfigured: false });
  });

  it('returns mapped suggestions on success', async () => {
    mockSession(MOCK_SESSION);
    const fakeResults = [{ label: 'Paris, France', placeId: 'p1' }];
    (searchLocations as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(fakeResults);
    const res = await GET(makeRequest('?q=Paris'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ suggestions: fakeResults, providerConfigured: true });
  });

  it('returns 502 when the provider call fails unexpectedly', async () => {
    mockSession(MOCK_SESSION);
    (searchLocations as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const res = await GET(makeRequest('?q=Paris'));
    expect(res.status).toBe(502);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(MOCK_SESSION);
    (checkRateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: false, remaining: 0, resetAt: Date.now() + 5_000,
    });
    const res = await GET(makeRequest('?q=Paris'));
    expect(res.status).toBe(429);
    expect(searchLocations).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/location-search-route.test.ts`
Expected: FAIL with `Cannot find module '../src/app/api/location-search/route'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/app/api/location-search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  searchLocations,
  getConfiguredProvider,
  LocationProviderNotConfiguredError,
} from '@/lib/location-provider';

const RATE_LIMIT       = 60;
const RATE_WINDOW_MS   = 60 * 1000;
const MIN_QUERY_LENGTH = 2;

export async function GET(req: NextRequest) {
  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, resetAt } = checkRateLimit(
    `location-search:${session.user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests', suggestions: [], providerConfigured: getConfiguredProvider() !== null },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } },
    );
  }

  const query = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200);

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [], providerConfigured: getConfiguredProvider() !== null });
  }

  try {
    const suggestions = await searchLocations(query);
    return NextResponse.json({ suggestions, providerConfigured: true });
  } catch (err) {
    if (err instanceof LocationProviderNotConfiguredError) {
      return NextResponse.json({ suggestions: [], providerConfigured: false });
    }
    logger.error('location search failed', {
      route: 'location-search GET',
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'location_search_failed', suggestions: [], providerConfigured: true },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/location-search-route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/location-search/route.ts __tests__/location-search-route.test.ts
git commit -m "feat: add authenticated /api/location-search proxy route"
```

---

### Task 5: `LocationAutocomplete` component

**Files:**
- Create: `src/components/LocationAutocomplete.tsx`

**Interfaces:**
- Consumes: `StructuredLocation`, `createCustomLocation` from `src/lib/location-types.ts` (Task 1); `nextHighlightIndex` from `src/lib/location-keyboard-nav.ts` (Task 3); fetches `GET /api/location-search?q=` (Task 4).
- Produces: `export default function LocationAutocomplete(props: { label: string; placeholder?: string; value: StructuredLocation | null; onChange: (location: StructuredLocation) => void }): JSX.Element`. Consumed by Task 6 (`src/app/setup/page.tsx`).

No automated test for this file per the Global Constraints (no DOM test runner in this repo). It is verified manually in Task 7's browser check.

- [ ] **Step 1: Write the component**

```tsx
// src/components/LocationAutocomplete.tsx
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createCustomLocation, type StructuredLocation } from '@/lib/location-types';
import { nextHighlightIndex } from '@/lib/location-keyboard-nav';

const INPUT_CLASS =
  'w-full min-h-[48px] bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground/60 focus:border-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 transition rounded-sm';

const DEBOUNCE_MS      = 300;
const MIN_QUERY_LENGTH = 2;

// Module-level: once any field learns no provider is configured, every
// LocationAutocomplete instance on the page stops calling the API and
// behaves like a plain text input for the rest of the session.
let providerAvailable = true;

interface LocationSearchResponse {
  suggestions:        StructuredLocation[];
  providerConfigured: boolean;
  error?:             string;
}

type Status = 'idle' | 'loading' | 'results' | 'empty' | 'error';

interface LocationAutocompleteProps {
  label:        string;
  placeholder?: string;
  value:        StructuredLocation | null;
  onChange:     (location: StructuredLocation) => void;
}

export default function LocationAutocomplete({
  label,
  placeholder,
  value,
  onChange,
}: LocationAutocompleteProps) {
  const listboxId = useId();
  const [query, setQuery] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [suggestions, setSuggestions] = useState<StructuredLocation[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const committedRef = useRef(true);

  useEffect(() => {
    setQuery(value?.label ?? '');
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function runSearch(nextQuery: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (nextQuery.trim().length < MIN_QUERY_LENGTH || !providerAvailable) {
      setStatus('idle');
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setStatus('loading');
        setOpen(true);

        try {
          const res = await fetch(`/api/location-search?q=${encodeURIComponent(nextQuery.trim())}`, {
            signal: controller.signal,
          });
          const data = (await res.json()) as LocationSearchResponse;

          if (!res.ok) {
            setStatus('error');
            setSuggestions([]);
            return;
          }
          if (!data.providerConfigured) {
            providerAvailable = false;
            setStatus('idle');
            setSuggestions([]);
            setOpen(false);
            return;
          }
          setSuggestions(data.suggestions);
          setStatus(data.suggestions.length > 0 ? 'results' : 'empty');
          setHighlightIndex(-1);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setStatus('error');
          setSuggestions([]);
        }
      })();
    }, DEBOUNCE_MS);
  }

  function commit(location: StructuredLocation) {
    committedRef.current = true;
    setQuery(location.label);
    setOpen(false);
    setSuggestions([]);
    setStatus('idle');
    setHighlightIndex(-1);
    onChange(location);
  }

  function commitCustomIfNeeded() {
    const trimmed = query.trim();
    if (!trimmed || trimmed === value?.label) return;
    commit(createCustomLocation(trimmed));
  }

  const customRowVisible = query.trim().length > 0;
  const rowCount = suggestions.length + (customRowVisible ? 1 : 0);

  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground/70">{label}</span>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            committedRef.current = false;
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              if (!committedRef.current) commitCustomIfNeeded();
            }, 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (!open && suggestions.length > 0) setOpen(true);
              setHighlightIndex((current) => nextHighlightIndex(current, e.key, rowCount));
            } else if (e.key === 'Enter') {
              if (open && highlightIndex >= 0) {
                e.preventDefault();
                if (highlightIndex < suggestions.length) {
                  commit(suggestions[highlightIndex]);
                } else {
                  commitCustomIfNeeded();
                }
              }
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className={INPUT_CLASS}
        />
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-border bg-card shadow-lg divide-y divide-border/60"
          >
            {status === 'loading' && (
              <li className="px-4 py-2.5 text-xs text-muted-foreground/70">Searching…</li>
            )}
            {status === 'error' && (
              <li className="px-4 py-2.5 text-xs text-muted-foreground/70">
                Couldn&apos;t reach location search. You can still type your own.
              </li>
            )}
            {status === 'empty' && (
              <li className="px-4 py-2.5 text-xs text-muted-foreground/70">No matches yet.</li>
            )}
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.placeId}
                role="option"
                aria-selected={index === highlightIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(suggestion);
                }}
                className={`px-4 py-2.5 text-sm cursor-pointer transition ${
                  index === highlightIndex ? 'bg-foreground/5 text-foreground' : 'text-foreground hover:bg-foreground/5'
                }`}
              >
                {suggestion.label}
              </li>
            ))}
            {customRowVisible && (
              <li
                role="option"
                aria-selected={highlightIndex === suggestions.length}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitCustomIfNeeded();
                }}
                className={`px-4 py-2.5 text-xs cursor-pointer transition ${
                  highlightIndex === suggestions.length
                    ? 'bg-foreground/5 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Use &quot;{query.trim()}&quot; as entered
              </li>
            )}
          </ul>
        )}
      </div>
    </label>
  );
}
```

- [ ] **Step 2: Typecheck and lint the new file**

Run: `npx tsc --noEmit` and `npx eslint src/components/LocationAutocomplete.tsx --max-warnings=0`
Expected: no errors from either command.

- [ ] **Step 3: Commit**

```bash
git add src/components/LocationAutocomplete.tsx
git commit -m "feat: add LocationAutocomplete combobox component"
```

---

### Task 6: Wire `LocationAutocomplete` into `/setup`

**Files:**
- Modify: `src/app/setup/page.tsx:1-16` (imports), `src/app/setup/page.tsx:582-583` (state), `src/app/setup/page.tsx:797-820` (sessionStorage payload), `src/app/setup/page.tsx:972-991` (Birthplace + childhood-place fields)

**Interfaces:**
- Consumes: `LocationAutocomplete` default export and `StructuredLocation` type from Task 5 / Task 1.

- [ ] **Step 1: Add imports**

In `src/app/setup/page.tsx`, after the existing `AnimatedWordmark` import (line 6):

```typescript
import AnimatedWordmark from '@/components/AnimatedWordmark';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import type { StructuredLocation } from '@/lib/location-types';
```

- [ ] **Step 2: Add structured-location state**

Replace:

```typescript
  const [birthplace, setBirthplace] = useState('');
  const [childhoodPlace, setChildhoodPlace] = useState('');
```

with:

```typescript
  const [birthplace, setBirthplace] = useState('');
  const [childhoodPlace, setChildhoodPlace] = useState('');
  const [birthplaceLocation, setBirthplaceLocation] = useState<StructuredLocation | null>(null);
  const [childhoodPlaceLocation, setChildhoodPlaceLocation] = useState<StructuredLocation | null>(null);
```

- [ ] **Step 3: Carry structured locations into the sessionStorage onboarding context**

Replace:

```typescript
            birthplace: birthplace.trim() || undefined,
            childhoodPlace: childhoodPlace.trim() || undefined,
```

with:

```typescript
            birthplace: birthplace.trim() || undefined,
            birthplaceLocation: birthplaceLocation ?? undefined,
            childhoodPlace: childhoodPlace.trim() || undefined,
            childhoodPlaceLocation: childhoodPlaceLocation ?? undefined,
```

(This is the only place structured location data is persisted. `/api/setup` and `/api/foundation` payloads below are untouched and keep sending the plain `birthplace`/`childhoodPlace` strings exactly as before.)

- [ ] **Step 4: Replace the Birthplace field**

Replace:

```tsx
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground/70">Birthplace</span>
                <input
                  type="text"
                  placeholder="e.g. Port-au-Prince, Haiti"
                  value={birthplace}
                  onChange={(e) => setBirthplace(e.target.value)}
                  className={INPUT}
                />
              </label>
```

with:

```tsx
              <LocationAutocomplete
                label="Birthplace"
                placeholder="e.g. Port-au-Prince, Haiti"
                value={birthplaceLocation}
                onChange={(location) => {
                  setBirthplaceLocation(location);
                  setBirthplace(location.label);
                }}
              />
```

- [ ] **Step 5: Replace the childhood-place field**

Replace:

```tsx
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground/70">Where you spent most of your childhood</span>
                <input
                  type="text"
                  placeholder="e.g. Brooklyn, around my grandparents' house"
                  value={childhoodPlace}
                  onChange={(e) => setChildhoodPlace(e.target.value)}
                  className={INPUT}
                />
              </label>
```

with:

```tsx
              <LocationAutocomplete
                label="Where you spent most of your childhood"
                placeholder="e.g. Brooklyn, around my grandparents' house"
                value={childhoodPlaceLocation}
                onChange={(location) => {
                  setChildhoodPlaceLocation(location);
                  setChildhoodPlace(location.label);
                }}
              />
```

- [ ] **Step 6: Run the full test suite (must still pass — no route contract changed)**

Run: `npm run test`
Expected: PASS, same test count as before plus the new suites from Tasks 1–4.

- [ ] **Step 7: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat: wire LocationAutocomplete into setup Birthplace and childhood fields"
```

---

### Task 7: Document optional provider env vars

**Files:**
- Modify: `.env.local.example`

**Interfaces:**
- None (documentation only). Read by `getConfiguredProvider()` from Task 2 at runtime.

- [ ] **Step 1: Add the optional block**

In `.env.local.example`, after the `# App` section at the end of the file, append:

```
# Location autocomplete (optional — onboarding falls back to free-text entry
# if none of these are set; do not commit a real key here)
# One of: mapbox | geoapify. Auto-detected from whichever key below is set if omitted.
LOCATION_PROVIDER=
MAPBOX_ACCESS_TOKEN=
GEOAPIFY_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "docs: document optional location provider env vars"
```

---

### Task 8: Full validation pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: exit code 0, no warnings (`--max-warnings=0` is already configured).

- [ ] **Step 2: Unit tests**

Run: `npm run test`
Expected: all suites pass, including the four new ones from Tasks 1–4.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Confirm no incidental next-env.d.ts churn**

Run: `git status --porcelain next-env.d.ts`
Expected: empty output. If Next.js regenerated it during the build, run `git checkout -- next-env.d.ts` to discard the incidental change before committing anything else.

- [ ] **Step 5: Start the dev server and smoke-test `/setup`**

Run: `npm run dev` (background), then `curl -I --max-time 10 http://127.0.0.1:3000/setup`
Expected: `HTTP/1.1 200 OK` (or the redirect Next.js issues when unauthenticated — confirm it is not a 5xx).

- [ ] **Step 6: Manual browser check (no provider key configured in this environment)**

Using the running dev server: open `/setup`, advance to "Step 2 — Name the family context," and for both Birthplace and "Where you spent most of your childhood":
- Type at least 2 characters and confirm no dropdown appears and no console errors are thrown (expected — no `MAPBOX_ACCESS_TOKEN`/`GEOAPIFY_API_KEY` is set in `.env.local`).
- Confirm the typed text is retained when tabbing to the next field and when clicking "Continue," i.e. the field still behaves like a normal text input end-to-end.
- Confirm no black-on-black text anywhere in the field or (if a key is later added) the dropdown.

This step cannot exercise live provider suggestions without a real API key; it verifies the required graceful-degradation path.

- [ ] **Step 7: Final commit (only if any of the above steps required a fix)**

```bash
git add -A
git commit -m "chore: validation fixups for location autocomplete"
```
