export type FoundationPromptCategory =
  | 'foundation'
  | 'story'
  | 'deepening'
  | 'connecting'
  | 'clarifying'
  | 'contradiction'
  | 'recipient_specific'
  | 'legacy';

export interface FoundationPromptCategoryDefinition {
  key: FoundationPromptCategory;
  label: string;
  purpose: string;
  prompts: readonly string[];
}

export const FOUNDATION_PROMPT_LIBRARY = [
  {
    key:     'foundation',
    label:   'Foundation Questions',
    purpose: 'Establish identity, relationships, origin, and family context.',
    prompts: [
      'Where were you born?',
      'Where did you spend most of your childhood?',
      'Who raised you?',
      'Who are the important people in your family?',
    ],
  },
  {
    key:     'story',
    label:   'Story Questions',
    purpose: 'Collect specific memories and experiences.',
    prompts: [
      'What is one early memory you still think about?',
      'Tell me about a decision that changed the direction of your life.',
      'What is one failure that taught you something success could not?',
    ],
  },
  {
    key:     'deepening',
    label:   'Deepening Questions',
    purpose: 'Connect stated values or beliefs to lived examples.',
    prompts: [
      'You mentioned that faith matters to you. Can you remember a time when faith changed a decision you made?',
      'You selected persistence as a value. Where do you think that came from?',
      'Can you share a story that explains why honesty matters to you?',
    ],
  },
  {
    key:     'connecting',
    label:   'Connecting Questions',
    purpose: 'Connect multiple Breadcrumbs, people, events, or themes.',
    prompts: [
      'You mentioned your father taught you discipline, and later you described becoming more patient as a parent. How did those two experiences shape the way you raise your children?',
      'You have shared several stories about risk and faith. How do those two ideas connect for you?',
    ],
  },
  {
    key:     'clarifying',
    label:   'Clarifying Questions',
    purpose: 'Ask the contributor to explain, correct, or expand something previously shared.',
    prompts: [
      'Earlier you said optimism helped you through hard seasons. What did you mean by that?',
      'Would you like to clarify or add more context to what you shared about your childhood?',
    ],
  },
  {
    key:     'contradiction',
    label:   'Contradiction Questions',
    purpose: 'Preserve evolving beliefs instead of forcing artificial consistency.',
    prompts: [
      'Has your view on success changed over time?',
      'Is there something you believed when you were younger that you no longer believe?',
      'Have you ever changed your mind about family, faith, work, or money?',
    ],
  },
  {
    key:     'recipient_specific',
    label:   'Recipient-Specific Questions',
    purpose: 'Ask what the contributor wants a specific person to know.',
    prompts: [
      'What do you want this family member to understand about you?',
      'What advice would you want to leave specifically for your children?',
      'If your grandchildren came here looking for guidance, what would you want them to find?',
    ],
  },
  {
    key:     'legacy',
    label:   'Legacy Questions',
    purpose: 'Capture what should be preserved for future generations.',
    prompts: [
      'What stories from your life should never be forgotten?',
      'What do you hope future generations understand about your family?',
      'What do you want the people you love to remember most about you?',
    ],
  },
] as const satisfies ReadonlyArray<FoundationPromptCategoryDefinition>;

export type FoundationEvidenceConfidence = 'emerging' | 'developing' | 'strong';

export const FOUNDATION_EVIDENCE_CONFIDENCE_LABELS: Record<FoundationEvidenceConfidence, string> = {
  emerging:   'Emerging',
  developing: 'Developing',
  strong:     'Strong',
};

export interface FoundationEvidenceSignal {
  stated_value: string;
  supporting_breadcrumbs_count: number;
  supporting_stories_count: number;
  repeated_mentions_count: number;
  confidence: FoundationEvidenceConfidence;
}

export const FOUNDATION_EVIDENCE_RESPONSE_GUIDANCE = {
  emerging:
    'You have not shared much about this yet, but in one Breadcrumb you described...',
  developing:
    'Across several Breadcrumbs, you have consistently emphasized...',
  strong:
    'Across your stories about career, marriage, faith, and parenting, a recurring principle is...',
} as const;

export type FoundationSaveMode = 'agent_context' | 'private_reflection' | 'breadcrumb';

export const FOUNDATION_SAVE_MODES = [
  {
    value:       'agent_context',
    label:       'Family Agent Context',
    description: 'Helps personalize prompts and understand contributor context.',
  },
  {
    value:       'private_reflection',
    label:       'Private Reflection',
    description: 'Kept for the contributor unless they later choose to share it.',
  },
  {
    value:       'breadcrumb',
    label:       'Breadcrumb',
    description: 'Intentionally shared with selected recipients under family permissions.',
  },
] as const satisfies ReadonlyArray<{
  value: FoundationSaveMode;
  label: string;
  description: string;
}>;
