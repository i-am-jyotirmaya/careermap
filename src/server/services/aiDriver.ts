import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { CareerForgeDB } from '../db/database.ts';
import type { JevModelRouter, CandidateModelOption } from './jevRouter.ts';
import type {
  AIProviderRecord,
  ProviderModelConfig,
  ProviderType,
  ReasoningEffort,
  RoutingDecision,
  TaskPurpose,
} from '../../shared/types.ts';

export interface InferenceRequest {
  purpose: TaskPurpose;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  preferredProviderId?: string;
  maxTokens?: number;
  temperature?: number;
}

export class InferenceError extends Error {
  public readonly purpose: TaskPurpose;
  public readonly status: 502 | 504;

  constructor(purpose: TaskPurpose, cause: unknown) {
    super(cause instanceof Error ? cause.message : 'The AI provider request failed.', { cause });
    this.purpose = purpose;
    this.status = cause instanceof Error && cause.name === 'TimeoutError' ? 504 : 502;
  }
}

export interface InferenceResult {
  text: string;
  modelUsed: string;
  providerUsed: string;
  routingDecision: RoutingDecision;
}

export function getDefaultCodexAuthPath(): string {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return path.join(codexHome, 'auth.json');
}

export function detectLocalCodexStatus(): {
  authFileExists: boolean;
  authPath: string;
  cliInstalled: boolean;
} {
  const authPath = getDefaultCodexAuthPath();
  let authFileExists = false;
  try {
    authFileExists = fs.existsSync(authPath) && fs.statSync(authPath).size > 5;
  } catch {
    authFileExists = false;
  }

  let cliInstalled = false;
  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    const res = spawnSync(cmd, ['codex'], { encoding: 'utf8', timeout: 3000 });
    cliInstalled = res.status === 0 && Boolean(res.stdout?.trim());
  } catch {
    cliInstalled = false;
  }

  return { authFileExists, authPath, cliInstalled };
}

const DEFAULT_CODEX_MODEL: ProviderModelConfig = {
  id: 'codex-default',
  label: 'Codex CLI default',
  costTier: 'free_local',
  capabilityTier: 'coding_specialist',
  supportsReasoningEffort: true,
  enabled: true,
};

const LEGACY_CODEX_MODELS = new Set(['gpt-5.3-codex', 'gpt-5-codex', 'codex-mini-latest', 'o4-mini']);

export function getProviderModels(provider: AIProviderRecord): ProviderModelConfig[] {
  if (provider.type !== 'codex_subscription') return provider.models;

  const models = provider.models.filter((model) => !LEGACY_CODEX_MODELS.has(model.id));
  if (models.some((model) => model.enabled)) return models;
  return [DEFAULT_CODEX_MODEL, ...models.filter((model) => model.id !== DEFAULT_CODEX_MODEL.id)];
}

export const DEFAULT_PROVIDER_PRESETS: Record<
  ProviderType,
  {
    defaultName: string;
    defaultBaseUrl: string;
    models: ProviderModelConfig[];
  }
