/** Strips non-digits, returns E.164 for US numbers (+1XXXXXXXXXX), or null if invalid. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Expects E.164 input from normalizePhone. Returns +1 (XXX) ···-XXXX for US numbers, raw string otherwise. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ···-${digits.slice(7)}`;
  }
  return e164;
}
