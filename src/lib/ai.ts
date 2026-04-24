import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_DOMAINS = ['relationships', 'finances', 'resilience', 'career', 'identity', 'faith', 'health'] as const;
const VALID_DELIVERY_TYPES = ['age-locked', 'milestone', 'evergreen'] as const;

export const FALLBACK_PROMPTS = [
  'What is something you learned the hard way that you want your child to know before they have to learn it themselves?',
  'Describe a moment when you were genuinely afraid, and what got you through it.',
  'What do you wish your own parents had told you before you turned 18?',
  'Tell your child about someone who shaped who you are — and what they gave you.',
  'What does money mean to you, and what do you want your child to understand about it?',
  'Describe a time you made a decision you are still proud of, even if it was hard.',
  'What does a good friendship look like to you? What took you longest to learn about it?',
  'Write about a place that made you feel like yourself. What was it about that place?',
  'When has someone close to you surprised you in a way that changed how you see them?',
  'What is something small from your everyday life that you never want them to forget?',
];

// ── Prompt generation ──────────────────────────────────────────
export async function generateDailyPrompt(context: {
  ownerName:         string;
  ownerRole?:        string;
  recipientName?:    string;
  recipientAge?:     number;
  recentTopics:      string[];
}): Promise<string> {
  const { ownerName, ownerRole, recipientName, recipientAge, recentTopics } = context;

  const writerDescription = ownerRole && ownerRole !== 'other'
    ? `${ownerRole} named ${ownerName}`
    : `person named ${ownerName}`;

  const recipientDescription = recipientName
    ? `${recipientName}${recipientAge != null ? `, who is currently ${recipientAge} years old` : ''}`
    : 'someone they love';

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are a thoughtful guide helping a ${writerDescription} write a meaningful letter to ${recipientDescription}.

Generate ONE short, specific, emotionally resonant writing prompt. The prompt should invite the writer to share a real memory, lesson, or piece of wisdom.

Rules:
- One prompt only — no lists, no options
- 1-2 sentences maximum
- Avoid these recently used topics: ${recentTopics.join(', ') || 'none'}
- Do not use the word "journey", "legacy", or "wisdom"
- Speak directly to the writer, not about them

Return only the prompt text. No preamble.`
    }],
  });

  return (msg.content[0] as { text: string }).text.trim();
}

// ── Entry tagging ──────────────────────────────────────────────
export async function tagEntry(content: string, recipientAge: number): Promise<{
  domain: string;
  relevantAge: number;
  deliveryType: 'age-locked' | 'milestone' | 'evergreen';
  summary: string;
}> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Analyze this written entry and return a JSON object with these fields:
- domain: one of [relationships, finances, resilience, career, identity, faith, health]
- relevantAge: the age (integer) at which this wisdom would be most useful to the recipient
- deliveryType: one of [age-locked, milestone, evergreen]
- summary: one sentence summary of the core lesson (max 20 words)

Entry: """${content}"""
Recipient's current age: ${recipientAge}

Return only valid JSON. No markdown, no explanation.`
    }],
  });

  const raw = (msg.content[0] as { text: string }).text.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { domain: 'identity', relevantAge: 18, deliveryType: 'evergreen' as const, summary: '' };
  }

  const domain = VALID_DOMAINS.includes(parsed.domain as typeof VALID_DOMAINS[number])
    ? (parsed.domain as typeof VALID_DOMAINS[number])
    : 'identity';

  const deliveryType = VALID_DELIVERY_TYPES.includes(parsed.deliveryType as typeof VALID_DELIVERY_TYPES[number])
    ? (parsed.deliveryType as typeof VALID_DELIVERY_TYPES[number])
    : 'evergreen';

  const rawAge = Number(parsed.relevantAge);
  const relevantAge = Number.isFinite(rawAge) ? Math.max(0, Math.min(100, Math.round(rawAge))) : 18;

  const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : '';

  return { domain, relevantAge, deliveryType, summary };
}

// ── Follow-up question ─────────────────────────────────────────
export async function generateFollowUp(entry: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `A person has written this entry: """${entry}"""

Ask ONE short follow-up question to draw out more specific detail or emotional depth.
One sentence only. No preamble. Make it feel like a trusted listener, not an interviewer.`
    }],
  });

  return (msg.content[0] as { text: string }).text.trim();
}
