export interface StructuredLocation {
  label: string;
  placeId: string | null;
  provider: 'geoapify' | 'custom';
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  raw: Record<string, unknown> | null;
  isCustom: boolean;
}

export function customLocation(label: string): StructuredLocation {
  return {
    label,
    placeId: null,
    provider: 'custom',
    latitude: null,
    longitude: null,
    city: null,
    region: null,
    country: null,
    countryCode: null,
    raw: null,
    isCustom: true,
  };
}
