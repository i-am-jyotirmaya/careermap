import crypto from 'node:crypto';
import type { CareerForgeDB } from '../db/database.ts';
import { InferenceError, type AIDriver } from './aiDriver.ts';
import type { GamificationService } from './gamificationService.ts';
import {
  type CachedResourceTemplate,
  type MemoryCacheService,
  canonicalizeKey,
  computeContextHash,
} from './memoryCache.ts';
import type {
  CareerProfile,
  CareerStream,
  GamificationDelta,
  LearningResource,
  PracticeProblem,
  PreparedPhaseBlueprint,
  PreparedTopicNode,
  ProblemArchetype,
  ProblemDifficulty,
  ResourceKind,
  ResumeRecord,
  RoutingDecision,
  SolutionSubmission,
  SuggestedRoadmap,
  TopicDifficulty,
  TopicWorkspaceResponse,
} from '../../shared/types.ts';

const VALID_THEMES = ['indigo', 'emerald', 'amber', 'rose', 'cyan', 'violet'] as const;

function sanitizeTheme(val: string | undefined, idx = 0): CareerStream['colorTheme'] {
  if (val && (VALID_THEMES as readonly string[]).includes(val)) {
    return val as CareerStream['colorTheme'];
  }
  return VALID_THEMES[idx % VALID_THEMES.length]!;
}

function emptyGamificationDelta(globalLevel = 1): GamificationDelta {
  return {
    xpGained: 0,
    sparksGained: 0,
    leveledUpGlobal: false,
    newGlobalLevel: globalLevel,
    leveledUpStream: false,
    unlockedAchievements: [],
    completedQuests: [],
    lootDropMessage: null,
  };
}

function ensureFullPrecomputedRoadmap(
  rawPhases: PreparedPhaseBlueprint[],
  streamTitle: string,
  targetRole: string,
  gapSkills: string[]
): PreparedPhaseBlueprint[] {
  const defaultPhaseDefs: Array<{
    title: string;
    objective: string;
    defaultDifficulty: TopicDifficulty;
    fallbackTopics: string[];
  }> = [
    {
      title: 'Phase 1: Core Foundations & Mental Models',
      objective: `Establish rock-solid architectural and implementation fundamentals for ${targetRole}.`,
      defaultDifficulty: 'foundation',
      fallbackTopics: [
        `${gapSkills[0] || streamTitle} Core Invariants`,
        `System Contracts & Data Modeling`,
        `Observability & Failure Modes`,
      ],
    },
    {
      title: 'Phase 2: Production Execution & Scale',
      objective: `Apply ${streamTitle} patterns under real-world throughput, latency, and reliability constraints.`,
      defaultDifficulty: 'intermediate',
      fallbackTopics: [
        `${gapSkills[1] || 'Distributed Execution'} Trade-offs`,
        `Resilience, Retries & Performance Tuning`,
        `End-to-End Production Integration`,
      ],
    },
    {
      title: 'Phase 3: Staff+ Mastery & Boss Capstone',
      objective: `Synthesize multi-system trade-offs and conquer a realistic ${targetRole} Boss Capstone.`,
      defaultDifficulty: 'advanced',
      fallbackTopics: [
        `Cross-Cutting Architecture & Governance`,
        `High-Stakes Incident & Design Defense`,
        `Boss Capstone: ${streamTitle} End-to-End Architecture`,
      ],
    },
  ];

  const normalized: PreparedPhaseBlueprint[] = [];
  const totalPhases = Math.max(3, rawPhases.length);

  for (let pIdx = 0; pIdx < totalPhases; pIdx++) {
    const existing = rawPhases[pIdx];
    const def = defaultPhaseDefs[Math.min(pIdx, defaultPhaseDefs.length - 1)]!;
    const phaseTitle = existing?.title || def.title;
    const phaseObjective = existing?.objective || def.objective;
    const topics: PreparedTopicNode[] = [...(existing?.topics ?? [])].map((t) => ({
      ...t,
      isBossTopic: false,
    }));

    // Ensure at least 3 nodes per phase so the entire roadmap flow graph is rich and complete beforehand
    let fallbackIdx = 0;
    while (topics.length < 3) {
      const candidateTitle =
        def.fallbackTopics[fallbackIdx] || `${streamTitle} Milestone ${pIdx + 1}.${topics.length + 1}`;
      fallbackIdx++;
      if (topics.some((t) => canonicalizeKey(t.title) === canonicalizeKey(candidateTitle))) {
        continue;
      }
      topics.push({
        canonicalKey: canonicalizeKey(candidateTitle),
        title: candidateTitle,
        summary: `${phaseObjective} Focus area: ${candidateTitle}.`,
        estimatedHours: pIdx === totalPhases - 1 && topics.length === 2 ? 6 : 4,
        difficulty:
          pIdx === totalPhases - 1 && topics.length === 2 ? 'staff_plus' : def.defaultDifficulty,
        keySkills: gapSkills.length > 0 ? gapSkills.slice(0, 3) : [streamTitle, targetRole],
        isBossTopic: false,
      });
    }

    normalized.push({
      title: phaseTitle,
      objective: phaseObjective,
      topics,
    });
  }

  // Mark the culminating topic of the final phase as the Boss Capstone
  const finalPhase = normalized[normalized.length - 1]!;
  if (finalPhase.topics.length > 0) {
    finalPhase.topics[finalPhase.topics.length - 1]!.isBossTopic = true;
  }

  return normalized;
}

export class CareerEngine {
  private readonly db: CareerForgeDB;
  private readonly ai: AIDriver;
  private readonly gamification: GamificationService;
  private readonly memoryCache: MemoryCacheService;

  constructor(
    db: CareerForgeDB,
    ai: AIDriver,
    gamification: GamificationService,
    memoryCache: MemoryCacheService
  ) {
    this.db = db;
    this.ai = ai;
    this.gamification = gamification;
    this.memoryCache = memoryCache;
  }

