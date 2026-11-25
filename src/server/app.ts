import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import type { CareerForgeDB } from './db/database.ts';
import { JevModelRouter } from './services/jevRouter.ts';
import {
  AIDriver,
  InferenceError,
  DEFAULT_PROVIDER_PRESETS,
  detectLocalCodexStatus,
} from './services/aiDriver.ts';
import { GamificationService } from './services/gamificationService.ts';
import { CareerEngine } from './services/careerEngine.ts';
import { MemoryCacheService } from './services/memoryCache.ts';
import { parseResumeBuffer } from './services/resumeParser.ts';
import type {
  AppPreferences,
  CompleteOnboardingInput,
  DangerZoneAction,
  DangerZoneRequest,
  ProblemArchetype,
  ProblemDifficulty,
  ProviderType,
  SaveJevConfigInput,
  SaveProviderInput,
  StreamStatus,
  SystemStatusResponse,
  TaskPurpose,
  UpdateProfileInput,
} from '../shared/types.ts';

const DANGER_ZONE_PHRASES: Record<DangerZoneAction, string> = {
  reset_evaluations: 'RESET EVALUATIONS',
  reset_progress: 'RESET PROGRESS',
  delete_streams_and_resumes: 'DELETE ROADMAPS',
  factory_reset: 'FACTORY RESET',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB resume file limit
});

