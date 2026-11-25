import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextTopic } from '../../shared/learningFlow.ts';
import type { StreamPhase, StreamTopic } from '../../shared/types.ts';
import type { AddressInfo } from 'node:net';
import { CareerForgeDB } from '../db/database.ts';
import { createApp } from '../app.ts';

function topic(id: string, topicOrder: number, status: StreamTopic['status']): StreamTopic {
  return {
    id,
    topicOrder,
    status,
    streamId: 'stream',
    phaseId: 'phase',
    title: id,
    summary: '',
    estimatedHours: 1,
    difficulty: 'foundation',
    keySkills: [],
    masteryScore: 0,
    isBossTopic: false,
    resourceCount: 0,
    completedResourceCount: 0,
    problemCount: 0,
    solvedProblemCount: 0,
  };
}

function phase(phaseOrder: number, topics: StreamTopic[]): StreamPhase {
  return {
    id: `phase-${phaseOrder}`,
    streamId: 'stream',
    phaseOrder,
    title: '',
    objective: '',
    topics,
  };
}

test('continues an in-progress topic before starting a new one', () => {
  assert.equal(
    getNextTopic({
      phases: [phase(1, [topic('new', 1, 'available'), topic('working', 2, 'in_progress')])],
    })?.id,
    'working',
  );
});

test('selects the earliest unfinished topic in curriculum order without mutating input', () => {
  const phases = [
    phase(2, [topic('later', 1, 'available')]),
    phase(1, [topic('next', 2, 'available'), topic('done', 1, 'mastered')]),
  ];
  assert.equal(getNextTopic({ phases })?.id, 'next');
  assert.equal(phases[0]?.phaseOrder, 2);
  assert.equal(phases[1]?.topics[0]?.id, 'next');
});

test('does not offer a next topic when the roadmap is empty or fully mastered', () => {
  assert.equal(getNextTopic({ phases: [] }), undefined);
  assert.equal(getNextTopic({ phases: [phase(1, [topic('done', 1, 'mastered')])] }), undefined);
});

test('returning users retain access to saved work after their last provider is disabled', async () => {
  const db = new CareerForgeDB(':memory:');
  const provider = {
    name: 'Test provider',
    type: 'ollama' as const,
    baseUrl: 'http://127.0.0.1:11434',
    enabled: true,
  };
  const saved = db.saveProvider(provider);
  db.completeOnboarding();
  db.saveProvider({ ...provider, id: saved.id, enabled: false });
  const server = createApp(db).listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/status`,
    );
    assert.equal(response.status, 200);
    const { status } = await response.json();
    assert.equal(status.isOnboarded, true);
    assert.equal(status.hasActiveProvider, false);
    assert.equal(status.connectedProviderCount, 0);
    assert.equal(status.preferences.showRoadmapFlowInArena, false);
  } finally {
    server.close();
    db.close();
  }
});
