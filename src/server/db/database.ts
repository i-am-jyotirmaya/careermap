import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  Achievement,
  ActiveBuff,
  AIProviderRecord,
  AppPreferences,
  AvatarColor,
  AvatarIcon,
  BonusAppliedItem,
  BonusQuest,
  CareerProfile,
  CareerStream,
  CodexAuthMode,
  CompleteOnboardingInput,
  DangerZoneAction,
  FlashcardItem,
  JevChannel,
  JevConfig,
  JevConfigurationStatus,
  JevCostPolicy,
  LearningResource,
  PlayerProfile,
  PracticeProblem,
  PreparedPhaseBlueprint,
  PreparedTopicNode,
  ProblemArchetype,
  ProblemDifficulty,
  ProviderConnectionStatus,
  ProviderModelConfig,
  ProviderType,
  ReasoningEffort,
  ResourceKind,
  RoadmapGraphEdge,
  RoutingDecision,
  RubricCriterion,
  RubricScoreItem,
  SaveJevConfigInput,
  SaveProviderInput,
  SolutionSubmission,
  StreamPhase,
  StreamStatus,
  StreamTopic,
  SuggestedRoadmap,
  TaskPurpose,
  TopicDifficulty,
  TopicStatus,
  UpdateProfileInput,
  XpEvent,
  ResumeRecord,
} from '../../shared/types.ts';

import type {
  CachedResourcePack,
  CachedResourceTemplate,
  CachedRoadmapBlueprint,
} from '../services/memoryCache.ts';
import { canonicalizeKey } from '../services/memoryCache.ts';

