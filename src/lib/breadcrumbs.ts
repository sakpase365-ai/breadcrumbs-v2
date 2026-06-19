export type BreadcrumbType =
  | "Letter"
  | "Story"
  | "Life Lesson"
  | "Advice"
  | "Memory"
  | "Value"
  | "Reflection";

export type FamilyDraft = {
  name: string;
  role: string;
  birthDate?: string;
};

export type FamilyMember = {
  id: string;
  display_name: string;
  relationship: string | null;
  date_of_birth: string | null;
};

export type EntryAnalysis = {
  breadcrumb_type: BreadcrumbType;
  tags: string[];
  domain: string;
  relevant_age: number;
  follow_up_question: string;
};

export const BREADCRUMB_TYPES: BreadcrumbType[] = [
  "Letter",
  "Story",
  "Life Lesson",
  "Advice",
  "Memory",
  "Value",
  "Reflection",
];

export const FOUNDATION_QUESTIONS = [
  {
    key: "deepest_belief",
    question: "What do you believe in most deeply?",
  },
  {
    key: "hardest_overcome",
    question: "What's the hardest thing you've overcome?",
  },
  {
    key: "children_know_you",
    question: "What do you want your children to know about you?",
  },
  {
    key: "family_story",
    question: "What story from your family shaped the way you love?",
  },
  {
    key: "work_meaning",
    question: "What has work taught you about dignity, sacrifice, or purpose?",
  },
  {
    key: "love_definition",
    question: "How do you define love when life gets difficult?",
  },
  {
    key: "faith_and_doubt",
    question: "What have faith, doubt, or wonder meant in your life?",
  },
  {
    key: "mistakes",
    question: "What mistake taught you something you still carry?",
  },
  {
    key: "joy",
    question: "Where have you found ordinary joy?",
  },
  {
    key: "courage",
    question: "When did you have to be braver than you felt?",
  },
  {
    key: "money",
    question: "What do you hope your family understands about money and enough?",
  },
  {
    key: "legacy",
    question: "What do you hope remains of you in the people you love?",
  },
];

export const FALLBACK_PROMPTS = [
  "Write a letter about a small moment you hope they remember when life feels loud.",
  "Tell the story of a choice that quietly changed who you became.",
  "Write about a value you learned slowly, through ordinary days rather than grand lessons.",
  "Describe something you hope they discover for themselves, even if you could tell them now.",
  "Share a memory that explains what love looked like in your family.",
];

export const fallbackAnalysis = (content: string): EntryAnalysis => {
  const lower = content.toLowerCase();
  const breadcrumb_type: BreadcrumbType = lower.includes("remember")
    ? "Memory"
    : lower.includes("dear")
      ? "Letter"
      : lower.includes("learn")
        ? "Life Lesson"
        : "Reflection";

  const tags = [
    lower.includes("faith") ? "faith" : "love",
    lower.includes("work") ? "work" : "resilience",
    lower.includes("fear") ? "courage" : "belonging",
  ];

  return {
    breadcrumb_type,
    tags: Array.from(new Set(tags)),
    domain: lower.includes("work") ? "career" : lower.includes("health") ? "health" : "identity",
    relevant_age: lower.includes("child") ? 12 : 18,
    follow_up_question: "What is one detail from this memory that only you would know?",
  };
};

export const getAge = (birthDate?: string | null) => {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1;
  return age;
};