  // 1. Analyze Resume + Prepare Roadmaps & Topic Nodes (with Memory Cache + Consistent Refresh)
  public async analyzeResumeAndSuggestRoadmaps(params: {
    filename: string;
    fileFormat: string;
    rawText: string;
    careerGoalsNote?: string;
    existingResumeId?: string;
  }): Promise<{
    resume: ResumeRecord;
    routingDecisions: RoutingDecision[];
    gamificationDelta: GamificationDelta;
    fromMemoryCache: boolean;
    consistencyNote: string;
  }> {
    const contextHash = computeContextHash([params.rawText, params.careerGoalsNote ?? '']);
    const existingResume = params.existingResumeId
      ? this.db.getResume(params.existingResumeId)
      : this.db.getLatestResume();

    // If neither resume text nor career goals changed, return exact consistent state without AI
    if (
      existingResume &&
      existingResume.contextHash === contextHash &&
      existingResume.profile &&
      existingResume.suggestedRoadmaps.length > 0
    ) {
      return {
        resume: existingResume,
        routingDecisions: [],
        gamificationDelta: emptyGamificationDelta(this.db.getPlayerProfile().globalLevel),
        fromMemoryCache: true,
        consistencyNote:
          'Consistent — resume content and career goals have not changed; serving prepared profile & roadmap nodes from memory without AI.',
      };
    }

    const routingDecisions: RoutingDecision[] = [];

    // Step A: Resume Analysis (purpose: resume_analysis, temperature: 0 for consistency)
    const profileResp = await this.ai.executeJson<{
      headline: string;
      currentRole: string;
      seniorityEstimate: string;
      yearsOfExperience: number;
      summary: string;
      skills: Array<{
        name: string;
        category: string;
        level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
        yearsEvidence: string;
      }>;
      superpowers: string[];
      growthGaps: string[];
      domains: string[];
      standoutHighlights: string[];
    }>({
      purpose: 'resume_analysis',
      temperature: 0,
      systemPrompt: `You are a Principal Career Strategist and Staff Engineering Bar-Raiser.
Analyze the candidate's resume thoroughly and extract an accurate, consistent, high-signal structured CareerProfile JSON object.`,
      userPrompt: `Analyze this resume and return JSON with exact keys:
{
  "headline": "concise professional identity headline",
  "currentRole": "current or most recent title",
  "seniorityEstimate": "e.g. Mid-Level, Senior, Staff, Lead, Entry-Level",
  "yearsOfExperience": number,
  "summary": "2-3 sentence executive synthesis of background and trajectory",
  "skills": [
    { "name": "Skill", "category": "Languages | Systems | AI/Data | Cloud/Infra | Leadership | Domain", "level": "beginner|intermediate|advanced|expert", "yearsEvidence": "brief evidence from resume" }
  ],
  "superpowers": ["3-5 concrete differentiators evidenced in the resume"],
  "growthGaps": ["4-5 high-leverage skill or scope gaps to unlock the next career tier"],
  "domains": ["industry or technical domains"],
  "standoutHighlights": ["3 notable achievements from the resume"]
}

CANDIDATE RESUME:
${params.rawText.slice(0, 24000)}`,
    });

    routingDecisions.push(profileResp.routingDecision);

    const profile: CareerProfile = {
      headline: profileResp.data.headline || 'Technology Professional',
      currentRole: profileResp.data.currentRole || 'Software Engineer',
      seniorityEstimate: profileResp.data.seniorityEstimate || 'Mid-Senior',
      yearsOfExperience: Number(profileResp.data.yearsOfExperience ?? 3),
      summary:
        profileResp.data.summary ||
        'Experienced professional seeking structured multi-stream growth.',
      skills: Array.isArray(profileResp.data.skills) ? profileResp.data.skills.slice(0, 18) : [],
      superpowers: Array.isArray(profileResp.data.superpowers) ? profileResp.data.superpowers : [],
      growthGaps: Array.isArray(profileResp.data.growthGaps) ? profileResp.data.growthGaps : [],
      domains: Array.isArray(profileResp.data.domains) ? profileResp.data.domains : [],
      standoutHighlights: Array.isArray(profileResp.data.standoutHighlights)
        ? profileResp.data.standoutHighlights
        : [],
    };

    const anchorNote =
      existingResume && existingResume.suggestedRoadmaps.length > 0
        ? `\nPREVIOUS ROADMAP TITLES FOR CONSISTENCY (preserve unchanged tracks unless new resume/goal information warrants adjustment):\n${existingResume.suggestedRoadmaps
            .map((r) => `- ${r.title} (${r.targetRole})`)
            .join('\n')}`
        : '';

    // Step B: Multi-Stream Career Roadmap Suggestions + Prepared Nodes (temperature: 0)
    const roadmapsResp = await this.ai.executeJson<{
      roadmaps: Array<{
        title: string;
        tagline: string;
        category: 'vertical_growth' | 'adjacent_pivot' | 'leadership_track' | 'specialist_frontier';
        targetRole: string;
        fitScore: number;
        difficulty: 'moderate' | 'challenging' | 'ambitious';
        estimatedWeeks: number;
        marketDemand: 'high' | 'surging' | 'evergreen';
        whyItFits: string;
        bridgeSkills: string[];
        gapSkillsToBuild: string[];
        colorTheme: string;
        iconName: string;
        phasesPreview?: Array<{
          title: string;
          objective: string;
          keyTopics: string[];
        }>;
        preparedPhases?: Array<{
          title: string;
          objective: string;
          topics: Array<{
            title: string;
            summary: string;
            estimatedHours: number;
            difficulty: TopicDifficulty;
            keySkills: string[];
            isBossTopic?: boolean;
          }>;
        }>;
      }>;
    }>({
      purpose: 'roadmap_suggestion',
      temperature: 0,
      systemPrompt: `You are an elite Career Architect. Based on the candidate's structured profile and aspirations, propose 4 distinct, compelling career growth roadmaps that can be pursued independently or in parallel streams, including their complete 3-phase topic nodes so they are ready in memory immediately.`,
      userPrompt: `Generate 4 tailored career growth roadmaps as JSON. Give each roadmap exactly 3 phases and each phase exactly 3 topics. Keep each description to one sentence.
{
  "roadmaps": [
    {
      "title": "Stream Title",
      "tagline": "Punchy 1-line value proposition",
      "category": "vertical_growth | adjacent_pivot | leadership_track | specialist_frontier",
      "targetRole": "Target role unlocked",
      "fitScore": 88,
      "difficulty": "moderate | challenging | ambitious",
      "estimatedWeeks": 12,
      "marketDemand": "high | surging | evergreen",
      "whyItFits": "Specific explanation referencing the candidate's existing skills and gaps",
      "bridgeSkills": ["existing skills from resume that transfer"],
      "gapSkillsToBuild": ["new high-value skills this stream teaches"],
      "colorTheme": "indigo | emerald | amber | rose | cyan | violet",
      "iconName": "Rocket | Cpu | Layers | Shield | Brain | Compass",
      "preparedPhases": [
        {
          "title": "Phase 1: ...",
          "objective": "Clear capability gained in Phase 1",
          "topics": [
            {
              "title": "Topic Title",
              "summary": "One concise sentence describing what to learn and practice",
              "estimatedHours": 4,
              "difficulty": "foundation | intermediate | advanced | staff_plus",
              "keySkills": ["skill1", "skill2"],
              "isBossTopic": false
            }
          ]
        }
      ]
    }
  ]
}

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

OPTIONAL USER PREFERENCES / FOCUS:
${params.careerGoalsNote?.trim() || 'Suggest diverse, high-upside career growth streams tailored to my background.'}${anchorNote}`,
    });

    const roadmaps = roadmapsResp.data?.roadmaps;
    if (!Array.isArray(roadmaps) || roadmaps.length === 0) {
      throw new InferenceError(
        'roadmap_suggestion',
        new Error('The AI provider returned no career roadmaps.')
      );
    }
    routingDecisions.push(roadmapsResp.routingDecision);

    const existingActivatedBySlug = new Map<string, string>();
    for (const prevRm of existingResume?.suggestedRoadmaps ?? []) {
      if (prevRm.activatedStreamId) {
        existingActivatedBySlug.set(canonicalizeKey(prevRm.title), prevRm.activatedStreamId);
      }
    }

    const nowIso = new Date().toISOString();
    const suggestedRoadmaps: SuggestedRoadmap[] = roadmaps.map(
      (rm, idx) => {
        const rmId = crypto.randomUUID();
        const rmTitle = rm.title || `Career Growth Track ${idx + 1}`;
        const rmTarget = rm.targetRole || 'Next-Level Role';
        const gapSkills = Array.isArray(rm.gapSkillsToBuild) ? rm.gapSkillsToBuild : [];

        // Normalize preparedPhases (or upgrade phasesPreview into full PreparedPhaseBlueprint nodes)
        let preparedPhases: PreparedPhaseBlueprint[] = [];
        if (Array.isArray(rm.preparedPhases) && rm.preparedPhases.length > 0) {
          preparedPhases = rm.preparedPhases.map((p, pIdx, pArr) => ({
            title: p.title || `Phase ${pIdx + 1}`,
            objective: p.objective || 'Build progressive mastery',
            topics: (p.topics ?? []).map((t, tIdx, tArr) => {
              const title = t.title || `Topic ${tIdx + 1}`;
              const canonicalKey = canonicalizeKey(title);
              return {
                canonicalKey,
                title,
                summary: t.summary || `Master ${title} concepts and production trade-offs.`,
                estimatedHours: Number(t.estimatedHours ?? 4),
                difficulty: (['foundation', 'intermediate', 'advanced', 'staff_plus'].includes(
                  t.difficulty
                )
                  ? t.difficulty
                  : pIdx === 0
                    ? 'foundation'
                    : pIdx === pArr.length - 1
                      ? 'advanced'
                      : 'intermediate') as TopicDifficulty,
                keySkills:
                  Array.isArray(t.keySkills) && t.keySkills.length > 0
                    ? t.keySkills
                    : gapSkills.slice(0, 3),
                isBossTopic:
                  Boolean(t.isBossTopic) ||
                  (pIdx === pArr.length - 1 && tIdx === tArr.length - 1),
              };
            }),
          }));
        } else if (Array.isArray(rm.phasesPreview) && rm.phasesPreview.length > 0) {
          preparedPhases = rm.phasesPreview.map((pp, pIdx, pArr) => ({
            title: pp.title || `Phase ${pIdx + 1}`,
            objective: pp.objective || 'Build progressive mastery',
            topics: (pp.keyTopics ?? []).map((topicTitle, tIdx, tArr) => {
              const cachedNode = this.memoryCache.getTopicNode(topicTitle);
              if (cachedNode) return cachedNode;
              const isBoss = pIdx === pArr.length - 1 && tIdx === tArr.length - 1;
              const node: PreparedTopicNode = {
                canonicalKey: canonicalizeKey(topicTitle),
                title: topicTitle,
                summary: `${pp.objective} — hands-on mastery of ${topicTitle}.`,
                estimatedHours: isBoss ? 6 : 4,
                difficulty: isBoss
                  ? 'staff_plus'
                  : pIdx === 0
                    ? 'foundation'
                    : 'intermediate',
                keySkills: gapSkills.slice(0, 3),
                isBossTopic: isBoss,
              };
              return node;
            }),
          }));
        }

        // Guarantee complete 3-phase multi-node roadmap graph is computed beforehand!
        preparedPhases = ensureFullPrecomputedRoadmap(
          preparedPhases,
          rmTitle,
          rmTarget,
          gapSkills
        );

        const phasesPreview = preparedPhases.map((p) => ({
          title: p.title,
          objective: p.objective,
          keyTopics: p.topics.map((t) => t.title),
        }));

        // Cache roadmap blueprint and all its topic nodes in memory!
        if (preparedPhases.length > 0) {
          this.memoryCache.storeRoadmapBlueprint({
            roadmapKey: canonicalizeKey(`${rmTitle}::${rmTarget}`),
            roadmapId: rmId,
            title: rmTitle,
            targetRole: rmTarget,
            description: rm.whyItFits || rm.tagline || 'Structured mastery roadmap',
            phases: preparedPhases,
            contextHash: computeContextHash([rmTitle, rmTarget, rm.whyItFits, contextHash]),
            updatedAt: nowIso,
          });
        }

        return {
          id: rmId,
          title: rmTitle,
          tagline: rm.tagline || 'Structured mastery roadmap',
          category: rm.category || 'vertical_growth',
          targetRole: rmTarget,
          fitScore: Math.min(99, Math.max(55, Number(rm.fitScore ?? 85))),
          difficulty: rm.difficulty || 'challenging',
          estimatedWeeks: Number(rm.estimatedWeeks ?? 12),
          marketDemand: rm.marketDemand || 'high',
          whyItFits: rm.whyItFits || 'Builds directly on your core experience.',
          bridgeSkills: Array.isArray(rm.bridgeSkills) ? rm.bridgeSkills : [],
          gapSkillsToBuild: gapSkills,
          colorTheme: sanitizeTheme(rm.colorTheme, idx),
          iconName: rm.iconName || 'Compass',
          phasesPreview,
          preparedPhases,
          activatedStreamId: existingActivatedBySlug.get(canonicalizeKey(rmTitle)) ?? null,
        };
      }
    );

    const resume = this.db.saveResume({
      id: params.existingResumeId ?? existingResume?.id,
      filename: params.filename,
      fileFormat: params.fileFormat,
      rawText: params.rawText,
      careerGoalsNote: params.careerGoalsNote ?? '',
      contextHash,
      profile,
      suggestedRoadmaps,
      analyzedByModel: roadmapsResp.modelUsed,
    });

    const isFirstAnalysis = !existingResume;
    const { delta } = this.gamification.grantXpAndCheckProgression({
      baseXp: isFirstAnalysis ? 75 : 25,
      baseSparks: isFirstAnalysis ? 30 : 10,
      source: 'resume_analysis',
      description: isFirstAnalysis
        ? `Analyzed resume "${params.filename}" & cached ${suggestedRoadmaps.length} career roadmaps in memory`
        : `Refreshed resume profile & updated roadmap nodes in memory`,
      extraAchievementCodes: ['ORIGIN_STORY'],
    });

    return {
      resume,
      routingDecisions,
      gamificationDelta: delta,
      fromMemoryCache: false,
      consistencyNote: isFirstAnalysis
        ? 'Prepared roadmaps and cached all phase & topic nodes in memory for AI-free reuse.'
        : 'Updated roadmaps based on new resume/goal changes and refreshed in-memory node cache.',
    };
  }

