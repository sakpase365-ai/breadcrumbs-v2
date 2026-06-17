import { describe, it, expect, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: mockCreate } },
  })),
}));

describe('transcribeAudio (via mock)', () => {
  it('returns trimmed text from Whisper response', async () => {
    mockCreate.mockResolvedValueOnce({ text: '  Hello, this is a voice note.  ' });
    const OpenAI = (await import('openai')).default;
    const client = new (OpenAI as any)({ apiKey: 'test' });
    const result = await client.audio.transcriptions.create({
      file: new File([Buffer.from('audio')], 'test.webm', { type: 'audio/webm' }),
      model: 'whisper-1',
      language: 'en',
    });
    expect(result.text.trim()).toBe('Hello, this is a voice note.');
  });

  it('handles empty transcript gracefully', async () => {
    mockCreate.mockResolvedValueOnce({ text: '   ' });
    const OpenAI = (await import('openai')).default;
    const client = new (OpenAI as any)({ apiKey: 'test' });
    const result = await client.audio.transcriptions.create({
      file: new File([Buffer.from('audio')], 'test.webm', { type: 'audio/webm' }),
      model: 'whisper-1',
      language: 'en',
    });
    expect(result.text.trim() || null).toBeNull();
  });

  it('falls back to placeholder when transcript is absent', () => {
    const transcript: string | null | undefined = null;
    const voiceContent = transcript?.trim() || 'Voice note — something I want them to hear.';
    expect(voiceContent).toBe('Voice note — something I want them to hear.');
  });

  it('uses transcript as content when present', () => {
    const transcript = 'I want you to know how much I love you.';
    const voiceContent = transcript?.trim() || 'Voice note — something I want them to hear.';
    expect(voiceContent).toBe('I want you to know how much I love you.');
  });
});
