export const PASSCODE_STORAGE_KEY = 'breadcrumbs_passcode_v1';
const PASSCODE_UNLOCK_KEY         = 'breadcrumbs_unlocked';

export interface PasscodeData {
  enabled: boolean;
  hash:    string;
  salt:    string;
}

/** PBKDF2-SHA256 key derivation — exported for testing. */
export async function deriveKeyBase64(pin: string, saltBytes: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes.buffer as ArrayBuffer, iterations: 100_000 },
    keyMaterial,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/** Hash a PIN with a fresh random salt. Returns { hash, salt } as base64 strings. */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt      = btoa(String.fromCharCode(...saltBytes));
  const hash      = await deriveKeyBase64(pin, saltBytes);
  return { hash, salt };
}

/** Verify a PIN against stored hash + salt. Returns true if correct. */
export async function verifyPinAgainstHash(pin: string, hash: string, salt: string): Promise<boolean> {
  if (!pin) return false;
  try {
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    const derived   = await deriveKeyBase64(pin, saltBytes);
    return derived === hash;
  } catch {
    return false;
  }
}

// ── localStorage helpers (browser-only) ──────────────────────

export function readPasscodeData(): PasscodeData {
  if (typeof window === 'undefined') return { enabled: false, hash: '', salt: '' };
  try {
    const raw = window.localStorage.getItem(PASSCODE_STORAGE_KEY);
    if (!raw) return { enabled: false, hash: '', salt: '' };
    const parsed = JSON.parse(raw) as PasscodeData;
    if (typeof parsed.enabled !== 'boolean' || !parsed.hash || !parsed.salt) {
      return { enabled: false, hash: '', salt: '' };
    }
    return parsed;
  } catch {
    return { enabled: false, hash: '', salt: '' };
  }
}

export async function savePasscode(pin: string): Promise<void> {
  const { hash, salt } = await hashPin(pin);
  const data: PasscodeData = { enabled: true, hash, salt };
  window.localStorage.setItem(PASSCODE_STORAGE_KEY, JSON.stringify(data));
}

export function disablePasscode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PASSCODE_STORAGE_KEY);
  window.sessionStorage.removeItem(PASSCODE_UNLOCK_KEY);
}

export async function verifyPasscode(pin: string): Promise<boolean> {
  const data = readPasscodeData();
  if (!data.enabled || !data.hash || !data.salt) return false;
  return verifyPinAgainstHash(pin, data.hash, data.salt);
}

// ── Session unlock tracking (sessionStorage) ─────────────────

export function isUnlockedThisSession(): boolean {
  if (typeof window === 'undefined') return true;
  return window.sessionStorage.getItem(PASSCODE_UNLOCK_KEY) === 'true';
}

export function markUnlocked(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PASSCODE_UNLOCK_KEY, 'true');
}