  // 2. Launch Career Stream — Reuses Prepared Roadmap Nodes & Resources from Memory WITHOUT AI!
  public async launchCareerStream(params: {
    resumeId?: string;
    suggestedRoadmapId?: string;
    customStreamInput?: {
      title: string;
      targetRole: string;
      focusDescription: string;
      colorTheme?: CareerStream['colorTheme'];
    };
  }): Promise<{
    stream: CareerStream;
    routingDecision: RoutingDecision | null;
    gamificationDelta: GamificationDelta;
    reusedFromMemory: boolean;
  }> {
    const latestResume = params.resumeId
      ? this.db.getResume(params.resumeId)
      : this.db.getLatestResume();

    let seedRoadmap: SuggestedRoadmap | undefined;
    if (latestResume && params.suggestedRoadmapId) {
      seedRoadmap = latestResume.suggestedRoadmaps.find(
        (r) => r.id === params.suggestedRoadmapId
      );
    }

    const title =
      seedRoadmap?.title ?? params.customStreamInput?.title ?? 'Accelerated Mastery Stream';
    const targetRole =
      seedRoadmap?.targetRole ?? params.customStreamInput?.targetRole ?? 'Senior Specialist';
    const tagline =
      seedRoadmap?.tagline ??
      params.customStreamInput?.focusDescription.slice(0, 110) ??
      'Independent skill & execution stream';
    const category = seedRoadmap?.category ?? 'specialist_frontier';
    const colorTheme = sanitizeTheme(
      seedRoadmap?.colorTheme ?? params.customStreamInput?.colorTheme,
      this.db.listStreams().length
    );
    const iconName = seedRoadmap?.iconName ?? 'Rocket';

    // Check In-Memory Cache first so prepared roadmaps & nodes are reused WITHOUT using AI!
    const cachedBlueprint = this.memoryCache.getRoadmapBlueprint({
      roadmapId: seedRoadmap?.id,
      title,
      targetRole,
    });

    let phasesToCreate: PreparedPhaseBlueprint[] | null = null;
    let descriptionToUse = seedRoadmap?.whyItFits ?? params.customStreamInput?.focusDescription ?? tagline;
    let routingDecision: RoutingDecision | null = null;
    let reusedFromMemory = false;

    if (cachedBlueprint && cachedBlueprint.phases.length > 0) {
      phasesToCreate = cachedBlueprint.phases;
      descriptionToUse = cachedBlueprint.description || descriptionToUse;
      reusedFromMemory = true;
    } else if (seedRoadmap?.preparedPhases && seedRoadmap.preparedPhases.length > 0) {
      phasesToCreate = seedRoadmap.preparedPhases;
      reusedFromMemory = true;
    }

    const nodesContextHash = computeContextHash([
      title,
      targetRole,
      descriptionToUse,
      latestResume?.contextHash ?? '',
    ]);

    if (!phasesToCreate) {
      const curriculumResp = await this.ai.executeJson<{
        description: string;
        phases: Array<{
          title: string;
          objective: string;
          topics: Array<{
            title: string;
            summary: string;
            estimatedHours: number;
            difficulty: TopicDifficulty;
            keySkills: string[];
            isBossTopic?: boolean;
          }>;
        }>;
      }>({
        purpose: 'stream_curriculum',
        temperature: 0,
        systemPrompt: `You are a Principal Curriculum Designer. Design a deeply practical, hands-on 3-phase career stream curriculum.
Each phase must have 3 concrete topic nodes (9 topics total), progressing from foundational mental models to production execution, culminating in a final Boss Capstone topic in Phase 3.`,
        userPrompt: `Design the full independent curriculum for this Career Stream as JSON:
{
  "description": "2-3 sentence motivating overview of what mastering this stream unlocks",
  "phases": [
    {
      "title": "Phase 1: ...",
      "objective": "Clear measurable capability gained in Phase 1",
      "topics": [
        {
          "title": "Specific Topic Title",
          "summary": "Concrete 1-2 sentence scope of what will be learned and practiced",
          "estimatedHours": 4,
          "difficulty": "foundation | intermediate | advanced | staff_plus",
          "keySkills": ["skill1", "skill2", "skill3"],
          "isBossTopic": false
        }
      ]
    }
  ]
}

STREAM GOAL:
Title: ${title}
Target Role: ${targetRole}
Context / Why It Fits: ${descriptionToUse}
Gap Skills to Master: ${(seedRoadmap?.gapSkillsToBuild ?? []).join(', ') || 'Core domain mastery'}
Candidate Background Summary: ${latestResume?.profile?.summary ?? 'Motivated software/tech professional'}`,
      });

      routingDecision = curriculumResp.routingDecision;
      descriptionToUse = curriculumResp.data.description || descriptionToUse;

      phasesToCreate = (curriculumResp.data.phases ?? []).map((p, pIdx, arr) => ({
        title: p.title || `Phase ${pIdx + 1}`,
        objective: p.objective || 'Build progressive mastery',
        topics: (p.topics ?? []).map((t, tIdx, tArr) => {
          const topicTitle = t.title || `Topic ${tIdx + 1}`;
          // Reuse existing node details from memory if this canonical node was already prepared!
          const existingMemNode = this.memoryCache.getTopicNode(topicTitle);
          if (existingMemNode) return existingMemNode;
          return {
            canonicalKey: canonicalizeKey(topicTitle),
            title: topicTitle,
            summary: t.summary || 'Master core concepts and hands-on execution.',
            estimatedHours: Number(t.estimatedHours ?? 4),
            difficulty: (['foundation', 'intermediate', 'advanced', 'staff_plus'].includes(
              t.difficulty
            )
              ? t.difficulty
              : 'intermediate') as TopicDifficulty,
            keySkills: Array.isArray(t.keySkills) ? t.keySkills : [],
            isBossTopic:
              Boolean(t.isBossTopic) || (pIdx === arr.length - 1 && tIdx === tArr.length - 1),
          };
        }),
      }));

      // Store in Memory Cache for future AI-free reuse!
      this.memoryCache.storeRoadmapBlueprint({
        roadmapKey: canonicalizeKey(`${title}::${targetRole}`),
        roadmapId: seedRoadmap?.id,
        title,
        targetRole,
        description: descriptionToUse,
        phases: phasesToCreate,
        contextHash: nodesContextHash,
        updatedAt: new Date().toISOString(),
      });
    }

    phasesToCreate = ensureFullPrecomputedRoadmap(
      phasesToCreate,
      title,
      targetRole,
      seedRoadmap?.gapSkillsToBuild ?? []
    );

    const stream = this.db.createStreamWithCurriculum({
      title,
      tagline,
      category,
      targetRole,
      description: descriptionToUse,
      colorTheme,
      iconName,
      nodesContextHash,
      phases: phasesToCreate,
    });

    // Attach any already-cached topic resources from memory immediately without AI!
    for (const phase of stream.phases) {
      for (const topic of phase.topics) {
        const cachedPack = this.memoryCache.getResourcePack(topic.title);
        if (cachedPack && cachedPack.resources.length > 0) {
          this.db.replaceGeneratedResourcesForTopic({
            streamId: stream.id,
            topicId: topic.id,
            templates: cachedPack.resources,
            modelUsed: cachedPack.modelUsed,
            contextHash: cachedPack.contextHash,
            focusNote: cachedPack.focusNote,
          });
        }
      }
    }

    // Link back to suggested roadmap if applicable
    if (latestResume && seedRoadmap) {
      const updatedRoadmaps = latestResume.suggestedRoadmaps.map((r) =>
        r.id === seedRoadmap.id ? { ...r, activatedStreamId: stream.id } : r
      );
      this.db.saveResume({
        id: latestResume.id,
        filename: latestResume.filename,
        fileFormat: latestResume.fileFormat,
        rawText: latestResume.rawText,
        careerGoalsNote: latestResume.careerGoalsNote,
        contextHash: latestResume.contextHash,
        profile: latestResume.profile,
        suggestedRoadmaps: updatedRoadmaps,
        analyzedByModel: latestResume.analyzedByModel,
      });
    }

    const { delta } = this.gamification.grantXpAndCheckProgression({
      baseXp: 60,
      baseSparks: 25,
      streamId: stream.id,
      source: 'stream_launch',
      description: reusedFromMemory
        ? `Launched career stream from cached memory nodes: "${stream.title}"`
        : `Launched independent career stream: "${stream.title}"`,
    });

    return {
      stream: this.db.getStream(stream.id)!,
      routingDecision,
      gamificationDelta: delta,
      reusedFromMemory,
    };
  }