export function createApp(db: CareerForgeDB) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const router = new JevModelRouter(db);
  const aiDriver = new AIDriver(db, router);
  const gamification = new GamificationService(db);
  const memoryCache = new MemoryCacheService(db);
  const engine = new CareerEngine(db, aiDriver, gamification, memoryCache);

  const buildSystemStatus = (): SystemStatusResponse => {
    const providers = db.listProviders();
    const activeProviders = providers.filter((p) => p.enabled);
    const connectedProviders = providers.filter((p) => p.connectionStatus === 'connected');
    const jev = db.getJevConfig();
    const latestResume = db.getLatestResume();
    const activeStreams = db.listStreams().filter((s) => s.status === 'active');
    const codexStatus = detectLocalCodexStatus();
    const player = db.getPlayerProfile();

    return {
      dbPath: db.dbPath,
      dbFileSizeBytes: db.getDbFileSizeBytes(),
      isOnboarded: player.hasCompletedOnboarding && activeProviders.length > 0,
      hasActiveProvider: activeProviders.length > 0,
      activeProviderCount: activeProviders.length,
      connectedProviderCount: connectedProviders.length,
      jevConfigured: jev.enabled && jev.hasApiKey,
      jevStatus: jev.status,
      hasResume: Boolean(latestResume),
      activeStreamCount: activeStreams.length,
      codexLocalAuthDetected: codexStatus.authFileExists,
      codexLocalAuthPath: codexStatus.authPath,
      codexCliInstalled: codexStatus.cliInstalled,
      memoryCache: memoryCache.getStats(),
      preferences: db.getPreferences(),
    };
  };

  // ---------------- System Status & Onboarding ----------------
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({
      status: buildSystemStatus(),
      presets: DEFAULT_PROVIDER_PRESETS,
    });
  });

  app.post('/api/onboarding/complete', (req: Request, res: Response) => {
    const providers = db.listProviders();
    const activeProviders = providers.filter((p) => p.enabled);
    if (activeProviders.length === 0) {
      res.status(400).json({
        error:
          'Mandatory setup incomplete: Connect and enable at least one AI provider before entering CareerForge.',
      });
      return;
    }
    const body = (req.body ?? {}) as CompleteOnboardingInput;
    const profile = db.completeOnboarding(body);
    res.json({
      status: buildSystemStatus(),
      profile,
    });
  });

  // ---------------- AI Providers ----------------
  app.get('/api/providers', (_req: Request, res: Response) => {
    res.json({
      providers: db.listProviders(),
      presets: DEFAULT_PROVIDER_PRESETS,
    });
  });

  app.post('/api/providers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as SaveProviderInput;
      if (!body.name || !body.type) {
        res.status(400).json({ error: 'Provider name and type are required.' });
        return;
      }

      const hadEnabledBefore = db.listProviders().some((p) => p.enabled);

      // Automatically manage candidate models so the user never has to manually assign models
      let resolvedModels = body.models;
      if (!resolvedModels || resolvedModels.length === 0) {
        const existingProv = body.id ? db.getProviderWithSecret(body.id) : null;
        if (body.autoVerify !== false && body.enabled) {
          try {
            const discovered = await aiDriver.discoverModels({
              type: body.type,
              baseUrl: body.baseUrl,
              apiKeyOrSecret: body.apiKeyOrSecret,
              providerId: body.id,
            });
            if (discovered.length > 0) {
              resolvedModels = discovered;
            }
          } catch {
            // Fall back to curated automatic model catalog
          }
        }
        if (!resolvedModels || resolvedModels.length === 0) {
          resolvedModels =
            existingProv && existingProv.models.length > 0
              ? existingProv.models
              : DEFAULT_PROVIDER_PRESETS[body.type]?.models ?? [];
        }
      }

      let saved = db.saveProvider({
        ...body,
        models: resolvedModels,
      });

      let verificationResult: {
        ok: boolean;
        latencyMs: number;
        message: string;
      } | null = null;

      if (saved.enabled && body.autoVerify !== false) {
        const testRes = await aiDriver.testProvider(saved.id);
        verificationResult = {
          ok: testRes.ok,
          latencyMs: testRes.latencyMs,
          message: testRes.message,
        };
        const refreshed = db.listProviders().find((p) => p.id === saved.id);
        if (refreshed) saved = refreshed;
      }

      let gamificationDelta = null;
      if (!hadEnabledBefore && saved.enabled) {
        const { delta } = gamification.grantXpAndCheckProgression({
          baseXp: 50,
          baseSparks: 20,
          source: 'provider_setup',
          description: `Configured first AI provider: ${saved.name}`,
          extraAchievementCodes: ['ENGINE_IGNITED'],
        });
        gamificationDelta = delta;
      } else {
        const unlocked = gamification.checkSystemAchievements();
        if (unlocked.length > 0) {
          const { delta } = gamification.grantXpAndCheckProgression({
            baseXp: 0,
            baseSparks: 0,
            source: 'achievement_check',
            description: 'Inference Fleet updated',
          });
          gamificationDelta = { ...delta, unlockedAchievements: unlocked };
        }
      }

      res.json({
        provider: saved,
        providers: db.listProviders(),
        verificationResult,
        gamificationDelta,
      });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/providers/:id', (req: Request, res: Response) => {
    db.deleteProvider(String(req.params.id));
    res.json({ providers: db.listProviders() });
  });

  app.post('/api/providers/:id/test', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await aiDriver.testProvider(String(req.params.id));
      res.json({
        ...result,
        providers: db.listProviders(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/providers/discover-models',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as {
          type: ProviderType;
          baseUrl: string;
          apiKeyOrSecret?: string;
          providerId?: string;
        };
        const models = await aiDriver.discoverModels(body);
        res.json({ models });
      } catch (err) {
        next(err);
      }
    }
  );

  // ---------------- TypeSafe Jev Router ----------------
  app.get('/api/jev', (_req: Request, res: Response) => {
    res.json({
      config: db.getJevConfig(),
      decisions: db.listRoutingDecisions(40),
    });
  });

  app.post('/api/jev', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as SaveJevConfigInput;
      let saved = db.saveJevConfig(input);
      let verificationResult: {
        ok: boolean;
        latencyMs: number;
        message: string;
      } | null = null;

      if (saved.enabled && saved.hasApiKey && input.autoVerify !== false) {
        const testRes = await router.testJevConnection();
        verificationResult = {
          ok: testRes.ok,
          latencyMs: testRes.latencyMs,
          message: testRes.message,
        };
        saved = db.getJevConfig();
      }

      const unlocked = gamification.checkSystemAchievements();
      res.json({
        config: saved,
        verificationResult,
        unlockedAchievements: unlocked,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/jev/test', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await router.testJevConnection();
      res.json({
        ...result,
        config: db.getJevConfig(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/jev/simulate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { purpose?: TaskPurpose; samplePrompt?: string };
      const purpose: TaskPurpose = body.purpose ?? 'solution_evaluation';
      const samplePrompt =
        body.samplePrompt ??
        `Task simulation for ${purpose}: Evaluate multi-constraint distributed systems architecture and edge cases.`;
      const { decision } = await router.routeTask({
        purpose,
        promptPreview: samplePrompt,
      });
      res.json({
        decision,
        decisions: db.listRoutingDecisions(40),
      });
    } catch (err) {
      next(err);
    }
  });

  // ---------------- Resumes & Roadmaps ----------------
  app.get('/api/resumes', (_req: Request, res: Response) => {
    res.json({
      latest: db.getLatestResume(),
      history: db.listResumes(),
    });
  });

  app.post(
    '/api/resumes/parse-file',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No resume file uploaded.' });
          return;
        }
        const parsed = await parseResumeBuffer(req.file.buffer, req.file.originalname);
        res.json(parsed);
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/resumes/analyze', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        filename?: string;
        fileFormat?: string;
        rawText: string;
        careerGoalsNote?: string;
        existingResumeId?: string;
      };

      if (typeof body?.rawText !== 'string' || body.rawText.trim().length < 40) {
        res.status(400).json({
          error: 'Please upload or paste a resume with at least 40 characters of content.',
        });
        return;
      }

      const result = await engine.analyzeResumeAndSuggestRoadmaps({
        filename: body.filename || 'Pasted Resume.txt',
        fileFormat: body.fileFormat || 'txt',
        rawText: body.rawText,
        careerGoalsNote: body.careerGoalsNote,
        existingResumeId: body.existingResumeId,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof InferenceError) {
        const stage = err.purpose === 'roadmap_suggestion' ? 'Roadmap generation' : 'Resume profile analysis';
        res.status(err.status).json({ error: `${stage} failed. ${err.message}` });
        return;
      }
      next(err);
    }
  });

  // ---------------- Career Streams ----------------
  app.get('/api/streams', (_req: Request, res: Response) => {
    res.json({ streams: db.listStreams() });
  });

  app.get('/api/streams/:id', (req: Request, res: Response) => {
    const stream = db.getStream(String(req.params.id));
    if (!stream) {
      res.status(404).json({ error: 'Career stream not found.' });
      return;
    }
    res.json({ stream });
  });

  app.post('/api/streams', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        resumeId?: string;
        suggestedRoadmapId?: string;
        customStreamInput?: {
          title: string;
          targetRole: string;
          focusDescription: string;
          colorTheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
        };
      };

      const result = await engine.launchCareerStream(body);
      res.json({
        ...result,
        streams: db.listStreams(),
        latestResume: db.getLatestResume(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/streams/:id', (req: Request, res: Response) => {
    const body = req.body as { status: StreamStatus };
    const updated = db.updateStreamStatus(String(req.params.id), body.status);
    if (!updated) {
      res.status(404).json({ error: 'Stream not found.' });
      return;
    }
    res.json({ stream: updated, streams: db.listStreams() });
  });

  app.post(
    '/api/streams/:id/refresh-nodes',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as { updatedFocusDescription?: string };
        const result = await engine.refreshStreamNodesOnDemand({
          streamId: String(req.params.id),
          updatedFocusDescription: body.updatedFocusDescription,
        });
        res.json({
          ...result,
          streams: db.listStreams(),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete('/api/streams/:id', (req: Request, res: Response) => {
    db.deleteStream(String(req.params.id));
    res.json({ streams: db.listStreams() });
  });

  // ---------------- Topic Workspace, Learning Resources & Practice Arena ----------------
  app.get('/api/topics/:topicId', (req: Request, res: Response) => {
    try {
      const topicId = String(req.params.topicId);
      const workspace = engine.getTopicWorkspaceFromMemory(topicId);
      res.json(workspace);
    } catch {
      res.status(404).json({ error: 'Topic not found.' });
    }
  });

  app.post(
    '/api/topics/:topicId/resources/generate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as { focusNote?: string; refresh?: boolean };
        const result = await engine.generateTopicResources({
          topicId: String(req.params.topicId),
          focusNote: body.focusNote,
          refresh: Boolean(body.refresh),
        });
        const topic = db.getTopic(String(req.params.topicId))!;
        res.json({
          ...result,
          topic,
          stream: db.getStream(topic.streamId),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get('/api/memory-cache', (_req: Request, res: Response) => {
    res.json({
      stats: memoryCache.getStats(),
      nodes: memoryCache.listCachedTopicNodes(),
    });
  });

  app.post('/api/topics/:topicId/resources/custom', (req: Request, res: Response) => {
    const topic = db.getTopic(String(req.params.topicId));
    if (!topic) {
      res.status(404).json({ error: 'Topic not found.' });
      return;
    }
    const body = req.body as {
      title: string;
      url?: string;
      providerOrAuthor?: string;
      notes?: string;
      estimatedMinutes?: number;
    };
    const resource = db.insertResource({
      streamId: topic.streamId,
      topicId: topic.id,
      kind: 'external_article',
      title: body.title || 'Custom Learning Bookmark',
      url: body.url?.trim() || null,
      providerOrAuthor: body.providerOrAuthor?.trim() || 'Personal Study Note',
      estimatedMinutes: Number(body.estimatedMinutes ?? 20),
      difficulty: topic.difficulty,
      whyRelevant: 'Added manually to stream study vault.',
      contentMarkdown: body.notes ?? '',
      flashcards: [],
      xpReward: 25,
      generatedByModel: null,
    });
    db.recomputeStreamAndTopicMetrics(topic.streamId, topic.id);
    res.json({
      resource,
      resources: db.listResourcesForTopic(topic.id),
      stream: db.getStream(topic.streamId),
    });
  });

  app.patch('/api/resources/:resourceId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { isCompleted?: boolean; isBookmarked?: boolean };
      const result = engine.completeOrToggleResource({
        resourceId: String(req.params.resourceId),
        isCompleted: body.isCompleted,
        isBookmarked: body.isBookmarked,
      });
      res.json({
        ...result,
        resources: db.listResourcesForTopic(result.resource.topicId),
        topic: db.getTopic(result.resource.topicId),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/topics/:topicId/problems/generate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as {
          archetype?: ProblemArchetype;
          difficulty?: ProblemDifficulty;
        };
        const result = await engine.generatePracticeProblem({
          topicId: String(req.params.topicId),
          archetype: body.archetype,
          difficulty: body.difficulty,
        });
        const topic = db.getTopic(String(req.params.topicId))!;
        res.json({
          ...result,
          problems: db.listProblemsForTopic(topic.id),
          topic,
          stream: db.getStream(topic.streamId),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.put('/api/problems/:problemId/draft', (req: Request, res: Response) => {
    const body = req.body as { draftSolution: string };
    db.saveProblemDraft(String(req.params.problemId), body.draftSolution ?? '');
    res.json({ ok: true });
  });

  app.post('/api/problems/:problemId/reveal-hint', (req: Request, res: Response) => {
    const updated = db.revealNextHint(String(req.params.problemId));
    if (!updated) {
      res.status(404).json({ error: 'Problem not found.' });
      return;
    }
    res.json({ problem: updated });
  });

  app.post(
    '/api/problems/:problemId/mentor-coach',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as { currentDraft: string; question?: string };
        const result = await engine.getLiveMentorCoachHint({
          problemId: String(req.params.problemId),
          currentDraft: body.currentDraft ?? '',
          question: body.question,
        });
        res.json({
          ...result,
          problem: db.getPracticeProblem(String(req.params.problemId)),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/problems/:problemId/submit',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = req.body as { solutionText: string };
        const result = await engine.submitAndEvaluateSolution({
          problemId: String(req.params.problemId),
          solutionText: body.solutionText ?? '',
        });
        res.json({
          ...result,
          problems: db.listProblemsForTopic(result.problem.topicId),
          recentSubmissions: db.listSubmissionsForTopic(result.problem.topicId, 20),
          topic: db.getTopic(result.problem.topicId),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ---------------- Gamification, Easter Eggs & Reliquary ----------------
  app.get('/api/gamification', (_req: Request, res: Response) => {
    res.json({ profile: db.getPlayerProfile() });
  });

  app.patch('/api/gamification/profile', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as UpdateProfileInput;
    const profile = db.updatePlayerProfile(body);
    res.json({ profile });
  });

  // ---------------- Settings, Preferences & Guarded Danger Zone ----------------
  app.get('/api/settings/preferences', (_req: Request, res: Response) => {
    res.json({ preferences: db.getPreferences() });
  });

  app.put('/api/settings/preferences', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Partial<AppPreferences>;
    const preferences = db.savePreferences(body);
    res.json({ preferences, status: buildSystemStatus() });
  });

  app.post('/api/settings/clear-memory-cache', (_req: Request, res: Response) => {
    db.clearPreparedCaches();
    memoryCache.clearAll();
    res.json({
      ok: true,
      message: 'In-memory roadmap & resource caches cleared.',
      memoryCache: memoryCache.getStats(),
    });
  });

  app.post('/api/settings/danger-zone', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as DangerZoneRequest;
    const expectedPhrase = DANGER_ZONE_PHRASES[body.action];
    if (!expectedPhrase) {
      res.status(400).json({ error: 'Unknown Danger Zone action.' });
      return;
    }
    if (!body.acknowledgedIrreversible) {
      res.status(400).json({
        error: 'You must explicitly acknowledge that this action is permanent and irreversible.',
      });
      return;
    }
    if ((body.confirmationPhrase ?? '').trim() !== expectedPhrase) {
      res.status(400).json({
        error: `Confirmation mismatch. Please type the exact phrase "${expectedPhrase}" to proceed.`,
      });
      return;
    }

    db.executeDangerZoneAction(body.action);
    if (body.action === 'delete_streams_and_resumes' || body.action === 'factory_reset') {
      memoryCache.clearAll();
    }
    if (body.action === 'reset_progress') {
      gamification.checkSystemAchievements();
    }

    const actionMessages: Record<DangerZoneAction, string> = {
      reset_evaluations: 'All practice submissions and evaluation scores have been reset.',
      reset_progress:
        'All XP, levels, streaks, achievements, and stream mastery progress have been reset.',
      delete_streams_and_resumes:
        'All career streams, resumes, and cached roadmaps have been deleted.',
      factory_reset:
        'Factory reset complete. All data cleared and onboarding restored to initial setup.',
    };

    res.json({
      ok: true,
      message: actionMessages[body.action],
      status: buildSystemStatus(),
      profile: db.getPlayerProfile(),
    });
  });

  app.post('/api/gamification/easter-egg', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        eggId: 'konami' | 'anvil_seven' | 'terminal_command';
        commandText?: string;
      };
      const result = gamification.triggerEasterEgg(body);
      res.json({
        ...result,
        profile: db.getPlayerProfile(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/gamification/reliquary', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = gamification.redeemMysteryReliquary();
      res.json({
        ...result,
        profile: db.getPlayerProfile(),
      });
    } catch (err) {
      next(err);
    }
  });

  // Serve production client build if present
  const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('/{*splat}', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Centralized error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    res.status(400).json({ error: message });
  });

  return app;
}
