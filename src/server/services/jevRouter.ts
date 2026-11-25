import crypto from 'node:crypto';
import type { CareerForgeDB } from '../db/database.ts';
import { getProviderModels } from './aiDriver.ts';
import type {
  AIProviderRecord,
  CapabilityTier,
  CostTier,
  JevChannel,
  JevCostPolicy,
  ProviderModelConfig,
  ReasoningEffort,
  RoutingDecision,
  TaskPurpose,
} from '../../shared/types.ts';

export interface CandidateModelOption {
  optionKey: string;
  displayKey: string;
  provider: AIProviderRecord & { secret: string };
  model: ProviderModelConfig;
}

interface TaskProfile {
  description: string;
  reasoningDemand: number; // 0..1
  codingDemand: number; // 0..1
  speedDemand: number; // 0..1
  defaultEffort: ReasoningEffort;
  baseComplexity: number; // 0..2 scale matching Jev score
}

const PURPOSE_PROFILES: Record<TaskPurpose, TaskProfile> = {
  provider_test: {
    description: 'Quick connectivity and health check ping to verify inference works.',
    reasoningDemand: 0.1,
    codingDemand: 0.1,
    speedDemand: 0.95,
    defaultEffort: 'low',
    baseComplexity: 0.1,
  },
  resume_analysis: {
    description:
      'Extract structured skills, seniority level, career strengths, and growth gaps from raw resume text.',
    reasoningDemand: 0.55,
    codingDemand: 0.2,
    speedDemand: 0.65,
    defaultEffort: 'medium',
    baseComplexity: 1.0,
  },
  roadmap_suggestion: {
    description:
      'Design high-leverage, personalized multi-track career growth roadmaps from a candidate profile.',
    reasoningDemand: 0.9,
    codingDemand: 0.35,
    speedDemand: 0.3,
    defaultEffort: 'high',
    baseComplexity: 1.8,
  },
  stream_curriculum: {
    description:
      'Architect ordered phases, progressive milestones, skill nodes, and boss challenges for a career stream.',
    reasoningDemand: 0.8,
    codingDemand: 0.4,
    speedDemand: 0.4,
    defaultEffort: 'medium',
    baseComplexity: 1.5,
  },
  learning_resources: {
    description:
      'Synthesize an in-depth study guide, flashcards, and curated external learning resources for a topic.',
    reasoningDemand: 0.65,
    codingDemand: 0.45,
    speedDemand: 0.55,
    defaultEffort: 'medium',
    baseComplexity: 1.2,
  },
  practice_generation: {
    description:
      'Create a realistic hands-on practice challenge with starter code/template, constraints, hints, and grading rubric.',
    reasoningDemand: 0.78,
    codingDemand: 0.85,
    speedDemand: 0.45,
    defaultEffort: 'medium',
    baseComplexity: 1.5,
  },
  solution_evaluation: {
    description:
      'Rigorously evaluate a submitted solution against rubric criteria, edge cases, correctness, and craft, providing actionable feedback.',
    reasoningDemand: 0.95,
    codingDemand: 0.9,
    speedDemand: 0.25,
    defaultEffort: 'high',
    baseComplexity: 1.9,
  },
  mentor_hint: {
    description:
      'Provide a concise Socratic coaching nudge to unblock the learner without giving away the full answer.',
    reasoningDemand: 0.45,
    codingDemand: 0.5,
    speedDemand: 0.85,
    defaultEffort: 'low',
    baseComplexity: 0.7,
  },
};