  // 2b. On-Demand Refresh of Stream Roadmap Nodes (Consistent when no new information is available)
  public async refreshStreamNodesOnDemand(params: {
    streamId: string;
    updatedFocusDescription?: string;
  }): Promise<{
    stream: CareerStream;
    fromMemoryCache: boolean;
    updatedWithAi: boolean;
    consistencyNote: string;
    routingDecision: RoutingDecision | null;
  }> {
    const stream = this.db.getStream(params.streamId);
    if (!stream) throw new Error('Career stream not found.');

    const latestResume = this.db.getLatestResume();
    const nextDescription = params.updatedFocusDescription?.trim() || stream.description;
    const nextHash = computeContextHash([
      stream.title,
      stream.targetRole,
      nextDescription,
      latestResume?.contextHash ?? '',
    ]);

    const currentHash = this.db.getStreamNodesContextHash(stream.id);
    if (currentHash && currentHash === nextHash) {
      return {
        stream,
        fromMemoryCache: true,
        updatedWithAi: false,
        consistencyNote:
          'Consistent — no new resume updates or stream focus changes detected; keeping existing roadmap nodes from memory.',
        routingDecision: null,
      };
    }

    const existingNodesSummary = stream.phases
      .map(
        (p) =>
          `${p.title} (${p.objective}): ${p.topics
            .map((t) => `${t.title} [${t.status}]`)
            .join(', ')}`
      )
      .join('\n');

    const resp = await this.ai.executeJson<{
      phases: Array<{
        title: string;
        objective: string;
        topics: Array<{
          title: string;
          summary: string;
          estimatedHours: number;
          difficulty: TopicDifficulty;
          keySkills: string[];
          isBossTopic?: boolean;
        }>;
      }>;
    }>({
      purpose: 'stream_curriculum',
      temperature: 0,
      systemPrompt: `You are a Principal Curriculum Designer performing a consistent, incremental roadmap refresh.
Keep existing phases and topics stable where information has not changed, and only refine unstarted topics where new candidate background or focus warrants it.`,
      userPrompt: `Refresh the 3-phase curriculum JSON while preserving consistency with existing nodes:
{
  "phases": [
    {
      "title": "Phase 1: ...",
      "objective": "...",
      "topics": [
        {
          "title": "Topic Title",
          "summary": "...",
          "estimatedHours": 4,
          "difficulty": "foundation | intermediate | advanced | staff_plus",
          "keySkills": ["skill1", "skill2"],
          "isBossTopic": false
        }
      ]
    }
  ]
}

STREAM: ${stream.title} (Target Role: ${stream.targetRole})
UPDATED FOCUS / CONTEXT: ${nextDescription}
LATEST CANDIDATE PROFILE: ${latestResume?.profile?.summary ?? 'No updated resume'}
EXISTING PHASES & NODES:
${existingNodesSummary}`,
    });

    const refreshedPhases: PreparedPhaseBlueprint[] = (resp.data.phases ?? []).map(
      (p, pIdx, arr) => ({
        title: p.title || `Phase ${pIdx + 1}`,
        objective: p.objective || 'Build progressive mastery',
        topics: (p.topics ?? []).map((t, tIdx, tArr) => ({
          canonicalKey: canonicalizeKey(t.title || `Topic ${tIdx + 1}`),
          title: t.title || `Topic ${tIdx + 1}`,
          summary: t.summary || 'Master core concepts and execution.',
          estimatedHours: Number(t.estimatedHours ?? 4),
          difficulty: (['foundation', 'intermediate', 'advanced', 'staff_plus'].includes(
            t.difficulty
          )
            ? t.difficulty
            : 'intermediate') as TopicDifficulty,
          keySkills: Array.isArray(t.keySkills) ? t.keySkills : [],
          isBossTopic:
            Boolean(t.isBossTopic) || (pIdx === arr.length - 1 && tIdx === tArr.length - 1),
        })),
      })
    );

    if (nextDescription !== stream.description) {
      this.db.db
        .prepare('UPDATE career_streams SET description = ? WHERE id = ?')
        .run(nextDescription, stream.id);
    }

    const updatedStream = this.db.updateStreamNodesInPlace(
      stream.id,
      refreshedPhases,
      nextHash
    )!;

    this.memoryCache.storeRoadmapBlueprint({
      roadmapKey: canonicalizeKey(`${stream.title}::${stream.targetRole}`),
      title: stream.title,
      targetRole: stream.targetRole,
      description: nextDescription,
      phases: refreshedPhases,
      contextHash: nextHash,
      updatedAt: new Date().toISOString(),
    });

    return {
      stream: updatedStream,
      fromMemoryCache: false,
      updatedWithAi: true,
      consistencyNote:
        'Updated roadmap nodes based on newly detected context and refreshed in-memory node cache.',
      routingDecision: resp.routingDecision,
    };
  }

