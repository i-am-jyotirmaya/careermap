import type {
  Achievement,
  AIProviderRecord,
  AppPreferences,
  CareerStream,
  CompleteOnboardingInput,
  DangerZoneRequest,
  GamificationDelta,
  JevConfig,
  LearningResource,
  MemoryCacheStats,
  PlayerProfile,
  PracticeProblem,
  ProblemArchetype,
  ProblemDifficulty,
  ProviderModelConfig,
  ProviderType,
  ResumeRecord,
  RoutingDecision,
  SaveJevConfigInput,
  SaveProviderInput,
  SolutionSubmission,
  StreamStatus,
  StreamTopic,
  SystemStatusResponse,
  TaskPurpose,
  TopicWorkspaceResponse,
  UpdateProfileInput,
} from '../../shared/types.ts';

// Client-side In-Memory Cache for Topic Workspaces & Resources (0ms AI-free reuse across navigation)
const topicWorkspaceMemoryCache = new Map<string, TopicWorkspaceResponse>();

export function clearTopicWorkspaceMemoryCache(topicId?: string): void {
  if (topicId) {
    topicWorkspaceMemoryCache.delete(topicId);
  } else {
    topicWorkspaceMemoryCache.clear();
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed with HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  getStatus: () =>
    requestJson<{
      status: SystemStatusResponse;
      presets: Record<
        ProviderType,
        { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }
      >;
    }>('/api/status'),

  getProviders: () =>
    requestJson<{
      providers: AIProviderRecord[];
      presets: Record<
        ProviderType,
        { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }
      >;
    }>('/api/providers'),

  saveProvider: (input: SaveProviderInput) =>
    requestJson<{
      provider: AIProviderRecord;
      providers: AIProviderRecord[];
      verificationResult: { ok: boolean; latencyMs: number; message: string } | null;
      gamificationDelta: GamificationDelta | null;
    }>('/api/providers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteProvider: (id: string) =>
    requestJson<{ providers: AIProviderRecord[] }>(`/api/providers/${id}`, {
      method: 'DELETE',
    }),

  testProvider: (id: string) =>
    requestJson<{
      ok: boolean;
      latencyMs: number;
      message: string;
      modelTested: string | null;
      providers: AIProviderRecord[];
    }>(`/api/providers/${id}/test`, { method: 'POST' }),

  discoverModels: (body: {
    type: ProviderType;
    baseUrl: string;
    apiKeyOrSecret?: string;
    providerId?: string;
  }) =>
    requestJson<{ models: ProviderModelConfig[] }>('/api/providers/discover-models', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getJev: () =>
    requestJson<{ config: JevConfig; decisions: RoutingDecision[] }>('/api/jev'),

  saveJev: (input: SaveJevConfigInput) =>
    requestJson<{
      config: JevConfig;
      verificationResult: { ok: boolean; latencyMs: number; message: string } | null;
      unlockedAchievements: Achievement[];
    }>('/api/jev', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  testJev: () =>
    requestJson<{
      ok: boolean;
      modelVersion: string | null;
      latencyMs: number;
      message: string;
      config: JevConfig;
    }>('/api/jev/test', { method: 'POST' }),

  simulateJev: (purpose: TaskPurpose, samplePrompt?: string) =>
    requestJson<{ decision: RoutingDecision; decisions: RoutingDecision[] }>(
      '/api/jev/simulate',
      {
        method: 'POST',
        body: JSON.stringify({ purpose, samplePrompt }),
      }
    ),

  getResumes: () =>
    requestJson<{ latest: ResumeRecord | null; history: ResumeRecord[] }>('/api/resumes'),

  parseResumeFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return requestJson<{ filename: string; fileFormat: string; rawText: string }>(
      '/api/resumes/parse-file',
      {
        method: 'POST',
        body: fd,
      }
    );
  },

  analyzeResume: (body: {
    filename?: string;
    fileFormat?: string;
    rawText: string;
    careerGoalsNote?: string;
    existingResumeId?: string;
  }) =>
    requestJson<{
      resume: ResumeRecord;
      routingDecisions: RoutingDecision[];
      gamificationDelta: GamificationDelta;
      fromMemoryCache: boolean;
      consistencyNote: string;
    }>('/api/resumes/analyze', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getStreams: () => requestJson<{ streams: CareerStream[] }>('/api/streams'),

  launchStream: (body: {
    resumeId?: string;
    suggestedRoadmapId?: string;
    customStreamInput?: {
      title: string;
      targetRole: string;
      focusDescription: string;
      colorTheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
    };
  }) =>
    requestJson<{
      stream: CareerStream;
      streams: CareerStream[];
      latestResume: ResumeRecord | null;
      routingDecision: RoutingDecision | null;
      gamificationDelta: GamificationDelta;
      reusedFromMemory: boolean;
    }>('/api/streams', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  refreshStreamNodes: async (streamId: string, updatedFocusDescription?: string) => {
    const res = await requestJson<{
      stream: CareerStream;
      streams: CareerStream[];
      fromMemoryCache: boolean;
      updatedWithAi: boolean;
      consistencyNote: string;
      routingDecision: RoutingDecision | null;
    }>(`/api/streams/${streamId}/refresh-nodes`, {
      method: 'POST',
      body: JSON.stringify({ updatedFocusDescription }),
    });
    if (res.updatedWithAi) {
      clearTopicWorkspaceMemoryCache();
    }
    return res;
  },

  updateStreamStatus: (id: string, status: StreamStatus) =>
    requestJson<{ stream: CareerStream; streams: CareerStream[] }>(`/api/streams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteStream: (id: string) => {
    clearTopicWorkspaceMemoryCache();
    return requestJson<{ streams: CareerStream[] }>(`/api/streams/${id}`, {
      method: 'DELETE',
    });
  },

  getTopicWorkspace: async (topicId: string, options?: { bypassClientMemory?: boolean }) => {
    if (!options?.bypassClientMemory && topicWorkspaceMemoryCache.has(topicId)) {
      return topicWorkspaceMemoryCache.get(topicId)!;
    }
    const ws = await requestJson<TopicWorkspaceResponse>(`/api/topics/${topicId}`);
    topicWorkspaceMemoryCache.set(topicId, ws);
    return ws;
  },

  generateTopicResources: async (
    topicId: string,
    focusNote?: string,
    refresh = false
  ) => {
    const res = await requestJson<{
      resources: LearningResource[];
      routingDecision: RoutingDecision | null;
      topic: StreamTopic;
      stream: CareerStream;
      fromMemoryCache: boolean;
      refreshedWithAi: boolean;
      consistencyNote: string;
    }>(`/api/topics/${topicId}/resources/generate`, {
      method: 'POST',
      body: JSON.stringify({ focusNote, refresh }),
    });
    const prev = topicWorkspaceMemoryCache.get(topicId);
    topicWorkspaceMemoryCache.set(topicId, {
      stream: res.stream,
      topic: res.topic,
      resources: res.resources,
      problems: prev?.problems ?? [],
      recentSubmissions: prev?.recentSubmissions ?? [],
      servedFromMemory: true,
      lastResourceFocusNote: focusNote ?? prev?.lastResourceFocusNote ?? '',
    });
    return res;
  },

  addCustomResource: async (
    topicId: string,
    body: {
      title: string;
      url?: string;
      providerOrAuthor?: string;
      notes?: string;
      estimatedMinutes?: number;
    }
  ) => {
    const res = await requestJson<{
      resource: LearningResource;
      resources: LearningResource[];
      stream: CareerStream;
    }>(`/api/topics/${topicId}/resources/custom`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    clearTopicWorkspaceMemoryCache(topicId);
    return res;
  },

  updateResource: async (
    resourceId: string,
    body: { isCompleted?: boolean; isBookmarked?: boolean }
  ) => {
    const res = await requestJson<{
      resource: LearningResource;
      resources: LearningResource[];
      topic: StreamTopic;
      stream: CareerStream;
      gamificationDelta: GamificationDelta | null;
    }>(`/api/resources/${resourceId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const prev = topicWorkspaceMemoryCache.get(res.topic.id);
    if (prev) {
      topicWorkspaceMemoryCache.set(res.topic.id, {
        ...prev,
        stream: res.stream,
        topic: res.topic,
        resources: res.resources,
      });
    }
    return res;
  },

  generatePracticeProblem: async (
    topicId: string,
    body: { archetype?: ProblemArchetype; difficulty?: ProblemDifficulty }
  ) => {
    const res = await requestJson<{
      problem: PracticeProblem;
      problems: PracticeProblem[];
      routingDecision: RoutingDecision;
      topic: StreamTopic;
      stream: CareerStream;
    }>(`/api/topics/${topicId}/problems/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const prev = topicWorkspaceMemoryCache.get(topicId);
    if (prev) {
      topicWorkspaceMemoryCache.set(topicId, {
        ...prev,
        stream: res.stream,
        topic: res.topic,
        problems: res.problems,
      });
    }
    return res;
  },

  saveProblemDraft: async (problemId: string, draftSolution: string) => {
    const res = await requestJson<{ ok: boolean }>(`/api/problems/${problemId}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ draftSolution }),
    });
    for (const [tid, ws] of topicWorkspaceMemoryCache.entries()) {
      if (ws.problems.some((p) => p.id === problemId)) {
        topicWorkspaceMemoryCache.set(tid, {
          ...ws,
          problems: ws.problems.map((p) =>
            p.id === problemId ? { ...p, draftSolution } : p
          ),
        });
      }
    }
    return res;
  },

  revealHint: async (problemId: string) => {
    const res = await requestJson<{ problem: PracticeProblem }>(
      `/api/problems/${problemId}/reveal-hint`,
      { method: 'POST' }
    );
    for (const [tid, ws] of topicWorkspaceMemoryCache.entries()) {
      if (ws.problems.some((p) => p.id === problemId)) {
        topicWorkspaceMemoryCache.set(tid, {
          ...ws,
          problems: ws.problems.map((p) =>
            p.id === problemId ? res.problem : p
          ),
        });
      }
    }
    return res;
  },

  askMentorCoach: (problemId: string, currentDraft: string, question?: string) =>
    requestJson<{
      coachingMarkdown: string;
      routingDecision: RoutingDecision;
      problem: PracticeProblem;
    }>(`/api/problems/${problemId}/mentor-coach`, {
      method: 'POST',
      body: JSON.stringify({ currentDraft, question }),
    }),

  submitSolution: async (problemId: string, solutionText: string) => {
    const res = await requestJson<{
      submission: SolutionSubmission;
      problem: PracticeProblem;
      problems: PracticeProblem[];
      recentSubmissions: SolutionSubmission[];
      topic: StreamTopic;
      stream: CareerStream;
      gamificationDelta: GamificationDelta;
      routingDecision: RoutingDecision;
    }>(`/api/problems/${problemId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ solutionText }),
    });
    const prev = topicWorkspaceMemoryCache.get(res.topic.id);
    if (prev) {
      topicWorkspaceMemoryCache.set(res.topic.id, {
        ...prev,
        stream: res.stream,
        topic: res.topic,
        problems: res.problems,
        recentSubmissions: res.recentSubmissions,
      });
    }
    return res;
  },

  getGamification: () => requestJson<{ profile: PlayerProfile }>('/api/gamification'),

  updatePlayerName: (displayName: string) =>
    requestJson<{ profile: PlayerProfile }>('/api/gamification/profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName }),
    }),

  updateProfile: (input: UpdateProfileInput) =>
    requestJson<{ profile: PlayerProfile }>('/api/gamification/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  completeOnboarding: (input?: CompleteOnboardingInput) =>
    requestJson<{ status: SystemStatusResponse; profile: PlayerProfile }>(
      '/api/onboarding/complete',
      {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      }
    ),

  getPreferences: () =>
    requestJson<{ preferences: AppPreferences }>('/api/settings/preferences'),

  savePreferences: (patch: Partial<AppPreferences>) =>
    requestJson<{ preferences: AppPreferences; status: SystemStatusResponse }>(
      '/api/settings/preferences',
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  clearServerMemoryCache: async () => {
    clearTopicWorkspaceMemoryCache();
    return requestJson<{
      ok: boolean;
      message: string;
      memoryCache: MemoryCacheStats;
    }>('/api/settings/clear-memory-cache', {
      method: 'POST',
    });
  },

  executeDangerZone: async (body: DangerZoneRequest) => {
    clearTopicWorkspaceMemoryCache();
    return requestJson<{
      ok: boolean;
      message: string;
      status: SystemStatusResponse;
      profile: PlayerProfile;
    }>('/api/settings/danger-zone', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  triggerEasterEgg: (
    eggId: 'konami' | 'anvil_seven' | 'terminal_command',
    commandText?: string
  ) =>
    requestJson<{
      alreadyFound: boolean;
      message: string;
      asciiArt?: string;
      delta: GamificationDelta;
      profile: PlayerProfile;
    }>('/api/gamification/easter-egg', {
      method: 'POST',
      body: JSON.stringify({ eggId, commandText }),
    }),

  redeemReliquary: () =>
    requestJson<{
      rewardTitle: string;
      rewardDescription: string;
      delta: GamificationDelta;
      profile: PlayerProfile;
    }>('/api/gamification/reliquary', { method: 'POST' }),
};
