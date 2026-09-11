import { NextRequest, NextResponse } from 'next/server';
import type { StructuredLocation } from '@/lib/location';

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;

interface GeoapifyResult {
  formatted?: string;
  place_id?: string;
  lat?: number;
  lon?: number;
  city?: string;
  town?: string;
  state?: string;
  country?: string;
  country_code?: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!GEOAPIFY_KEY) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', q);
    url.searchParams.set('limit', '6');
    url.searchParams.set('type', 'city');
    url.searchParams.set('format', 'json');
    url.searchParams.set('apiKey', GEOAPIFY_KEY);

    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4_000),
    });

    if (!upstream.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await upstream.json() as { results?: GeoapifyResult[] };

    const results: StructuredLocation[] = (data.results ?? []).map((item) => ({
      label: item.formatted ?? q,
      placeId: item.place_id ?? null,
      provider: 'geoapify',
      latitude: item.lat ?? null,
      longitude: item.lon ?? null,
      city: item.city ?? item.town ?? null,
      region: item.state ?? null,
      country: item.country ?? null,
      countryCode: item.country_code ?? null,
      raw: item as Record<string, unknown>,
      isCustom: false,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
