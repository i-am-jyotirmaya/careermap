import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { NEO_SPRING, NeoSelect, PageTransition } from '@/components/ui/motion-primitives';
import { api } from '../lib/api.ts';
import { ProviderJevSetupView } from './ProviderJevSetupView.tsx';
import type {
  AIProviderRecord,
  AppPreferences,
  DangerZoneAction,
  GamificationDelta,
  JevConfig,
  ProviderModelConfig,
  ProviderType,
  RoutingDecision,
  SystemStatusResponse,
} from '../../shared/types.ts';

export type SettingsSectionId = 'ai_engine' | 'preferences' | 'danger_zone';

export interface SettingsViewProps {
  initialSection?: SettingsSectionId;
  status: SystemStatusResponse;
  providers: AIProviderRecord[];
  presets: Record<
    ProviderType,
    { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }
  >;
  jevConfig: JevConfig;
  routingDecisions: RoutingDecision[];
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  onDangerZoneExecuted: (action: DangerZoneAction) => Promise<void>;
}

interface DangerZoneOptionSpec {
  action: DangerZoneAction;
  title: string;
  requiredPhrase: string;
  summary: string;
  deletedItems: string[];
  preservedItems: string[];
  buttonLabel: string;
}

const DANGER_ZONE_OPTIONS: DangerZoneOptionSpec[] = [
  {
    action: 'reset_evaluations',
    title: 'Reset Practice Submissions & Evaluations',
    requiredPhrase: 'RESET EVALUATIONS',
    summary:
      'Clears submitted solutions, scores & hint reveals; preserves streams, roadmaps & study guides.',
    deletedItems: [
      'All practice challenge solution submissions, scores, and rubric evaluations',
      'Saved draft solutions and revealed progressive hints across practice problems',
    ],
    preservedItems: [
      'Active career streams, roadmap phases, and topic nodes',
      'Generated learning guides, flashcards, and bookmarked resources',
      'Uploaded resumes, AI provider credentials, and TypeSafe Jev configuration',
    ],
    buttonLabel: 'Reset Evaluations...',
  },
  {
    action: 'reset_progress',
    title: 'Reset Stream Mastery & Gamification Progress',
    requiredPhrase: 'RESET PROGRESS',
    summary:
      'Resets all XP, levels, streaks, achievements, quests & completion flags back to Level 1; preserves AI providers, uploaded resume & stream roadmaps.',
    deletedItems: [
      'Global Level, Global XP, Forge Sparks, Daily Streak, and Progression Ledger events',
      'Unlocked achievements, active multiplier buffs, bonus quest progress, and found secrets',
      'Stream XP/levels, topic mastery scores, resource completion flags, and challenge evaluations',
    ],
    preservedItems: [
      'Connected AI providers and TypeSafe Jev router configuration',
      'Uploaded resumes and career profile analysis',
      'Career stream roadmaps, topic structures, and generated learning content',
    ],
    buttonLabel: 'Reset Progress...',
  },
  {
    action: 'delete_streams_and_resumes',
    title: 'Delete All Career Streams & Resumes',
    requiredPhrase: 'DELETE ROADMAPS',
    summary:
      'Permanently deletes all streams, phases, topics, resources, challenges & resumes; preserves AI providers & Jev router config.',
    deletedItems: [
      'All career streams, roadmap phases, DAG edges, and topic workspaces',
      'All generated study guides, flashcards, practice problems, and evaluations',
      'All uploaded resumes, parsed career profiles, and prepared roadmap caches',
    ],
    preservedItems: [
      'Connected AI inference providers and saved API keys / Codex auth',
      'TypeSafe Jev model router settings and UI preferences',
    ],
    buttonLabel: 'Delete Streams & Resumes...',
  },
  {
    action: 'factory_reset',
    title: 'Factory Reset Entire Platform',
    requiredPhrase: 'FACTORY RESET',
    summary:
      'Wipes all providers, Jev keys, streams, resumes, caches & progress, returning the app to initial onboarding.',
    deletedItems: [
      'All AI provider configurations, API keys, and TypeSafe Jev credentials',
      'All career streams, resumes, resources, practice problems, and evaluations',
      'All player identity settings, XP, achievements, caches, and custom preferences',
    ],
    preservedItems: [
      'Empty initialized SQLite schema ready for fresh first-run onboarding',
    ],
    buttonLabel: 'Factory Reset Platform...',
  },
];

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialSection = 'ai_engine',
  status,
  providers,
  presets,
  jevConfig,
  routingDecisions,
  onRefreshAll,
  onGamificationDelta,
  onDangerZoneExecuted,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);

  // Preferences state
  const [prefs, setPrefs] = useState<AppPreferences>(status.preferences);
  const [savingPrefKey, setSavingPrefKey] = useState<keyof AppPreferences | null>(null);
  const [prefBanner, setPrefBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Memory Cache state
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheBanner, setCacheBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Danger Zone modal & execution state
  const [activeDangerSpec, setActiveDangerSpec] = useState<DangerZoneOptionSpec | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [executingDanger, setExecutingDanger] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [dangerBanner, setDangerBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setPrefs(status.preferences);
  }, [status.preferences]);

  useEffect(() => {
    if (!activeDangerSpec || executingDanger) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDangerSpec(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeDangerSpec, executingDanger]);

  const totalCachedItems =
    status.memoryCache.cachedRoadmaps +
    status.memoryCache.cachedTopicNodes +
    status.memoryCache.cachedResourcePacks;

  const handleUpdatePreference = async <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K]
  ) => {
    const previous = prefs;
    const optimistic: AppPreferences = { ...prefs, [key]: value };
    setPrefs(optimistic);
    setSavingPrefKey(key);
    setPrefBanner(null);

    try {
      const res = await api.savePreferences({ [key]: value });
      setPrefs(res.preferences);
      await onRefreshAll();
      setPrefBanner({
        kind: 'ok',
        text: 'Workspace preferences saved to local SQLite.',
      });
    } catch (err) {
      setPrefs(previous);
      setPrefBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to save preference.',
      });
    } finally {
      setSavingPrefKey(null);
    }
  };

  const handleClearMemoryCache = async () => {
    setClearingCache(true);
    setCacheBanner(null);
    try {
      const res = await api.clearServerMemoryCache();
      await onRefreshAll();
      setCacheBanner({
        kind: 'ok',
        text: res.message || 'Transient server & client memory caches cleared.',
      });
    } catch (err) {
      setCacheBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to clear transient memory cache.',
      });
    } finally {
      setClearingCache(false);
    }
  };

  const openDangerModal = (spec: DangerZoneOptionSpec) => {
    setActiveDangerSpec(spec);
    setAcknowledged(false);
    setTypedPhrase('');
    setModalError(null);
  };

  const closeDangerModal = () => {
    if (executingDanger) return;
    setActiveDangerSpec(null);
    setAcknowledged(false);
    setTypedPhrase('');
    setModalError(null);
  };

  const canExecuteDanger =
    activeDangerSpec !== null &&
    acknowledged &&
    typedPhrase.trim() === activeDangerSpec.requiredPhrase &&
    !executingDanger;

  const handleConfirmDangerZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDangerSpec || !canExecuteDanger) return;

    setExecutingDanger(true);
    setModalError(null);
    try {
      const res = await api.executeDangerZone({
        action: activeDangerSpec.action,
        confirmationPhrase: typedPhrase.trim(),
        acknowledgedIrreversible: acknowledged,
      });
      const completedAction = activeDangerSpec.action;
      setActiveDangerSpec(null);
      setAcknowledged(false);
      setTypedPhrase('');
      setDangerBanner({
        kind: 'ok',
        text: res.message,
      });
      await onDangerZoneExecuted(completedAction);
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : 'Failed to execute Danger Zone operation.'
      );
    } finally {
      setExecutingDanger(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Settings Header & Brutalist Sub-Navigation Bar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage AI connections, preferences and local data.
            </p>
          </div>

          {/* 3 Brutalist Section Switcher Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setActiveSection('ai_engine')}
              aria-pressed={activeSection === 'ai_engine'}
              className={`neo-press inline-flex cursor-pointer items-center gap-2 rounded-base border-2 border-border px-4 py-2.5 font-heading text-xs font-bold ${
                activeSection === 'ai_engine'
                  ? 'translate-x-[2px] translate-y-[2px] bg-[#88AAEE] text-black shadow-[2px_2px_0px_0px_var(--border)]'
                  : 'bg-background text-foreground shadow-shadow hover:bg-secondary-background'
              }`}
            >
              <Cpu className="h-4 w-4 stroke-[2.25]" />
              <span>AI connections</span>
              <Badge variant="mint" className="px-2 py-0 font-mono text-[10px]">
                {status.connectedProviderCount} Connected
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('preferences')}
              aria-pressed={activeSection === 'preferences'}
              className={`neo-press inline-flex cursor-pointer items-center gap-2 rounded-base border-2 border-border px-4 py-2.5 font-heading text-xs font-bold ${
                activeSection === 'preferences'
                  ? 'translate-x-[2px] translate-y-[2px] bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)]'
                  : 'bg-background text-foreground shadow-shadow hover:bg-secondary-background'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 stroke-[2.25]" />
              <span>Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('danger_zone')}
              aria-pressed={activeSection === 'danger_zone'}
              className={`neo-press inline-flex cursor-pointer items-center gap-2 rounded-base border-2 border-border px-4 py-2.5 font-heading text-xs font-bold ${
                activeSection === 'danger_zone'
                  ? 'translate-x-[2px] translate-y-[2px] bg-[#FF6B6B] text-black shadow-[2px_2px_0px_0px_var(--border)]'
                  : 'bg-[#FF6B6B]/25 text-foreground shadow-shadow hover:bg-[#FF6B6B]/50'
              }`}
            >
              <AlertTriangle className="h-4 w-4 stroke-[2.25]" />
              <span>Data &amp; reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Danger Execution Banner if triggered */}
      <AnimatePresence>
        {dangerBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={NEO_SPRING}
            className={`flex items-start justify-between gap-3 rounded-base border-2 border-border p-4 text-xs text-black shadow-shadow ${
              dangerBanner.kind === 'ok' ? 'bg-[#05E17A]' : 'bg-[#FF6B6B]'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {dangerBanner.kind === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 stroke-[2.5]" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 stroke-[2.5]" />
              )}
              <span className="font-heading font-bold">{dangerBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setDangerBanner(null)}
              className="cursor-pointer rounded-base border-2 border-black bg-secondary-background p-1 text-black hover:bg-background"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Section Body */}
      <AnimatePresence mode="wait">
        {/* SECTION 1: AI Engine & Jev Router */}
        {activeSection === 'ai_engine' && (
          <motion.div
            key="ai_engine"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-base border-2 border-border bg-[#88AAEE]/35 px-4 py-3 text-xs text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#88AAEE] text-black">
                  <Shield className="h-4 w-4 stroke-[2.25]" />
                </div>
                <span className="font-medium">
                  <strong className="font-heading">Global Inference Scope:</strong> AI Engine &amp;
                  TypeSafe Jev Router settings apply globally across all resume analyses, roadmaps,
                  study guides, mentor hints, and evaluations.
                </span>
              </div>
            </div>

            <ProviderJevSetupView
              status={status}
              providers={providers}
              presets={presets}
              jevConfig={jevConfig}
              routingDecisions={routingDecisions}
              onRefreshAll={onRefreshAll}
              onGamificationDelta={onGamificationDelta}
              onGoToResume={() => {}}
              hideContinueButton={true}
            />
          </motion.div>
        )}

        {/* SECTION 2: Workspace, UI & Memory Cache */}
        {activeSection === 'preferences' && (
          <motion.div
            key="preferences"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-8 xl:grid-cols-12"
          >
            {/* Interactive Preferences Panel */}
            <Card className="overflow-hidden py-0 gap-0 xl:col-span-7">
              <CardHeader className="border-b-2 border-border bg-[#FFDC58]/55 py-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      Workspace &amp; Interface Preferences
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs font-medium text-black/80">
                      Changes persist immediately to your local SQLite database.
                    </CardDescription>
                  </div>
                  {savingPrefKey && (
                    <Badge variant="neutral" className="font-mono text-xs">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 py-6">
                <div className="space-y-3.5">
                  {/* Toggle 1: animationsEnabled */}
                  <div className="flex items-center justify-between gap-4 rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                    <div>
                      <div className="font-heading text-sm font-bold text-foreground">
                        Fluid Graph &amp; UI Animations
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Enable smooth transitions across DAG roadmap edges, progress bars, and toast
                        celebrations.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.animationsEnabled}
                      aria-label="Fluid Graph & UI Animations"
                      disabled={savingPrefKey !== null}
                      onCheckedChange={(checked) =>
                        void handleUpdatePreference('animationsEnabled', checked)
                      }
                    />
                  </div>

                  {/* Toggle 2: showRoadmapFlowInArena */}
                  <div className="flex items-center justify-between gap-4 rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                    <div>
                      <div className="font-heading text-sm font-bold text-foreground">
                        Expand Roadmap Flow Graph by Default in Topic Arena
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Automatically show the connected phase &amp; prerequisite topic flow header
                        inside the Topic Workbench.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.showRoadmapFlowInArena}
                      aria-label="Expand Roadmap Flow Graph by Default in Topic Arena"
                      disabled={savingPrefKey !== null}
                      onCheckedChange={(checked) =>
                        void handleUpdatePreference('showRoadmapFlowInArena', checked)
                      }
                    />
                  </div>

                  {/* Toggle 3: compactStreamCards */}
                  <div className="flex items-center justify-between gap-4 rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                    <div>
                      <div className="font-heading text-sm font-bold text-foreground">
                        Compact Stream Cards on Dashboard
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Render denser multi-stream cards in Career Streams Hub when managing several
                        concurrent tracks.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.compactStreamCards}
                      aria-label="Compact Stream Cards on Dashboard"
                      disabled={savingPrefKey !== null}
                      onCheckedChange={(checked) =>
                        void handleUpdatePreference('compactStreamCards', checked)
                      }
                    />
                  </div>

                  {/* Select: defaultLanguageHint */}
                  <div className="flex flex-col justify-between gap-3 rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)] sm:flex-row sm:items-center">
                    <div>
                      <label
                        htmlFor="pref-default-language"
                        className="block font-heading text-sm font-bold text-foreground"
                      >
                        Default Practice Challenge Language
                      </label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Preferred starter template language hint for newly generated coding
                        challenges.
                      </p>
                    </div>
                    <NeoSelect
                      id="pref-default-language"
                      value={prefs.defaultLanguageHint}
                      disabled={savingPrefKey !== null}
                      onChange={(e) =>
                        void handleUpdatePreference(
                          'defaultLanguageHint',
                          e.target.value as AppPreferences['defaultLanguageHint']
                        )
                      }
                    >
                      <option value="typescript">TypeScript (typescript)</option>
                      <option value="python">Python (python)</option>
                      <option value="go">Go (go)</option>
                      <option value="sql">SQL (sql)</option>
                      <option value="markdown">System Design / Markdown (markdown)</option>
                    </NeoSelect>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {prefBanner && (
                    <motion.div
                      key={prefBanner.text}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={NEO_SPRING}
                      className={`flex items-center gap-2 rounded-base border-2 border-border p-3 text-xs text-black shadow-[2px_2px_0px_0px_var(--border)] ${
                        prefBanner.kind === 'ok' ? 'bg-[#05E17A]' : 'bg-[#FF6B6B]'
                      }`}
                    >
                      {prefBanner.kind === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      )}
                      <span className="font-heading font-bold">{prefBanner.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Local SQLite Storage & In-Memory Cache Panel */}
            <Card className="overflow-hidden py-0 gap-0 xl:col-span-5">
              <CardHeader className="border-b-2 border-border bg-[#22D3EE]/35 py-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#22D3EE] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                    <Database className="h-4 w-4 stroke-[2.25]" />
                  </div>
                  <CardTitle className="text-lg">
                    Local SQLite Storage &amp; In-Memory Cache
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 text-xs font-medium text-black/80">
                  All CareerForge state lives locally on your machine with zero cloud telemetry
                  lock-in.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 py-6">
                {/* SQLite File Telemetry */}
                <div className="space-y-3 rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                      <HardDrive className="h-3.5 w-3.5 stroke-[2.25]" />
                      SQLite Database File
                    </span>
                    <Badge variant="mint" className="font-mono text-xs">
                      {formatFileSize(status.dbFileSizeBytes)}
                    </Badge>
                  </div>
                  <div className="break-all rounded-base border-2 border-border bg-secondary-background px-3 py-2 font-mono text-xs font-bold text-foreground">
                    {status.dbPath}
                  </div>
                </div>

                {/* Transient Cache Counts */}
                <div>
                  <div className="mb-2 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Prepared Blueprint &amp; Resource Cache
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-base border-2 border-border bg-[#88AAEE]/40 p-3 text-black shadow-[2px_2px_0px_0px_var(--border)]">
                      <div className="font-mono text-xl font-black">
                        {status.memoryCache.cachedRoadmaps}
                      </div>
                      <div className="mt-0.5 font-heading text-[11px] font-bold">Roadmaps</div>
                    </div>
                    <div className="rounded-base border-2 border-border bg-[#05E17A]/40 p-3 text-black shadow-[2px_2px_0px_0px_var(--border)]">
                      <div className="font-mono text-xl font-black">
                        {status.memoryCache.cachedTopicNodes}
                      </div>
                      <div className="mt-0.5 font-heading text-[11px] font-bold">Topic Nodes</div>
                    </div>
                    <div className="rounded-base border-2 border-border bg-[#FFDC58]/65 p-3 text-black shadow-[2px_2px_0px_0px_var(--border)]">
                      <div className="font-mono text-xl font-black">
                        {status.memoryCache.cachedResourcePacks}
                      </div>
                      <div className="mt-0.5 font-heading text-[11px] font-bold">
                        Resource Packs
                      </div>
                    </div>
                  </div>
                </div>

                <p className="rounded-base border-2 border-border bg-background p-3.5 text-xs leading-relaxed text-muted-foreground">
                  Clearing the transient memory cache purges prepared in-memory roadmap &amp;
                  resource pack blueprints so future generations fetch fresh AI output. Your{' '}
                  <strong className="font-heading text-foreground">
                    active streams, saved study guides, submissions, and XP progress remain
                    completely safe
                  </strong>
                  .
                </p>

                <AnimatePresence mode="wait">
                  {cacheBanner && (
                    <motion.div
                      key={cacheBanner.text}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={NEO_SPRING}
                      className={`flex items-center gap-2 rounded-base border-2 border-border p-3 text-xs text-black shadow-[2px_2px_0px_0px_var(--border)] ${
                        cacheBanner.kind === 'ok' ? 'bg-[#05E17A]' : 'bg-[#FF6B6B]'
                      }`}
                    >
                      {cacheBanner.kind === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      )}
                      <span className="font-heading font-bold">{cacheBanner.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="button"
                  variant="default"
                  onClick={() => void handleClearMemoryCache()}
                  disabled={clearingCache}
                  className="w-full bg-[#22D3EE] text-black"
                >
                  {clearingCache ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Clear Transient Memory Cache
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* SECTION 3: Danger Zone */}
        {activeSection === 'danger_zone' && (
          <motion.div
            key="danger_zone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg"
          >
            {/* Bold #FF6B6B Danger Header */}
            <div className="flex items-start gap-3.5 border-b-2 border-border bg-[#FF6B6B] px-6 py-5 text-black">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-base border-2 border-black bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_#000]">
                <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold text-black">
                  Danger Zone · Destructive Local SQLite Resets
                </h2>
                <p className="mt-1 text-xs font-medium leading-relaxed text-black/90">
                  Each operation below permanently deletes specific tables or records inside your
                  local SQLite database (
                  <code className="rounded-base border border-black bg-secondary-background px-1.5 py-0.5 font-mono font-bold text-black">
                    {status.dbPath}
                  </code>
                  ). Every action is protected by a mandatory two-step confirmation dialog.
                </p>
              </div>
            </div>

            {/* Danger Options List */}
            <div className="space-y-3.5 bg-[#FF6B6B]/12 p-6">
              {DANGER_ZONE_OPTIONS.map((opt) => (
                <div
                  key={opt.action}
                  className="flex flex-col gap-4 rounded-base border-2 border-border bg-secondary-background p-4 shadow-[3px_3px_0px_0px_var(--border)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1.5 pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-sm font-bold text-foreground">
                        {opt.title}
                      </h3>
                      <Badge variant="coral" className="font-mono text-[10px]">
                        Phrase: {opt.requiredPhrase}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{opt.summary}</p>
                  </div>

                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => openDangerModal(opt)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {opt.buttonLabel}
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guarded Two-Step Confirmation Modal with Spring Entrance */}
      <AnimatePresence>
        {activeDangerSpec && (
          <motion.div
            key="danger-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="danger-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          >
            <motion.div
              key={activeDangerSpec.action}
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={NEO_SPRING}
              className="w-full max-w-lg overflow-hidden rounded-base border-3 border-border bg-secondary-background text-foreground shadow-brutal-lg"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 border-b-2 border-border bg-[#FF6B6B] px-6 py-4 text-black">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-black bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_#000]">
                    <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
                  </div>
                  <h3 id="danger-modal-title" className="font-heading text-base font-bold text-black">
                    {activeDangerSpec.title}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={executingDanger}
                  onClick={closeDangerModal}
                  aria-label="Close confirmation dialog"
                  className="neo-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-base border-2 border-black bg-secondary-background text-black shadow-[2px_2px_0px_0px_#000] disabled:opacity-40"
                >
                  <X className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Impact Breakdown + Two-Step Guard Form */}
              <form onSubmit={handleConfirmDangerZone} className="space-y-4 p-6">
                <div className="space-y-1.5 rounded-base border-2 border-border bg-[#FF6B6B]/25 p-3.5 text-xs text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="font-heading font-bold uppercase tracking-wider text-foreground">
                    Permanently Deleted
                  </div>
                  <ul className="list-disc space-y-1 pl-4 font-medium text-foreground">
                    {activeDangerSpec.deletedItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5 rounded-base border-2 border-border bg-[#05E17A]/25 p-3.5 text-xs text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="font-heading font-bold uppercase tracking-wider text-foreground">
                    Safely Preserved
                  </div>
                  <ul className="list-disc space-y-1 pl-4 font-medium text-foreground">
                    {activeDangerSpec.preservedItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Guard 1: Explicit Irreversibility Checkbox */}
                <label className="flex cursor-pointer items-start gap-3 rounded-base border-2 border-border bg-background p-3.5 text-xs text-foreground shadow-[2px_2px_0px_0px_var(--border)] select-none transition-colors hover:bg-[#FFDC58]/35">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    disabled={executingDanger}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[3px] border-2 border-black accent-[#FF6B6B] focus:ring-2 focus:ring-black"
                  />
                  <span className="font-heading font-bold leading-relaxed">
                    I understand this action permanently deletes local SQLite data and cannot be
                    undone.
                  </span>
                </label>

                {/* Guard 2: Exact Case-Sensitive Confirmation Phrase Input */}
                <div>
                  <label
                    htmlFor="danger-confirmation-phrase"
                    className="block font-heading text-xs font-bold text-foreground"
                  >
                    Type{' '}
                    <code className="rounded-base border-2 border-border bg-[#FFDC58] px-2 py-0.5 font-mono text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                      {activeDangerSpec.requiredPhrase}
                    </code>{' '}
                    (case-sensitive) to unlock execution:
                  </label>
                  <Input
                    id="danger-confirmation-phrase"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={executingDanger}
                    value={typedPhrase}
                    onChange={(e) => setTypedPhrase(e.target.value)}
                    placeholder={activeDangerSpec.requiredPhrase}
                    className="mt-2 font-mono font-bold"
                  />
                </div>

                {modalError && (
                  <div className="flex items-start gap-2 rounded-base border-2 border-border bg-[#FF6B6B] p-3 text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                    <AlertCircle className="h-4 w-4 shrink-0 stroke-[2.5]" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="neutral"
                    disabled={executingDanger}
                    onClick={closeDangerModal}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" disabled={!canExecuteDanger}>
                    {executingDanger ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Permanently Execute {activeDangerSpec.title}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
