export function firstName(name?: string | null, fallback = 'your loved one'): string {
  const clean = name?.trim();
  if (!clean) return fallback;
  return clean.split(/\s+/)[0];
}