  // 3a. Read Topic Workspace from Memory / SQLite WITHOUT AI
  public getTopicWorkspaceFromMemory(topicId: string): TopicWorkspaceResponse {
    const topic = this.db.getTopic(topicId);
    if (!topic) throw new Error('Topic not found.');
    const meta = this.db.getTopicCacheMeta(topicId);
    let resources = this.db.listResourcesForTopic(topicId);

    // If this topic has no rows yet, check if its canonical node already has generated resources in memory!
    if (resources.length === 0 && meta) {
      const cachedPack = this.memoryCache.getResourcePack(meta.canonicalKey);
      if (cachedPack && cachedPack.resources.length > 0) {
        resources = this.db.replaceGeneratedResourcesForTopic({
          streamId: topic.streamId,
          topicId: topic.id,
          templates: cachedPack.resources,
          modelUsed: cachedPack.modelUsed,
          contextHash: cachedPack.contextHash,
          focusNote: cachedPack.focusNote,
        });
      }
    }

    const refreshedTopic = this.db.getTopic(topicId)!;
    const stream = this.db.getStream(topic.streamId)!;

    return {
      stream,
      topic: refreshedTopic,
      resources,
      problems: this.db.listProblemsForTopic(topicId),
      recentSubmissions: this.db.listSubmissionsForTopic(topicId, 20),
      servedFromMemory: true,
      lastResourceFocusNote: this.db.getTopicCacheMeta(topicId)?.lastFocusNote ?? '',
    };
  }

