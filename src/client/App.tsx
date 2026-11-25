import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  FileText,
  Hammer,
  Layers,
  Loader2,
  Palette,
  Sparkles,
  Swords,
  Terminal,
  X,
} from 'lucide-react';
import { api } from './lib/api.ts';
import { Button } from '@/components/ui/button';
import { getNextTopic } from '../shared/learningFlow.ts';
import { NEO_SPRING, PageTransition } from '@/components/ui/motion-primitives';
import { OnboardingFlowView } from './components/OnboardingFlowView.tsx';
import { ResumeRoadmapView } from './components/ResumeRoadmapView.tsx';
import { StreamsHubView } from './components/StreamsHubView.tsx';
import { TopicWorkbenchView } from './components/TopicWorkbenchView.tsx';
import { GamificationVaultView } from './components/GamificationVaultView.tsx';
import { UserAvatarMenu, type UserMenuDestination } from './components/UserAvatarMenu.tsx';
import { UserProfileView } from './components/UserProfileView.tsx';
import { SettingsView, type SettingsSectionId } from './components/SettingsView.tsx';
import type {
  AIProviderRecord,
  CareerStream,
  DangerZoneAction,
  GamificationDelta,
  JevConfig,
  PlayerProfile,
  ProviderModelConfig,
  ProviderType,
  ResumeRecord,
  RoutingDecision,
  StreamTopic,
  SystemStatusResponse,
} from '../shared/types.ts';

type NavTab =
  | 'onboarding'
  | 'streams'
  | 'resume'
  | 'workbench'
  | 'profile'
  | 'vault'
  | 'settings';

interface ToastItem {
  id: string;
  title: string;
  subtitle: string;
  accent: 'indigo' | 'emerald' | 'amber' | 'cyan';
}

const KONAMI_SEQ = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];

type NeoPaletteId = 'default' | 'violet' | 'blue' | 'mint' | 'sunburst';

const NEO_PALETTES: Array<{ id: NeoPaletteId; label: string; swatch: string }> = [
  { id: 'default', label: 'Classic Periwinkle', swatch: '#88AAEE' },
  { id: 'sunburst', label: 'Sunburst Yellow', swatch: '#FFDC58' },
  { id: 'violet', label: 'Neo Violet', swatch: '#A985FF' },
  { id: 'mint', label: 'Cyber Mint', swatch: '#05E17A' },
  { id: 'blue', label: 'Electric Blue', swatch: '#5294FF' },
];

const TOAST_ACCENT_BG: Record<ToastItem['accent'], string> = {
  indigo: 'bg-[#88AAEE]',
  emerald: 'bg-[#05E17A]',
  amber: 'bg-[#FFDC58]',
  cyan: 'bg-[#22D3EE]',
};