> = {
  codex_subscription: {
    defaultName: 'ChatGPT Codex Subscription',
    defaultBaseUrl: '',
    models: [DEFAULT_CODEX_MODEL],
  },
  openai: {
    defaultName: 'OpenAI API',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1 (Flagship)',
        costTier: 'frontier',
        capabilityTier: 'reasoning',
        supportsReasoningEffort: false,
        enabled: true,
      },
      {
        id: 'o4-mini',
        label: 'o4-mini (Reasoning & Code)',
        costTier: 'balanced',
        capabilityTier: 'reasoning',
        supportsReasoningEffort: true,
        enabled: true,
      },
      {
        id: 'gpt-4.1-mini',
        label: 'GPT-4.1 Mini (Balanced)',
        costTier: 'balanced',
        capabilityTier: 'balanced',
        supportsReasoningEffort: false,
        enabled: true,
      },
      {
        id: 'gpt-4.1-nano',
        label: 'GPT-4.1 Nano (Fast Economy)',
        costTier: 'economy',
        capabilityTier: 'fast',
        supportsReasoningEffort: false,
        enabled: true,
      },
    ],
  },
  anthropic: {
    defaultName: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: [
      {
        id: 'claude-sonnet-4-5-20250929',
        label: 'Claude Sonnet 4.5 (Coding & Synthesis)',
        costTier: 'balanced',
        capabilityTier: 'coding_specialist',
        supportsReasoningEffort: true,
        enabled: true,
      },
      {
        id: 'claude-opus-4-1-20250805',
        label: 'Claude Opus 4.1 (Deep Frontier Reasoning)',
        costTier: 'frontier',
        capabilityTier: 'reasoning',
        supportsReasoningEffort: true,
        enabled: true,
      },
      {
        id: 'claude-3-5-haiku-latest',
        label: 'Claude 3.5 Haiku (Fast Economy)',
        costTier: 'economy',
        capabilityTier: 'fast',
        supportsReasoningEffort: false,
        enabled: true,
      },
    ],
  },
  ollama: {
    defaultName: 'Ollama Local',
    defaultBaseUrl: 'http://localhost:11434',
    models: [
      {
        id: 'qwen2.5-coder:7b',
        label: 'Qwen 2.5 Coder 7B (Local)',
        costTier: 'free_local',
        capabilityTier: 'coding_specialist',
        supportsReasoningEffort: false,
        enabled: true,
      },
      {
        id: 'llama3.2:latest',
        label: 'Llama 3.2 (Local Fast)',
        costTier: 'free_local',
        capabilityTier: 'balanced',
        supportsReasoningEffort: false,
        enabled: true,
      },
    ],
  },
  openai_compatible: {
    defaultName: 'OpenRouter / Custom Compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: [
      {
        id: 'anthropic/claude-sonnet-4.5',
        label: 'Claude Sonnet 4.5 (via OpenRouter)',
        costTier: 'balanced',
        capabilityTier: 'coding_specialist',
        supportsReasoningEffort: false,
        enabled: true,
      },
      {
        id: 'openai/gpt-4.1-mini',
        label: 'GPT-4.1 Mini (via OpenRouter)',
        costTier: 'economy',
        capabilityTier: 'balanced',
        supportsReasoningEffort: false,
        enabled: true,
      },
      {
        id: 'deepseek/deepseek-r1',
        label: 'DeepSeek R1 (Reasoning)',
        costTier: 'economy',
        capabilityTier: 'reasoning',
        supportsReasoningEffort: false,
        enabled: true,
      },
    ],
  },
};

export function extractJsonFromText<T>(rawText: string): T {
  const trimmed = rawText.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue
  }

  // 2. Markdown code block ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // 3. Locate outermost { ... } or [ ... ]
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Attempt trailing comma cleanup
      const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned) as T;
    }
  }

  throw new Error(`Model response did not contain valid JSON. Excerpt: ${trimmed.slice(0, 200)}`);
}

export class AIDriver {
  private readonly db: CareerForgeDB;
  private readonly router: JevModelRouter;

  constructor(db: CareerForgeDB, router: JevModelRouter) {
    this.db = db;
    this.router = router;
  }

  public async execute(req: InferenceRequest): Promise<InferenceResult> {
    const { candidate, decision } = await this.router.routeTask({
      purpose: req.purpose,
      promptPreview: `${req.systemPrompt.slice(0, 400)}\n${req.userPrompt.slice(0, 1200)}`,
      preferredProviderId: req.preferredProviderId,
    });

    let text: string;
    try {
      text = await this.callCandidate(candidate, req, decision.reasoningEffort);
    } catch (err) {
      throw new InferenceError(req.purpose, err);
    }
    return {
      text,
      modelUsed: `${candidate.provider.name} (${candidate.model.id})`,
      providerUsed: candidate.provider.name,
      routingDecision: decision,
    };
  }

