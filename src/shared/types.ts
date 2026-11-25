export type ProviderType =
  | 'codex_subscription'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'openai_compatible';

export type CostTier = 'free_local' | 'economy' | 'balanced' | 'frontier';
export type CapabilityTier = 'fast' | 'balanced' | 'reasoning' | 'coding_specialist';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ProviderModelConfig {
  id: string;
  label: string;
  costTier: CostTier;
  capabilityTier: CapabilityTier;
  supportsReasoningEffort: boolean;
  enabled: boolean;
}

export type CodexAuthMode = 'auto_local_auth_json' | 'paste_token_or_json' | 'cli_exec';

export type ProviderConnectionStatus = 'connected' | 'unverified' | 'failed' | 'disabled';

export interface AIProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  baseUrl: string;
  hasSecret: boolean;
  maskedSecret: string;
  codexAuthMode?: CodexAuthMode;
  codexAuthPath?: string;
  models: ProviderModelConfig[];
  priority: number;
  connectionStatus: ProviderConnectionStatus;
  lastTestedAt: string | null;
  lastTestStatus: 'untested' | 'ok' | 'error';
  lastTestMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProviderInput {
  id?: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  baseUrl: string;
  apiKeyOrSecret?: string;
  codexAuthMode?: CodexAuthMode;
  codexAuthPath?: string;
  models?: ProviderModelConfig[];
  priority?: number;
  autoVerify?: boolean;
}

export type JevChannel = 'typesafe' | 'openrouter' | 'vercel' | 'custom';
export type JevCostPolicy = 'quality_first' | 'balanced' | 'cost_saver';
export type JevConfigurationStatus =
  | 'configured_verified'
  | 'configured'
  | 'not_configured'
  | 'disabled';

export interface JevConfig {
  enabled: boolean;
  hasApiKey: boolean;
  maskedApiKey: string;
  status: JevConfigurationStatus;
  channel: JevChannel;
  baseUrl: string;
  model: string;
  costPolicy: JevCostPolicy;
  lastTestedAt: string | null;
  lastTestStatus: 'untested' | 'ok' | 'error';
  lastTestMessage: string | null;
}

export interface SaveJevConfigInput {
  enabled: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
  channel: JevChannel;
  baseUrl: string;
  model: string;
  costPolicy: JevCostPolicy;
  autoVerify?: boolean;
}

export type TaskPurpose =
  | 'resume_analysis'
  | 'roadmap_suggestion'
  | 'stream_curriculum'
  | 'learning_resources'
  | 'practice_generation'
  | 'solution_evaluation'
  | 'mentor_hint'
  | 'provider_test';

export interface RoutingDecision {
  id: string;
  purpose: TaskPurpose;
  decidedBy: 'typesafe_jev' | 'autonomous_fallback';
  jevModelVersion: string | null;
  selectedProviderId: string;
  selectedProviderName: string;
  selectedModel: string;
  reasoningEffort: ReasoningEffort;
  confidence: number;
  complexityScore: number;
  probabilities: Record<string, number>;
  rationale: string;
  latencyMs: number;
  createdAt: string;
}

export interface SkillRating {
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsEvidence: string;
}

export interface CareerProfile {
  headline: string;
  currentRole: string;
  seniorityEstimate: string;
  yearsOfExperience: number;
  summary: string;
  skills: SkillRating[];
  superpowers: string[];
  growthGaps: string[];
  domains: string[];
  standoutHighlights: string[];
}

export interface PreparedTopicNode {
  canonicalKey: string;
  title: string;
  summary: string;
  estimatedHours: number;
  difficulty: TopicDifficulty;
  keySkills: string[];
  isBossTopic: boolean;
}

export interface PreparedPhaseBlueprint {
  title: string;
  objective: string;
  topics: PreparedTopicNode[];
}

export interface SuggestedRoadmapPhasePreview {
  title: string;
  objective: string;
  keyTopics: string[];
}

export interface SuggestedRoadmap {
  id: string;
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
  colorTheme: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
  iconName: string;
  phasesPreview: SuggestedRoadmapPhasePreview[];
  preparedPhases?: PreparedPhaseBlueprint[];
  activatedStreamId?: string | null;
}