export const App: React.FC = () => {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('onboarding');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('ai_engine');
  const [neoPalette, setNeoPalette] = useState<NeoPaletteId>(() => {
    try {
      const saved = window.localStorage.getItem('cf_neo_palette') as NeoPaletteId | null;
      return saved && NEO_PALETTES.some((p) => p.id === saved) ? saved : 'default';
    } catch {
      return 'default';
    }
  });
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [presets, setPresets] = useState<
    Record<ProviderType, { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }>
  >({} as Record<ProviderType, { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }>);
  const [providers, setProviders] = useState<AIProviderRecord[]>([]);
  const [jevConfig, setJevConfig] = useState<JevConfig | null>(null);
  const [routingDecisions, setRoutingDecisions] = useState<RoutingDecision[]>([]);
  const [latestResume, setLatestResume] = useState<ResumeRecord | null>(null);
  const [streams, setStreams] = useState<CareerStream[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(() => {
    try { return window.localStorage.getItem('cf_selected_stream'); } catch { return null; }
  });
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  // Gamification Toasts & Easter Eggs
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [overclockMode, setOverclockMode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleLog, setConsoleLog] = useState<Array<{ cmd: string; out: string; art?: string }>>([
    {
      cmd: 'welcome',
      out: 'CareerForge Secret Oracle Console v1.0 — try: sudo promote | jev --explain | rubberduck | coffee',
    },
  ]);

  const anvilClicksRef = useRef<number[]>([]);
  const konamiBufferRef = useRef<string[]>([]);

  const pushToast = useCallback(
    (title: string, subtitle: string, accent: ToastItem['accent'] = 'indigo') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-4), { id, title, subtitle, accent }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5500);
    },
    []
  );

  const handleGamificationDelta = useCallback(
    (delta: GamificationDelta | null) => {
      if (!delta) return;
      if (delta.xpGained > 0 || delta.sparksGained > 0) {
        pushToast(
          `+${delta.xpGained} XP ${delta.sparksGained > 0 ? `· +${delta.sparksGained} Sparks` : ''}`,
          delta.leveledUpStream
            ? `Stream Leveled Up to Lvl ${delta.newStreamLevel}!`
            : delta.leveledUpGlobal
              ? `Global Rank Up! Now Level ${delta.newGlobalLevel}!`
              : 'Progress recorded in local SQLite',
          'emerald'
        );
      }
      for (const ach of delta.unlockedAchievements) {
        pushToast(`Achievement Unlocked: ${ach.title}`, ach.description, 'amber');
      }
      for (const q of delta.completedQuests) {
        pushToast(`Bonus Quest Complete: ${q.title}`, `+${q.xpReward} XP Bonus Claimed!`, 'cyan');
      }
      if (delta.lootDropMessage) {
        pushToast('Mystery Arena Drop!', delta.lootDropMessage, 'amber');
      }
    },
    [pushToast]
  );

  const refreshAll = useCallback(async (isInitial = false) => {
    const [statusRes, provRes, jevRes, resumeRes, streamRes, gamRes] = await Promise.all([
      api.getStatus(),
      api.getProviders(),
      api.getJev(),
      api.getResumes(),
      api.getStreams(),
      api.getGamification(),
    ]);

    setStatus(statusRes.status);
    setPresets(statusRes.presets);
    setProviders(provRes.providers);
    setJevConfig(jevRes.config);
    setRoutingDecisions(jevRes.decisions);
    setLatestResume(resumeRes.latest);
    setStreams(streamRes.streams);
    setProfile(gamRes.profile);

    if (streamRes.streams.length > 0) {
      setSelectedStreamId((prev) =>
        prev && streamRes.streams.some((s) => s.id === prev) ? prev : (streamRes.streams.find((s) => s.status === 'active') ?? streamRes.streams[0]!).id
      );
      setActiveTopicId((prev) => prev && streamRes.streams.some((s) => s.phases.some((p) => p.topics.some((t) => t.id === prev))) ? prev : null);
    } else {
      setSelectedStreamId(null);
      setActiveTopicId(null);
    }

    if (isInitial) {
      if (!statusRes.status.isOnboarded) {
        setActiveTab('onboarding');
      } else {
        setActiveTab('streams');
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (neoPalette === 'default') {
      root.removeAttribute('data-neo-palette');
    } else {
      root.setAttribute('data-neo-palette', neoPalette);
    }
    try {
      window.localStorage.setItem('cf_neo_palette', neoPalette);
    } catch {
      // ignore storage errors
    }
  }, [neoPalette]);

  useEffect(() => {
    const root = document.documentElement;
    const enabled = status?.preferences.animationsEnabled ?? true;
    root.setAttribute('data-animations', enabled ? 'on' : 'off');
  }, [status?.preferences.animationsEnabled]);

  const boot = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try { await refreshAll(true); }
    catch (err) { setBootError(err instanceof Error ? err.message : 'Unable to load your workspace.'); }
    finally { setBooting(false); }
  }, [refreshAll]);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => {
    try {
      if (selectedStreamId) window.localStorage.setItem('cf_selected_stream', selectedStreamId);
      else window.localStorage.removeItem('cf_selected_stream');
    } catch { /* storage unavailable */ }
  }, [selectedStreamId]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [activeTab, activeTopicId]);

  // Konami Code + Ctrl+K Oracle Console shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setConsoleOpen((v) => !v);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key.toLowerCase();
      konamiBufferRef.current = [...konamiBufferRef.current.slice(-9), key];
      if (konamiBufferRef.current.join(',') === KONAMI_SEQ.join(',')) {
        konamiBufferRef.current = [];
        setOverclockMode((v) => !v);
        void api.triggerEasterEgg('konami').then((res) => {
          setProfile(res.profile);
          pushToast('🕹️ KONAMI OVERCLOCK!', res.message, 'cyan');
          handleGamificationDelta(res.delta);
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleGamificationDelta, pushToast]);

  const handleAnvilClick = () => {
    const now = Date.now();
    const recent = anvilClicksRef.current.filter((t) => now - t < 3000);
    recent.push(now);
    anvilClicksRef.current = recent;

    if (recent.length >= 7) {
      anvilClicksRef.current = [];
      void api.triggerEasterEgg('anvil_seven').then((res) => {
        setProfile(res.profile);
        pushToast('🔨 SEVENFOLD ANVIL STRIKE!', res.message, 'amber');
        handleGamificationDelta(res.delta);
      });
    }
  };

  const handleRunConsoleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = consoleInput.trim();
    if (!cmd) return;
    setConsoleInput('');
    const res = await api.triggerEasterEgg('terminal_command', cmd);
    setProfile(res.profile);
    setConsoleLog((prev) => [...prev, { cmd, out: res.message, art: res.asciiArt }]);
    handleGamificationDelta(res.delta);
  };

  if (!booting && bootError) {
    return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6"><h1 className="font-heading text-2xl font-bold">Couldn't open your workspace</h1><p role="alert" className="text-sm text-muted-foreground">{bootError}</p><Button onClick={() => void boot()}>Try again</Button></main>;
  }
  if (booting || !status || !jevConfig || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={NEO_SPRING}
          className="flex items-center gap-3.5 rounded-base border-2 border-border bg-secondary-background px-6 py-4 shadow-brutal-lg"
        >
          <div className="flex size-9 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58]">
            <Loader2 className="h-5 w-5 animate-spin text-black" />
          </div>
          <span className="font-heading text-sm font-bold text-foreground">
            Opening your workspace…
          </span>
        </motion.div>
      </div>
    );
  }

  const handleOpenTopic = (topic: StreamTopic) => {
    setSelectedStreamId(topic.streamId);
    setActiveTopicId(topic.id);
    setActiveTab('workbench');
  };

  const handleOpenArenaDefault = () => {
    const targetStream =
      streams.find((s) => s.id === selectedStreamId) ?? streams[0] ?? null;
    const firstTopic = targetStream ? targetStream.phases.flatMap((p) => p.topics).find((t) => t.id === activeTopicId) ?? getNextTopic(targetStream) ?? targetStream.phases[0]?.topics[0] : null;
    if (firstTopic) {
      setSelectedStreamId(targetStream!.id);
      setActiveTopicId(firstTopic.id);
      setActiveTab('workbench');
    }
  };

  const handleUserMenuNavigate = (dest: UserMenuDestination) => {
    if (dest === 'settings') {
      setSettingsSection('ai_engine');
      setActiveTab('settings');
    } else {
      setActiveTab(dest);
    }
  };

  const handleDangerZoneExecuted = async (action: DangerZoneAction) => {
    if (action === 'delete_streams_and_resumes' || action === 'factory_reset') {
      setSelectedStreamId(null);
      setActiveTopicId(null);
    }
    await refreshAll(false);
    if (action === 'factory_reset') {
      setActiveTab('onboarding');
      pushToast(
        'Factory Reset Complete',
        'Returned CareerForge to fresh first-run onboarding.',
        'amber'
      );
    } else {
      pushToast(
        'Danger Zone Action Completed',
        'Local SQLite state has been updated.',
        'indigo'
      );
    }
  };

  // Requirement 2 & 3: Mandatory Onboarding Flow on Homepage before letting new users into the application
  if (!status.isOnboarded || activeTab === 'onboarding') {
    return (
      <MotionConfig reducedMotion={status.preferences.animationsEnabled ? 'user' : 'always'}>
        <div
          className={`min-h-screen bg-background text-foreground ${overclockMode ? 'overclock-grid' : ''}`}
        >
          <OnboardingFlowView
            status={status}
            profile={profile}
            providers={providers}
            presets={presets}
            jevConfig={jevConfig}
            routingDecisions={routingDecisions}
            onRefreshAll={() => refreshAll(false)}
            onGamificationDelta={handleGamificationDelta}
            onOnboardingComplete={async () => {
              await refreshAll(false);
              setActiveTab('streams');
              pushToast(
                'Welcome to CareerForge!',
                'AI Engine ready — landed on your Career Streams Dashboard.',
                'emerald'
              );
            }}
          />

          {/* Reward & Achievement Celebration Toasts */}
          <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex max-w-sm flex-col gap-3">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 40, scale: 0.92 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 30, scale: 0.94 }}
                  transition={NEO_SPRING}
                  className="pointer-events-auto overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg"
                >
                  <div
                    className={`border-b-2 border-border px-3.5 py-1.5 font-heading text-xs font-extrabold text-black ${TOAST_ACCENT_BG[t.accent]}`}
                  >
                    {t.title}
                  </div>
                  <div className="px-3.5 py-2.5 text-xs font-medium text-foreground">
                    {t.subtitle}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
    );
  }

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    onClick?: () => void;
  }> = [
    {
      id: 'streams',
      label: 'My roadmaps',
      icon: <Layers className="h-4 w-4" />,
    },
    {
      id: 'resume',
      label: 'Resume',
      icon: <FileText className="h-4 w-4" />,
    },
    ...(streams.length > 0 || activeTopicId
      ? [
          {
            id: 'workbench' as NavTab,
            label: 'Learn',
            icon: <Swords className="h-4 w-4" />,
            onClick: handleOpenArenaDefault,
          },
        ]
      : []),
  ];

  const cyclePalette = () => {
    const idx = NEO_PALETTES.findIndex((p) => p.id === neoPalette);
    const next = NEO_PALETTES[(idx + 1) % NEO_PALETTES.length]!;
    setNeoPalette(next.id);
  };

  return (
    <MotionConfig reducedMotion={status.preferences.animationsEnabled ? 'user' : 'always'}>
      <div
        className={`min-h-screen bg-background text-foreground ${overclockMode ? 'overclock-grid' : ''}`}
      >
        {/* Sticky Neobrutalist Top Command Header + Top-Right User Avatar Menu */}
        <header className="sticky top-0 z-30 border-b-3 border-border bg-secondary-background shadow-[0px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6">
            {/* Brand + 7-Tap Anvil Easter Egg */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.93, rotate: -4 }}
              onClick={() => {
                handleAnvilClick();
                setActiveTab('streams');
              }}
              title="CareerForge Dashboard (Psst... strike the anvil 7 times rapidly!)"
              className="neo-press group flex cursor-pointer items-center gap-3 rounded-base border-2 border-border bg-[#FFDC58] px-3 py-1.5 text-left shadow-[3px_3px_0px_0px_var(--border)]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-base border-2 border-border bg-secondary-background text-black">
                <Hammer className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-heading text-sm font-black tracking-tight text-black">
                  <span>CareerForge</span>
                  {overclockMode && (
                    <span className="rounded-[4px] border border-black bg-[#22D3EE] px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">
                      OVERCLOCK
                    </span>
                  )}
                </div>
              </div>
            </motion.button>

            {/* Primary Center Navigation with Spring layoutId Pill */}
            <nav aria-label="Primary navigation" className="order-last flex w-full flex-wrap items-center justify-center gap-1 rounded-base border-2 border-border bg-background p-1 sm:order-none sm:w-auto">
              {navItems.map((item) => {
                const isCurrent = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => (item.onClick ? item.onClick() : setActiveTab(item.id))}
                    className="relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-base px-2.5 py-1.5 font-heading text-sm font-bold text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5"
                  >
                    {isCurrent && (
                      <motion.span
                        layoutId="primary-nav-active-pill"
                        transition={NEO_SPRING}
                        className="absolute inset-0 rounded-base border-2 border-border bg-main shadow-[2px_2px_0px_0px_var(--border)]"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      {item.icon}
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          className={`rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            isCurrent
                              ? 'bg-secondary-background text-black'
                              : 'bg-[#FFDC58] text-black'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Top-Right Palette Switcher + Polymath Indicator + User Avatar Dropdown Menu */}
            <div className="flex items-center gap-2.5 text-xs">
              {profile.polymathMultiplierActive && (
                <span
                  title="Working across 2+ streams today grants 1.25x XP!"
                  className="hidden md:inline-flex items-center gap-1 rounded-base border-2 border-border bg-[#05E17A] px-2.5 py-1 font-heading font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]"
                >
                  <Sparkles className="h-3.5 w-3.5" /> 1.25x Polymath
                </span>
              )}

              <button
                type="button"
                onClick={cyclePalette}
                aria-label="Change color palette"
                title={`Switch Neobrutalism Palette (Current: ${NEO_PALETTES.find((p) => p.id === neoPalette)?.label})`}
                className="neo-press inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-base border-2 border-border bg-secondary-background px-2.5 font-heading text-xs font-bold text-foreground shadow-[2px_2px_0px_0px_var(--border)]"
              >
                <Palette className="h-4 w-4" />
                <span
                  className="size-3.5 rounded-full border-2 border-border"
                  style={{
                    backgroundColor:
                      NEO_PALETTES.find((p) => p.id === neoPalette)?.swatch ?? '#88AAEE',
                  }}
                />
              </button>

              <UserAvatarMenu
                profile={profile}
                status={status}
                activeDestination={activeTab}
                onNavigate={handleUserMenuNavigate}
                onOpenConsole={() => setConsoleOpen(true)}
              />
            </div>
          </div>
        </header>

        {/* Main Content Container with Fluent Page Transitions */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            {activeTab === 'streams' && (
              <PageTransition key="view-streams">
                <StreamsHubView
                  hasActiveProvider={status.hasActiveProvider}
                  streams={streams}
                  selectedStreamId={selectedStreamId}
                  onSelectStream={setSelectedStreamId}
                  onOpenTopic={handleOpenTopic}
                  onRefreshAll={() => refreshAll(false)}
                  onGamificationDelta={handleGamificationDelta}
                  onGoToResume={() => setActiveTab('resume')}
                  onGoToSetup={() => { setSettingsSection('ai_engine'); setActiveTab('settings'); }}
                  compactCards={status.preferences.compactStreamCards}
                />
              </PageTransition>
            )}

            {activeTab === 'resume' && (
              <PageTransition key="view-resume">
                <ResumeRoadmapView
                  hasActiveProvider={status.hasActiveProvider}
                  latestResume={latestResume}
                  streams={streams}
                  onRefreshAll={() => refreshAll(false)}
                  onGamificationDelta={handleGamificationDelta}
                  onGoToSetup={() => {
                    setSettingsSection('ai_engine');
                    setActiveTab('settings');
                  }}
                  onOpenStream={(streamId) => {
                    setSelectedStreamId(streamId);
                    setActiveTab('streams');
                  }}
                />
              </PageTransition>
            )}

            {activeTab === 'workbench' && !activeTopicId && <PageTransition key="view-empty-topic"><div className="space-y-4"><h1 className="font-heading text-2xl font-bold">Choose a topic to learn</h1><Button onClick={() => setActiveTab('streams')}>View roadmaps</Button></div></PageTransition>}
            {activeTab === 'workbench' && activeTopicId && (
              <PageTransition key={`view-workbench-${activeTopicId}`}>
                <TopicWorkbenchView
                  topicId={activeTopicId}
                  hasActiveProvider={status.hasActiveProvider}
                  onGoToSetup={() => { setSettingsSection('ai_engine'); setActiveTab('settings'); }}
                  onBackToStream={(streamId) => {
                    setSelectedStreamId(streamId);
                    setActiveTab('streams');
                  }}
                  onSelectTopic={(nextTopicId) => setActiveTopicId(nextTopicId)}
                  onRefreshAll={() => refreshAll(false)}
                  onGamificationDelta={handleGamificationDelta}
                  defaultShowRoadmapGraph={status.preferences.showRoadmapFlowInArena}
                  defaultLanguageHint={status.preferences.defaultLanguageHint}
                  animationsEnabled={status.preferences.animationsEnabled}
                />
              </PageTransition>
            )}

            {activeTab === 'profile' && (
              <PageTransition key="view-profile">
                <UserProfileView
                  profile={profile}
                  streams={streams}
                  latestResume={latestResume}
                  onRefreshAll={() => refreshAll(false)}
                  onNavigateVault={() => setActiveTab('vault')}
                  onNavigateSettings={() => {
                    setSettingsSection('ai_engine');
                    setActiveTab('settings');
                  }}
                />
              </PageTransition>
            )}

            {activeTab === 'vault' && (
              <PageTransition key="view-vault">
                <GamificationVaultView
                  profile={profile}
                  onRefreshAll={() => refreshAll(false)}
                  onGamificationDelta={handleGamificationDelta}
                  onOpenConsole={() => setConsoleOpen(true)}
                />
              </PageTransition>
            )}

            {activeTab === 'settings' && (
              <PageTransition key="view-settings">
                <SettingsView
                  initialSection={settingsSection}
                  status={status}
                  providers={providers}
                  presets={presets}
                  jevConfig={jevConfig}
                  routingDecisions={routingDecisions}
                  onRefreshAll={() => refreshAll(false)}
                  onGamificationDelta={handleGamificationDelta}
                  onDangerZoneExecuted={handleDangerZoneExecuted}
                />
              </PageTransition>
            )}
          </AnimatePresence>
        </main>

        {/* Neobrutalist Reward & Achievement Celebration Toasts */}
        <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex max-w-sm flex-col gap-3">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.94 }}
                transition={NEO_SPRING}
                className="pointer-events-auto overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg"
              >
                <div
                  className={`border-b-2 border-border px-3.5 py-1.5 font-heading text-xs font-extrabold text-black ${TOAST_ACCENT_BG[t.accent]}`}
                >
                  {t.title}
                </div>
                <div className="px-3.5 py-2.5 text-xs font-medium text-foreground">
                  {t.subtitle}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Secret Oracle Console Modal (Ctrl+K) — Classic Neobrutalist Terminal Window */}
        <AnimatePresence>
          {consoleOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={NEO_SPRING}
                className="w-full max-w-xl overflow-hidden rounded-base border-3 border-border bg-[#111111] shadow-brutal-lg"
              >
                <div className="flex items-center justify-between border-b-2 border-border bg-[#22D3EE] px-4 py-2.5 text-black">
                  <div className="flex items-center gap-2 font-mono text-xs font-extrabold">
                    <Terminal className="h-4 w-4 stroke-[2.5]" />
                    <span>ORACLE SECRET CONSOLE // ROOT</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConsoleOpen(false)}
                    className="neo-press flex size-7 cursor-pointer items-center justify-center rounded-[4px] border-2 border-border bg-secondary-background text-black shadow-[2px_2px_0px_0px_#000]"
                  >
                    <X className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>

                <div className="max-h-72 space-y-3 overflow-y-auto p-4 font-mono text-xs">
                  {consoleLog.map((entry, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="font-bold text-[#FFDC58]">$ {entry.cmd}</div>
                      <div className="text-[#05E17A]">{entry.out}</div>
                      {entry.art && (
                        <pre className="mt-1.5 rounded-base border border-zinc-700 bg-black p-2.5 text-[11px] text-[#22D3EE]">
                          {entry.art}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleRunConsoleCommand}
                  className="flex items-center gap-2 border-t-2 border-border bg-[#1A1A1A] p-2.5"
                >
                  <span className="px-2 font-mono text-xs font-bold text-[#22D3EE]">$</span>
                  <input
                    type="text"
                    autoFocus
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    placeholder="Type `sudo promote`, `jev --explain`, `rubberduck`, or `coffee`..."
                    className="flex-1 bg-transparent px-1 py-1.5 font-mono text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="neo-press cursor-pointer rounded-base border-2 border-black bg-[#FFDC58] px-3.5 py-1.5 font-heading text-xs font-extrabold text-black shadow-[2px_2px_0px_0px_#000]"
                  >
                    RUN
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
