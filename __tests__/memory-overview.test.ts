import { describe, expect, it } from 'vitest';
import { countMemoryTopics, memoryRingGradient } from '@/lib/memory-overview';
import { matchPreviewMemories, SAMPLE_MEMORIES } from '@/lib/preview-memories';

describe('family memory overview', () => {
  it('counts only provided entries and groups missing topics as Other', () => {
    const topics = countMemoryTopics([{ domain: 'faith' }, { domain: 'faith' }, { domain: null }]);
    expect(topics.map(({ topic, count }) => ({ topic, count }))).toEqual([{ topic: 'faith', count: 2 }, { topic: 'Other', count: 1 }]);
    expect(topics.reduce((total, topic) => total + topic.count, 0)).toBe(3);
  });
  it('leaves an empty ring neutral instead of inventing saved memories', () => {
    expect(countMemoryTopics([])).toEqual([]);
    expect(memoryRingGradient([])).toBe('#20283d');
  });
  it('scales visible chart segments to the actual counts', () => {
    expect(memoryRingGradient([{ topic: 'a', count: 1, color: '#aaa' }, { topic: 'b', count: 3, color: '#bbb' }])).toBe('conic-gradient(#aaa 0deg 90deg, #bbb 90deg 360deg)');
  });
});
describe('honest sample retrieval', () => {
  it('returns the relevant original rather than an unrelated canned response', () => {
    expect(matchPreviewMemories('What did you believe about faith?', SAMPLE_MEMORIES).map((memory) => memory.id)).toEqual(['sample-faith']);
  });
  it('returns no sources when there is insufficient sample evidence', () => {
    expect(matchPreviewMemories('Tell me about quantum physics', SAMPLE_MEMORIES)).toEqual([]);
  });
  it('can retrieve a newly captured sample breadcrumb', () => {
    const added = { ...SAMPLE_MEMORIES[0], id: 'new', title: 'Learning astronomy', content: 'I loved studying astronomy.' };
    expect(matchPreviewMemories('astronomy', [...SAMPLE_MEMORIES, added])[0].id).toBe('new');
  });
});
