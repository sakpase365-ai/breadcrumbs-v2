export interface PreviewMemory {
  id: string; title: string; content: string; recipient: string; type: string; domain: string; date: string; audio?: string;
}
export const SAMPLE_MEMORIES: PreviewMemory[] = [
  { id: 'sample-courage', title: 'When the next step feels big', content: 'Maya, when I started my first business, I was scared too. I did not wait until the fear went away. I chose one small thing I could do that day, and then another the next day. You do not need to see the whole path to take the next step. I believe in you.', recipient: 'Maya', type: 'lesson', domain: 'resilience', date: 'October 8, 2026' },
  { id: 'sample-sundays', title: 'Our Sunday mornings', content: 'Leo, my favorite part of Sundays was making pancakes with you. You always insisted the first one belonged to the dog. I hope you remember that we were never in a hurry on those mornings. Those little moments meant everything to me.', recipient: 'Leo', type: 'memory', domain: 'relationships', date: 'October 4, 2026' },
  { id: 'sample-home', title: 'You can always come home', content: 'You never have to earn your place in this family. Whether life is going well or feels difficult, you can always come home. We will find a way through it together.', recipient: 'Everyone', type: 'message', domain: 'relationships', date: 'September 28, 2026' },
  { id: 'sample-faith', title: 'What faith means to me', content: 'For me, faith was a way to stay grounded when I did not have all the answers. Quiet prayer and time with family helped me find patience. You are allowed to ask questions and find your own understanding.', recipient: 'Everyone', type: 'lesson', domain: 'faith', date: 'September 20, 2026' },
  { id: 'sample-work', title: 'Build something you believe in', content: 'The work I am proudest of was not the work that looked impressive. It was the work where I helped someone, kept my word, and learned something new. Let your curiosity lead you, and finish what you start.', recipient: 'Maya', type: 'lesson', domain: 'career', date: 'September 15, 2026' },
  { id: 'sample-money', title: 'A little breathing room', content: 'Money gave us choices when we saved a little at a time. Spend on what matters to you, and leave yourself some breathing room. The goal is peace of mind, not keeping up with anyone else.', recipient: 'Leo', type: 'lesson', domain: 'finances', date: 'September 12, 2026' },
];

export function matchPreviewMemories(question: string, memories: PreviewMemory[]): PreviewMemory[] {
  const ignore = new Set(['what', 'would', 'about', 'when', 'your', 'their', 'they', 'with', 'from', 'have', 'that', 'this', 'feel', 'should', 'tell', 'say', 'you', 'the', 'and', 'how', 'can', 'are']);
  const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 2 && !ignore.has(term));
  return memories.map((memory) => ({ memory, score: terms.reduce((score, term) => score + Number(memory.content.toLowerCase().includes(term)) + 2 * Number(memory.title.toLowerCase().includes(term)) + 3 * Number(memory.domain.toLowerCase().includes(term)), 0) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 1).map(({ memory }) => memory);
}