  // 3b. Generate or On-Demand Refresh Topic Resources (Served from Memory & Consistent when unchanged!)
  public async generateTopicResources(params: {
    topicId: string;
    focusNote?: string;
    refresh?: boolean;
  }): Promise<{
    resources: LearningResource[];
    routingDecision: RoutingDecision | null;
    fromMemoryCache: boolean;
    refreshedWithAi: boolean;
    consistencyNote: string;
  }> {
    const topic = this.db.getTopic(params.topicId);
    if (!topic) throw new Error('Topic not found.');
    const stream = this.db.getStream(topic.streamId);
    if (!stream) throw new Error('Stream not found.');

    const meta = this.db.getTopicCacheMeta(topic.id)!;
    const latestResume = this.db.getLatestResume();
    const effectiveFocus =
      params.focusNote !== undefined ? params.focusNote.trim() : meta.lastFocusNote;

    const desiredHash = computeContextHash([
      meta.canonicalKey,
      topic.title,
      topic.summary,
      topic.keySkills.join(','),
      effectiveFocus,
      latestResume?.contextHash ?? '',
    ]);

    const existingResources = this.db.listResourcesForTopic(topic.id);
    const hasGeneratedAlready = existingResources.some((r) => r.generatedByModel !== null);

    // 1. If topic already has generated resources and context hash has NOT changed -> 0 AI calls, 100% consistent!
    if (hasGeneratedAlready && meta.resourcesContextHash === desiredHash) {
      return {
        resources: existingResources,
        routingDecision: null,
        fromMemoryCache: true,
        refreshedWithAi: false,
        consistencyNote:
          'Consistent — no new focus instructions or profile updates detected; serving consistent resources from memory without AI.',
      };
    }

    // 2. Check global in-memory resource cache by canonical node key + matching hash!
    const memPack = this.memoryCache.getResourcePack(meta.canonicalKey);
    if (memPack && memPack.contextHash === desiredHash && memPack.resources.length > 0) {
      const hydrated = this.db.replaceGeneratedResourcesForTopic({
        streamId: stream.id,
        topicId: topic.id,
        templates: memPack.resources,
        modelUsed: memPack.modelUsed,
        contextHash: memPack.contextHash,
        focusNote: effectiveFocus,
      });
      return {
        resources: hydrated,
        routingDecision: null,
        fromMemoryCache: true,
        refreshedWithAi: false,
        consistencyNote:
          'Reused prepared resources directly from in-memory cache without invoking AI.',
      };
    }

    // 3. Context is new or updated -> Run deterministic AI (temperature: 0), anchored on previous content if refreshing
    const baselineAnchor =
      hasGeneratedAlready && params.refresh
        ? `\nEXISTING RESOURCES BASELINE (keep accurate core explanations & canonical URLs consistent; only expand/adjust for the updated focus or profile):\n${existingResources
            .filter((r) => r.generatedByModel !== null)
            .map((r) => `- [${r.kind}] ${r.title}${r.url ? ` (${r.url})` : ''}`)
            .join('\n')}`
        : '';

    const resp = await this.ai.executeJson<{
      generatedGuide: {
        title: string;
        estimatedMinutes: number;
        whyRelevant: string;
        contentMarkdown: string;
        flashcards: Array<{ front: string; back: string }>;
      };
      externalResources: Array<{
        kind:
          | 'external_article'
          | 'external_video'
          | 'external_course'
          | 'external_repo'
          | 'external_book';
        title: string;
        url: string;
        providerOrAuthor: string;
        estimatedMinutes: number;
        difficulty: string;
        whyRelevant: string;
        studyNotesMarkdown: string;
      }>;
    }>({
      purpose: 'learning_resources',
      temperature: 0,
      systemPrompt: `You are a Staff Mentor and Technical Educator.
Create BOTH:
1. A comprehensive, deeply practical AI-generated Markdown Study Guide (with mental models, concrete examples/code/architecture Trade-offs, common pitfalls, and 4 active-recall flashcards).
2. 4 high-signal, real, authoritative external learning resources (official documentation, well-known books, seminal papers/engineering blogs, or reputable open-source repos — use accurate canonical URLs or https://duckduckgo.com/?q=... search URLs if exact path varies so links never 404).`,
      userPrompt: `Generate learning resources for this career stream topic as JSON:
{
  "generatedGuide": {
    "title": "Deep-Dive Guide: ...",
    "estimatedMinutes": 25,
    "whyRelevant": "How this unlocks ${stream.targetRole}",
    "contentMarkdown": "## Core Mental Model\\n... (detailed multi-section markdown with concrete examples, diagrams/code, trade-offs, and checklist)",
    "flashcards": [
      { "front": "Challenging conceptual question", "back": "Crisp high-signal answer" }
    ]
  },
  "externalResources": [
    {
      "kind": "external_article | external_video | external_course | external_repo | external_book",
      "title": "Resource Title",
      "url": "https://...",
      "providerOrAuthor": "Author / Organization",
      "estimatedMinutes": 35,
      "difficulty": "intermediate | advanced",
      "whyRelevant": "Why this specific resource is gold for this topic",
      "studyNotesMarkdown": "Key takeaways and what to pay attention to while studying this resource."
    }
  ]
}

STREAM: ${stream.title} (Target: ${stream.targetRole})
TOPIC: ${topic.title}
SUMMARY: ${topic.summary}
KEY SKILLS: ${topic.keySkills.join(', ')}
DIFFICULTY: ${topic.difficulty}
OPTIONAL LEARNER REQUEST: ${effectiveFocus || 'Comprehensive practical mastery'}${baselineAnchor}`,
    });

    const templates: CachedResourceTemplate[] = [];

    if (resp.data.generatedGuide) {
      const g = resp.data.generatedGuide;
      templates.push({
        kind: 'generated_guide',
        title: g.title || `Deep-Dive Guide: ${topic.title}`,
        url: null,
        providerOrAuthor: `CareerForge AI (${resp.modelUsed})`,
        estimatedMinutes: Number(g.estimatedMinutes ?? 25),
        difficulty: topic.difficulty,
        whyRelevant: g.whyRelevant || `Core synthesis for ${topic.title}`,
        contentMarkdown: g.contentMarkdown || `# ${topic.title}\n\n${topic.summary}`,
        flashcards: Array.isArray(g.flashcards) ? g.flashcards : [],
        xpReward: 50,
      });
    }

    for (const ext of resp.data.externalResources ?? []) {
      const validKinds: ResourceKind[] = [
        'external_article',
        'external_video',
        'external_course',
        'external_repo',
        'external_book',
      ];
      const kind: ResourceKind = validKinds.includes(ext.kind) ? ext.kind : 'external_article';
      templates.push({
        kind,
        title: ext.title || 'Recommended External Study',
        url: ext.url || `https://duckduckgo.com/?q=${encodeURIComponent(ext.title || topic.title)}`,
        providerOrAuthor: ext.providerOrAuthor || 'Industry Reference',
        estimatedMinutes: Number(ext.estimatedMinutes ?? 30),
        difficulty: ext.difficulty || topic.difficulty,
        whyRelevant: ext.whyRelevant || 'Curated external reference.',
        contentMarkdown: ext.studyNotesMarkdown || ext.whyRelevant || '',
        flashcards: [],
        xpReward: 35,
      });
    }

    // Store in Memory Cache so future loads & refreshes are AI-free!
    this.memoryCache.storeResourcePack({
      canonicalKey: meta.canonicalKey,
      contextHash: desiredHash,
      focusNote: effectiveFocus,
      modelUsed: resp.modelUsed,
      resources: templates,
      updatedAt: new Date().toISOString(),
    });

    const updatedResources = this.db.replaceGeneratedResourcesForTopic({
      streamId: stream.id,
      topicId: topic.id,
      templates,
      modelUsed: resp.modelUsed,
      contextHash: desiredHash,
      focusNote: effectiveFocus,
    });

    return {
      resources: updatedResources,
      routingDecision: resp.routingDecision,
      fromMemoryCache: false,
      refreshedWithAi: true,
      consistencyNote: hasGeneratedAlready
        ? 'Refreshed resources with updated context and cached in memory.'
        : 'Prepared resources and stored in memory for future AI-free access.',
    };
  }

