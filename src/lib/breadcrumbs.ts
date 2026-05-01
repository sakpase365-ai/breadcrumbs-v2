export const BREADCRUMB_TYPES = [
  { value: 'letter',       label: 'Letter'           },
  { value: 'story',        label: 'Story'             },
  { value: 'lesson',       label: 'Life Lesson'       },
  { value: 'advice',       label: 'Advice'            },
  { value: 'memory',       label: 'Memory'            },
  { value: 'prayer',       label: 'Prayer / Blessing' },
  { value: 'family_value', label: 'Family Value'      },
] as const;

export type BreadcrumbTypeValue = typeof BREADCRUMB_TYPES[number]['value'];

export const BREADCRUMB_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  BREADCRUMB_TYPES.map((t) => [t.value, t.label])
);

export const VALUE_TAGS = [
  'Faith', 'Courage', 'Honesty', 'Consistency', 'Optimism',
  'Discipline', 'Family', 'Love', 'Forgiveness', 'Purpose',
  'Work Ethic', 'Resilience',
] as const;

export type ValueTag = typeof VALUE_TAGS[number];

export const FOUNDATION_QUESTIONS = [
  { key: 'roots_upbringing',     question: 'Where did you grow up, and what shaped you most?' },
  { key: 'heritage_origins',     question: 'Where are your parents and grandparents from?' },
  { key: 'family_sacrifices',    question: 'What sacrifices or values were passed down through your family?' },
  { key: 'partner_meeting',      question: "How did you meet your child's mother/father?" },
  { key: 'partner_attraction',   question: 'What drew you to them?' },
  { key: 'relationship_lessons', question: 'What did that relationship teach you about love, family, faith, or commitment?' },
  { key: 'core_values',          question: 'What values are most important in your family?' },
  { key: 'life_lesson',          question: 'What is one thing your children should always remember about life?' },
  { key: 'handling_failure',     question: 'How should your children deal with failure or discouragement?' },
  { key: 'defining_moment',      question: 'What is one difficult moment that shaped who you became?' },
  { key: 'faith_purpose',        question: 'What role does faith, belief, or purpose play in your life?' },
  { key: 'legacy_message',       question: 'What message do you want passed down through your family for generations?' },
] as const;

export type FoundationKey = typeof FOUNDATION_QUESTIONS[number]['key'];

export const VALID_FOUNDATION_KEYS: Set<string> = new Set(
  FOUNDATION_QUESTIONS.map((q) => q.key)
);
