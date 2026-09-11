/**
 * Simplified capture UX: three intents only. Stored as public.breadcrumb_type.
 * Legacy rows may still use letter, story, advice, prayer, family_value, etc.
 */
export const CAPTURE_INTENT_OPTIONS = [
  {
    value:       'message',
    label:       'Message',
    description:
      'A direct note, encouragement, blessing, prayer, or something you want them to hear from you.',
  },
  {
    value:       'memory',
    label:       'Memory',
    description:
      'A story, moment, experience, family history, or something you want remembered.',
  },
  {
    value:       'lesson',
    label:       'Lesson',
    description:
      'Wisdom, values, advice, principles, warnings, or something you want passed down.',
  },
] as const;

export type CaptureIntentValue = (typeof CAPTURE_INTENT_OPTIONS)[number]['value'];

const CAPTURE_VALUES = new Set<string>(CAPTURE_INTENT_OPTIONS.map((o) => o.value));

/** Archive badges + API validation: new intents, legacy app values, and schema enum extras */
export const BREADCRUMB_TYPE_LABEL: Record<string, string> = {
  message:      'Message',
  memory:       'Memory',
  lesson:       'Lesson',
  letter:       'Letter',
  story:        'Story',
  advice:       'Advice',
  prayer:       'Prayer / Blessing',
  family_value: 'Family Value',
  reflection:   'Reflection',
  guidance:     'Guidance',
  wisdom:       'Wisdom',
  answer:       'Answer',
  encouragement: 'Encouragement',
  journal:      'Journal',
};

/** Accept these on POST /api/save-entry (legacy + capture + enum) */
export const ALL_WRITABLE_BREADCRUMB_TYPES = new Set(Object.keys(BREADCRUMB_TYPE_LABEL));

/**
 * Backward compatibility: code/tests that expect { value, label }[].
 * Prefer CAPTURE_INTENT_OPTIONS for capture UI only.
 */
export const BREADCRUMB_TYPES = Object.entries(BREADCRUMB_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export type BreadcrumbTypeValue = string;

/** Map foundation/legacy prefill types to a capture intent when opening /capture */
export function normalizePrefillBreadcrumbType(raw: string): CaptureIntentValue {
  if (CAPTURE_VALUES.has(raw)) return raw as CaptureIntentValue;
  const legacyToIntent: Record<string, CaptureIntentValue> = {
    letter:       'message',
    prayer:       'message',
    answer:       'message',
    story:        'memory',
    memory:       'memory',
    reflection:   'memory',
    lesson:       'lesson',
    advice:       'lesson',
    family_value: 'lesson',
    wisdom:       'lesson',
    guidance:     'lesson',
    encouragement: 'message',
    journal:      'memory',
  };
  return legacyToIntent[raw] ?? 'message';
}

export const VALUE_TAGS = [
  'Faith', 'Courage', 'Honesty', 'Consistency', 'Optimism',
  'Discipline', 'Family', 'Love', 'Forgiveness', 'Purpose',
  'Work Ethic', 'Resilience',
] as const;

export type ValueTag = typeof VALUE_TAGS[number];

export const FOUNDATION_QUESTIONS = [
  // Who You Are
  { key: 'roots_upbringing',     question: 'Where did you grow up, and what shaped who you are today?' },
  { key: 'heritage_origins',     question: 'Where are your parents and grandparents from? What did they sacrifice for you to have the life you have?' },
  { key: 'family_values',        question: 'What values are most important to you — as a parent and as a person?' },

  // The Eight Principles
  { key: 'optimism',             question: 'What does it mean to stay optimistic, even when life feels impossible? How has the way you think shaped what your life became?' },
  { key: 'never_comfortable',    question: 'Why is getting too comfortable dangerous? What experience taught you this the hard way?' },
  { key: 'persistence',          question: 'Tell the story of a time you refused to give up, even when every door was closed against you. What kept you going?' },
  { key: 'fearlessness',         question: 'What does it mean to be fearless? Tell a story about a moment when you had to jump without knowing where you would land.' },
  { key: 'consistency',          question: "What does it look like to show up every single day — even when you're tired, frustrated, or unsure? Why does it matter?" },
  { key: 'honesty_self',         question: 'What does it mean to be honest with yourself? What have you had to face about yourself, honestly, that made you grow?' },
  { key: 'for_god_not_man',      question: 'What does it mean to do your work for God and not for the approval of people? When did that lesson cost you something real?' },
  { key: 'gut_instinct',         question: "Tell a story about a time you listened to that inner voice — or God's voice — and it changed the entire direction of your life." },

  // Love & Relationship
  { key: 'partner_story',        question: 'How did you meet your partner? Tell the full story.' },
  { key: 'relationship_lessons', question: 'What did your relationship teach you about love, commitment, and choosing the right person?' },

  // Faith
  { key: 'faith_foundation',     question: "What does your faith mean to you, and how has it shaped the decisions you've made?" },
  { key: 'faith_hard_times',     question: "Tell a story about a time God showed up for you in a moment that didn't make sense on paper." },

  // Facing Hard Times
  { key: 'handling_failure',     question: 'How do you deal with failure and discouragement? What would you tell your children when they feel like giving up?' },
  { key: 'defining_moment',      question: 'What is one difficult season of your life that ultimately shaped who you became?' },

  // Good Character
  { key: 'good_person',          question: 'What does it mean, in your eyes, to be a truly good person?' },

  // Legacy
  { key: 'life_advice',          question: 'What are the most important things you want your children to carry with them through life?' },
  { key: 'legacy_message',       question: 'What is the one message you want passed down through your family for generations?' },
] as const;

export type FoundationKey = typeof FOUNDATION_QUESTIONS[number]['key'];

export const VALID_FOUNDATION_KEYS: Set<string> = new Set(
  FOUNDATION_QUESTIONS.map((q) => q.key)
);
