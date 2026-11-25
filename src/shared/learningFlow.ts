import type { CareerStream, StreamTopic } from './types.ts';

/** Continue the most relevant unfinished topic, preserving curriculum order. */
export function getNextTopic(stream: Pick<CareerStream, 'phases'>): StreamTopic | undefined {
  const topics = [...stream.phases]
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .flatMap((phase) => [...phase.topics].sort((a, b) => a.topicOrder - b.topicOrder));
  return (
    topics.find((topic) => topic.status === 'in_progress') ??
    topics.find((topic) => topic.status !== 'mastered')
  );
}