export function maskSecret(secret: string | null | undefined): string {
  if (!secret || secret.trim().length === 0) return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function xpThresholdForLevel(level: number): number {
  return Math.round(150 * Math.pow(1.28, Math.max(0, level - 1)));
}

export function rankTitleForLevel(level: number): string {
  if (level >= 15) return 'Grandmaster Polymath';
  if (level >= 12) return 'Principal Vanguard';
  if (level >= 9) return 'Staff Pathfinder';
  if (level >= 6) return 'Senior Forge Architect';
  if (level >= 4) return 'Multi-Stream Journeyman';
  if (level >= 2) return 'Apprentice Navigator';
  return 'Forge Initiate';
}

const DEFAULT_ACHIEVEMENTS: Array<Omit<Achievement, 'id' | 'unlockedAt'>> = [
  {
    code: 'ENGINE_IGNITED',
    title: 'Engine Ignited',
    description: 'Configure and enable your first AI inference provider.',
    tier: 'bronze',
    iconName: 'Cpu',
    xpBonus: 50,
    sparksBonus: 25,
    isSecret: false,
  },
  {
    code: 'MULTI_PROVIDER_FLEET',
    title: 'Inference Fleet Commander',
    description: 'Enable 2 or more AI providers simultaneously so the router can pick across vendors.',
    tier: 'silver',
    iconName: 'Network',
    xpBonus: 100,
    sparksBonus: 40,
    isSecret: false,
  },
  {
    code: 'SYSTEM_ONE_ONLINE',
    title: 'System One Online',
    description: "Connect TypeSafe's Jev API key or complete 5 intelligent model-routed tasks.",
    tier: 'silver',
    iconName: 'GitBranch',
    xpBonus: 120,
    sparksBonus: 50,
    isSecret: false,
  },
  {
    code: 'ORIGIN_STORY',
    title: 'Origin Story',
    description: 'Upload and analyze your resume to generate personalized career roadmaps.',
    tier: 'bronze',
    iconName: 'FileText',
    xpBonus: 75,
    sparksBonus: 30,
    isSecret: false,
  },
  {
    code: 'FIRST_STREAM',
    title: 'Charting the Course',
    description: 'Launch your first career growth stream.',
    tier: 'bronze',
    iconName: 'Compass',
    xpBonus: 60,
    sparksBonus: 25,
    isSecret: false,
  },
  {
    code: 'MULTIVERSE_TRAVELER',
    title: 'Parallel Multiverse',
    description: 'Pursue 2 active career streams simultaneously.',
    tier: 'silver',
    iconName: 'Layers',
    xpBonus: 125,
    sparksBonus: 50,
    isSecret: false,
  },
  {
    code: 'TRIPLE_THREAT',
    title: 'Triple-Stream Polymath',
    description: 'Maintain 3 or more active career streams at the same time.',
    tier: 'gold',
    iconName: 'Sparkles',
    xpBonus: 220,
    sparksBonus: 80,
    isSecret: false,
  },
  {
    code: 'SCHOLAR_FIRST',
    title: 'First Spark of Knowledge',
    description: 'Complete your first learning resource in any stream.',
    tier: 'bronze',
    iconName: 'BookOpen',
    xpBonus: 40,
    sparksBonus: 15,
    isSecret: false,
  },
  {
    code: 'DEEP_SCHOLAR',
    title: 'Voracious Scholar',
    description: 'Complete 5 learning resources across your career streams.',
    tier: 'silver',
    iconName: 'Library',
    xpBonus: 130,
    sparksBonus: 45,
    isSecret: false,
  },
  {
    code: 'ARENA_BLOODED',
    title: 'Arena Blooded',
    description: 'Submit a practice problem solution and earn a passing AI evaluation.',
    tier: 'bronze',
    iconName: 'Swords',
    xpBonus: 90,
    sparksBonus: 35,
    isSecret: false,
  },
  {
    code: 'FLAWLESS_EXECUTION',
    title: 'Flawless Execution',
    description: 'Score 92 or higher on an AI-evaluated practice problem.',
    tier: 'gold',
    iconName: 'Crown',
    xpBonus: 200,
    sparksBonus: 75,
    isSecret: false,
  },
  {
    code: 'COMEBACK_KID',
    title: 'Iterative Redemption',
    description: 'Re-submit a solution to a practice problem and improve your score by 15+ points.',
    tier: 'silver',
    iconName: 'TrendingUp',
    xpBonus: 140,
    sparksBonus: 50,
    isSecret: false,
  },
  {
    code: 'PURE_INSTINCT',
    title: 'Zero-Hint Instinct',
    description: 'Pass a Hard or Boss practice problem without revealing any hints.',
    tier: 'gold',
    iconName: 'Zap',
    xpBonus: 225,
    sparksBonus: 85,
    isSecret: false,
  },
  {
    code: 'BOSS_SLAYER',
    title: 'Boss Milestone Conqueror',
    description: 'Pass a Boss-difficulty capstone challenge in any stream.',
    tier: 'mythic',
    iconName: 'Trophy',
    xpBonus: 350,
    sparksBonus: 120,
    isSecret: false,
  },
  {
    code: 'CROSS_POLLINATOR',
    title: 'Cross-Stream Pollinator',
    description: 'Earn XP in 2 different career streams on the same day.',
    tier: 'silver',
    iconName: 'Shuffle',
    xpBonus: 150,
    sparksBonus: 60,
    isSecret: false,
  },
  {
    code: 'TOPIC_MASTER',
    title: 'Node Mastered',
    description: 'Reach Mastered status on a roadmap topic node.',
    tier: 'gold',
    iconName: 'Award',
    xpBonus: 180,
    sparksBonus: 65,
    isSecret: false,
  },
  {
    code: 'SECRET_KONAMI',
    title: '30 Lives Career Cheat',
    description: 'Entered the legendary ↑↑↓↓←→←→BA sequence inside CareerForge.',
    tier: 'secret',
    iconName: 'Gamepad2',
    xpBonus: 150,
    sparksBonus: 100,
    isSecret: true,
  },
  {
    code: 'SECRET_ANVIL_SEVEN',
    title: "Hephaestus's Apprentice",
    description: 'Struck the CareerForge anvil 7 times in rapid succession to awaken the forge.',
    tier: 'secret',
    iconName: 'Hammer',
    xpBonus: 125,
    sparksBonus: 77,
    isSecret: true,
  },
  {
    code: 'SECRET_TERMINAL_HACKER',
    title: 'Root Career Access',
    description: 'Discovered the hidden Oracle Console command.',
    tier: 'secret',
    iconName: 'Terminal',
    xpBonus: 135,
    sparksBonus: 88,
    isSecret: true,
  },
  {
    code: 'SECRET_NIGHT_OWL_OR_LOOT',
    title: 'Alchemist of Sparks',
    description: 'Transmuted Forge Sparks at the Mystery Reliquary.',
    tier: 'secret',
    iconName: 'Gem',
    xpBonus: 140,
    sparksBonus: 60,
    isSecret: true,
  },
];

export class CareerForgeDB {
  public readonly db: DatabaseSync;
  public readonly dbPath: string;

  constructor(customPath?: string) {
    const resolvedPath =
      customPath ??
      process.env.CAREER_FORGE_DB_PATH ??
      path.resolve(process.cwd(), 'data', 'career-forge.sqlite');

    this.dbPath = resolvedPath;
    if (resolvedPath !== ':memory:') {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
    this.seedDefaults();
  }

  public close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        base_url TEXT NOT NULL,
        secret TEXT NOT NULL DEFAULT '',
        codex_auth_mode TEXT,
        codex_auth_path TEXT,
        models_json TEXT NOT NULL DEFAULT '[]',
        priority INTEGER NOT NULL DEFAULT 10,
        last_tested_at TEXT,
        last_test_status TEXT NOT NULL DEFAULT 'untested',
        last_test_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS jev_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 1,
        api_key TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL DEFAULT 'typesafe',
        base_url TEXT NOT NULL DEFAULT 'https://api.typesafe.ai/v1/systemone',
        model TEXT NOT NULL DEFAULT 'jev-latest',
        cost_policy TEXT NOT NULL DEFAULT 'balanced',
        last_tested_at TEXT,
        last_test_status TEXT NOT NULL DEFAULT 'untested',
        last_test_message TEXT
      );

      CREATE TABLE IF NOT EXISTS routing_decisions (
        id TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        decided_by TEXT NOT NULL,
        jev_model_version TEXT,
        selected_provider_id TEXT NOT NULL,
        selected_provider_name TEXT NOT NULL,
        selected_model TEXT NOT NULL,
        reasoning_effort TEXT NOT NULL,
        confidence REAL NOT NULL,
        complexity_score REAL NOT NULL,
        probabilities_json TEXT NOT NULL DEFAULT '{}',
        rationale TEXT NOT NULL,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resumes (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_format TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        profile_json TEXT,
        suggested_roadmaps_json TEXT NOT NULL DEFAULT '[]',
        analyzed_by_model TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_streams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tagline TEXT NOT NULL,
        category TEXT NOT NULL,
        target_role TEXT NOT NULL,
        description TEXT NOT NULL,
        color_theme TEXT NOT NULL DEFAULT 'indigo',
        icon_name TEXT NOT NULL DEFAULT 'Compass',
        status TEXT NOT NULL DEFAULT 'active',
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        mastery_percent REAL NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 0,
        last_activity_date TEXT,
        problems_solved INTEGER NOT NULL DEFAULT 0,
        resources_completed INTEGER NOT NULL DEFAULT 0,
        total_evaluations INTEGER NOT NULL DEFAULT 0,
        avg_score REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stream_phases (
        id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL REFERENCES career_streams(id) ON DELETE CASCADE,
        phase_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        objective TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stream_topics (
        id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL REFERENCES career_streams(id) ON DELETE CASCADE,
        phase_id TEXT NOT NULL REFERENCES stream_phases(id) ON DELETE CASCADE,
        topic_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        estimated_hours REAL NOT NULL DEFAULT 3,
        difficulty TEXT NOT NULL DEFAULT 'intermediate',
        key_skills_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'available',
        mastery_score REAL NOT NULL DEFAULT 0,
        is_boss_topic INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS learning_resources (
        id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL REFERENCES career_streams(id) ON DELETE CASCADE,
        topic_id TEXT NOT NULL REFERENCES stream_topics(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        provider_or_author TEXT NOT NULL,
        estimated_minutes INTEGER NOT NULL DEFAULT 20,
        difficulty TEXT NOT NULL DEFAULT 'intermediate',
        why_relevant TEXT NOT NULL,
        content_markdown TEXT NOT NULL DEFAULT '',
        flashcards_json TEXT NOT NULL DEFAULT '[]',
        is_completed INTEGER NOT NULL DEFAULT 0,
        is_bookmarked INTEGER NOT NULL DEFAULT 0,
        xp_reward INTEGER NOT NULL DEFAULT 35,
        generated_by_model TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS practice_problems (
        id TEXT PRIMARY KEY,
        stream_id TEXT NOT NULL REFERENCES career_streams(id) ON DELETE CASCADE,
        topic_id TEXT NOT NULL REFERENCES stream_topics(id) ON DELETE CASCADE,
        archetype TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        title TEXT NOT NULL,
        scenario_markdown TEXT NOT NULL,
        requirements_json TEXT NOT NULL DEFAULT '[]',
        constraints_json TEXT NOT NULL DEFAULT '[]',
        starter_template TEXT NOT NULL DEFAULT '',
        language_hint TEXT NOT NULL DEFAULT 'markdown',
        rubric_json TEXT NOT NULL DEFAULT '[]',
        hints_json TEXT NOT NULL DEFAULT '[]',
        hints_revealed INTEGER NOT NULL DEFAULT 0,
        xp_reward INTEGER NOT NULL DEFAULT 100,
        best_score REAL,
        status TEXT NOT NULL DEFAULT 'unattempted',
        draft_solution TEXT NOT NULL DEFAULT '',
        generated_by_model TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS solution_submissions (
        id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL REFERENCES practice_problems(id) ON DELETE CASCADE,
        stream_id TEXT NOT NULL REFERENCES career_streams(id) ON DELETE CASCADE,
        topic_id TEXT NOT NULL REFERENCES stream_topics(id) ON DELETE CASCADE,
        attempt_number INTEGER NOT NULL,
        solution_text TEXT NOT NULL,
        score REAL NOT NULL,
        verdict TEXT NOT NULL,
        summary_feedback TEXT NOT NULL,
        strengths_json TEXT NOT NULL DEFAULT '[]',
        improvements_json TEXT NOT NULL DEFAULT '[]',
        rubric_breakdown_json TEXT NOT NULL DEFAULT '[]',
        exemplar_approach_markdown TEXT NOT NULL DEFAULT '',
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        bonuses_applied_json TEXT NOT NULL DEFAULT '[]',
        evaluated_by_model TEXT NOT NULL,
        routing_decision_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        display_name TEXT NOT NULL DEFAULT 'Career Explorer',
        global_level INTEGER NOT NULL DEFAULT 1,
        global_xp INTEGER NOT NULL DEFAULT 0,
        forge_sparks INTEGER NOT NULL DEFAULT 50,
        daily_streak INTEGER NOT NULL DEFAULT 0,
        last_active_date TEXT,
        streams_worked_today_json TEXT NOT NULL DEFAULT '[]',
        streams_worked_date TEXT,
        easter_eggs_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        tier TEXT NOT NULL,
        icon_name TEXT NOT NULL,
        xp_bonus INTEGER NOT NULL,
        sparks_bonus INTEGER NOT NULL,
        is_secret INTEGER NOT NULL DEFAULT 0,
        unlocked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS active_buffs (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        multiplier REAL NOT NULL,
        remaining_uses INTEGER NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bonus_quests (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        quest_type TEXT NOT NULL,
        target_count INTEGER NOT NULL,
        current_count INTEGER NOT NULL DEFAULT 0,
        xp_reward INTEGER NOT NULL,
        sparks_reward INTEGER NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS xp_events (
        id TEXT PRIMARY KEY,
        stream_id TEXT,
        stream_title TEXT,
        source TEXT NOT NULL,
        xp_amount INTEGER NOT NULL,
        sparks_amount INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prepared_roadmaps_cache (
        roadmap_key TEXT PRIMARY KEY,
        roadmap_id TEXT,
        title TEXT NOT NULL,
        target_role TEXT NOT NULL,
        description TEXT NOT NULL,
        phases_json TEXT NOT NULL,
        context_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prepared_nodes_cache (
        canonical_key TEXT PRIMARY KEY,
        node_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prepared_resources_cache (
        canonical_key TEXT PRIMARY KEY,
        context_hash TEXT NOT NULL,
        focus_note TEXT NOT NULL DEFAULT '',
        model_used TEXT,
        resources_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        animations_enabled INTEGER NOT NULL DEFAULT 1,
        compact_stream_cards INTEGER NOT NULL DEFAULT 0,
        default_language_hint TEXT NOT NULL DEFAULT 'typescript',
        show_roadmap_flow_in_arena INTEGER NOT NULL DEFAULT 1
      );
    `);

    // Safe additive column migrations for existing databases
    this.ensureColumn('resumes', 'career_goals_note', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('resumes', 'context_hash', 'TEXT');
    this.ensureColumn('career_streams', 'nodes_context_hash', 'TEXT');
    this.ensureColumn('stream_topics', 'canonical_key', 'TEXT');
    this.ensureColumn('stream_topics', 'resources_context_hash', 'TEXT');
    this.ensureColumn('stream_topics', 'last_focus_note', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn(
      'player_profile',
      'headline_title',
      "TEXT NOT NULL DEFAULT 'Polymath Engineer in Training'"
    );
    this.ensureColumn('player_profile', 'avatar_color', "TEXT NOT NULL DEFAULT 'indigo'");
    this.ensureColumn('player_profile', 'avatar_icon', "TEXT NOT NULL DEFAULT 'Rocket'");
    this.ensureColumn('player_profile', 'has_completed_onboarding', 'INTEGER NOT NULL DEFAULT 0');
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const cols = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
    }
  }

  private seedDefaults(): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO jev_config (id, enabled, api_key, channel, base_url, model, cost_policy)
         VALUES (1, 1, '', 'typesafe', 'https://api.typesafe.ai/v1/systemone', 'jev-latest', 'balanced')`
      )
      .run();

    this.db
      .prepare(
        `INSERT OR IGNORE INTO player_profile (id, display_name, global_level, global_xp, forge_sparks, daily_streak)
         VALUES (1, 'Career Explorer', 1, 0, 50, 0)`
      )
      .run();

    this.db
      .prepare(
        `INSERT OR IGNORE INTO app_preferences (
           id, animations_enabled, compact_stream_cards, default_language_hint, show_roadmap_flow_in_arena
         ) VALUES (1, 1, 0, 'typescript', 1)`
      )
      .run();

    // Auto-recognize existing users who already configured a provider and created streams/resumes
    const existingProviderRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM ai_providers WHERE enabled = 1')
      .get() as { cnt: number };
    const existingActivityRow = this.db
      .prepare(
        'SELECT (SELECT COUNT(*) FROM career_streams) + (SELECT COUNT(*) FROM resumes) as cnt'
      )
      .get() as { cnt: number };
    if (existingProviderRow.cnt > 0 && existingActivityRow.cnt > 0) {
      this.db
        .prepare('UPDATE player_profile SET has_completed_onboarding = 1 WHERE id = 1')
        .run();
    }

    const insertAch = this.db.prepare(
      `INSERT OR IGNORE INTO achievements (id, code, title, description, tier, icon_name, xp_bonus, sparks_bonus, is_secret, unlocked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    );

    for (const ach of DEFAULT_ACHIEVEMENTS) {
      insertAch.run(
        crypto.randomUUID(),
        ach.code,
        ach.title,
        ach.description,
        ach.tier,
        ach.iconName,
        ach.xpBonus,
        ach.sparksBonus,
        ach.isSecret ? 1 : 0
      );
    }

    const questCountRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM bonus_quests')
      .get() as { cnt: number };

    if (questCountRow.cnt === 0) {
      const now = new Date().toISOString();
      const insertQuest = this.db.prepare(
        `INSERT INTO bonus_quests (id, title, description, quest_type, target_count, current_count, xp_reward, sparks_reward, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?)`
      );
      insertQuest.run(
        crypto.randomUUID(),
        'Knowledge Expedition',
        'Complete 3 learning resources across any active streams.',
        'mastery_sprint',
        3,
        120,
        40,
        now
      );
      insertQuest.run(
        crypto.randomUUID(),
        'Arena Gladiator',
        'Pass 2 practice problem evaluations with a score of 70+.',
        'mastery_sprint',
        2,
        175,
        60,
        now
      );
      insertQuest.run(
        crypto.randomUUID(),
        'Cross-Stream Synthesis',
        'Make progress in 2 distinct career streams on the same day.',
        'cross_stream',
        2,
        160,
        55,
        now
      );
    }
  }

  // ===================== AI PROVIDERS =====================

  public listProviders(): AIProviderRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM ai_providers ORDER BY priority ASC, created_at ASC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapProviderRow(r));
  }

  public getProviderWithSecret(id: string): (AIProviderRecord & { secret: string }) | null {
    const row = this.db
      .prepare('SELECT * FROM ai_providers WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...this.mapProviderRow(row),
      secret: String(row.secret ?? ''),
    };
  }

  public listEnabledProvidersWithSecrets(): Array<AIProviderRecord & { secret: string }> {
    const rows = this.db
      .prepare('SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY priority ASC, created_at ASC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      ...this.mapProviderRow(row),
      secret: String(row.secret ?? ''),
    }));
  }

  public saveProvider(input: SaveProviderInput): AIProviderRecord {
    const now = new Date().toISOString();
    const existing = input.id ? this.getProviderWithSecret(input.id) : null;
    const id = existing ? existing.id : input.id || crypto.randomUUID();
    const secretToStore =
      input.apiKeyOrSecret !== undefined && input.apiKeyOrSecret !== ''
        ? input.apiKeyOrSecret
        : existing
          ? existing.secret
          : '';
    const modelsToStore = input.models ?? existing?.models ?? [];

    if (existing) {
      const connectionConfigChanged =
        existing.baseUrl !== input.baseUrl ||
        existing.secret !== secretToStore ||
        existing.type !== input.type ||
        (existing.codexAuthMode ?? null) !== (input.codexAuthMode ?? null) ||
        (existing.codexAuthPath ?? null) !== (input.codexAuthPath ?? null);

      const nextTestStatus = connectionConfigChanged ? 'untested' : existing.lastTestStatus;
      const nextTestMessage = connectionConfigChanged ? null : existing.lastTestMessage;

      this.db
        .prepare(
          `UPDATE ai_providers
           SET name = ?, type = ?, enabled = ?, base_url = ?, secret = ?,
               codex_auth_mode = ?, codex_auth_path = ?, models_json = ?, priority = ?,
               last_test_status = ?, last_test_message = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          input.name,
          input.type,
          input.enabled ? 1 : 0,
          input.baseUrl,
          secretToStore,
          input.codexAuthMode ?? null,
          input.codexAuthPath ?? null,
          JSON.stringify(modelsToStore),
          input.priority ?? existing.priority,
          nextTestStatus,
          nextTestMessage,
          now,
          id
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO ai_providers (
             id, name, type, enabled, base_url, secret, codex_auth_mode, codex_auth_path,
             models_json, priority, last_tested_at, last_test_status, last_test_message, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'untested', NULL, ?, ?)`
        )
        .run(
          id,
          input.name,
          input.type,
          input.enabled ? 1 : 0,
          input.baseUrl,
          secretToStore,
          input.codexAuthMode ?? null,
          input.codexAuthPath ?? null,
          JSON.stringify(modelsToStore),
          input.priority ?? 10,
          now,
          now
        );
    }

    const saved = this.getProviderWithSecret(id)!;
    const { secret: _omit, ...publicRecord } = saved;
    return publicRecord;
  }

  public updateProviderTestResult(id: string, status: 'ok' | 'error', message: string): void {
    this.db
      .prepare(
        `UPDATE ai_providers SET last_tested_at = ?, last_test_status = ?, last_test_message = ? WHERE id = ?`
      )
      .run(new Date().toISOString(), status, message, id);
  }

  public deleteProvider(id: string): void {
    this.db.prepare('DELETE FROM ai_providers WHERE id = ?').run(id);
  }

  private mapProviderRow(r: Record<string, unknown>): AIProviderRecord {
    const secret = String(r.secret ?? '');
    const enabled = Number(r.enabled) === 1;
    const lastTestStatus = (r.last_test_status as 'untested' | 'ok' | 'error') ?? 'untested';
    let connectionStatus: ProviderConnectionStatus = 'unverified';
    if (!enabled) {
      connectionStatus = 'disabled';
    } else if (lastTestStatus === 'ok') {
      connectionStatus = 'connected';
    } else if (lastTestStatus === 'error') {
      connectionStatus = 'failed';
    }

    return {
      id: String(r.id),
      name: String(r.name),
      type: r.type as ProviderType,
      enabled,
      baseUrl: String(r.base_url),
      hasSecret: secret.trim().length > 0,
      maskedSecret: maskSecret(secret),
      codexAuthMode: (r.codex_auth_mode as CodexAuthMode | null) ?? undefined,
      codexAuthPath: r.codex_auth_path ? String(r.codex_auth_path) : undefined,
      models: JSON.parse(String(r.models_json || '[]')) as ProviderModelConfig[],
      priority: Number(r.priority ?? 10),
      connectionStatus,
      lastTestedAt: r.last_tested_at ? String(r.last_tested_at) : null,
      lastTestStatus,
      lastTestMessage: r.last_test_message ? String(r.last_test_message) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ===================== JEV CONFIG & ROUTING DECISIONS =====================

  public getJevConfigWithSecret(): JevConfig & { apiKey: string } {
    const row = this.db.prepare('SELECT * FROM jev_config WHERE id = 1').get() as Record<
      string,
      unknown
    >;
    const apiKey = String(row.api_key ?? '');
    const enabled = Number(row.enabled) === 1;
    const hasApiKey = apiKey.trim().length > 0;
    const lastTestStatus = (row.last_test_status as 'untested' | 'ok' | 'error') ?? 'untested';

    let status: JevConfigurationStatus = 'not_configured';
    if (hasApiKey) {
      if (!enabled) {
        status = 'disabled';
      } else if (lastTestStatus === 'ok') {
        status = 'configured_verified';
      } else {
        status = 'configured';
      }
    }

    return {
      enabled,
      apiKey,
      hasApiKey,
      maskedApiKey: maskSecret(apiKey),
      status,
      channel: row.channel as JevChannel,
      baseUrl: String(row.base_url),
      model: String(row.model),
      costPolicy: row.cost_policy as JevCostPolicy,
      lastTestedAt: row.last_tested_at ? String(row.last_tested_at) : null,
      lastTestStatus,
      lastTestMessage: row.last_test_message ? String(row.last_test_message) : null,
    };
  }

  public getJevConfig(): JevConfig {
    const { apiKey: _omit, ...cfg } = this.getJevConfigWithSecret();
    return cfg;
  }

  public saveJevConfig(input: SaveJevConfigInput): JevConfig {
    const current = this.getJevConfigWithSecret();
    let nextKey = current.apiKey;
    if (input.clearApiKey) {
      nextKey = '';
    } else if (input.apiKey !== undefined && input.apiKey.trim() !== '') {
      nextKey = input.apiKey.trim();
    }

    const keyOrEndpointChanged =
      nextKey !== current.apiKey ||
      input.baseUrl !== current.baseUrl ||
      input.channel !== current.channel;

    const nextTestStatus = !nextKey
      ? 'untested'
      : keyOrEndpointChanged
        ? 'untested'
        : current.lastTestStatus;
    const nextTestMsg = !nextKey || keyOrEndpointChanged ? null : current.lastTestMessage;

    this.db
      .prepare(
        `UPDATE jev_config
         SET enabled = ?, api_key = ?, channel = ?, base_url = ?, model = ?, cost_policy = ?,
             last_test_status = ?, last_test_message = ?
         WHERE id = 1`
      )
      .run(
        input.enabled ? 1 : 0,
        nextKey,
        input.channel,
        input.baseUrl,
        input.model,
        input.costPolicy,
        nextTestStatus,
        nextTestMsg
      );

    return this.getJevConfig();
  }

  public updateJevTestResult(status: 'ok' | 'error', message: string): void {
    this.db
      .prepare(
        `UPDATE jev_config SET last_tested_at = ?, last_test_status = ?, last_test_message = ? WHERE id = 1`
      )
      .run(new Date().toISOString(), status, message);
  }

  public recordRoutingDecision(decision: RoutingDecision): void {
    this.db
      .prepare(
        `INSERT INTO routing_decisions (
           id, purpose, decided_by, jev_model_version, selected_provider_id, selected_provider_name,
           selected_model, reasoning_effort, confidence, complexity_score, probabilities_json,
           rationale, latency_ms, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        decision.id,
        decision.purpose,
        decision.decidedBy,
        decision.jevModelVersion,
        decision.selectedProviderId,
        decision.selectedProviderName,
        decision.selectedModel,
        decision.reasoningEffort,
        decision.confidence,
        decision.complexityScore,
        JSON.stringify(decision.probabilities),
        decision.rationale,
        decision.latencyMs,
        decision.createdAt
      );
  }

  public listRoutingDecisions(limit = 30): RoutingDecision[] {
    const rows = this.db
      .prepare('SELECT * FROM routing_decisions ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRoutingDecisionRow(r));
  }

  public getRoutingDecision(id: string): RoutingDecision | null {
    const row = this.db
      .prepare('SELECT * FROM routing_decisions WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRoutingDecisionRow(row) : null;
  }

  public countRoutingDecisions(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM routing_decisions').get() as {
      cnt: number;
    };
    return row.cnt;
  }

  private mapRoutingDecisionRow(r: Record<string, unknown>): RoutingDecision {
    return {
      id: String(r.id),
      purpose: r.purpose as TaskPurpose,
      decidedBy: r.decided_by as 'typesafe_jev' | 'autonomous_fallback',
      jevModelVersion: r.jev_model_version ? String(r.jev_model_version) : null,
      selectedProviderId: String(r.selected_provider_id),
      selectedProviderName: String(r.selected_provider_name),
      selectedModel: String(r.selected_model),
      reasoningEffort: r.reasoning_effort as ReasoningEffort,
      confidence: Number(r.confidence),
      complexityScore: Number(r.complexity_score),
      probabilities: JSON.parse(String(r.probabilities_json || '{}')) as Record<string, number>,
      rationale: String(r.rationale),
      latencyMs: Number(r.latency_ms),
      createdAt: String(r.created_at),
    };
  }

  // ===================== RESUMES & SUGGESTED ROADMAPS =====================

  public saveResume(params: {
    id?: string;
    filename: string;
    fileFormat: string;
    rawText: string;
    careerGoalsNote?: string;
    contextHash?: string | null;
    profile: CareerProfile | null;
    suggestedRoadmaps: SuggestedRoadmap[];
    analyzedByModel: string | null;
  }): ResumeRecord {
    const now = new Date().toISOString();
    const id = params.id ?? crypto.randomUUID();
    const existing = this.getResume(id);
    const goalsNote = params.careerGoalsNote ?? existing?.careerGoalsNote ?? '';
    const ctxHash = params.contextHash !== undefined ? params.contextHash : (existing?.contextHash ?? null);

    if (existing) {
      this.db
        .prepare(
          `UPDATE resumes
           SET filename = ?, file_format = ?, raw_text = ?, career_goals_note = ?, context_hash = ?,
               profile_json = ?, suggested_roadmaps_json = ?, analyzed_by_model = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          params.filename,
          params.fileFormat,
          params.rawText,
          goalsNote,
          ctxHash,
          params.profile ? JSON.stringify(params.profile) : null,
          JSON.stringify(params.suggestedRoadmaps),
          params.analyzedByModel,
          now,
          id
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO resumes (
             id, filename, file_format, raw_text, career_goals_note, context_hash,
             profile_json, suggested_roadmaps_json, analyzed_by_model, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          params.filename,
          params.fileFormat,
          params.rawText,
          goalsNote,
          ctxHash,
          params.profile ? JSON.stringify(params.profile) : null,
          JSON.stringify(params.suggestedRoadmaps),
          params.analyzedByModel,
          now,
          now
        );
    }
    return this.getResume(id)!;
  }

  public getLatestResume(): ResumeRecord | null {
    const row = this.db
      .prepare('SELECT * FROM resumes ORDER BY updated_at DESC LIMIT 1')
      .get() as Record<string, unknown> | undefined;
    return row ? this.mapResumeRow(row) : null;
  }

  public getResume(id: string): ResumeRecord | null {
    const row = this.db.prepare('SELECT * FROM resumes WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapResumeRow(row) : null;
  }

  public listResumes(): ResumeRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM resumes ORDER BY updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapResumeRow(r));
  }

  private mapResumeRow(r: Record<string, unknown>): ResumeRecord {
    return {
      id: String(r.id),
      filename: String(r.filename),
      fileFormat: String(r.file_format),
      rawText: String(r.raw_text),
      careerGoalsNote: r.career_goals_note ? String(r.career_goals_note) : '',
      contextHash: r.context_hash ? String(r.context_hash) : null,
      profile: r.profile_json ? (JSON.parse(String(r.profile_json)) as CareerProfile) : null,
      suggestedRoadmaps: JSON.parse(
        String(r.suggested_roadmaps_json || '[]')
      ) as SuggestedRoadmap[],
      analyzedByModel: r.analyzed_by_model ? String(r.analyzed_by_model) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ===================== CAREER STREAMS, PHASES & TOPICS =====================

  public createStreamWithCurriculum(params: {
    title: string;
    tagline: string;
    category: string;
    targetRole: string;
    description: string;
    colorTheme: CareerStream['colorTheme'];
    iconName: string;
    nodesContextHash?: string | null;
    phases: Array<{
      title: string;
      objective: string;
      topics: Array<{
        canonicalKey?: string;
        title: string;
        summary: string;
        estimatedHours: number;
        difficulty: TopicDifficulty;
        keySkills: string[];
        isBossTopic?: boolean;
      }>;
    }>;
  }): CareerStream {
    const streamId = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO career_streams (
           id, title, tagline, category, target_role, description, color_theme, icon_name,
           nodes_context_hash, status, level, xp, mastery_percent, streak_days, last_activity_date,
           problems_solved, resources_completed, total_evaluations, avg_score, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, 0, 0, NULL, 0, 0, 0, 0, ?, ?)`
      )
      .run(
        streamId,
        params.title,
        params.tagline,
        params.category,
        params.targetRole,
        params.description,
        params.colorTheme,
        params.iconName,
        params.nodesContextHash ?? null,
        now,
        now
      );

    const insertPhase = this.db.prepare(
      `INSERT INTO stream_phases (id, stream_id, phase_order, title, objective) VALUES (?, ?, ?, ?, ?)`
    );
    const insertTopic = this.db.prepare(
      `INSERT INTO stream_topics (
         id, stream_id, phase_id, topic_order, canonical_key, title, summary, estimated_hours,
         difficulty, key_skills_json, status, mastery_score, is_boss_topic
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', 0, ?)`
    );

    params.phases.forEach((phase, pIdx) => {
      const phaseId = crypto.randomUUID();
      insertPhase.run(phaseId, streamId, pIdx + 1, phase.title, phase.objective);
      phase.topics.forEach((topic, tIdx) => {
        const isBoss =
          topic.isBossTopic ?? (pIdx === params.phases.length - 1 && tIdx === phase.topics.length - 1);
        const canonicalKey = topic.canonicalKey || canonicalizeKey(topic.title);
        insertTopic.run(
          crypto.randomUUID(),
          streamId,
          phaseId,
          tIdx + 1,
          canonicalKey,
          topic.title,
          topic.summary,
          topic.estimatedHours,
          topic.difficulty,
          JSON.stringify(topic.keySkills),
          isBoss ? 1 : 0
        );
      });
    });

    return this.getStream(streamId)!;
  }

  public getStreamNodesContextHash(streamId: string): string | null {
    const row = this.db
      .prepare('SELECT nodes_context_hash FROM career_streams WHERE id = ?')
      .get(streamId) as { nodes_context_hash?: string | null } | undefined;
    return row?.nodes_context_hash ?? null;
  }

  public updateStreamNodesInPlace(
    streamId: string,
    phases: PreparedPhaseBlueprint[],
    nodesContextHash: string
  ): CareerStream | null {
    const current = this.getStream(streamId);
    if (!current) return null;

    // Update phase metadata & unstarted topics in place while preserving topics that have progress
    const updatePhaseStmt = this.db.prepare(
      'UPDATE stream_phases SET title = ?, objective = ? WHERE id = ?'
    );
    const insertPhaseStmt = this.db.prepare(
      'INSERT INTO stream_phases (id, stream_id, phase_order, title, objective) VALUES (?, ?, ?, ?, ?)'
    );
    const updateTopicStmt = this.db.prepare(
      `UPDATE stream_topics
       SET canonical_key = ?, title = ?, summary = ?, estimated_hours = ?, difficulty = ?, key_skills_json = ?, is_boss_topic = ?
       WHERE id = ?`
    );
    const insertTopicStmt = this.db.prepare(
      `INSERT INTO stream_topics (
         id, stream_id, phase_id, topic_order, canonical_key, title, summary, estimated_hours,
         difficulty, key_skills_json, status, mastery_score, is_boss_topic
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', 0, ?)`
    );

    phases.forEach((nextPhase, pIdx) => {
      const existingPhase = current.phases[pIdx];
      let phaseId: string;
      if (existingPhase) {
        phaseId = existingPhase.id;
        updatePhaseStmt.run(nextPhase.title, nextPhase.objective, phaseId);
      } else {
        phaseId = crypto.randomUUID();
        insertPhaseStmt.run(phaseId, streamId, pIdx + 1, nextPhase.title, nextPhase.objective);
      }

      nextPhase.topics.forEach((nextTopic, tIdx) => {
        const existingTopic = existingPhase?.topics[tIdx];
        if (existingTopic) {
          // Preserve mastered / active topics' identity; only refresh descriptive metadata on available topics
          if (
            existingTopic.status === 'available' &&
            existingTopic.completedResourceCount === 0 &&
            existingTopic.solvedProblemCount === 0
          ) {
            updateTopicStmt.run(
              nextTopic.canonicalKey || canonicalizeKey(nextTopic.title),
              nextTopic.title,
              nextTopic.summary,
              nextTopic.estimatedHours,
              nextTopic.difficulty,
              JSON.stringify(nextTopic.keySkills),
              nextTopic.isBossTopic ? 1 : 0,
              existingTopic.id
            );
          }
        } else {
          insertTopicStmt.run(
            crypto.randomUUID(),
            streamId,
            phaseId,
            tIdx + 1,
            nextTopic.canonicalKey || canonicalizeKey(nextTopic.title),
            nextTopic.title,
            nextTopic.summary,
            nextTopic.estimatedHours,
            nextTopic.difficulty,
            JSON.stringify(nextTopic.keySkills),
            nextTopic.isBossTopic ? 1 : 0
          );
        }
      });
    });

    this.db
      .prepare('UPDATE career_streams SET nodes_context_hash = ?, updated_at = ? WHERE id = ?')
      .run(nodesContextHash, new Date().toISOString(), streamId);

    this.recomputeStreamAndTopicMetrics(streamId);
    return this.getStream(streamId);
  }

  public listStreams(): CareerStream[] {
    const rows = this.db
      .prepare('SELECT * FROM career_streams ORDER BY updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.hydrateStream(r));
  }

  public getStream(streamId: string): CareerStream | null {
    const row = this.db
      .prepare('SELECT * FROM career_streams WHERE id = ?')
      .get(streamId) as Record<string, unknown> | undefined;
    return row ? this.hydrateStream(row) : null;
  }

  public updateStreamStatus(streamId: string, status: StreamStatus): CareerStream | null {
    this.db
      .prepare('UPDATE career_streams SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), streamId);
    return this.getStream(streamId);
  }

  public deleteStream(streamId: string): void {
    this.db.prepare('DELETE FROM career_streams WHERE id = ?').run(streamId);
  }

  public getTopic(topicId: string): StreamTopic | null {
    const row = this.db
      .prepare(
        `SELECT t.*,
           (SELECT COUNT(*) FROM learning_resources r WHERE r.topic_id = t.id) AS resource_count,
           (SELECT COUNT(*) FROM learning_resources r WHERE r.topic_id = t.id AND r.is_completed = 1) AS completed_resource_count,
           (SELECT COUNT(*) FROM practice_problems p WHERE p.topic_id = t.id) AS problem_count,
           (SELECT COUNT(*) FROM practice_problems p WHERE p.topic_id = t.id AND p.status IN ('passed', 'mastered')) AS solved_problem_count
         FROM stream_topics t WHERE t.id = ?`
      )
      .get(topicId) as Record<string, unknown> | undefined;
    return row ? this.mapTopicRow(row) : null;
  }

  public recomputeStreamAndTopicMetrics(streamId: string, topicId?: string): {
    topicMasteredNow: boolean;
  } {
    let topicMasteredNow = false;

    if (topicId) {
      const currentTopic = this.getTopic(topicId);
      if (currentTopic) {
        const resScore =
          currentTopic.resourceCount > 0
            ? (currentTopic.completedResourceCount / currentTopic.resourceCount) * 35
            : 0;

        const probAvgRow = this.db
          .prepare(
            `SELECT AVG(COALESCE(best_score, 0)) as avg_best, COUNT(*) as cnt,
                    SUM(CASE WHEN status IN ('passed', 'mastered') THEN 1 ELSE 0 END) as solved
             FROM practice_problems WHERE topic_id = ?`
          )
          .get(topicId) as { avg_best: number | null; cnt: number; solved: number };

        let practiceComponent = 0;
        if (probAvgRow.cnt > 0 && (probAvgRow.solved ?? 0) > 0) {
          practiceComponent = Math.min(65, ((probAvgRow.avg_best ?? 0) / 100) * 65);
        }

        const rawMastery = Math.min(
          100,
          Math.round(
            probAvgRow.cnt > 0 && currentTopic.resourceCount > 0
              ? resScore + practiceComponent
              : probAvgRow.cnt > 0
                ? ((probAvgRow.avg_best ?? 0) / 100) * 100
                : currentTopic.resourceCount > 0
                  ? (currentTopic.completedResourceCount / currentTopic.resourceCount) * 60
                  : 0
          )
        );

        let nextStatus: TopicStatus = 'available';
        if (rawMastery >= 80 && (probAvgRow.solved ?? 0) >= 1) {
          nextStatus = 'mastered';
        } else if (rawMastery > 0 || currentTopic.completedResourceCount > 0) {
          nextStatus = 'in_progress';
        }

        if (currentTopic.status !== 'mastered' && nextStatus === 'mastered') {
          topicMasteredNow = true;
        }

        this.db
          .prepare('UPDATE stream_topics SET mastery_score = ?, status = ? WHERE id = ?')
          .run(rawMastery, nextStatus, topicId);
      }
    }

    const topicAgg = this.db
      .prepare('SELECT AVG(mastery_score) as avg_mastery FROM stream_topics WHERE stream_id = ?')
      .get(streamId) as { avg_mastery: number | null };

    const resCompleted = this.db
      .prepare(
        'SELECT COUNT(*) as cnt FROM learning_resources WHERE stream_id = ? AND is_completed = 1'
      )
      .get(streamId) as { cnt: number };

    const probsSolved = this.db
      .prepare(
        "SELECT COUNT(*) as cnt FROM practice_problems WHERE stream_id = ? AND status IN ('passed', 'mastered')"
      )
      .get(streamId) as { cnt: number };

    const evalStats = this.db
      .prepare(
        'SELECT COUNT(*) as cnt, AVG(score) as avg_score FROM solution_submissions WHERE stream_id = ?'
      )
      .get(streamId) as { cnt: number; avg_score: number | null };

    this.db
      .prepare(
        `UPDATE career_streams
         SET mastery_percent = ?, resources_completed = ?, problems_solved = ?,
             total_evaluations = ?, avg_score = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        Math.round((topicAgg.avg_mastery ?? 0) * 10) / 10,
        resCompleted.cnt,
        probsSolved.cnt,
        evalStats.cnt,
        Math.round((evalStats.avg_score ?? 0) * 10) / 10,
        new Date().toISOString(),
        streamId
      );

    return { topicMasteredNow };
  }

  private hydrateStream(r: Record<string, unknown>): CareerStream {
    const streamId = String(r.id);
    const phaseRows = this.db
      .prepare('SELECT * FROM stream_phases WHERE stream_id = ? ORDER BY phase_order ASC')
      .all(streamId) as Array<Record<string, unknown>>;

    const topicRows = this.db
      .prepare(
        `SELECT t.*,
           (SELECT COUNT(*) FROM learning_resources lr WHERE lr.topic_id = t.id) AS resource_count,
           (SELECT COUNT(*) FROM learning_resources lr WHERE lr.topic_id = t.id AND lr.is_completed = 1) AS completed_resource_count,
           (SELECT COUNT(*) FROM practice_problems pp WHERE pp.topic_id = t.id) AS problem_count,
           (SELECT COUNT(*) FROM practice_problems pp WHERE pp.topic_id = t.id AND pp.status IN ('passed', 'mastered')) AS solved_problem_count
         FROM stream_topics t
         WHERE t.stream_id = ?
         ORDER BY t.topic_order ASC`
      )
      .all(streamId) as Array<Record<string, unknown>>;

    const topicsByPhase = new Map<string, StreamTopic[]>();
    for (const tr of topicRows) {
      const topic = this.mapTopicRow(tr);
      const list = topicsByPhase.get(topic.phaseId) ?? [];
      list.push(topic);
      topicsByPhase.set(topic.phaseId, list);
    }

    const phases: StreamPhase[] = phaseRows.map((pr) => {
      const pid = String(pr.id);
      return {
        id: pid,
        streamId,
        phaseOrder: Number(pr.phase_order),
        title: String(pr.title),
        objective: String(pr.objective),
        topics: topicsByPhase.get(pid) ?? [],
      };
    });

    const roadmapEdges = this.computeRoadmapGraphEdges(phases);

    const level = Number(r.level ?? 1);
    return {
      id: streamId,
      title: String(r.title),
      tagline: String(r.tagline),
      category: String(r.category),
      targetRole: String(r.target_role),
      description: String(r.description),
      colorTheme: (r.color_theme as CareerStream['colorTheme']) ?? 'indigo',
      iconName: String(r.icon_name ?? 'Compass'),
      status: r.status as StreamStatus,
      level,
      xp: Number(r.xp ?? 0),
      xpToNextLevel: xpThresholdForLevel(level),
      masteryPercent: Number(r.mastery_percent ?? 0),
      streakDays: Number(r.streak_days ?? 0),
      lastActivityDate: r.last_activity_date ? String(r.last_activity_date) : null,
      problemsSolved: Number(r.problems_solved ?? 0),
      resourcesCompleted: Number(r.resources_completed ?? 0),
      totalEvaluations: Number(r.total_evaluations ?? 0),
      avgScore: Number(r.avg_score ?? 0),
      phases,
      roadmapEdges,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  private computeRoadmapGraphEdges(phases: StreamPhase[]): RoadmapGraphEdge[] {
    const edges: RoadmapGraphEdge[] = [];
    const seen = new Set<string>();

    const addEdge = (
      fromTopicId: string,
      toTopicId: string,
      kind: RoadmapGraphEdge['kind']
    ) => {
      if (!fromTopicId || !toTopicId || fromTopicId === toTopicId) return;
      const key = `${fromTopicId}->${toTopicId}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ id: key, fromTopicId, toTopicId, kind });
    };

    // 1. Intra-phase progression edges
    for (const phase of phases) {
      for (let i = 0; i < phase.topics.length - 1; i++) {
        const curr = phase.topics[i]!;
        const next = phase.topics[i + 1]!;
        addEdge(
          curr.id,
          next.id,
          next.isBossTopic ? 'boss_convergence' : 'intra_phase'
        );
      }
    }

    // 2. Cross-phase fluid flow edges connecting parallel tracks and phase handoffs
    for (let p = 0; p < phases.length - 1; p++) {
      const currPhase = phases[p]!;
      const nextPhase = phases[p + 1]!;
      if (currPhase.topics.length === 0 || nextPhase.topics.length === 0) continue;

      const pairCount = Math.min(currPhase.topics.length, nextPhase.topics.length);
      for (let i = 0; i < pairCount; i++) {
        const fromT = currPhase.topics[i]!;
        const toT = nextPhase.topics[i]!;
        addEdge(
          fromT.id,
          toT.id,
          toT.isBossTopic ? 'boss_convergence' : 'cross_phase'
        );
      }

      // Handoff from end of phase p into start of phase p+1
      const lastCurr = currPhase.topics[currPhase.topics.length - 1]!;
      const firstNext = nextPhase.topics[0]!;
      addEdge(lastCurr.id, firstNext.id, 'cross_phase');
    }

    // 3. Ensure final Boss Capstone receives convergence from preceding phase's final node
    const lastPhase = phases[phases.length - 1];
    const prevPhase = phases.length >= 2 ? phases[phases.length - 2] : undefined;
    const bossNode = lastPhase?.topics.find((t) => t.isBossTopic);
    if (bossNode && prevPhase && prevPhase.topics.length > 0) {
      const prevFinal = prevPhase.topics[prevPhase.topics.length - 1]!;
      addEdge(prevFinal.id, bossNode.id, 'boss_convergence');
    }

    return edges;
  }

  private mapTopicRow(tr: Record<string, unknown>): StreamTopic {
    return {
      id: String(tr.id),
      streamId: String(tr.stream_id),
      phaseId: String(tr.phase_id),
      topicOrder: Number(tr.topic_order),
      title: String(tr.title),
      summary: String(tr.summary),
      estimatedHours: Number(tr.estimated_hours),
      difficulty: tr.difficulty as TopicDifficulty,
      keySkills: JSON.parse(String(tr.key_skills_json || '[]')) as string[],
      status: tr.status as TopicStatus,
      masteryScore: Number(tr.mastery_score ?? 0),
      isBossTopic: Number(tr.is_boss_topic) === 1,
      resourceCount: Number(tr.resource_count ?? 0),
      completedResourceCount: Number(tr.completed_resource_count ?? 0),
      problemCount: Number(tr.problem_count ?? 0),
      solvedProblemCount: Number(tr.solved_problem_count ?? 0),
    };
  }

  // ===================== LEARNING RESOURCES =====================

  public insertResource(params: Omit<LearningResource, 'id' | 'createdAt' | 'isCompleted' | 'isBookmarked'>): LearningResource {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO learning_resources (
           id, stream_id, topic_id, kind, title, url, provider_or_author, estimated_minutes,
           difficulty, why_relevant, content_markdown, flashcards_json,
           is_completed, is_bookmarked, xp_reward, generated_by_model, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
      )
      .run(
        id,
        params.streamId,
        params.topicId,
        params.kind,
        params.title,
        params.url,
        params.providerOrAuthor,
        params.estimatedMinutes,
        params.difficulty,
        params.whyRelevant,
        params.contentMarkdown,
        JSON.stringify(params.flashcards ?? []),
        params.xpReward,
        params.generatedByModel,
        now
      );

    return this.getResource(id)!;
  }

  public getResource(id: string): LearningResource | null {
    const row = this.db
      .prepare('SELECT * FROM learning_resources WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapResourceRow(row) : null;
  }

  public listResourcesForTopic(topicId: string): LearningResource[] {
    const rows = this.db
      .prepare('SELECT * FROM learning_resources WHERE topic_id = ? ORDER BY created_at ASC')
      .all(topicId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapResourceRow(r));
  }

  public updateResourceState(
    id: string,
    patch: { isCompleted?: boolean; isBookmarked?: boolean }
  ): LearningResource | null {
    const current = this.getResource(id);
    if (!current) return null;
    const nextCompleted = patch.isCompleted ?? current.isCompleted;
    const nextBookmarked = patch.isBookmarked ?? current.isBookmarked;
    this.db
      .prepare('UPDATE learning_resources SET is_completed = ?, is_bookmarked = ? WHERE id = ?')
      .run(nextCompleted ? 1 : 0, nextBookmarked ? 1 : 0, id);
    return this.getResource(id);
  }

  public getTopicCacheMeta(topicId: string): {
    canonicalKey: string;
    resourcesContextHash: string | null;
    lastFocusNote: string;
  } | null {
    const row = this.db
      .prepare(
        'SELECT title, canonical_key, resources_context_hash, last_focus_note FROM stream_topics WHERE id = ?'
      )
      .get(topicId) as
      | {
          title: string;
          canonical_key: string | null;
          resources_context_hash: string | null;
          last_focus_note: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      canonicalKey: row.canonical_key || canonicalizeKey(row.title),
      resourcesContextHash: row.resources_context_hash ?? null,
      lastFocusNote: row.last_focus_note ?? '',
    };
  }

  public replaceGeneratedResourcesForTopic(params: {
    streamId: string;
    topicId: string;
    templates: CachedResourceTemplate[];
    modelUsed: string | null;
    contextHash: string;
    focusNote: string;
  }): LearningResource[] {
    const existing = this.listResourcesForTopic(params.topicId);
    // Preserve completion/bookmark state by matching kind + normalized title (or URL)
    const stateByKey = new Map<string, { isCompleted: boolean; isBookmarked: boolean }>();
    for (const r of existing) {
      if (r.generatedByModel !== null) {
        stateByKey.set(`${r.kind}::${canonicalizeKey(r.title)}`, {
          isCompleted: r.isCompleted,
          isBookmarked: r.isBookmarked,
        });
        if (r.url) {
          stateByKey.set(`url::${r.url}`, {
            isCompleted: r.isCompleted,
            isBookmarked: r.isBookmarked,
          });
        }
      }
    }

    // Remove previous AI-generated resources for this topic (keep user's custom resources where generated_by_model IS NULL)
    this.db
      .prepare('DELETE FROM learning_resources WHERE topic_id = ? AND generated_by_model IS NOT NULL')
      .run(params.topicId);

    const now = new Date().toISOString();
    const insertStmt = this.db.prepare(
      `INSERT INTO learning_resources (
         id, stream_id, topic_id, kind, title, url, provider_or_author, estimated_minutes,
         difficulty, why_relevant, content_markdown, flashcards_json,
         is_completed, is_bookmarked, xp_reward, generated_by_model, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const modelLabel = params.modelUsed ?? 'Memory Cache';
    for (const tpl of params.templates) {
      const prevState =
        stateByKey.get(`${tpl.kind}::${canonicalizeKey(tpl.title)}`) ??
        (tpl.url ? stateByKey.get(`url::${tpl.url}`) : undefined);
      insertStmt.run(
        crypto.randomUUID(),
        params.streamId,
        params.topicId,
        tpl.kind,
        tpl.title,
        tpl.url,
        tpl.providerOrAuthor,
        tpl.estimatedMinutes,
        tpl.difficulty,
        tpl.whyRelevant,
        tpl.contentMarkdown,
        JSON.stringify(tpl.flashcards ?? []),
        prevState?.isCompleted ? 1 : 0,
        prevState?.isBookmarked ? 1 : 0,
        tpl.xpReward,
        modelLabel,
        now
      );
    }

    this.db
      .prepare(
        'UPDATE stream_topics SET resources_context_hash = ?, last_focus_note = ? WHERE id = ?'
      )
      .run(params.contextHash, params.focusNote, params.topicId);

    this.recomputeStreamAndTopicMetrics(params.streamId, params.topicId);
    return this.listResourcesForTopic(params.topicId);
  }

  public countTotalCompletedResources(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM learning_resources WHERE is_completed = 1')
      .get() as { cnt: number };
    return row.cnt;
  }

  private mapResourceRow(r: Record<string, unknown>): LearningResource {
    return {
      id: String(r.id),
      streamId: String(r.stream_id),
      topicId: String(r.topic_id),
      kind: r.kind as ResourceKind,
      title: String(r.title),
      url: r.url ? String(r.url) : null,
      providerOrAuthor: String(r.provider_or_author),
      estimatedMinutes: Number(r.estimated_minutes),
      difficulty: String(r.difficulty),
      whyRelevant: String(r.why_relevant),
      contentMarkdown: String(r.content_markdown ?? ''),
      flashcards: JSON.parse(String(r.flashcards_json || '[]')) as FlashcardItem[],
      isCompleted: Number(r.is_completed) === 1,
      isBookmarked: Number(r.is_bookmarked) === 1,
      xpReward: Number(r.xp_reward ?? 35),
      generatedByModel: r.generated_by_model ? String(r.generated_by_model) : null,
      createdAt: String(r.created_at),
    };
  }

  // ===================== PRACTICE PROBLEMS & SUBMISSIONS =====================

  public insertPracticeProblem(
    params: Omit<
      PracticeProblem,
      'id' | 'hintsRevealed' | 'bestScore' | 'status' | 'draftSolution' | 'createdAt'
    >
  ): PracticeProblem {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO practice_problems (
           id, stream_id, topic_id, archetype, difficulty, title, scenario_markdown,
           requirements_json, constraints_json, starter_template, language_hint,
           rubric_json, hints_json, hints_revealed, xp_reward, best_score, status,
           draft_solution, generated_by_model, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, 'unattempted', ?, ?, ?)`
      )
      .run(
        id,
        params.streamId,
        params.topicId,
        params.archetype,
        params.difficulty,
        params.title,
        params.scenarioMarkdown,
        JSON.stringify(params.requirements),
        JSON.stringify(params.constraints),
        params.starterTemplate,
        params.languageHint,
        JSON.stringify(params.rubric),
        JSON.stringify(params.hints),
        params.xpReward,
        params.starterTemplate,
        params.generatedByModel,
        now
      );
    return this.getPracticeProblem(id)!;
  }

  public getPracticeProblem(id: string): PracticeProblem | null {
    const row = this.db
      .prepare('SELECT * FROM practice_problems WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapProblemRow(row) : null;
  }

  public listProblemsForTopic(topicId: string): PracticeProblem[] {
    const rows = this.db
      .prepare('SELECT * FROM practice_problems WHERE topic_id = ? ORDER BY created_at ASC')
      .all(topicId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapProblemRow(r));
  }

  public saveProblemDraft(problemId: string, draftSolution: string): void {
    this.db
      .prepare('UPDATE practice_problems SET draft_solution = ? WHERE id = ?')
      .run(draftSolution, problemId);
  }

  public revealNextHint(problemId: string): PracticeProblem | null {
    const prob = this.getPracticeProblem(problemId);
    if (!prob) return null;
    const nextCount = Math.min(prob.hints.length, prob.hintsRevealed + 1);
    this.db
      .prepare('UPDATE practice_problems SET hints_revealed = ? WHERE id = ?')
      .run(nextCount, problemId);
    return this.getPracticeProblem(problemId);
  }

  public recordSubmission(params: {
    problemId: string;
    streamId: string;
    topicId: string;
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
    routingDecisionId: string | null;
  }): { submission: SolutionSubmission; previousBestScore: number | null; attemptNumber: number } {
    const prob = this.getPracticeProblem(params.problemId)!;
    const previousBestScore = prob.bestScore;
    const prevAttemptsRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM solution_submissions WHERE problem_id = ?')
      .get(params.problemId) as { cnt: number };
    const attemptNumber = prevAttemptsRow.cnt + 1;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO solution_submissions (
           id, problem_id, stream_id, topic_id, attempt_number, solution_text, score, verdict,
           summary_feedback, strengths_json, improvements_json, rubric_breakdown_json,
           exemplar_approach_markdown, xp_awarded, bonuses_applied_json, evaluated_by_model,
           routing_decision_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        params.problemId,
        params.streamId,
        params.topicId,
        attemptNumber,
        params.solutionText,
        params.score,
        params.verdict,
        params.summaryFeedback,
        JSON.stringify(params.strengths),
        JSON.stringify(params.improvements),
        JSON.stringify(params.rubricBreakdown),
        params.exemplarApproachMarkdown,
        params.xpAwarded,
        JSON.stringify(params.bonusesApplied),
        params.evaluatedByModel,
        params.routingDecisionId,
        now
      );

    const newBest =
      previousBestScore === null ? params.score : Math.max(previousBestScore, params.score);
    let nextStatus: PracticeProblem['status'] = 'attempted';
    if (newBest >= 88) nextStatus = 'mastered';
    else if (newBest >= 70) nextStatus = 'passed';

    this.db
      .prepare(
        'UPDATE practice_problems SET best_score = ?, status = ?, draft_solution = ? WHERE id = ?'
      )
      .run(newBest, nextStatus, params.solutionText, params.problemId);

    return {
      submission: this.getSubmission(id)!,
      previousBestScore,
      attemptNumber,
    };
  }

  public getSubmission(id: string): SolutionSubmission | null {
    const row = this.db
      .prepare('SELECT * FROM solution_submissions WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapSubmissionRow(row) : null;
  }

  public listSubmissionsForTopic(topicId: string, limit = 20): SolutionSubmission[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM solution_submissions WHERE topic_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(topicId, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapSubmissionRow(r));
  }

  public listSubmissionsForProblem(problemId: string): SolutionSubmission[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM solution_submissions WHERE problem_id = ? ORDER BY attempt_number DESC'
      )
      .all(problemId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapSubmissionRow(r));
  }

  private mapProblemRow(r: Record<string, unknown>): PracticeProblem {
    return {
      id: String(r.id),
      streamId: String(r.stream_id),
      topicId: String(r.topic_id),
      archetype: r.archetype as ProblemArchetype,
      difficulty: r.difficulty as ProblemDifficulty,
      title: String(r.title),
      scenarioMarkdown: String(r.scenario_markdown),
      requirements: JSON.parse(String(r.requirements_json || '[]')) as string[],
      constraints: JSON.parse(String(r.constraints_json || '[]')) as string[],
      starterTemplate: String(r.starter_template ?? ''),
      languageHint: String(r.language_hint ?? 'markdown'),
      rubric: JSON.parse(String(r.rubric_json || '[]')) as RubricCriterion[],
      hints: JSON.parse(String(r.hints_json || '[]')) as string[],
      hintsRevealed: Number(r.hints_revealed ?? 0),
      xpReward: Number(r.xp_reward ?? 100),
      bestScore: r.best_score !== null && r.best_score !== undefined ? Number(r.best_score) : null,
      status: r.status as PracticeProblem['status'],
      draftSolution: String(r.draft_solution ?? ''),
      generatedByModel: r.generated_by_model ? String(r.generated_by_model) : null,
      createdAt: String(r.created_at),
    };
  }

  private mapSubmissionRow(r: Record<string, unknown>): SolutionSubmission {
    const routingId = r.routing_decision_id ? String(r.routing_decision_id) : null;
    return {
      id: String(r.id),
      problemId: String(r.problem_id),
      streamId: String(r.stream_id),
      topicId: String(r.topic_id),
      attemptNumber: Number(r.attempt_number),
      solutionText: String(r.solution_text),
      score: Number(r.score),
      verdict: r.verdict as 'needs_revision' | 'passed' | 'mastered',
      summaryFeedback: String(r.summary_feedback),
      strengths: JSON.parse(String(r.strengths_json || '[]')) as string[],
      improvements: JSON.parse(String(r.improvements_json || '[]')) as string[],
      rubricBreakdown: JSON.parse(String(r.rubric_breakdown_json || '[]')) as RubricScoreItem[],
      exemplarApproachMarkdown: String(r.exemplar_approach_markdown ?? ''),
      xpAwarded: Number(r.xp_awarded ?? 0),
      bonusesApplied: JSON.parse(String(r.bonuses_applied_json || '[]')) as BonusAppliedItem[],
      evaluatedByModel: String(r.evaluated_by_model),
      routingDecision: routingId ? this.getRoutingDecision(routingId) : null,
      createdAt: String(r.created_at),
    };
  }

  // ===================== GAMIFICATION PROFILE, BUFFS, ACHIEVEMENTS, QUESTS =====================

  public getPlayerProfile(): PlayerProfile {
    const row = this.db.prepare('SELECT * FROM player_profile WHERE id = 1').get() as Record<
      string,
      unknown
    >;
    const today = new Date().toISOString().slice(0, 10);
    const streamsWorkedDate = row.streams_worked_date ? String(row.streams_worked_date) : null;
    const streamsWorkedToday =
      streamsWorkedDate === today
        ? (JSON.parse(String(row.streams_worked_today_json || '[]')) as string[])
        : [];

    const globalLevel = Number(row.global_level ?? 1);
    const achRows = this.db
      .prepare('SELECT * FROM achievements ORDER BY unlocked_at DESC NULLS LAST, is_secret ASC')
      .all() as Array<Record<string, unknown>>;

    const buffRows = this.db
      .prepare('SELECT * FROM active_buffs WHERE remaining_uses > 0 ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;

    const questRows = this.db
      .prepare('SELECT * FROM bonus_quests ORDER BY completed_at ASC NULLS FIRST, created_at DESC')
      .all() as Array<Record<string, unknown>>;

    const eventRows = this.db
      .prepare('SELECT * FROM xp_events ORDER BY created_at DESC LIMIT 20')
      .all() as Array<Record<string, unknown>>;

    return {
      displayName: String(row.display_name ?? 'Career Explorer'),
      headlineTitle: String(row.headline_title ?? 'Polymath Engineer in Training'),
      avatarColor: ((row.avatar_color as AvatarColor) ?? 'indigo'),
      avatarIcon: ((row.avatar_icon as AvatarIcon) ?? 'Rocket'),
      hasCompletedOnboarding: Number(row.has_completed_onboarding ?? 0) === 1,
      rankTitle: rankTitleForLevel(globalLevel),
      globalLevel,
      globalXp: Number(row.global_xp ?? 0),
      xpToNextLevel: xpThresholdForLevel(globalLevel),
      forgeSparks: Number(row.forge_sparks ?? 0),
      dailyStreak: Number(row.daily_streak ?? 0),
      lastActiveDate: row.last_active_date ? String(row.last_active_date) : null,
      polymathMultiplierActive: streamsWorkedToday.length >= 2,
      streamsWorkedToday,
      easterEggsFound: JSON.parse(String(row.easter_eggs_json || '[]')) as string[],
      activeBuffs: buffRows.map((b) => ({
        id: String(b.id),
        label: String(b.label),
        description: String(b.description),
        multiplier: Number(b.multiplier),
        remainingUses: Number(b.remaining_uses),
        source: String(b.source),
        createdAt: String(b.created_at),
      })),
      achievements: achRows.map((a) => ({
        id: String(a.id),
        code: String(a.code),
        title: String(a.title),
        description: String(a.description),
        tier: a.tier as Achievement['tier'],
        iconName: String(a.icon_name),
        xpBonus: Number(a.xp_bonus),
        sparksBonus: Number(a.sparks_bonus),
        isSecret: Number(a.is_secret) === 1,
        unlockedAt: a.unlocked_at ? String(a.unlocked_at) : null,
      })),
      bonusQuests: questRows.map((q) => ({
        id: String(q.id),
        title: String(q.title),
        description: String(q.description),
        questType: q.quest_type as BonusQuest['questType'],
        targetCount: Number(q.target_count),
        currentCount: Number(q.current_count),
        xpReward: Number(q.xp_reward),
        sparksReward: Number(q.sparks_reward),
        completedAt: q.completed_at ? String(q.completed_at) : null,
        createdAt: String(q.created_at),
      })),
      recentEvents: eventRows.map((e) => ({
        id: String(e.id),
        streamId: e.stream_id ? String(e.stream_id) : null,
        streamTitle: e.stream_title ? String(e.stream_title) : null,
        source: String(e.source),
        xpAmount: Number(e.xp_amount),
        sparksAmount: Number(e.sparks_amount),
        description: String(e.description),
        createdAt: String(e.created_at),
      })),
    };
  }

  public addActiveBuff(params: Omit<ActiveBuff, 'id' | 'createdAt'>): ActiveBuff {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO active_buffs (id, label, description, multiplier, remaining_uses, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        params.label,
        params.description,
        params.multiplier,
        params.remainingUses,
        params.source,
        createdAt
      );
    return { id, createdAt, ...params };
  }

  public consumeOneBuffUse(): ActiveBuff | null {
    const row = this.db
      .prepare(
        'SELECT * FROM active_buffs WHERE remaining_uses > 0 ORDER BY multiplier DESC, created_at ASC LIMIT 1'
      )
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    const id = String(row.id);
    const nextUses = Number(row.remaining_uses) - 1;
    this.db.prepare('UPDATE active_buffs SET remaining_uses = ? WHERE id = ?').run(nextUses, id);
    return {
      id,
      label: String(row.label),
      description: String(row.description),
      multiplier: Number(row.multiplier),
      remainingUses: nextUses,
      source: String(row.source),
      createdAt: String(row.created_at),
    };
  }

  public unlockAchievementByCode(code: string): Achievement | null {
    const row = this.db
      .prepare('SELECT * FROM achievements WHERE code = ?')
      .get(code) as Record<string, unknown> | undefined;
    if (!row || row.unlocked_at) return null;

    const now = new Date().toISOString();
    this.db.prepare('UPDATE achievements SET unlocked_at = ? WHERE code = ?').run(now, code);

    return {
      id: String(row.id),
      code: String(row.code),
      title: String(row.title),
      description: String(row.description),
      tier: row.tier as Achievement['tier'],
      iconName: String(row.icon_name),
      xpBonus: Number(row.xp_bonus),
      sparksBonus: Number(row.sparks_bonus),
      isSecret: Number(row.is_secret) === 1,
      unlockedAt: now,
    };
  }

  // ===================== PREPARED MEMORY CACHE PERSISTENCE =====================

  public upsertPreparedRoadmapCacheRow(blueprint: CachedRoadmapBlueprint): void {
    this.db
      .prepare(
        `INSERT INTO prepared_roadmaps_cache (
           roadmap_key, roadmap_id, title, target_role, description, phases_json, context_hash, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(roadmap_key) DO UPDATE SET
           roadmap_id = excluded.roadmap_id,
           title = excluded.title,
           target_role = excluded.target_role,
           description = excluded.description,
           phases_json = excluded.phases_json,
           context_hash = excluded.context_hash,
           updated_at = excluded.updated_at`
      )
      .run(
        blueprint.roadmapKey,
        blueprint.roadmapId ?? null,
        blueprint.title,
        blueprint.targetRole,
        blueprint.description,
        JSON.stringify(blueprint.phases),
        blueprint.contextHash,
        blueprint.updatedAt
      );
  }

  public listPreparedRoadmapCacheRows(): CachedRoadmapBlueprint[] {
    const rows = this.db
      .prepare('SELECT * FROM prepared_roadmaps_cache ORDER BY updated_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      roadmapKey: String(r.roadmap_key),
      roadmapId: r.roadmap_id ? String(r.roadmap_id) : undefined,
      title: String(r.title),
      targetRole: String(r.target_role),
      description: String(r.description),
      phases: JSON.parse(String(r.phases_json || '[]')) as PreparedPhaseBlueprint[],
      contextHash: String(r.context_hash),
      updatedAt: String(r.updated_at),
    }));
  }

  public upsertPreparedNodeCacheRow(node: PreparedTopicNode): void {
    this.db
      .prepare(
        `INSERT INTO prepared_nodes_cache (canonical_key, node_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(canonical_key) DO UPDATE SET
           node_json = excluded.node_json,
           updated_at = excluded.updated_at`
      )
      .run(node.canonicalKey, JSON.stringify(node), new Date().toISOString());
  }

  public listPreparedNodeCacheRows(): PreparedTopicNode[] {
    const rows = this.db
      .prepare('SELECT node_json FROM prepared_nodes_cache')
      .all() as Array<{ node_json: string }>;
    return rows.map((r) => JSON.parse(r.node_json) as PreparedTopicNode);
  }

  public upsertPreparedResourceCacheRow(pack: CachedResourcePack): void {
    this.db
      .prepare(
        `INSERT INTO prepared_resources_cache (
           canonical_key, context_hash, focus_note, model_used, resources_json, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(canonical_key) DO UPDATE SET
           context_hash = excluded.context_hash,
           focus_note = excluded.focus_note,
           model_used = excluded.model_used,
           resources_json = excluded.resources_json,
           updated_at = excluded.updated_at`
      )
      .run(
        pack.canonicalKey,
        pack.contextHash,
        pack.focusNote,
        pack.modelUsed,
        JSON.stringify(pack.resources),
        pack.updatedAt
      );
  }

  public listPreparedResourceCacheRows(): CachedResourcePack[] {
    const rows = this.db
      .prepare('SELECT * FROM prepared_resources_cache')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      canonicalKey: String(r.canonical_key),
      contextHash: String(r.context_hash),
      focusNote: String(r.focus_note ?? ''),
      modelUsed: r.model_used ? String(r.model_used) : null,
      resources: JSON.parse(String(r.resources_json || '[]')) as CachedResourceTemplate[],
      updatedAt: String(r.updated_at),
    }));
  }

  // ===================== ONBOARDING, PROFILE, PREFERENCES & DANGER ZONE =====================

  public getDbFileSizeBytes(): number {
    if (this.dbPath === ':memory:') return 0;
    try {
      return fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0;
    } catch {
      return 0;
    }
  }

  public updatePlayerProfile(input: UpdateProfileInput): PlayerProfile {
    const current = this.getPlayerProfile();
    const nextName = input.displayName?.trim()
      ? input.displayName.trim().slice(0, 50)
      : current.displayName;
    const nextHeadline =
      input.headlineTitle !== undefined
        ? input.headlineTitle.trim().slice(0, 100) || 'Polymath Engineer in Training'
        : current.headlineTitle;
    const nextColor = input.avatarColor ?? current.avatarColor;
    const nextIcon = input.avatarIcon ?? current.avatarIcon;

    this.db
      .prepare(
        `UPDATE player_profile
         SET display_name = ?, headline_title = ?, avatar_color = ?, avatar_icon = ?
         WHERE id = 1`
      )
      .run(nextName, nextHeadline, nextColor, nextIcon);

    return this.getPlayerProfile();
  }

  public completeOnboarding(input?: CompleteOnboardingInput): PlayerProfile {
    if (input) {
      this.updatePlayerProfile(input);
    }
    this.db
      .prepare('UPDATE player_profile SET has_completed_onboarding = 1 WHERE id = 1')
      .run();
    return this.getPlayerProfile();
  }

  public getPreferences(): AppPreferences {
    const row = this.db.prepare('SELECT * FROM app_preferences WHERE id = 1').get() as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return {
        animationsEnabled: true,
        compactStreamCards: false,
        defaultLanguageHint: 'typescript',
        showRoadmapFlowInArena: true,
      };
    }
    return {
      animationsEnabled: Number(row.animations_enabled ?? 1) === 1,
      compactStreamCards: Number(row.compact_stream_cards ?? 0) === 1,
      defaultLanguageHint:
        (row.default_language_hint as AppPreferences['defaultLanguageHint']) ?? 'typescript',
      showRoadmapFlowInArena: Number(row.show_roadmap_flow_in_arena ?? 1) === 1,
    };
  }

  public savePreferences(patch: Partial<AppPreferences>): AppPreferences {
    const curr = this.getPreferences();
    const next: AppPreferences = {
      animationsEnabled: patch.animationsEnabled ?? curr.animationsEnabled,
      compactStreamCards: patch.compactStreamCards ?? curr.compactStreamCards,
      defaultLanguageHint: patch.defaultLanguageHint ?? curr.defaultLanguageHint,
      showRoadmapFlowInArena: patch.showRoadmapFlowInArena ?? curr.showRoadmapFlowInArena,
    };
    this.db
      .prepare(
        `UPDATE app_preferences
         SET animations_enabled = ?, compact_stream_cards = ?, default_language_hint = ?, show_roadmap_flow_in_arena = ?
         WHERE id = 1`
      )
      .run(
        next.animationsEnabled ? 1 : 0,
        next.compactStreamCards ? 1 : 0,
        next.defaultLanguageHint,
        next.showRoadmapFlowInArena ? 1 : 0
      );
    return this.getPreferences();
  }

  public clearPreparedCaches(): void {
    this.db.exec(`
      DELETE FROM prepared_roadmaps_cache;
      DELETE FROM prepared_nodes_cache;
      DELETE FROM prepared_resources_cache;
    `);
  }

  public executeDangerZoneAction(action: DangerZoneAction): void {
    if (action === 'reset_evaluations') {
      this.db.exec(`
        DELETE FROM solution_submissions;
        UPDATE practice_problems SET best_score = NULL, status = 'unattempted', hints_revealed = 0;
      `);
      const streams = this.listStreams();
      for (const s of streams) {
        for (const p of s.phases) {
          for (const t of p.topics) {
            this.recomputeStreamAndTopicMetrics(s.id, t.id);
          }
        }
        this.recomputeStreamAndTopicMetrics(s.id);
      }
      return;
    }

    if (action === 'reset_progress') {
      this.db.exec(`
        DELETE FROM solution_submissions;
        UPDATE practice_problems SET best_score = NULL, status = 'unattempted', hints_revealed = 0;
        UPDATE learning_resources SET is_completed = 0;
        UPDATE stream_topics SET status = 'available', mastery_score = 0;
        UPDATE career_streams
        SET level = 1, xp = 0, mastery_percent = 0, streak_days = 0, last_activity_date = NULL,
            problems_solved = 0, resources_completed = 0, total_evaluations = 0, avg_score = 0;
        UPDATE player_profile
        SET global_level = 1, global_xp = 0, forge_sparks = 50, daily_streak = 0,
            last_active_date = NULL, streams_worked_today_json = '[]', streams_worked_date = NULL,
            easter_eggs_json = '[]'
        WHERE id = 1;
        DELETE FROM active_buffs;
        DELETE FROM xp_events;
        UPDATE achievements SET unlocked_at = NULL;
        DELETE FROM bonus_quests WHERE quest_type = 'mystery_drop';
        UPDATE bonus_quests SET current_count = 0, completed_at = NULL;
      `);
      return;
    }

    if (action === 'delete_streams_and_resumes') {
      this.db.exec(`
        DELETE FROM career_streams;
        DELETE FROM resumes;
        DELETE FROM prepared_roadmaps_cache;
        DELETE FROM prepared_nodes_cache;
        DELETE FROM prepared_resources_cache;
      `);
      return;
    }

    if (action === 'factory_reset') {
      this.db.exec(`
        DELETE FROM ai_providers;
        DELETE FROM routing_decisions;
        DELETE FROM career_streams;
        DELETE FROM resumes;
        DELETE FROM prepared_roadmaps_cache;
        DELETE FROM prepared_nodes_cache;
        DELETE FROM prepared_resources_cache;
        DELETE FROM active_buffs;
        DELETE FROM xp_events;
        DELETE FROM achievements;
        DELETE FROM bonus_quests;
        DELETE FROM player_profile;
        DELETE FROM jev_config;
        DELETE FROM app_preferences;
      `);
      this.seedDefaults();
    }
  }
}