export function resolveJevEndpointAndModel(
  channel: JevChannel,
  baseUrl: string,
  model: string,
  apiKey: string
): { endpoint: string; modelName: string } {
  const trimmedUrl = baseUrl.trim().replace(/\/+$/, '');
  const autoOpenRouter = channel === 'openrouter' || apiKey.startsWith('sk-or-');

  if (autoOpenRouter) {
    const endpoint =
      trimmedUrl.includes('openrouter.ai') && trimmedUrl.includes('/decisions')
        ? trimmedUrl
        : 'https://openrouter.ai/api/alpha/decisions';
    const modelName =
      model.includes('typesafe/') || model.startsWith('~typesafe/')
        ? model
        : '~typesafe/jev-latest';
    return { endpoint, modelName };
  }

  if (channel === 'vercel') {
    const endpoint = trimmedUrl.includes('vercel.sh')
      ? trimmedUrl.endsWith('/v1/systemone')
        ? trimmedUrl
        : `${trimmedUrl}/v1/systemone`
      : 'https://ai-gateway.vercel.sh/typesafe/v1/systemone';
    const modelName = model.includes('typesafe') ? model : 'typesafe-ai/jev';
    return { endpoint, modelName };
  }

  if (channel === 'custom') {
    return {
      endpoint: trimmedUrl || 'https://api.typesafe.ai/v1/systemone',
      modelName: model || 'jev-latest',
    };
  }

  // Default official TypeSafe System One endpoint
  const endpoint = trimmedUrl.endsWith('/v1/systemone')
    ? trimmedUrl
    : trimmedUrl === 'https://api.typesafe.ai' || !trimmedUrl
      ? 'https://api.typesafe.ai/v1/systemone'
      : trimmedUrl;
  return {
    endpoint,
    modelName: model || 'jev-latest',
  };
}

