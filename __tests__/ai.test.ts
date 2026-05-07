import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist the mock function so it's available inside the factory
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Import after mocking so the module-level `client` uses the mock
import {
  tagEntry,
  FALLBACK_PROMPTS,
  pickFallbackPrompt,
  FAMILY_AGENT_SYSTEM,
  answerFamilyQuestion,
  normalizeQuestion,
} from '../src/lib/ai';
import type { FamilyAgentContext } from '../src/lib/family-agent-context';

describe('tagEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns safe defaults when AI returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'not valid json at all' }] });

    const result = await tagEntry('A letter to my child.', 8);

    expect(result.domain).toBe('identity');
    expect(result.deliveryType).toBe('evergreen');
    expect(result.relevantAge).toBe(18);
    expect(result.summary).toBe('');
  });

  it('whitelists domain — rejects invalid value to identity', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({
          domain: 'cooking',           // not a valid domain
          relevantAge: 16,
          deliveryType: 'evergreen',
          summary: 'A letter.',
        }),
      }],
    });

    const result = await tagEntry('About cooking.', 8);
    expect(result.domain).toBe('identity');
  });

  it('passes through a valid domain', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({
          domain: 'finances',
          relevantAge: 22,
          deliveryType: 'age-locked',
          summary: 'Lesson about money.',
        }),
      }],
    });

    const result = await tagEntry('About saving money.', 8);
    expect(result.domain).toBe('finances');
    expect(result.deliveryType).toBe('age-locked');
  });

  it('whitelists deliveryType — rejects invalid value to evergreen', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({
          domain: 'resilience',
          relevantAge: 18,
          deliveryType: 'birthday',   // not valid
          summary: 'Lesson about resilience.',
        }),
      }],
    });

    const result = await tagEntry('About hard times.', 10);
    expect(result.deliveryType).toBe('evergreen');
  });

  it('clamps relevantAge below 0 to 0', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'health', relevantAge: -5, deliveryType: 'evergreen', summary: 'Health.' }),
      }],
    });

    const result = await tagEntry('About health.', 5);
    expect(result.relevantAge).toBe(0);
  });

  it('clamps relevantAge above 100 to 100', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'health', relevantAge: 200, deliveryType: 'evergreen', summary: 'Health.' }),
      }],
    });

    const result = await tagEntry('About health.', 5);
    expect(result.relevantAge).toBe(100);
  });

  it('truncates summary longer than 200 chars', async () => {
    const longSummary = 'A'.repeat(300);
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'identity', relevantAge: 18, deliveryType: 'evergreen', summary: longSummary }),
      }],
    });

    const result = await tagEntry('Some content.', 8);
    expect(result.summary.length).toBe(200);
  });

  it('uses 18 as relevantAge fallback when AI returns non-numeric', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'career', relevantAge: 'adulthood', deliveryType: 'milestone', summary: 'Career.' }),
      }],
    });

    const result = await tagEntry('About work.', 10);
    expect(result.relevantAge).toBe(18);
  });
});

// ── normalizeQuestion ─────────────────────────────────────────────

describe('normalizeQuestion', () => {
  it('converts "What would my dad say about X" to direct ask', () => {
    expect(normalizeQuestion('What would my dad say about commitment working in a career'))
      .toBe('Tell me about commitment working in a career.');
  });

  it('converts "What would [name] say about X?" (with question mark)', () => {
    expect(normalizeQuestion('What would Marcus say about handling failure?'))
      .toBe('Tell me about handling failure.');
  });

  it('converts "What does [X] think about Y"', () => {
    expect(normalizeQuestion('What does my father think about money'))
      .toBe('Tell me what you think about money.');
  });

  it('converts "What would [X] want me to know about Y"', () => {
    expect(normalizeQuestion('What would my mom want me to know about relationships?'))
      .toBe('Tell me what you want me to know about relationships.');
  });

  it('converts "What would [X] advise about Y"', () => {
    expect(normalizeQuestion('What would my dad advise about starting a business'))
      .toBe('Tell me your advice about starting a business.');
  });

  it('passes through questions that are already direct', () => {
    expect(normalizeQuestion('Tell me about faith.'))
      .toBe('Tell me about faith.');
  });

  it('passes through questions with no third-person frame', () => {
    expect(normalizeQuestion('How should I handle failure?'))
      .toBe('How should I handle failure?');
  });

  it('trims whitespace', () => {
    expect(normalizeQuestion('  What would dad say about love  '))
      .toBe('Tell me about love.');
  });
});

// ── FAMILY_AGENT_SYSTEM voice contract ────────────────────────────