  public async executeJson<T>(req: InferenceRequest): Promise<{
    data: T;
    modelUsed: string;
    routingDecision: RoutingDecision;
  }> {
    const jsonEnforcedReq: InferenceRequest = {
      ...req,
      jsonMode: true,
      systemPrompt:
        `${req.systemPrompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object matching the requested schema. Do not include markdown commentary outside the JSON.`,
    };
    const result = await this.execute(jsonEnforcedReq);
    try {
      return {
        data: extractJsonFromText<T>(result.text),
        modelUsed: result.modelUsed,
        routingDecision: result.routingDecision,
      };
    } catch (err) {
      throw new InferenceError(
        req.purpose,
        new Error('The AI provider returned an invalid JSON response.', { cause: err })
      );
    }
  }

  public async testProvider(providerId: string): Promise<{
    ok: boolean;
    latencyMs: number;
    message: string;
    modelTested: string | null;
  }> {
    const provider = this.db.getProviderWithSecret(providerId);
    if (!provider) {
      throw new Error('Provider not found.');
    }
    const models = getProviderModels(provider);
    const model = models.find((m) => m.enabled) ?? models[0];
    if (!model) {
      const msg = 'No models configured on this provider.';
      this.db.updateProviderTestResult(providerId, 'error', msg);
      return { ok: false, latencyMs: 0, message: msg, modelTested: null };
    }

    const startMs = Date.now();
    try {
      const candidate: CandidateModelOption = {
        optionKey: 'test_0',
        displayKey: `${provider.name} / ${model.id}`,
        provider,
        model,
      };
      const reply = await this.callCandidate(
        candidate,
        {
          purpose: 'provider_test',
          systemPrompt: 'You are a concise health-check assistant.',
          userPrompt: 'Reply with the exact word READY.',
          maxTokens: 32,
        },
        'low'
      );
      const latencyMs = Date.now() - startMs;
      const snippet = reply.trim().slice(0, 60);
      const okMsg = `Verified ${model.id} in ${latencyMs}ms — response: "${snippet}"`;
      this.db.updateProviderTestResult(providerId, 'ok', okMsg);
      return { ok: true, latencyMs, message: okMsg, modelTested: model.id };
    } catch (err) {
      const latencyMs = Date.now() - startMs;
      const errMsg = err instanceof Error ? err.message : String(err);
      this.db.updateProviderTestResult(providerId, 'error', errMsg);
      return { ok: false, latencyMs, message: errMsg, modelTested: model.id };
    }
  }