const DEFAULT_MODEL_IDS_BY_PROVIDER: Partial<Record<AIProviderRecord['type'], string[]>> = {
  openai: ['gpt-4.1', 'o4-mini', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-opus-4-1-20250805', 'claude-3-5-haiku-latest'],
  ollama: ['qwen2.5-coder:7b', 'llama3.2:latest'],
  openai_compatible: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4.1-mini', 'deepseek/deepseek-r1'],
};

export function inferAutomaticModelConfig(
  modelId: string,
  providerType: AIProviderRecord['type']
): ProviderModelConfig {
  const lower = modelId.toLowerCase();
  const costTier: CostTier =
    providerType === 'ollama' || providerType === 'codex_subscription'
      ? 'free_local'
      : /nano|mini|flash|haiku/.test(lower)
        ? 'economy'
        : /opus|o3|gpt-5|gpt-4\.1$/.test(lower)
          ? 'frontier'
          : 'balanced';

  const capabilityTier: CapabilityTier = /codex|coder|sonnet/.test(lower)
    ? 'coding_specialist'
    : /opus|^o[134]|\/o[134]|r1|qwq|gpt-4\.1$/.test(lower)
      ? 'reasoning'
      : /nano|mini|flash|haiku|3b/.test(lower)
        ? 'fast'
        : 'balanced';

  return {
    id: modelId,
    label: modelId,
    costTier,
    capabilityTier,
    supportsReasoningEffort: /^o[134]|codex|gpt-5|sonnet|opus/.test(lower),
    enabled: true,
  };
}

export class JevModelRouter {
  private readonly db: CareerForgeDB;

  constructor(db: CareerForgeDB) {
    this.db = db;
  }

  public getAvailableCandidates(): CandidateModelOption[] {
    const allEnabled = this.db.listEnabledProvidersWithSecrets();
    const verifiedConnected = allEnabled.filter((p) => p.connectionStatus === 'connected');
    const nonFailed = allEnabled.filter((p) => p.connectionStatus !== 'failed');

    const activePool =
      verifiedConnected.length > 0
        ? verifiedConnected
        : nonFailed.length > 0
          ? nonFailed
          : allEnabled;

    const candidates: CandidateModelOption[] = [];
    let index = 0;

    for (const provider of activePool) {
      const models = getProviderModels(provider);
      let enabledModels = models.filter((m) => m.enabled);
      if (enabledModels.length === 0) {
        const fallbackIds =
          models.length > 0
            ? models.map((m) => m.id)
            : DEFAULT_MODEL_IDS_BY_PROVIDER[provider.type] ?? [];
        enabledModels = fallbackIds.map((id) => inferAutomaticModelConfig(id, provider.type));
      }

      for (const model of enabledModels) {
        candidates.push({
          optionKey: `opt_${index}`,
          displayKey: `${provider.name} / ${model.id}`,
          provider,
          model,
        });
        index++;
      }
    }
    return candidates;
  }

  public async routeTask(params: {
    purpose: TaskPurpose;
    promptPreview: string;
    preferredProviderId?: string;
  }): Promise<{ candidate: CandidateModelOption; decision: RoutingDecision }> {
    const startMs = Date.now();
    let candidates = this.getAvailableCandidates();

    if (params.preferredProviderId) {
      const filtered = candidates.filter((c) => c.provider.id === params.preferredProviderId);
      if (filtered.length > 0) {
        candidates = filtered;
      }
    }

    if (candidates.length === 0) {
      throw new Error(
        'No enabled AI provider models found. Please configure and enable at least one AI provider in AI Engine Setup.'
      );
    }

    const jevCfg = this.db.getJevConfigWithSecret();

    // Use TypeSafe's Jev API when enabled and an API key is configured
    if (jevCfg.enabled && jevCfg.apiKey.trim().length > 0) {
      try {
        const jevResult = await this.callTypesafeJev({
          purpose: params.purpose,
          promptPreview: params.promptPreview,
          candidates,
          apiKey: jevCfg.apiKey.trim(),
          channel: jevCfg.channel,
          baseUrl: jevCfg.baseUrl,
          jevModel: jevCfg.model,
          costPolicy: jevCfg.costPolicy,
          startMs,
        });
        this.db.recordRoutingDecision(jevResult.decision);
        return jevResult;
      } catch (err) {
        const fallbackReason =
          err instanceof Error ? err.message : 'TypeSafe Jev request failed';
        const fallback = this.chooseAutonomously({
          purpose: params.purpose,
          promptPreview: params.promptPreview,
          candidates,
          costPolicy: jevCfg.costPolicy,
          startMs,
          fallbackNote: `Jev API unavailable (${fallbackReason}); autonomous router engaged.`,
        });
        this.db.recordRoutingDecision(fallback.decision);
        return fallback;
      }
    }

    // Autonomous selection when Jev API key is absent or Jev is disabled
    const autonomous = this.chooseAutonomously({
      purpose: params.purpose,
      promptPreview: params.promptPreview,
      candidates,
      costPolicy: jevCfg.costPolicy,
      startMs,
    });
    this.db.recordRoutingDecision(autonomous.decision);
    return autonomous;
  }

  public async testJevConnection(): Promise<{
    ok: boolean;
    modelVersion: string | null;
    latencyMs: number;
    message: string;
  }> {
    const jevCfg = this.db.getJevConfigWithSecret();
    if (!jevCfg.apiKey.trim()) {
      const msg =
        'No Jev API key provided. CareerForge will automatically use its built-in Autonomous Model Router.';
      this.db.updateJevTestResult('error', msg);
      return { ok: false, modelVersion: null, latencyMs: 0, message: msg };
    }

    const startMs = Date.now();
    const { endpoint, modelName } = resolveJevEndpointAndModel(
      jevCfg.channel,
      jevCfg.baseUrl,
      jevCfg.model,
      jevCfg.apiKey
    );

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jevCfg.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          state:
            'Task: Evaluate a candidate distributed systems design submission with 4 rubric criteria.',
          questions: {
            selected_tier: {
              type: 'choice',
              instructions: 'Which model capability tier best fits this task?',
              criteria: {
                fast: 'Lightweight model for simple extraction',
                reasoning: 'Strong reasoning model for grading complex architecture trade-offs',
              },
            },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - startMs;
      if (!res.ok) {
        const bodyText = await res.text();
        const errMsg = `HTTP ${res.status}: ${bodyText.slice(0, 220)}`;
        this.db.updateJevTestResult('error', errMsg);
        return { ok: false, modelVersion: null, latencyMs, message: errMsg };
      }

      const data = (await res.json()) as {
        model?: string;
        answers?: Record<string, { choice?: string; confidence?: number }>;
      };
      const answeredModel = data.model ?? modelName;
      const choice = data.answers?.selected_tier?.choice ?? 'reasoning';
      const conf = Math.round((data.answers?.selected_tier?.confidence ?? 1) * 100);
      const okMsg = `Connected to TypeSafe Jev (${answeredModel}) in ${latencyMs}ms — test decision "${choice}" (${conf}% confidence).`;
      this.db.updateJevTestResult('ok', okMsg);
      return { ok: true, modelVersion: answeredModel, latencyMs, message: okMsg };
    } catch (err) {
      const latencyMs = Date.now() - startMs;
      const errMsg = err instanceof Error ? err.message : String(err);
      this.db.updateJevTestResult('error', errMsg);
      return { ok: false, modelVersion: null, latencyMs, message: errMsg };
    }
  }

  private async callTypesafeJev(params: {
    purpose: TaskPurpose;
    promptPreview: string;
    candidates: CandidateModelOption[];
    apiKey: string;
    channel: JevChannel;
    baseUrl: string;
    jevModel: string;
    costPolicy: JevCostPolicy;
    startMs: number;
  }): Promise<{ candidate: CandidateModelOption; decision: RoutingDecision }> {
    const { endpoint, modelName } = resolveJevEndpointAndModel(
      params.channel,
      params.baseUrl,
      params.jevModel,
      params.apiKey
    );

    const profile = PURPOSE_PROFILES[params.purpose];
    const candidateCriteria: Record<string, string> = {};
    for (const c of params.candidates) {
      candidateCriteria[c.optionKey] =
        `${c.provider.name} (${c.provider.type}) | Model: ${c.model.id} | ` +
        `Capability: ${c.model.capabilityTier} | Cost: ${c.model.costTier} | ` +
        `Supports reasoning_effort: ${c.model.supportsReasoningEffort ? 'yes' : 'no'}`;
    }

    const requestBody = {
      model: modelName,
      state: {
        task_purpose: params.purpose,
        task_description: profile.description,
        cost_policy: params.costPolicy,
        estimated_prompt_chars: params.promptPreview.length,
        prompt_excerpt: params.promptPreview.slice(0, 1200),
      },
      questions: {
        selected_candidate: {
          type: 'choice',
          instructions:
            `Select the best AI model option for "${params.purpose}" respecting cost policy "${params.costPolicy}". ` +
            `Match reasoning/coding-heavy tasks to reasoning or coding_specialist models unless cost_saver requires economy/free_local.`,
          criteria: candidateCriteria,
        },
        reasoning_effort: {
          type: 'choice',
          instructions: 'Select the optimal reasoning effort for executing this task.',
          criteria: {
            low: 'Quick extraction, ping, or brief Socratic hint',
            medium: 'Balanced structured generation, study guides, or curriculum planning',
            high: 'Deep strategic roadmap synthesis or strict rubric-based solution grading',
          },
        },
        complexity: {
          type: 'score',
          instructions: 'Rate the cognitive complexity of fulfilling this task accurately.',
          criteria: [
            'Low complexity: simple verification or formatting',
            'Moderate complexity: structured synthesis and curation',
            'High complexity: multi-step architecture design or code/solution evaluation',
          ],
        },
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jev HTTP ${response.status}: ${text.slice(0, 180)}`);
    }

    const payload = (await response.json()) as {
      model?: string;
      answers?: {
        selected_candidate?: {
          choice?: string;
          probabilities?: Record<string, number>;
          confidence?: number;
        };
        reasoning_effort?: {
          choice?: string;
        };
        complexity?: {
          score?: number;
        };
      };
    };

    const chosenKey = payload.answers?.selected_candidate?.choice;
    const chosenCandidate =
      params.candidates.find((c) => c.optionKey === chosenKey) ?? params.candidates[0]!;

    const rawProbs = payload.answers?.selected_candidate?.probabilities ?? {};
    const readableProbs: Record<string, number> = {};
    for (const c of params.candidates) {
      const p = rawProbs[c.optionKey];
      if (typeof p === 'number') {
        readableProbs[c.displayKey] = Math.round(p * 1000) / 1000;
      }
    }
    if (Object.keys(readableProbs).length === 0) {
      readableProbs[chosenCandidate.displayKey] = 1;
    }

    const rawEffort = payload.answers?.reasoning_effort?.choice;
    const effort: ReasoningEffort =
      rawEffort === 'low' || rawEffort === 'medium' || rawEffort === 'high'
        ? rawEffort
        : profile.defaultEffort;

    const rawScore = payload.answers?.complexity?.score ?? profile.baseComplexity;
    const normalizedComplexity = Math.round(((rawScore / 2) * 10) * 10) / 10;
    const confidence =
      Math.round((payload.answers?.selected_candidate?.confidence ?? 0.85) * 100) / 100;
    const latencyMs = Date.now() - params.startMs;
    const jevVersion = payload.model ?? modelName;

    const decision: RoutingDecision = {
      id: crypto.randomUUID(),
      purpose: params.purpose,
      decidedBy: 'typesafe_jev',
      jevModelVersion: jevVersion,
      selectedProviderId: chosenCandidate.provider.id,
      selectedProviderName: chosenCandidate.provider.name,
      selectedModel: chosenCandidate.model.id,
      reasoningEffort: effort,
      confidence,
      complexityScore: normalizedComplexity,
      probabilities: readableProbs,
      rationale: `TypeSafe Jev (${jevVersion}) selected ${chosenCandidate.displayKey} with ${effort} reasoning effort (${Math.round(
        confidence * 100
      )}% confidence, policy: ${params.costPolicy}).`,
      latencyMs,
      createdAt: new Date().toISOString(),
    };

    return { candidate: chosenCandidate, decision };
  }

  public chooseAutonomously(params: {
    purpose: TaskPurpose;
    promptPreview: string;
    candidates: CandidateModelOption[];
    costPolicy: JevCostPolicy;
    startMs: number;
    fallbackNote?: string;
  }): { candidate: CandidateModelOption; decision: RoutingDecision } {
    const profile = PURPOSE_PROFILES[params.purpose];
    const lengthBoost = Math.min(0.2, params.promptPreview.length / 20000);
    const codeSignal =
      /```|function\s+|class\s+|interface\s+|SELECT\s+|async\s+|=>|def\s+/i.test(
        params.promptPreview
      )
        ? 0.15
        : 0;

    const effectiveReasoning = Math.min(1, profile.reasoningDemand + lengthBoost);
    const effectiveCoding = Math.min(1, profile.codingDemand + codeSignal);

    const capabilityScores: Record<CapabilityTier, { reasoning: number; coding: number; speed: number }> = {
      fast: { reasoning: 0.42, coding: 0.45, speed: 0.96 },
      balanced: { reasoning: 0.74, coding: 0.74, speed: 0.72 },
      reasoning: { reasoning: 0.97, coding: 0.88, speed: 0.42 },
      coding_specialist: { reasoning: 0.88, coding: 0.98, speed: 0.62 },
    };

    const costNumeric: Record<CostTier, number> = {
      free_local: 0.0,
      economy: 0.22,
      balanced: 0.55,
      frontier: 0.92,
    };

    const policyWeights: Record<
      JevCostPolicy,
      { qualityMultiplier: number; costPenalty: number; speedWeight: number }
    > = {
      quality_first: { qualityMultiplier: 1.45, costPenalty: 0.1, speedWeight: 0.15 },
      balanced: { qualityMultiplier: 1.05, costPenalty: 0.42, speedWeight: 0.28 },
      cost_saver: { qualityMultiplier: 0.75, costPenalty: 0.95, speedWeight: 0.35 },
    };

    const pw = policyWeights[params.costPolicy];

    const scored = params.candidates.map((cand) => {
      const cap = capabilityScores[cand.model.capabilityTier];
      const modelIdLower = cand.model.id.toLowerCase();

      // Model-family domain affinity bonus
      let familyBonus = 0;
      if (effectiveCoding >= 0.7 && /codex|coder|sonnet|claude|gpt-4\.1|gpt-5|o3|o4/.test(modelIdLower)) {
        familyBonus += 0.12;
      }
      if (effectiveReasoning >= 0.8 && /opus|o3|o4|r1|sonnet|gpt-5|gpt-4\.1/.test(modelIdLower)) {
        familyBonus += 0.12;
      }
      if (profile.speedDemand >= 0.8 && /mini|nano|haiku|flash|small|3b|7b|8b/.test(modelIdLower)) {
        familyBonus += 0.18;
      }

      const qualityFit =
        cap.reasoning * effectiveReasoning * 0.52 +
        cap.coding * effectiveCoding * 0.36 +
        cap.speed * profile.speedDemand * pw.speedWeight +
        familyBonus;

      const costDrag = costNumeric[cand.model.costTier] * pw.costPenalty;
      const priorityBonus = Math.max(0, (20 - cand.provider.priority) * 0.008);
      const utility = qualityFit * pw.qualityMultiplier - costDrag + priorityBonus;

      return { cand, utility };
    });

    scored.sort((a, b) => b.utility - a.utility);

    // Softmax with temperature 0.25 for calibrated probabilities
    const maxU = scored[0]!.utility;
    const exps = scored.map((s) => Math.exp((s.utility - maxU) / 0.22));
    const sumExp = exps.reduce((acc, v) => acc + v, 0) || 1;

    const probabilities: Record<string, number> = {};
    scored.forEach((s, idx) => {
      probabilities[s.cand.displayKey] = Math.round((exps[idx]! / sumExp) * 1000) / 1000;
    });

    const winner = scored[0]!.cand;
    const topProb = exps[0]! / sumExp;
    const confidence =
      scored.length === 1 ? 0.95 : Math.round(Math.min(0.98, Math.max(0.55, topProb)) * 100) / 100;

    let effort: ReasoningEffort = profile.defaultEffort;
    if (params.costPolicy === 'cost_saver' && effort === 'high' && params.purpose !== 'solution_evaluation') {
      effort = 'medium';
    } else if (params.costPolicy === 'quality_first' && effectiveReasoning >= 0.75) {
      effort = 'high';
    }

    const complexityScore =
      Math.round(
        Math.min(10, (profile.baseComplexity / 2) * 8.5 + lengthBoost * 5 + codeSignal * 4) * 10
      ) / 10;

    const rationalePrefix = params.fallbackNote
      ? `${params.fallbackNote} `
      : 'Autonomous Router (no Jev API key configured): ';

    const decision: RoutingDecision = {
      id: crypto.randomUUID(),
      purpose: params.purpose,
      decidedBy: 'autonomous_fallback',
      jevModelVersion: null,
      selectedProviderId: winner.provider.id,
      selectedProviderName: winner.provider.name,
      selectedModel: winner.model.id,
      reasoningEffort: effort,
      confidence,
      complexityScore,
      probabilities,
      rationale:
        `${rationalePrefix}Matched "${params.purpose}" (reasoning ${(effectiveReasoning * 100).toFixed(
          0
        )}%, coding ${(effectiveCoding * 100).toFixed(0)}%) to ${winner.displayKey} ` +
        `[${winner.model.capabilityTier}/${winner.model.costTier}] under "${params.costPolicy}" policy.`,
      latencyMs: Math.max(1, Date.now() - params.startMs),
      createdAt: new Date().toISOString(),
    };

    return { candidate: winner, decision };
  }
}