  // 4. Toggle Resource Completion (with XP & Stream Progress!)
  public completeOrToggleResource(params: {
    resourceId: string;
    isCompleted?: boolean;
    isBookmarked?: boolean;
  }): {
    resource: LearningResource;
    stream: CareerStream;
    gamificationDelta: GamificationDelta | null;
  } {
    const before = this.db.getResource(params.resourceId);
    if (!before) throw new Error('Learning resource not found.');

    const updated = this.db.updateResourceState(params.resourceId, {
      isCompleted: params.isCompleted,
      isBookmarked: params.isBookmarked,
    })!;

    const { topicMasteredNow } = this.db.recomputeStreamAndTopicMetrics(
      updated.streamId,
      updated.topicId
    );

    let gamificationDelta: GamificationDelta | null = null;
    if (!before.isCompleted && updated.isCompleted) {
      const extraCodes = topicMasteredNow ? ['TOPIC_MASTER'] : [];
      const { delta } = this.gamification.grantXpAndCheckProgression({
        baseXp: updated.xpReward,
        streamId: updated.streamId,
        source: 'resource_complete',
        description: `Completed resource: "${updated.title}"`,
        consumeBuff: true,
        extraAchievementCodes: extraCodes,
        questSignals: { resourceCompleted: true },
      });
      gamificationDelta = delta;
    }

    return {
      resource: updated,
      stream: this.db.getStream(updated.streamId)!,
      gamificationDelta,
    };
  }

  // 5. Generate Hands-On Practice Problem for a Topic
  public async generatePracticeProblem(params: {
    topicId: string;
    archetype?: ProblemArchetype;
    difficulty?: ProblemDifficulty;
  }): Promise<{
    problem: PracticeProblem;
    routingDecision: RoutingDecision;
  }> {
    const topic = this.db.getTopic(params.topicId);
    if (!topic) throw new Error('Topic not found.');
    const stream = this.db.getStream(topic.streamId);
    if (!stream) throw new Error('Stream not found.');

    const difficulty: ProblemDifficulty =
      params.difficulty ?? (topic.isBossTopic ? 'boss' : 'standard');
    const archetype: ProblemArchetype = params.archetype ?? 'coding_implementation';

    const xpByDifficulty: Record<ProblemDifficulty, number> = {
      warmup: 75,
      standard: 120,
      hard: 180,
      boss: 280,
    };

    const existingTitles = this.db
      .listProblemsForTopic(topic.id)
      .map((p) => p.title)
      .join('; ');

    const resp = await this.ai.executeJson<{
      title: string;
      scenarioMarkdown: string;
      requirements: string[];
      constraints: string[];
      starterTemplate: string;
      languageHint: string;
      rubric: Array<{ criterion: string; weight: number; description: string }>;
      hints: string[];
    }>({
      purpose: 'practice_generation',
      systemPrompt: `You are a Principal Bar-Raiser crafting realistic, engaging practice challenges that build real-world career mastery.
Avoid toy trivia — ground the challenge in realistic production constraints, edge cases, and decision-making.`,
      userPrompt: `Create a ${difficulty.toUpperCase()} "${archetype}" practice challenge for this topic as JSON:
{
  "title": "Compelling Challenge Title",
  "scenarioMarkdown": "Rich problem context, inputs/outputs or system context, and concrete examples in Markdown",
  "requirements": ["Requirement 1", "Requirement 2", "Requirement 3", "Requirement 4"],
  "constraints": ["Constraint / edge-case 1", "Constraint 2"],
  "starterTemplate": "Starter code or structured response scaffold the candidate can fill in",
  "languageHint": "typescript | python | sql | go | markdown",
  "rubric": [
    { "criterion": "Core Correctness & Completeness", "weight": 35, "description": "..." },
    { "criterion": "Edge Cases & Resilience", "weight": 25, "description": "..." },
    { "criterion": "Architecture / Code Craft & Clarity", "weight": 20, "description": "..." },
    { "criterion": "Trade-off Reasoning & Production Pragmatism", "weight": 20, "description": "..." }
  ],
  "hints": [
    "Hint 1: Gentle conceptual pointer",
    "Hint 2: Deeper structural nudge",
    "Hint 3: Key insight for tricky edge cases"
  ]
}

STREAM: ${stream.title} (Target Role: ${stream.targetRole})
TOPIC: ${topic.title} — ${topic.summary}
KEY SKILLS: ${topic.keySkills.join(', ')}
ARCHETYPE: ${archetype}
DIFFICULTY: ${difficulty}
EXISTING PROBLEMS TO AVOID DUPLICATING: ${existingTitles || 'None'}`,
    });

    const problem = this.db.insertPracticeProblem({
      streamId: stream.id,
      topicId: topic.id,
      archetype,
      difficulty,
      title: resp.data.title || `${topic.title} Challenge`,
      scenarioMarkdown: resp.data.scenarioMarkdown || topic.summary,
      requirements: Array.isArray(resp.data.requirements) ? resp.data.requirements : [],
      constraints: Array.isArray(resp.data.constraints) ? resp.data.constraints : [],
      starterTemplate: resp.data.starterTemplate || '// Write your solution and trade-off notes here\n',
      languageHint: resp.data.languageHint || 'markdown',
      rubric:
        Array.isArray(resp.data.rubric) && resp.data.rubric.length > 0
          ? resp.data.rubric
          : [
              {
                criterion: 'Correctness & Completeness',
                weight: 40,
                description: 'Addresses all stated requirements accurately.',
              },
              {
                criterion: 'Edge Cases & Robustness',
                weight: 30,
                description: 'Handles failure modes, scale, and constraints.',
              },
              {
                criterion: 'Clarity & Engineering Craft',
                weight: 30,
                description: 'Well-structured, idiomatic, and clearly reasoned.',
              },
            ],
      hints: Array.isArray(resp.data.hints) ? resp.data.hints : [],
      xpReward: xpByDifficulty[difficulty],
      generatedByModel: resp.modelUsed,
    });

    this.db.recomputeStreamAndTopicMetrics(stream.id, topic.id);

    return {
      problem,
      routingDecision: resp.routingDecision,
    };
  }

