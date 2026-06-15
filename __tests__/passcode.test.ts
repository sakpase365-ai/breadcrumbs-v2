import { describe, it, expect } from 'vitest';
import {
  deriveKeyBase64,
  hashPin,
  verifyPinAgainstHash,
} from '../src/lib/passcode';

describe('deriveKeyBase64', () => {
  it('returns a non-empty base64 string', async () => {
    const saltBytes = new Uint8Array(16).fill(1);
    const result = await deriveKeyBase64('1234', saltBytes);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the same output for the same input', async () => {
    const saltBytes = new Uint8Array(16).fill(7);
    const a = await deriveKeyBase64('9876', saltBytes);
    const b = await deriveKeyBase64('9876', saltBytes);
    expect(a).toBe(b);
  });

  it('returns different output for different PINs', async () => {
    const saltBytes = new Uint8Array(16).fill(3);
    const a = await deriveKeyBase64('1234', saltBytes);
    const b = await deriveKeyBase64('5678', saltBytes);
    expect(a).not.toBe(b);
  });

  it('returns different output for different salts', async () => {
    const salt1 = new Uint8Array(16).fill(1);
    const salt2 = new Uint8Array(16).fill(2);
    const a = await deriveKeyBase64('1234', salt1);
    const b = await deriveKeyBase64('1234', salt2);
    expect(a).not.toBe(b);
  });
});

describe('hashPin', () => {
  it('returns a hash and salt', async () => {
    const result = await hashPin('1234');
    expect(typeof result.hash).toBe('string');
    expect(typeof result.salt).toBe('string');
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.salt.length).toBeGreaterThan(0);
  });

  it('produces different salts on each call', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a.salt).not.toBe(b.salt);
  });
});

describe('verifyPinAgainstHash', () => {
  it('returns true for the correct PIN', async () => {
    const { hash, salt } = await hashPin('4567');
    const ok = await verifyPinAgainstHash('4567', hash, salt);
    expect(ok).toBe(true);
  });

  it('returns false for a wrong PIN', async () => {
    const { hash, salt } = await hashPin('4567');
    const ok = await verifyPinAgainstHash('9999', hash, salt);
    expect(ok).toBe(false);
  });

  it('returns false for empty PIN', async () => {
    const { hash, salt } = await hashPin('4567');
    const ok = await verifyPinAgainstHash('', hash, salt);
    expect(ok).toBe(false);
  });
});
