export interface TopicCount { topic: string; count: number; color: string }
const COLORS = ['#638cff', '#b995ef', '#72c7b0', '#e5bb75', '#719dc7', '#d891af', '#95bde3'];
export function countMemoryTopics(entries: { domain?: string | null }[]): TopicCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const topic = entry.domain?.trim() || 'Other';
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([topic, count], index) => ({ topic, count, color: COLORS[index % COLORS.length] }));
}
export function memoryRingGradient(topics: TopicCount[]): string {
  const total = topics.reduce((sum, topic) => sum + topic.count, 0);
  if (!total) return '#20283d';
  let angle = 0;
  const slices = topics.filter((topic) => topic.count > 0).map((topic) => {
    const start = angle;
    angle += topic.count / total * 360;
    return `${topic.color} ${start}deg ${angle}deg`;
  });
  return `conic-gradient(${slices.join(', ')})`;
}