describe('FAMILY_AGENT_SYSTEM', () => {
  it('instructs first-person speaker voice', () => {
    expect(FAMILY_AGENT_SYSTEM).toContain('first person');
    expect(FAMILY_AGENT_SYSTEM).toContain('I want you to');
    expect(FAMILY_AGENT_SYSTEM).toContain('I believe');
  });

  it('explicitly prohibits third-person parent references', () => {
    expect(FAMILY_AGENT_SYSTEM).toContain('your dad');
    expect(FAMILY_AGENT_SYSTEM).toContain('your father');
    expect(FAMILY_AGENT_SYSTEM).toContain('he wrote');
    expect(FAMILY_AGENT_SYSTEM).toContain('she believes');
    expect(FAMILY_AGENT_SYSTEM).toContain('for him');
    expect(FAMILY_AGENT_SYSTEM).toContain('for her');
  });

  it('explicitly prohibits source-summary language', () => {
    expect(FAMILY_AGENT_SYSTEM).toContain('based on');
    expect(FAMILY_AGENT_SYSTEM).toContain('according to');
    expect(FAMILY_AGENT_SYSTEM).toContain('Family Foundation');
    expect(FAMILY_AGENT_SYSTEM).toContain('saved breadcrumbs');
  });

  it('instructs the AI to read the SPEAKER block', () => {
    expect(FAMILY_AGENT_SYSTEM).toContain('SPEAKER');
  });

  it('instructs the AI to address the recipient directly', () => {
    expect(FAMILY_AGENT_SYSTEM).toContain('RECIPIENT');
  });
});

// ── answerFamilyQuestion voice call ───────────────────────────────

const MOCK_FAMILY_CTX: FamilyAgentContext = {
  ownerName:            'Marcus',
  ownerRole:            'father',
  ownerCustomRoleLabel: null,
  familyName:           'The Johnson Family',
  profileNotFound:      false,
  familyProfileContext: [{ category: 'core_values', content: 'Faith above all.' }],
  recipientContext:     { id: 'mid-1', name: 'Cairo', role: 'son', age: 16 },
  relevantBreadcrumbs:  [],
  familyValues:         ['Faith'],
  contextSources:       [],
  warnings:             [],
};

describe('answerFamilyQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes FAMILY_AGENT_SYSTEM as the system prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Cairo, I want you to know that faith matters.' }],
    });

    await answerFamilyQuestion(MOCK_FAMILY_CTX, 'What does Dad say about faith?');

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toBe(FAMILY_AGENT_SYSTEM);
  });

  it('includes SPEAKER block in the user message', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Cairo, I believe faith is the foundation.' }],
    });

    await answerFamilyQuestion(MOCK_FAMILY_CTX, 'What does Dad say about faith?');

    const call = mockCreate.mock.calls[0][0];
    const userContent: string = call.messages[0].content;
    expect(userContent).toContain('SPEAKER');
    expect(userContent).toContain('Name: Marcus');
    expect(userContent).toContain('Role: father');
  });

  it('includes RECIPIENT block when recipientContext is present', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Cairo, I want you to understand something.' }],
    });

    await answerFamilyQuestion(MOCK_FAMILY_CTX, 'What should I know about faith?');

    const call = mockCreate.mock.calls[0][0];
    const userContent: string = call.messages[0].content;
    expect(userContent).toContain('RECIPIENT');
    expect(userContent).toContain('Cairo');
    expect(userContent).toContain('son');
  });

  it('wraps the normalized question in <question> tags', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'My son, I want you to know this.' }],
    });

    await answerFamilyQuestion(MOCK_FAMILY_CTX, 'Tell me about faith.');

    const call = mockCreate.mock.calls[0][0];
    const userContent: string = call.messages[0].content;
    expect(userContent).toContain('<question>');
    expect(userContent).toContain('faith');
  });

  it('normalizes third-person question frames before sending to AI', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'Cairo, I believe faith is everything.' }],
    });

    await answerFamilyQuestion(MOCK_FAMILY_CTX, 'What would my dad say about faith?');

    const call = mockCreate.mock.calls[0][0];
    const userContent: string = call.messages[0].content;
    // "What would my dad say about faith?" → "Tell me about faith."
    expect(userContent).toMatch(/<question>Tell me about faith\.<\/question>/);
    expect(userContent).not.toContain('What would my dad say');
  });

  it('returns the AI response text trimmed', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: '  Cairo, I believe this deeply.  ' }],
    });

    const result = await answerFamilyQuestion(MOCK_FAMILY_CTX, 'What about faith?');
    expect(result).toBe('Cairo, I believe this deeply.');
  });

  it('repairs third-person source-summary answers before returning them', async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [{ text: 'Based on what your dad has shared, he would tell you to keep going.' }],
      })
      .mockResolvedValueOnce({
        content: [{ text: 'Cairo, I want you to keep going, even when it feels unseen.' }],
      });

    const result = await answerFamilyQuestion(MOCK_FAMILY_CTX, 'What would my dad say about commitment?');

    expect(result).toBe('Cairo, I want you to keep going, even when it feels unseen.');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('<draft>');
  });
});

// ── FALLBACK_PROMPTS ──────────────────────────────────────────────

describe('FALLBACK_PROMPTS', () => {
  it('contains a large pool of prompts for offline variety', () => {
    expect(FALLBACK_PROMPTS.length).toBeGreaterThanOrEqual(35);
  });

  it('all prompts are non-empty strings', () => {
    for (const p of FALLBACK_PROMPTS) {
      expect(typeof p).toBe('string');
      expect(p.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('pickFallbackPrompt', () => {
  it('avoids an exact match when another fallback exists', () => {
    const avoid = FALLBACK_PROMPTS[0];
    const picked = pickFallbackPrompt([avoid]);
    expect(FALLBACK_PROMPTS).toContain(picked);
    if (FALLBACK_PROMPTS.length > 1) {
      expect(picked).not.toBe(avoid);
    }
  });
});