  // 6. Live AI Socratic Coaching Nudge on Current Draft
  public async getLiveMentorCoachHint(params: {
    problemId: string;
    currentDraft: string;
    question?: string;
  }): Promise<{
    coachingMarkdown: string;
    routingDecision: RoutingDecision;
  }> {
    const problem = this.db.getPracticeProblem(params.problemId);
    if (!problem) throw new Error('Practice problem not found.');

    // Also mark at least 1 hint used so Pure Instinct tracks accurately
    if (problem.hintsRevealed === 0) {
      this.db.revealNextHint(problem.id);
    }

    const resp = await this.ai.execute({
      purpose: 'mentor_hint',
      systemPrompt: `You are a Socratic Staff Mentor. Give a concise, encouraging coaching nudge (under 180 words) based on the candidate's current draft. Point out blind spots or ask guiding questions WITHOUT writing the full solution for them.`,
      userPrompt: `CHALLENGE: ${problem.title}
SCENARIO: ${problem.scenarioMarkdown}
REQUIREMENTS: ${problem.requirements.join('; ')}

CANDIDATE'S CURRENT DRAFT:
${params.currentDraft || '(Empty draft so far)'}

SPECIFIC QUESTION:
${params.question || 'Give me a targeted Socratic nudge on how to proceed or what I might be missing.'}`,
    });

    return {
      coachingMarkdown: resp.text,
      routingDecision: resp.routingDecision,
    };
  }

  // 7. Submit & Evaluate Solution with Full Rubric, Feedback, Stream Progress & Gamification
  public async submitAndEvaluateSolution(params: {
    problemId: string;
    solutionText: string;
  }): Promise<{
    submission: SolutionSubmission;
    problem: PracticeProblem;
    stream: CareerStream;
    gamificationDelta: GamificationDelta;
    routingDecision: RoutingDecision;
  }> {
    if (!params.solutionText.trim() || params.solutionText.trim().length < 10) {
      throw new Error('Please write a meaningful solution before submitting for AI evaluation.');
    }

    const problem = this.db.getPracticeProblem(params.problemId);
    if (!problem) throw new Error('Practice problem not found.');
    const stream = this.db.getStream(problem.streamId);
    if (!stream) throw new Error('Career stream not found.');

    const evalResp = await this.ai.executeJson<{
      score: number;
      verdict: 'needs_revision' | 'passed' | 'mastered';
      summaryFeedback: string;
      strengths: string[];
      improvements: string[];
      rubricBreakdown: Array<{
        criterion: string;
        score: number;
        maxScore: number;
        comment: string;
      }>;
      exemplarApproachMarkdown: string;
    }>({
      purpose: 'solution_evaluation',
      systemPrompt: `You are a fair, rigorous, constructive Staff+ Bar-Raiser evaluating a candidate's practice solution.
Grade strictly against the rubric:
- Incomplete stubs, placeholders, or off-topic text MUST score < 35 ("needs_revision").
- Solid working solutions with minor gaps score 70-87 ("passed").
- Exceptional solutions addressing requirements, constraints, edge cases, and trade-offs score 88-100 ("mastered").
Provide specific, actionable feedback and a clear exemplar reference approach.`,
      userPrompt: `Evaluate the submitted solution and return JSON:
{
  "score": 0-100,
  "verdict": "needs_revision | passed | mastered",
  "summaryFeedback": "2-4 sentence holistic engineering assessment",
  "strengths": ["specific things done well in the submission"],
  "improvements": ["concrete, actionable improvements to elevate the solution"],
  "rubricBreakdown": [
    { "criterion": "Criterion Name", "score": 28, "maxScore": 35, "comment": "Specific justification" }
  ],
  "exemplarApproachMarkdown": "Concise reference solution / key patterns in Markdown"
}

CHALLENGE: ${problem.title} (${problem.archetype}, difficulty: ${problem.difficulty})
SCENARIO:
${problem.scenarioMarkdown}

REQUIREMENTS:
${problem.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

CONSTRAINTS:
${problem.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

RUBRIC:
${JSON.stringify(problem.rubric, null, 2)}

CANDIDATE SUBMITTED SOLUTION:
${params.solutionText}`,
    });

    const rawScore = Math.min(100, Math.max(0, Math.round(Number(evalResp.data.score ?? 0))));
    const verdict: 'needs_revision' | 'passed' | 'mastered' =
      rawScore >= 88 ? 'mastered' : rawScore >= 70 ? 'passed' : 'needs_revision';

    // Pre-calculate attempt count & skill bonuses
    const prevAttempts = this.db.listSubmissionsForProblem(problem.id).length;
    const attemptNumber = prevAttempts + 1;

    const { baseXpToGrant, skillBonuses, achievementCodes } =
      this.gamification.computeSubmissionBaseAndSkillBonuses({
        problemBaseXp: problem.xpReward,
        difficulty: problem.difficulty,
        score: rawScore,
        previousBestScore: problem.bestScore,
        attemptNumber,
        hintsRevealed: problem.hintsRevealed,
      });

    // Record submission first with provisional bonuses, then run full progression
    const tempSubmission = this.db.recordSubmission({
      problemId: problem.id,
      streamId: stream.id,
      topicId: problem.topicId,
      solutionText: params.solutionText,
      score: rawScore,
      verdict,
      summaryFeedback:
        evalResp.data.summaryFeedback || 'Evaluation completed against challenge rubric.',
      strengths: Array.isArray(evalResp.data.strengths) ? evalResp.data.strengths : [],
      improvements: Array.isArray(evalResp.data.improvements) ? evalResp.data.improvements : [],
      rubricBreakdown: Array.isArray(evalResp.data.rubricBreakdown)
        ? evalResp.data.rubricBreakdown
        : [],
      exemplarApproachMarkdown: evalResp.data.exemplarApproachMarkdown || '',
      xpAwarded: baseXpToGrant,
      bonusesApplied: skillBonuses,
      evaluatedByModel: evalResp.modelUsed,
      routingDecisionId: evalResp.routingDecision.id,
    });

    const { topicMasteredNow } = this.db.recomputeStreamAndTopicMetrics(stream.id, problem.topicId);
    if (topicMasteredNow) {
      achievementCodes.push('TOPIC_MASTER');
    }

    const { delta, bonusesApplied: globalBonuses } = this.gamification.grantXpAndCheckProgression({
      baseXp: baseXpToGrant,
      streamId: stream.id,
      source: 'solution_evaluation',
      description: `Evaluated "${problem.title}" — Score ${rawScore}/100 (${verdict.toUpperCase()})`,
      consumeBuff: rawScore >= 70,
      extraAchievementCodes: achievementCodes,
      questSignals: { evaluationPassed: rawScore >= 70 },
    });

    const allBonuses = [...skillBonuses, ...globalBonuses];
    this.db.db
      .prepare(
        'UPDATE solution_submissions SET xp_awarded = ?, bonuses_applied_json = ? WHERE id = ?'
      )
      .run(delta.xpGained, JSON.stringify(allBonuses), tempSubmission.submission.id);

    return {
      submission: this.db.getSubmission(tempSubmission.submission.id)!,
      problem: this.db.getPracticeProblem(problem.id)!,
      stream: this.db.getStream(stream.id)!,
      gamificationDelta: delta,
      routingDecision: evalResp.routingDecision,
    };
  }
}
