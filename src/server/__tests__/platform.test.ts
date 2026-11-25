import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { CareerForgeDB } from '../db/database.ts';
import { JevModelRouter } from '../services/jevRouter.ts';
import { parseResumeBuffer } from '../services/resumeParser.ts';
import { createApp } from '../app.ts';

describe('CareerForge Platform — SQLite, TypeSafe Jev Router, Multi-Stream Isolation & Gamification', () => {
  let mockLlmServer: http.Server;
  let mockLlmPort = 0;
  let mockLlmRequestCount = 0;
  let mockJevServer: http.Server;
  let mockJevPort = 0;
  let forceJevError = false;
  let forceRoadmapError = false;

  before(async () => {
    // Mock TypeSafe Jev System One Server
    mockJevServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (forceJevError) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ detail: 'Simulated Jev overload' }));
          return;
        }
        const parsed = JSON.parse(body) as {
          model: string;
          questions: Record<string, { criteria?: Record<string, string> }>;
        };
        const candidateKeys = Object.keys(parsed.questions.selected_candidate?.criteria ?? {});
        // Pick the last candidate to prove Jev choice overrides default index 0
        const chosen = candidateKeys[candidateKeys.length - 1] ?? 'opt_0';
        const probs: Record<string, number> = {};
        for (const k of candidateKeys) {
          probs[k] = k === chosen ? 0.88 : 0.12 / Math.max(1, candidateKeys.length - 1);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            model: 'jev-1.14.0',
            answers: {
              selected_candidate: {
                type: 'choice',
                choice: chosen,
                probabilities: probs,
                confidence: 0.88,
              },
              reasoning_effort: {
                type: 'choice',
                choice: 'high',
                confidence: 0.92,
              },
              complexity: {
                type: 'score',
                score: 2,
                confidence: 0.95,
              },
            },
            usage: { input_tokens: 320, output_tokens: 48 },
          })
        );
      });
    });

    await new Promise<void>((resolve) => {
      mockJevServer.listen(0, '127.0.0.1', () => {
        mockJevPort = (mockJevServer.address() as AddressInfo).port;
        resolve();
      });
    });

    // Mock OpenAI-compatible Inference Server returning structured responses per task prompt
    mockLlmServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url?.includes('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            data: [
              { id: 'gpt-4.1', name: 'GPT-4.1' },
              { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
            ],
          })
        );
        return;
      }

      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        mockLlmRequestCount += 1;
        const parsed = JSON.parse(body) as {
          messages?: Array<{ content: string }>;
        };
        const fullText = (parsed.messages ?? []).map((m) => m.content).join('\n');

        let replyObj: unknown = { status: 'READY' };

        if (fullText.includes('CareerProfile JSON object')) {
          replyObj = {
            headline: 'Senior Distributed Systems Engineer',
            currentRole: 'Senior Backend Engineer',
            seniorityEstimate: 'Senior',
            yearsOfExperience: 6,
            summary: 'Strong backend systems engineer ready for Staff & AI tracks.',
            skills: [
              {
                name: 'TypeScript',
                category: 'Languages',
                level: 'expert',
                yearsEvidence: '5 yrs',
              },
            ],
            superpowers: ['High-throughput event architectures'],
            growthGaps: ['Multi-region consensus', 'Agentic evaluation systems'],
            domains: ['Fintech', 'Developer Platforms'],
            standoutHighlights: ['12M events/day pipeline'],
          };
        } else if (fullText.includes('Generate 4 tailored career growth roadmaps')) {
          if (forceRoadmapError) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Simulated provider failure' }));
            return;
          }
          replyObj = {
            roadmaps: [
              {
                title: 'Staff Distributed Systems Architect',
                tagline: 'Master consensus, multi-region scale, and reliability',
                category: 'vertical_growth',
                targetRole: 'Staff Software Engineer',
                fitScore: 93,
                difficulty: 'challenging',
                estimatedWeeks: 12,
                marketDemand: 'high',
                whyItFits: 'Directly extends your Kafka and PostgreSQL background.',
                bridgeSkills: ['Kafka', 'PostgreSQL'],
                gapSkillsToBuild: ['Raft Consensus', 'Multi-Region Failover'],
                colorTheme: 'indigo',
                iconName: 'Layers',
                phasesPreview: [
                  {
                    title: 'Phase 1: Storage & Replication',
                    objective: 'Master replication logs',
                    keyTopics: ['WAL Internals', 'Quorum Reads'],
                  },
                ],
              },
              {
                title: 'Production Agentic AI Systems',
                tagline: 'Build reliable multi-model AI agents & eval pipelines',
                category: 'specialist_frontier',
                targetRole: 'Staff AI Engineer',
                fitScore: 89,
                difficulty: 'ambitious',
                estimatedWeeks: 10,
                marketDemand: 'surging',
                whyItFits: 'Combines backend orchestration with LLM routing.',
                bridgeSkills: ['TypeScript', 'Event Pipelines'],
                gapSkillsToBuild: ['Model Routing', 'Eval Rubrics'],
                colorTheme: 'emerald',
                iconName: 'Cpu',
                phasesPreview: [
                  {
                    title: 'Phase 1: Agent Loops & Evals',
                    objective: 'Deterministic harnesses',
                    keyTopics: ['Structured Outputs', 'Decision Routers'],
                  },
                ],
              },
            ],
          };
        } else if (fullText.includes('Design the full independent curriculum')) {
          replyObj = {
            description: 'Hands-on 3-phase stream curriculum.',
            phases: [
              {
                title: 'Phase 1: Foundations',
                objective: 'Core mental models',
                topics: [
                  {
                    title: 'Idempotency & Exactly-Once Semantics',
                    summary: 'Design retry-safe distributed mutations.',
                    estimatedHours: 4,
                    difficulty: 'intermediate',
                    keySkills: ['Idempotency Keys', 'Outbox Pattern'],
                    isBossTopic: false,
                  },
                  {
                    title: 'Capstone Boss: Global Ledger Architecture',
                    summary: 'End-to-end multi-region design.',
                    estimatedHours: 6,
                    difficulty: 'staff_plus',
                    keySkills: ['Consensus', 'Partitioning'],
                    isBossTopic: true,
                  },
                ],
              },
            ],
          };
        } else if (fullText.includes('Generate learning resources for this career stream topic')) {
          replyObj = {
            generatedGuide: {
              title: 'Deep-Dive Guide: Idempotent Distributed Systems',
              estimatedMinutes: 25,
              whyRelevant: 'Essential for Staff reliability.',
              contentMarkdown: '## Outbox Pattern\nUse transactional outbox tables for atomic publish.',
              flashcards: [
                {
                  front: 'What problem does the Transactional Outbox solve?',
                  back: 'Dual-write inconsistency between DB commit and broker publish.',
                },
              ],
            },
            externalResources: [
              {
                kind: 'external_article',
                title: 'Designing Data-Intensive Applications — Reliability Notes',
                url: 'https://dataintensive.net',
                providerOrAuthor: 'Martin Kleppmann',
                estimatedMinutes: 35,
                difficulty: 'advanced',
                whyRelevant: 'Canonical distributed systems reference.',
                studyNotesMarkdown: 'Focus on replication lag & fencing tokens.',
              },
            ],
          };
        } else if (fullText.includes('practice challenge for this topic')) {
          replyObj = {
            title: 'Implement Idempotent Webhook Processor',
            scenarioMarkdown: 'Design a deduplicating payment webhook handler.',
            requirements: ['Guarantee at-most-once side effects', 'Handle concurrent duplicate retries'],
            constraints: ['Sub-20ms p99 lock overhead'],
            starterTemplate: 'export async function processWebhook(eventId: string) {\n  // TODO\n}',
            languageHint: 'typescript',
            rubric: [
              {
                criterion: 'Atomicity & Concurrency Safety',
                weight: 50,
                description: 'Prevents race conditions on simultaneous delivery.',
              },
              {
                criterion: 'Failure Recovery',
                weight: 50,
                description: 'Releases or recovers stuck in-flight keys.',
              },
            ],
            hints: ['Use unique DB constraints with status state transitions.'],
          };
        } else if (fullText.includes('Evaluate the submitted solution')) {
          replyObj = {
            score: 95,
            verdict: 'mastered',
            summaryFeedback: 'Exceptional atomic upsert state machine with lease expiration.',
            strengths: ['Clean atomic INSERT ON CONFLICT lock', 'Handles crash recovery'],
            improvements: ['Add structured metrics on duplicate drops'],
            rubricBreakdown: [
              {
                criterion: 'Atomicity & Concurrency Safety',
                score: 48,
                maxScore: 50,
                comment: 'Proper unique constraint fencing.',
              },
              {
                criterion: 'Failure Recovery',
                score: 47,
                maxScore: 50,
                comment: 'Stale lease timeout handled cleanly.',
              },
            ],
            exemplarApproachMarkdown: '```sql\nINSERT INTO idempotency_keys ...\n```',
          };
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(replyObj) } }],
          })
        );
      });
    });

    await new Promise<void>((resolve) => {
      mockLlmServer.listen(0, '127.0.0.1', () => {
        mockLlmPort = (mockLlmServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  after(() => {
    mockLlmServer.close();
    mockJevServer.close();
  });

  it('parses Markdown and plain-text resumes locally', async () => {
    const buf = Buffer.from('# Jane Doe\nSenior Backend Engineer with 7 years experience in Go and SQL.');
    const parsed = await parseResumeBuffer(buf, 'Jane_Resume.md');
    assert.equal(parsed.fileFormat, 'md');
    assert.ok(parsed.rawText.includes('Jane Doe'));
  });

  it('reports an upstream roadmap failure separately from invalid resume input', async () => {
    const db = new CareerForgeDB(':memory:');
    db.saveProvider({
      name: 'Mock inference provider',
      type: 'openai_compatible',
      baseUrl: `http://127.0.0.1:${mockLlmPort}/v1`,
      enabled: true,
    });
    const server = createApp(db).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));

    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/resumes/analyze`;
      const analyze = (rawText: string) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      const invalid = await analyze('Too short');
      assert.equal(invalid.status, 400);

      forceRoadmapError = true;
      const resume = 'Software engineer with six years building PostgreSQL and TypeScript systems.';
      const failed = await analyze(resume);
      assert.equal(failed.status, 502);
      assert.match((await failed.json()).error, /^Roadmap generation failed.*HTTP 503/);
      assert.equal(db.listResumes().length, 0);

      forceRoadmapError = false;
      const retried = await analyze(resume);
      assert.equal(retried.status, 200);
      assert.equal(db.listResumes().length, 1);
    } finally {
      forceRoadmapError = false;
      await new Promise<void>((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve());
      });
      db.close();
    }
  });

  it('uses Autonomous Router without Jev key, uses TypeSafe Jev when key is set, and falls back gracefully on Jev outage', async () => {
    const db = new CareerForgeDB(':memory:');
    db.saveProvider({
      name: 'Fast Local',
      type: 'ollama',
      enabled: true,
      baseUrl: 'http://127.0.0.1:11434',
      models: [
        {
          id: 'qwen-fast:3b',
          label: 'Qwen Fast',
          costTier: 'free_local',
          capabilityTier: 'fast',
          supportsReasoningEffort: false,
          enabled: true,
        },
      ],
    });
    db.saveProvider({
      name: 'Frontier Cloud',
      type: 'openai',
      enabled: true,
      baseUrl: `http://127.0.0.1:${mockLlmPort}/v1`,
      apiKeyOrSecret: 'sk-test-secret-123456',
      models: [
        {
          id: 'o4-mini',
          label: 'o4-mini Reasoning',
          costTier: 'frontier',
          capabilityTier: 'reasoning',
          supportsReasoningEffort: true,
          enabled: true,
        },
      ],
    });

    const router = new JevModelRouter(db);

    // 1. Without Jev API key + quality_first -> Autonomous picks Frontier reasoning model for solution_evaluation
    db.saveJevConfig({
      enabled: true,
      channel: 'custom',
      baseUrl: `http://127.0.0.1:${mockJevPort}/v1/systemone`,
      model: 'jev-latest',
      costPolicy: 'quality_first',
    });

    const autoEval = await router.routeTask({
      purpose: 'solution_evaluation',
      promptPreview: 'async function solve() {}',
    });
    assert.equal(autoEval.decision.decidedBy, 'autonomous_fallback');
    assert.equal(autoEval.decision.selectedModel, 'o4-mini');

    // Without Jev API key + cost_saver -> Autonomous picks free_local fast model for mentor_hint
    db.saveJevConfig({
      enabled: true,
      channel: 'custom',
      baseUrl: `http://127.0.0.1:${mockJevPort}/v1/systemone`,
      model: 'jev-latest',
      costPolicy: 'cost_saver',
    });

    const autoHint = await router.routeTask({
      purpose: 'mentor_hint',
      promptPreview: 'Need a quick nudge',
    });
    assert.equal(autoHint.decision.decidedBy, 'autonomous_fallback');
    assert.equal(autoHint.decision.selectedModel, 'qwen-fast:3b');

    // 2. With TypeSafe Jev API key -> Calls Jev System One endpoint and records jev-1.14.0 decision
    db.saveJevConfig({
      enabled: true,
      apiKey: 'jv_live_test_key_9999',
      channel: 'custom',
      baseUrl: `http://127.0.0.1:${mockJevPort}/v1/systemone`,
      model: 'jev-latest',
      costPolicy: 'balanced',
    });

    const jevDecision = await router.routeTask({
      purpose: 'roadmap_suggestion',
      promptPreview: 'Design career roadmaps',
    });
    assert.equal(jevDecision.decision.decidedBy, 'typesafe_jev');
    assert.equal(jevDecision.decision.jevModelVersion, 'jev-1.14.0');
    assert.equal(jevDecision.decision.reasoningEffort, 'high');

    // 3. When Jev endpoint errors (503) -> Seamlessly falls back to autonomous_fallback
    forceJevError = true;
    const fallbackDecision = await router.routeTask({
      purpose: 'roadmap_suggestion',
      promptPreview: 'Design career roadmaps under outage',
    });
    forceJevError = false;
    assert.equal(fallbackDecision.decision.decidedBy, 'autonomous_fallback');
    assert.ok(fallbackDecision.decision.rationale.includes('autonomous router engaged'));

    db.close();
  });

  it('tracks multiple career streams independently, evaluates practice solutions, and unlocks achievements + easter eggs', async () => {
    const db = new CareerForgeDB(':memory:');
    const app = createApp(db);
    const apiServer = http.createServer(app);
    await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
    const port = (apiServer.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // Step 1: Configure AI provider
      const provResp = await fetch(`${base}/api/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Local Mock OpenAI',
          type: 'openai_compatible',
          enabled: true,
          baseUrl: `http://127.0.0.1:${mockLlmPort}/v1`,
          apiKeyOrSecret: 'sk-mock-key-123456',
          models: [
            {
              id: 'gpt-4.1-mock',
              label: 'GPT-4.1 Mock',
              costTier: 'balanced',
              capabilityTier: 'coding_specialist',
              supportsReasoningEffort: false,
              enabled: true,
            },
          ],
        }),
      });
      assert.equal(provResp.status, 200);
      const provJson = (await provResp.json()) as {
        provider: { maskedSecret: string };
        gamificationDelta: { unlockedAchievements: Array<{ code: string }> };
      };
      assert.ok(provJson.provider.maskedSecret.includes('••••'));
      assert.ok(
        provJson.gamificationDelta.unlockedAchievements.some((a) => a.code === 'ENGINE_IGNITED')
      );

      // Step 2: Analyze resume & get suggested roadmaps
      const resumeResp = await fetch(`${base}/api/resumes/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'Alex_Resume.txt',
          fileFormat: 'txt',
          rawText:
            'Alex Rivera — Senior Software Engineer with 6 years building Kafka, PostgreSQL, and TypeScript distributed backend systems.',
        }),
      });
      assert.equal(resumeResp.status, 200);
      const resumeJson = (await resumeResp.json()) as {
        resume: { id: string; suggestedRoadmaps: Array<{ id: string; title: string }> };
      };
      assert.equal(resumeJson.resume.suggestedRoadmaps.length, 2);

      // Step 3: Launch TWO independent streams simultaneously
      const s1Resp = await fetch(`${base}/api/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resumeJson.resume.id,
          suggestedRoadmapId: resumeJson.resume.suggestedRoadmaps[0]!.id,
        }),
      });
      const s1Json = (await s1Resp.json()) as {
        stream: { id: string; phases: Array<{ topics: Array<{ id: string }> }> };
      };

      const s2Resp = await fetch(`${base}/api/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resumeJson.resume.id,
          suggestedRoadmapId: resumeJson.resume.suggestedRoadmaps[1]!.id,
        }),
      });
      const s2Json = (await s2Resp.json()) as {
        stream: { id: string; phases: Array<{ topics: Array<{ id: string }> }> };
      };

      const stream1TopicId = s1Json.stream.phases[0]!.topics[0]!.id;
      const stream2TopicId = s2Json.stream.phases[0]!.topics[0]!.id;

      // Step 4: Generate & Complete Learning Resource in Stream 1 ONLY
      const genResResp = await fetch(
        `${base}/api/topics/${stream1TopicId}/resources/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const genResJson = (await genResResp.json()) as {
        resources: Array<{ id: string }>;
      };
      assert.ok(genResJson.resources.length >= 2);

      await fetch(`${base}/api/resources/${genResJson.resources[0]!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });

      // Verify Stream 1 advanced while Stream 2's resources/mastery stayed independent!
      const afterResStreams = (await (await fetch(`${base}/api/streams`)).json()) as {
        streams: Array<{
          id: string;
          resourcesCompleted: number;
          problemsSolved: number;
          masteryPercent: number;
        }>;
      };
      const st1After = afterResStreams.streams.find((s) => s.id === s1Json.stream.id)!;
      const st2After = afterResStreams.streams.find((s) => s.id === s2Json.stream.id)!;
      assert.equal(st1After.resourcesCompleted, 1);
      assert.equal(st2After.resourcesCompleted, 0);
      assert.equal(st2After.problemsSolved, 0);

      // Step 5: Generate & Submit Practice Solution in Stream 2 -> triggers Polymath Combo + Flawless!
      const probResp = await fetch(
        `${base}/api/topics/${stream2TopicId}/problems/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archetype: 'coding_implementation', difficulty: 'hard' }),
        }
      );
      const probJson = (await probResp.json()) as { problem: { id: string } };

      const evalResp = await fetch(`${base}/api/problems/${probJson.problem.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solutionText:
            'export async function processWebhook(eventId: string) { /* atomic INSERT ON CONFLICT DO NOTHING with lease timeout */ return true; }',
        }),
      });
      assert.equal(evalResp.status, 200);
      const evalJson = (await evalResp.json()) as {
        submission: {
          score: number;
          verdict: string;
          bonusesApplied: Array<{ label: string }>;
        };
        stream: { problemsSolved: number; resourcesCompleted: number };
      };

      assert.equal(evalJson.submission.score, 95);
      assert.equal(evalJson.submission.verdict, 'mastered');
      assert.equal(evalJson.stream.problemsSolved, 1);
      assert.equal(evalJson.stream.resourcesCompleted, 0); // Still independent from Stream 1!
      assert.ok(
        evalJson.submission.bonusesApplied.some((b) =>
          b.label.includes('Polymath Multi-Stream Combo')
        )
      );

      // Step 6: Trigger Konami Easter Egg & Mystery Reliquary
      const eggResp = await fetch(`${base}/api/gamification/easter-egg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eggId: 'konami' }),
      });
      assert.equal(eggResp.status, 200);
      const eggJson = (await eggResp.json()) as {
        profile: { easterEggsFound: string[]; forgeSparks: number };
      };
      assert.ok(eggJson.profile.easterEggsFound.includes('konami'));
      assert.ok(eggJson.profile.forgeSparks >= 40);

      const relResp = await fetch(`${base}/api/gamification/reliquary`, {
        method: 'POST',
      });
      assert.equal(relResp.status, 200);
    } finally {
      apiServer.close();
      db.close();
    }
  });

  it('auto-verifies provider Connected status & Jev Configured status, reuses roadmap nodes & resources from memory without AI, and keeps refreshes consistent when unchanged', async () => {
    const db = new CareerForgeDB(':memory:');
    const app = createApp(db);
    const apiServer = http.createServer(app);
    await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
    const port = (apiServer.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // 1. Save provider WITHOUT specifying any models -> auto-discovers models & verifies Connected status
      const saveProvResp = await fetch(`${base}/api/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Zero-Config Cloud Provider',
          type: 'openai_compatible',
          enabled: true,
          baseUrl: `http://127.0.0.1:${mockLlmPort}/v1`,
          apiKeyOrSecret: 'sk-zero-config-key-9876',
        }),
      });
      assert.equal(saveProvResp.status, 200);
      const saveProvJson = (await saveProvResp.json()) as {
        provider: {
          connectionStatus: string;
          models: Array<{ id: string; enabled: boolean }>;
        };
      };
      assert.equal(saveProvJson.provider.connectionStatus, 'connected');
      assert.ok(saveProvJson.provider.models.some((m) => m.enabled));

      // 2. Save Jev configuration with API key -> auto-verifies Configured & Verified status
      const saveJevResp = await fetch(`${base}/api/jev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          apiKey: 'jv_live_verified_key_1234',
          channel: 'custom',
          baseUrl: `http://127.0.0.1:${mockJevPort}/v1/systemone`,
          model: 'jev-latest',
          costPolicy: 'balanced',
        }),
      });
      assert.equal(saveJevResp.status, 200);
      const saveJevJson = (await saveJevResp.json()) as {
        config: { status: string; hasApiKey: boolean };
      };
      assert.equal(saveJevJson.config.hasApiKey, true);
      assert.equal(saveJevJson.config.status, 'configured_verified');

      // Check /api/status reflects connectedProviderCount and jevConfigured
      const statusJson = (await (await fetch(`${base}/api/status`)).json()) as {
        status: { connectedProviderCount: number; jevConfigured: boolean; jevStatus: string };
      };
      assert.equal(statusJson.status.connectedProviderCount, 1);
      assert.equal(statusJson.status.jevConfigured, true);
      assert.equal(statusJson.status.jevStatus, 'configured_verified');

      // 3. Analyze resume -> prepares roadmaps & caches nodes in memory
      const analyze1 = (await (
        await fetch(`${base}/api/resumes/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: 'MemoryTest_Resume.txt',
            fileFormat: 'txt',
            rawText:
              'Senior Distributed Systems Engineer with 6 years building Kafka, PostgreSQL, and TypeScript architectures.',
            careerGoalsNote: 'Focus on Staff reliability',
          }),
        })
      ).json()) as {
        resume: { id: string; suggestedRoadmaps: Array<{ id: string; title: string }> };
        fromMemoryCache: boolean;
      };
      assert.equal(analyze1.fromMemoryCache, false);

      // Re-analyzing / refreshing with identical resume & goals uses 0 AI calls and returns consistent roadmaps!
      const callsBeforeRepeatResume = mockLlmRequestCount;
      const analyzeRepeat = (await (
        await fetch(`${base}/api/resumes/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            existingResumeId: analyze1.resume.id,
            filename: 'MemoryTest_Resume.txt',
            fileFormat: 'txt',
            rawText:
              'Senior Distributed Systems Engineer with 6 years building Kafka, PostgreSQL, and TypeScript architectures.',
            careerGoalsNote: 'Focus on Staff reliability',
          }),
        })
      ).json()) as {
        resume: { suggestedRoadmaps: Array<{ title: string }> };
        fromMemoryCache: boolean;
      };
      assert.equal(analyzeRepeat.fromMemoryCache, true);
      assert.equal(mockLlmRequestCount, callsBeforeRepeatResume);
      assert.deepEqual(
        analyzeRepeat.resume.suggestedRoadmaps.map((r) => r.title),
        analyze1.resume.suggestedRoadmaps.map((r) => r.title)
      );

      // 4. Launching a suggested roadmap reuses prepared nodes from memory with 0 AI calls!
      const callsBeforeStreamLaunch = mockLlmRequestCount;
      const launchJson = (await (
        await fetch(`${base}/api/streams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeId: analyze1.resume.id,
            suggestedRoadmapId: analyze1.resume.suggestedRoadmaps[0]!.id,
          }),
        })
      ).json()) as {
        stream: { id: string; phases: Array<{ topics: Array<{ id: string; title: string }> }> };
        reusedFromMemory: boolean;
      };
      assert.equal(launchJson.reusedFromMemory, true);
      assert.equal(mockLlmRequestCount, callsBeforeStreamLaunch);

      // On-demand stream node refresh when nothing changed -> 0 AI calls, consistent nodes
      const refreshNodesUnchanged = (await (
        await fetch(`${base}/api/streams/${launchJson.stream.id}/refresh-nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      ).json()) as { fromMemoryCache: boolean; updatedWithAi: boolean };
      assert.equal(refreshNodesUnchanged.fromMemoryCache, true);
      assert.equal(refreshNodesUnchanged.updatedWithAi, false);
      assert.equal(mockLlmRequestCount, callsBeforeStreamLaunch);

      // 5. Generate topic resources once -> cached in memory; subsequent reads & unchanged refreshes use 0 AI calls!
      const topicId = launchJson.stream.phases[0]!.topics[0]!.id;
      const genRes1 = (await (
        await fetch(`${base}/api/topics/${topicId}/resources/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focusNote: 'Replication trade-offs' }),
        })
      ).json()) as {
        resources: Array<{ title: string }>;
        fromMemoryCache: boolean;
      };
      assert.equal(genRes1.fromMemoryCache, false);
      assert.ok(genRes1.resources.length >= 2);

      const callsAfterInitialResources = mockLlmRequestCount;

      // Opening workspace reads from memory without AI
      const wsRead = (await (await fetch(`${base}/api/topics/${topicId}`)).json()) as {
        servedFromMemory: boolean;
        resources: Array<{ title: string }>;
      };
      assert.equal(wsRead.servedFromMemory, true);
      assert.equal(mockLlmRequestCount, callsAfterInitialResources);

      // On-demand refresh with unchanged focusNote & unchanged resume -> 0 AI calls, 100% consistent!
      const refreshUnchanged = (await (
        await fetch(`${base}/api/topics/${topicId}/resources/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focusNote: 'Replication trade-offs', refresh: true }),
        })
      ).json()) as {
        resources: Array<{ title: string }>;
        fromMemoryCache: boolean;
        refreshedWithAi: boolean;
      };
      assert.equal(refreshUnchanged.fromMemoryCache, true);
      assert.equal(refreshUnchanged.refreshedWithAi, false);
      assert.equal(mockLlmRequestCount, callsAfterInitialResources);
      assert.deepEqual(
        refreshUnchanged.resources.map((r) => r.title),
        genRes1.resources.map((r) => r.title)
      );

      // On-demand refresh WITH updated focusNote -> triggers AI update and updates memory cache
      const refreshUpdated = (await (
        await fetch(`${base}/api/topics/${topicId}/resources/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focusNote: 'Updated focus: Jepsen linearizability proofs',
            refresh: true,
          }),
        })
      ).json()) as {
        fromMemoryCache: boolean;
        refreshedWithAi: boolean;
      };
      assert.equal(refreshUpdated.refreshedWithAi, true);
      assert.equal(mockLlmRequestCount, callsAfterInitialResources + 1);
    } finally {
      apiServer.close();
      db.close();
    }
  });

  it('enforces mandatory onboarding gate, precomputes full 3-phase roadmap graph edges, updates avatar/profile, and guards Danger Zone actions', async () => {
    const db = new CareerForgeDB(':memory:');
    const app = createApp(db);
    const apiServer = http.createServer(app);
    await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
    const port = (apiServer.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    try {
      // 1. Fresh database starts un-onboarded, and /api/onboarding/complete rejects without an active provider
      const initialStatus = (await (await fetch(`${base}/api/status`)).json()) as {
        status: { isOnboarded: boolean; hasActiveProvider: boolean };
      };
      assert.equal(initialStatus.status.isOnboarded, false);
      assert.equal(initialStatus.status.hasActiveProvider, false);

      const prematureOnboard = await fetch(`${base}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Jyoti' }),
      });
      assert.equal(prematureOnboard.status, 400);

      // 2. Connect provider -> complete onboarding with custom avatar & headline -> isOnboarded becomes true
      await fetch(`${base}/api/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Verified Local Provider',
          type: 'openai_compatible',
          enabled: true,
          baseUrl: `http://127.0.0.1:${mockLlmPort}/v1`,
          apiKeyOrSecret: 'sk-onboard-key-1234',
        }),
      });

      const onboardOk = await fetch(`${base}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Alex Forger',
          headlineTitle: 'Staff Distributed & AI Engineer',
          avatarColor: 'emerald',
          avatarIcon: 'Brain',
        }),
      });
      assert.equal(onboardOk.status, 200);
      const onboardJson = (await onboardOk.json()) as {
        status: { isOnboarded: boolean };
        profile: {
          displayName: string;
          headlineTitle: string;
          avatarColor: string;
          avatarIcon: string;
          hasCompletedOnboarding: boolean;
        };
      };
      assert.equal(onboardJson.status.isOnboarded, true);
      assert.equal(onboardJson.profile.hasCompletedOnboarding, true);
      assert.equal(onboardJson.profile.displayName, 'Alex Forger');
      assert.equal(onboardJson.profile.avatarColor, 'emerald');
      assert.equal(onboardJson.profile.avatarIcon, 'Brain');

      // 3. Launch stream -> verify full 3-phase (9+ nodes) roadmap AND precomputed roadmapEdges DAG exist beforehand!
      const streamResp = await fetch(`${base}/api/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customStreamInput: {
            title: 'Staff Systems Track',
            targetRole: 'Staff Engineer',
            focusDescription: 'Consensus, storage engines, and global reliability',
            colorTheme: 'indigo',
          },
        }),
      });
      assert.equal(streamResp.status, 200);
      const streamJson = (await streamResp.json()) as {
        stream: {
          id: string;
          xp: number;
          phases: Array<{ topics: Array<{ id: string; isBossTopic: boolean }> }>;
          roadmapEdges: Array<{ kind: string; fromTopicId: string; toTopicId: string }>;
        };
      };
      assert.ok(streamJson.stream.phases.length >= 3);
      for (const ph of streamJson.stream.phases) {
        assert.ok(ph.topics.length >= 3);
      }
      assert.ok(streamJson.stream.roadmapEdges.length >= 8);
      assert.ok(streamJson.stream.roadmapEdges.some((e) => e.kind === 'intra_phase'));
      assert.ok(streamJson.stream.roadmapEdges.some((e) => e.kind === 'cross_phase'));
      assert.ok(streamJson.stream.roadmapEdges.some((e) => e.kind === 'boss_convergence'));

      // 4. Preferences update persists
      const prefResp = await fetch(`${base}/api/settings/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compactStreamCards: true, defaultLanguageHint: 'go' }),
      });
      assert.equal(prefResp.status, 200);
      const prefJson = (await prefResp.json()) as {
        preferences: { compactStreamCards: boolean; defaultLanguageHint: string };
      };
      assert.equal(prefJson.preferences.compactStreamCards, true);
      assert.equal(prefJson.preferences.defaultLanguageHint, 'go');

      // 5. Guarded Danger Zone rejects missing checkbox OR wrong/lowercase phrase
      const rejectUnchecked = await fetch(`${base}/api/settings/danger-zone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_progress',
          confirmationPhrase: 'RESET PROGRESS',
          acknowledgedIrreversible: false,
        }),
      });
      assert.equal(rejectUnchecked.status, 400);

      const rejectWrongPhrase = await fetch(`${base}/api/settings/danger-zone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_progress',
          confirmationPhrase: 'reset progress',
          acknowledgedIrreversible: true,
        }),
      });
      assert.equal(rejectWrongPhrase.status, 400);

      // Valid guarded RESET PROGRESS resets XP to 0 while keeping streams & onboarding intact
      const okResetProgress = await fetch(`${base}/api/settings/danger-zone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_progress',
          confirmationPhrase: 'RESET PROGRESS',
          acknowledgedIrreversible: true,
        }),
      });
      assert.equal(okResetProgress.status, 200);
      const resetProgJson = (await okResetProgress.json()) as {
        status: { isOnboarded: boolean; activeStreamCount: number };
        profile: { globalXp: number; globalLevel: number };
      };
      assert.equal(resetProgJson.status.isOnboarded, true);
      assert.equal(resetProgJson.status.activeStreamCount, 1);
      assert.equal(resetProgJson.profile.globalXp, 0);
      assert.equal(resetProgJson.profile.globalLevel, 1);

      // Valid guarded FACTORY RESET wipes everything and returns isOnboarded to false
      const okFactoryReset = await fetch(`${base}/api/settings/danger-zone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'factory_reset',
          confirmationPhrase: 'FACTORY RESET',
          acknowledgedIrreversible: true,
        }),
      });
      assert.equal(okFactoryReset.status, 200);
      const factoryJson = (await okFactoryReset.json()) as {
        status: { isOnboarded: boolean; hasActiveProvider: boolean; activeStreamCount: number };
      };
      assert.equal(factoryJson.status.isOnboarded, false);
      assert.equal(factoryJson.status.hasActiveProvider, false);
      assert.equal(factoryJson.status.activeStreamCount, 0);
    } finally {
      apiServer.close();
      db.close();
    }
  });
});