export interface ResumeRecord {
  id: string;
  filename: string;
  fileFormat: string;
  rawText: string;
  careerGoalsNote?: string;
  contextHash?: string | null;
  profile: CareerProfile | null;
  suggestedRoadmaps: SuggestedRoadmap[];
  analyzedByModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StreamStatus = 'active' | 'paused' | 'completed';
export type TopicStatus = 'available' | 'in_progress' | 'mastered';
export type TopicDifficulty = 'foundation' | 'intermediate' | 'advanced' | 'staff_plus';

export interface StreamTopic {
  id: string;
  streamId: string;
  phaseId: string;
  topicOrder: number;
  title: string;
  summary: string;
  estimatedHours: number;
  difficulty: TopicDifficulty;
  keySkills: string[];
  status: TopicStatus;
  masteryScore: number;
  isBossTopic: boolean;
  resourceCount: number;
  completedResourceCount: number;
  problemCount: number;
  solvedProblemCount: number;
}

export interface StreamPhase {
  id: string;
  streamId: string;
  phaseOrder: number;
  title: string;
  objective: string;
  topics: StreamTopic[];
}

export interface RoadmapGraphEdge {
  id: string;
  fromTopicId: string;
  toTopicId: string;
  kind: 'intra_phase' | 'cross_phase' | 'boss_convergence';
}

export interface CareerStream {
  id: string;
  title: string;
  tagline: string;
  category: string;
  targetRole: string;
  description: string;
  colorTheme: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
  iconName: string;
  status: StreamStatus;
  level: number;
  xp: number;
  xpToNextLevel: number;
  masteryPercent: number;
  streakDays: number;
  lastActivityDate: string | null;
  problemsSolved: number;
  resourcesCompleted: number;
  totalEvaluations: number;
  avgScore: number;
  phases: StreamPhase[];
  roadmapEdges: RoadmapGraphEdge[];
  createdAt: string;
  updatedAt: string;
}

export type ResourceKind =
  | 'generated_guide'
  | 'external_article'
  | 'external_video'
  | 'external_course'
  | 'external_repo'
  | 'external_book'
  | 'interactive_flashcards';

export interface FlashcardItem {
  front: string;
  back: string;
}

export interface LearningResource {
  id: string;
  streamId: string;
  topicId: string;
  kind: ResourceKind;
  title: string;
  url: string | null;
  providerOrAuthor: string;
  estimatedMinutes: number;
  difficulty: string;
  whyRelevant: string;
  contentMarkdown: string;
  flashcards: FlashcardItem[];
  isCompleted: boolean;
  isBookmarked: boolean;
  xpReward: number;
  generatedByModel: string | null;
  createdAt: string;
}

export type ProblemArchetype =
  | 'coding_implementation'
  | 'system_design'
  | 'debugging_incident'
  | 'architecture_review'
  | 'leadership_scenario';

export type ProblemDifficulty = 'warmup' | 'standard' | 'hard' | 'boss';

export interface RubricCriterion {
  criterion: string;
  weight: number;
  description: string;
}

export interface PracticeProblem {
  id: string;
  streamId: string;
  topicId: string;
  archetype: ProblemArchetype;
  difficulty: ProblemDifficulty;
  title: string;
  scenarioMarkdown: string;
  requirements: string[];
  constraints: string[];
  starterTemplate: string;
  languageHint: string;
  rubric: RubricCriterion[];
  hints: string[];
  hintsRevealed: number;
  xpReward: number;
  bestScore: number | null;
  status: 'unattempted' | 'attempted' | 'passed' | 'mastered';
  draftSolution: string;
  generatedByModel: string | null;
  createdAt: string;
}

export interface RubricScoreItem {
  criterion: string;
  score: number;
  maxScore: number;
  comment: string;
}

export interface BonusAppliedItem {
  label: string;
  multiplierOrFlat: string;
  xpAdded: number;
}

export interface SolutionSubmission {
  id: string;
  problemId: string;
  streamId: string;
  topicId: string;
  attemptNumber: number;
  solutionText: string;
  score: number;
  verdict: 'needs_revision' | 'passed' | 'mastered';
  summaryFeedback: string;
  strengths: string[];
  improvements: string[];
  rubricBreakdown: RubricScoreItem[];
  exemplarApproachMarkdown: string;
  xpAwarded: number;
  bonusesApplied: BonusAppliedItem[];
  evaluatedByModel: string;
  routingDecision: RoutingDecision | null;
  createdAt: string;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic' | 'secret';

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  tier: AchievementTier;
  iconName: string;
  xpBonus: number;
  sparksBonus: number;
  isSecret: boolean;
  unlockedAt: string | null;
}

export interface ActiveBuff {
  id: string;
  label: string;
  description: string;
  multiplier: number;
  remainingUses: number;
  source: string;
  createdAt: string;
}

export interface BonusQuest {
  id: string;
  title: string;
  description: string;
  questType: 'cross_stream' | 'streak' | 'mastery_sprint' | 'mystery_drop';
  targetCount: number;
  currentCount: number;
  xpReward: number;
  sparksReward: number;
  completedAt: string | null;
  createdAt: string;
}

export interface XpEvent {
  id: string;
  streamId: string | null;
  streamTitle: string | null;
  source: string;
  xpAmount: number;
  sparksAmount: number;
  description: string;
  createdAt: string;
}

export type AvatarColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
export type AvatarIcon =
  | 'User'
  | 'Rocket'
  | 'Code2'
  | 'Brain'
  | 'Shield'
  | 'Sparkles'
  | 'Compass'
  | 'Cpu';

export interface PlayerProfile {
  displayName: string;
  headlineTitle: string;
  avatarColor: AvatarColor;
  avatarIcon: AvatarIcon;
  hasCompletedOnboarding: boolean;
  rankTitle: string;
  globalLevel: number;
  globalXp: number;
  xpToNextLevel: number;
  forgeSparks: number;
  dailyStreak: number;
  lastActiveDate: string | null;
  polymathMultiplierActive: boolean;
  streamsWorkedToday: string[];
  easterEggsFound: string[];
  activeBuffs: ActiveBuff[];
  achievements: Achievement[];
  bonusQuests: BonusQuest[];
  recentEvents: XpEvent[];
}

export interface UpdateProfileInput {
  displayName?: string;
  headlineTitle?: string;
  avatarColor?: AvatarColor;
  avatarIcon?: AvatarIcon;
}

export interface AppPreferences {
  animationsEnabled: boolean;
  compactStreamCards: boolean;
  defaultLanguageHint: 'typescript' | 'python' | 'go' | 'sql' | 'markdown';
  showRoadmapFlowInArena: boolean;
}

export type DangerZoneAction =
  | 'reset_evaluations'
  | 'reset_progress'
  | 'delete_streams_and_resumes'
  | 'factory_reset';

export interface DangerZoneRequest {
  action: DangerZoneAction;
  confirmationPhrase: string;
  acknowledgedIrreversible: boolean;
}

export interface CompleteOnboardingInput {
  displayName?: string;
  headlineTitle?: string;
  avatarColor?: AvatarColor;
  avatarIcon?: AvatarIcon;
}

export interface GamificationDelta {
  xpGained: number;
  sparksGained: number;
  leveledUpGlobal: boolean;
  newGlobalLevel: number;
  leveledUpStream: boolean;
  newStreamLevel?: number;
  unlockedAchievements: Achievement[];
  completedQuests: BonusQuest[];
  lootDropMessage?: string | null;
}

export interface TopicWorkspaceResponse {
  stream: CareerStream;
  topic: StreamTopic;
  resources: LearningResource[];
  problems: PracticeProblem[];
  recentSubmissions: SolutionSubmission[];
  servedFromMemory: boolean;
  lastResourceFocusNote?: string;
}

export interface MemoryCacheStats {
  cachedRoadmaps: number;
  cachedTopicNodes: number;
  cachedResourcePacks: number;
}

export interface SystemStatusResponse {
  dbPath: string;
  dbFileSizeBytes: number;
  isOnboarded: boolean;
  hasActiveProvider: boolean;
  activeProviderCount: number;
  connectedProviderCount: number;
  jevConfigured: boolean;
  jevStatus: JevConfigurationStatus;
  hasResume: boolean;
  activeStreamCount: number;
  codexLocalAuthDetected: boolean;
  codexLocalAuthPath: string;
  codexCliInstalled: boolean;
  memoryCache: MemoryCacheStats;
  preferences: AppPreferences;
}