  public async discoverModels(params: {
    type: ProviderType;
    baseUrl: string;
    apiKeyOrSecret?: string;
    providerId?: string;
  }): Promise<ProviderModelConfig[]> {
    let secret = params.apiKeyOrSecret?.trim() ?? '';
    if (!secret && params.providerId) {
      secret = this.db.getProviderWithSecret(params.providerId)?.secret ?? '';
    }

    const cleanBase = params.baseUrl.trim().replace(/\/+$/, '');

    if (params.type === 'ollama') {
      const url = `${cleanBase || 'http://localhost:11434'}/api/tags`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`Ollama discovery failed (HTTP ${res.status}) at ${url}`);
      }
      const data = (await res.json()) as {
        models?: Array<{ name: string; details?: { parameter_size?: string } }>;
      };
      return (data.models ?? []).map((m) => {
        const lower = m.name.toLowerCase();
        const isCoder = /coder|codellama|starcoder|deepseek-coder|devstral/.test(lower);
        const isReasoner = /r1|qwq|reason|70b|32b/.test(lower);
        return {
          id: m.name,
          label: m.details?.parameter_size ? `${m.name} (${m.details.parameter_size})` : m.name,
          costTier: 'free_local',
          capabilityTier: isCoder ? 'coding_specialist' : isReasoner ? 'reasoning' : 'balanced',
          supportsReasoningEffort: false,
          enabled: true,
        };
      });
    }

    if (params.type === 'anthropic') {
      const url = `${cleanBase || 'https://api.anthropic.com'}/v1/models`;
      const res = await fetch(url, {
        headers: {
          'x-api-key': secret,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new Error(`Anthropic model discovery failed (HTTP ${res.status})`);
      }
      const data = (await res.json()) as {
        data?: Array<{ id: string; display_name?: string }>;
      };
      return (data.data ?? []).slice(0, 20).map((m) => {
        const lower = m.id.toLowerCase();
        return {
          id: m.id,
          label: m.display_name || m.id,
          costTier: lower.includes('opus')
            ? 'frontier'
            : lower.includes('haiku')
              ? 'economy'
              : 'balanced',
          capabilityTier: lower.includes('opus')
            ? 'reasoning'
            : lower.includes('haiku')
              ? 'fast'
              : 'coding_specialist',
          supportsReasoningEffort: lower.includes('opus') || lower.includes('sonnet'),
          enabled: true,
        };
      });
    }

    if (params.type === 'codex_subscription') {
      return DEFAULT_PROVIDER_PRESETS.codex_subscription.models;
    }

    // OpenAI & OpenAI-compatible
    const base = cleanBase || 'https://api.openai.com/v1';
    const url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
    const headers: Record<string, string> = {};
    if (secret) headers.Authorization = `Bearer ${secret}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(`Model discovery failed (HTTP ${res.status}) at ${url}`);
    }
    const data = (await res.json()) as { data?: Array<{ id: string; name?: string }> };
    const filtered = (data.data ?? [])
      .filter((m) => !/embedding|whisper|tts|dall-e|moderation|audio|realtime/i.test(m.id))
      .slice(0, 25);

    return filtered.map((m, idx) => {
      const lower = m.id.toLowerCase();
      return {
        id: m.id,
        label: m.name || m.id,
        costTier: /nano|mini|flash|haiku/.test(lower)
          ? 'economy'
          : /o3|opus|gpt-5|gpt-4\.1$/.test(lower)
            ? 'frontier'
            : 'balanced',
        capabilityTier: /codex|coder/.test(lower)
          ? 'coding_specialist'
          : /^o[134]|r1|opus/.test(lower)
            ? 'reasoning'
            : /mini|nano|flash/.test(lower)
              ? 'fast'
              : 'balanced',
        supportsReasoningEffort: /^o[134]|codex|gpt-5/.test(lower),
        enabled: idx < 8,
      };
    });
  }

  private async callCandidate(
    candidate: CandidateModelOption,
    req: InferenceRequest,
    effort: ReasoningEffort
  ): Promise<string> {
    const { provider, model } = candidate;

    switch (provider.type) {
      case 'codex_subscription':
        return this.runCodexCliExec(model, req, effort);
      case 'anthropic':
        return this.callAnthropic(provider, model, req, effort);
      case 'ollama':
        return this.callOllama(provider, model, req);
      case 'openai':
      case 'openai_compatible':
        return this.callOpenAICompatible(provider, model, req, effort);
    }
  }

  // ===================== CHATGPT CODEX SUBSCRIPTION =====================

  private runCodexCliExec(
    model: ProviderModelConfig,
    req: InferenceRequest,
    effort: ReasoningEffort
  ): Promise<string> {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'codex.cmd' : 'codex';
    const env = { ...process.env };
    delete env.OPENAI_BASE_URL;

    const login = spawnSync(cmd, ['login', 'status'], {
      encoding: 'utf8',
      env,
      shell: isWindows,
      timeout: 3000,
    });
    if (login.error && (login.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Install the Codex CLI on the CareerForge server and make it available on PATH.');
    }
    if (login.status !== 0 || !/logged in using chatgpt/i.test(login.stdout + login.stderr)) {
      throw new Error('Sign in with ChatGPT using `codex login` on the machine running CareerForge, then verify again.');
    }

    const args = [
      'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--color', 'never',
      '-c', 'approval_policy=never', '-c', 'model_provider=openai',
    ];
    if (model.id !== DEFAULT_CODEX_MODEL.id) {
      if (!/^[a-z0-9][a-z0-9._:/-]*$/i.test(model.id)) {
        throw new Error('The Codex model ID contains unsupported characters.');
      }
      args.push('--model', model.id);
    }
    if (model.supportsReasoningEffort) {
      args.push('-c', `model_reasoning_effort=${effort}`);
    }
    const resumeTask = req.purpose === 'resume_analysis' || req.purpose === 'roadmap_suggestion';
    const timeoutSeconds = req.purpose === 'roadmap_suggestion' ? 240 : 120;
    const fullPrompt = resumeTask
      ? `Complete this task from the supplied text alone. Return the requested JSON directly.\n\n${req.systemPrompt}\n\n${req.userPrompt}`
      : `${req.systemPrompt}\n\n${req.userPrompt}`;
    if (resumeTask) {
      args.push('--disable', 'shell_tool', '--disable', 'apps', '--disable', 'plugins', '-c', 'web_search=disabled');
    }
    args.push('-');

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { env, stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new DOMException(`Codex did not finish within ${timeoutSeconds} seconds.`, 'TimeoutError'));
      }, timeoutSeconds * 1000);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to invoke codex CLI: ${err.message}`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          const errorLine = stderr.split(/\r?\n/).findLast((line) => /^error:/i.test(line));
          reject(new Error(errorLine?.slice(0, 300) || `Codex CLI exited with code ${code} without a response.`));
        }
      });

      child.stdin.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EPIPE') {
          clearTimeout(timer);
          child.kill();
          reject(err);
        }
      });
      child.stdin.end(fullPrompt);
    });
  }

  // ===================== OPENAI & OPENAI-COMPATIBLE =====================

  private async callOpenAIResponsesApi(params: {
    baseUrl: string;
    bearerToken: string;
    modelId: string;
    systemPrompt: string;
    userPrompt: string;
    effort?: ReasoningEffort;
    jsonMode?: boolean;
  }): Promise<string> {
    const cleanBase = params.baseUrl.trim().replace(/\/+$/, '');
    const endpoint = cleanBase.endsWith('/responses')
      ? cleanBase
      : cleanBase.endsWith('/v1')
        ? `${cleanBase}/responses`
        : `${cleanBase}/v1/responses`;

    const body: Record<string, unknown> = {
      model: params.modelId,
      instructions: params.systemPrompt,
      input: params.userPrompt,
    };

    if (params.effort) {
      body.reasoning = { effort: params.effort };
    }
    if (params.jsonMode) {
      body.text = { format: { type: 'json_object' } };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Responses API HTTP ${res.status}: ${errText.slice(0, 260)}`);
    }

    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text;
    }

    const texts: string[] = [];
    for (const item of data.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === 'string') {
          texts.push(part.text);
        }
      }
    }
    if (texts.length > 0) return texts.join('\n');
    throw new Error('OpenAI Responses API returned an empty output.');
  }

  private async callOpenAICompatible(
    provider: AIProviderRecord & { secret: string },
    model: ProviderModelConfig,
    req: InferenceRequest,
    effort: ReasoningEffort
  ): Promise<string> {
    const cleanBase = (provider.baseUrl || 'https://api.openai.com/v1')
      .trim()
      .replace(/\/+$/, '');

    // Codex models on OpenAI require /v1/responses
    if (provider.type === 'openai' && /codex/i.test(model.id)) {
      return this.callOpenAIResponsesApi({
        baseUrl: cleanBase,
        bearerToken: provider.secret.trim(),
        modelId: model.id,
        systemPrompt: req.systemPrompt,
        userPrompt: req.userPrompt,
        effort: model.supportsReasoningEffort ? effort : undefined,
        jsonMode: req.jsonMode,
      });
    }

    const endpoint = cleanBase.endsWith('/chat/completions')
      ? cleanBase
      : `${cleanBase}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.secret.trim()) {
      headers.Authorization = `Bearer ${provider.secret.trim()}`;
    }
    if (cleanBase.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'http://localhost:5173';
      headers['X-Title'] = 'CareerForge Local';
    }

    const isReasoningModel = /^o[134]|gpt-5/i.test(model.id);
    const body: Record<string, unknown> = {
      model: model.id,
      messages: [
        { role: isReasoningModel ? 'developer' : 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    };

    if (model.supportsReasoningEffort && isReasoningModel) {
      body.reasoning_effort = effort;
    } else if (req.temperature !== undefined && !isReasoningModel) {
      body.temperature = req.temperature;
    }
    if (req.jsonMode && provider.type === 'openai') {
      body.response_format = { type: 'json_object' };
    }
    if (req.maxTokens) {
      if (isReasoningModel) {
        body.max_completion_tokens = req.maxTokens;
      } else {
        body.max_tokens = req.maxTokens;
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      // Automatic fallback if an OpenAI model requires /v1/responses
      if (provider.type === 'openai' && errText.includes('v1/responses')) {
        return this.callOpenAIResponsesApi({
          baseUrl: cleanBase,
          bearerToken: provider.secret.trim(),
          modelId: model.id,
          systemPrompt: req.systemPrompt,
          userPrompt: req.userPrompt,
          effort: model.supportsReasoningEffort ? effort : undefined,
          jsonMode: req.jsonMode,
        });
      }
      throw new Error(`${provider.name} HTTP ${res.status}: ${errText.slice(0, 260)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${provider.name} returned an empty completion.`);
    }
    return content;
  }

  // ===================== ANTHROPIC CLAUDE =====================

  private async callAnthropic(
    provider: AIProviderRecord & { secret: string },
    model: ProviderModelConfig,
    req: InferenceRequest,
    effort: ReasoningEffort
  ): Promise<string> {
    const cleanBase = (provider.baseUrl || 'https://api.anthropic.com')
      .trim()
      .replace(/\/+$/, '');
    const endpoint = cleanBase.endsWith('/v1/messages')
      ? cleanBase
      : `${cleanBase}/v1/messages`;

    const maxTokens = req.maxTokens ?? (effort === 'high' ? 6000 : 4096);
    const body: Record<string, unknown> = {
      model: model.id,
      max_tokens: maxTokens,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
    };
    if (req.temperature !== undefined) {
      body.temperature = req.temperature;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': provider.secret.trim(),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 260)}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const textBlocks = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!);

    if (textBlocks.length === 0) {
      throw new Error('Anthropic returned no text content.');
    }
    return textBlocks.join('\n');
  }

  // ===================== OLLAMA LOCAL =====================

  private async callOllama(
    provider: AIProviderRecord & { secret: string },
    model: ProviderModelConfig,
    req: InferenceRequest
  ): Promise<string> {
    const cleanBase = (provider.baseUrl || 'http://localhost:11434')
      .trim()
      .replace(/\/+$/, '');
    const endpoint = `${cleanBase}/api/chat`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.secret.trim()) {
      headers.Authorization = `Bearer ${provider.secret.trim()}`;
    }

    const body: Record<string, unknown> = {
      model: model.id,
      stream: false,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    };
    if (req.jsonMode) {
      body.format = 'json';
    }
    if (req.temperature !== undefined) {
      body.options = { temperature: req.temperature };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 260)}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    if (!data.message?.content) {
      throw new Error('Ollama returned empty message content.');
    }
    return data.message.content;
  }
}
