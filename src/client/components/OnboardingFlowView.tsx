import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Code2,
  Compass,
  Cpu,
  Database,
  GitBranch,
  Hammer,
  Layers,
  Loader2,
  Lock,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Unlock,
  User,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NEO_GENTLE_SPRING,
  NEO_SPRING,
  NeoStarBurst,
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/motion-primitives';
import { cn } from '@/lib/utils';
import { api } from '../lib/api.ts';
import { ProviderJevSetupView } from './ProviderJevSetupView.tsx';
import type {
  AIProviderRecord,
  AvatarColor,
  AvatarIcon,
  GamificationDelta,
  JevConfig,
  PlayerProfile,
  ProviderModelConfig,
  ProviderType,
  RoutingDecision,
  SystemStatusResponse,
} from '../../shared/types.ts';

export interface OnboardingFlowViewProps {
  status: SystemStatusResponse;
  profile: PlayerProfile;
  providers: AIProviderRecord[];
  presets: Record<
    ProviderType,
    { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }
  >;
  jevConfig: JevConfig;
  routingDecisions: RoutingDecision[];
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  onOnboardingComplete: () => Promise<void>;
}

const AVATAR_ICON_OPTIONS: Array<{ id: AvatarIcon; label: string }> = [
  { id: 'Rocket', label: 'Rocket' },
  { id: 'Code2', label: 'Code' },
  { id: 'Brain', label: 'Architect' },
  { id: 'Cpu', label: 'Systems' },
  { id: 'Compass', label: 'Navigator' },
  { id: 'Shield', label: 'Guardian' },
  { id: 'Sparkles', label: 'Catalyst' },
  { id: 'User', label: 'Builder' },
];

const AVATAR_ICON_MAP: Record<AvatarIcon, React.ComponentType<{ className?: string }>> = {
  User,
  Rocket,
  Code2,
  Brain,
  Shield,
  Sparkles,
  Compass,
  Cpu,
};

const AVATAR_COLOR_OPTIONS: AvatarColor[] = [
  'indigo',
  'emerald',
  'cyan',
  'violet',
  'amber',
  'rose',
];

const AVATAR_COLOR_STYLES: Record<
  AvatarColor,
  {
    label: string;
    swatch: string;
    activeChip: string;
    avatarBox: string;
    badgeVariant: 'default' | 'mint' | 'cyan' | 'violet' | 'yellow' | 'coral';
  }
> = {
  indigo: {
    label: 'Indigo',
    swatch: 'bg-[#88AAEE]',
    activeChip: 'bg-[#88AAEE] text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
    avatarBox: 'bg-[#88AAEE] text-foreground',
    badgeVariant: 'default',
  },
  emerald: {
    label: 'Emerald',
    swatch: 'bg-[#05E17A]',
    activeChip: 'bg-[#05E17A] text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
    avatarBox: 'bg-[#05E17A] text-foreground',
    badgeVariant: 'mint',
  },
  amber: {
    label: 'Amber',
    swatch: 'bg-[#FFDC58]',
    activeChip: 'bg-[#FFDC58] text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
    avatarBox: 'bg-[#FFDC58] text-foreground',
    badgeVariant: 'yellow',
  },
  rose: {
    label: 'Rose',
    swatch: 'bg-[#FF6B6B]',
    activeChip: 'bg-[#FF6B6B] text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
    avatarBox: 'bg-[#FF6B6B] text-foreground',
    badgeVariant: 'coral',
  },
  cyan: {
    label: 'Cyan',
    swatch: 'bg-[#22D3EE]',
    activeChip: 'bg-[#22D3EE] text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
    avatarBox: 'bg-[#22D3EE] text-foreground',
    badgeVariant: 'cyan',
  },
  violet: {
    label: 'Violet',
    swatch: 'bg-[#A985FF]',
    activeChip: 'bg-[#A985FF] text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
    avatarBox: 'bg-[#A985FF] text-foreground',
    badgeVariant: 'violet',
  },
};

const MARQUEE_ITEMS = [
  'LOCAL-FIRST SQLITE VAULT',
  'PARALLEL MULTI-STREAM ROADMAPS',
  '0MS MEMORY CACHE',
  'SOCRATIC PRACTICE ARENA',
  'TYPESAFE JEV AUTO-ROUTING',
  'ZERO CLOUD LOCK-IN',
];

const FEATURE_PILLARS: Array<{
  title: string;
  description: string;
  badge: string;
  headerBg: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    title: 'Parallel Multi-Stream Roadmaps',
    description:
      'Pursue Staff Engineering, Agentic AI Systems, Leadership, or an adjacent pivot simultaneously—each stream tracks its own Level, XP, and Mastery % independently.',
    badge: 'Independent Progression',
    headerBg: 'bg-[#88AAEE]',
    Icon: Layers,
  },
  {
    title: 'Precomputed Roadmaps & Instant Memory Cache',
    description:
      'Topic graphs, deep-dive study guides, and flashcards stay cached in local RAM + SQLite for 0ms AI-free navigation and deterministic on-demand refreshes.',
    badge: '0ms Local Cache',
    headerBg: 'bg-[#05E17A]',
    Icon: Database,
  },
  {
    title: 'Hands-On Practice Arena & Socratic Mentor',
    description:
      'Solve realistic coding, system design, incident debugging, and leadership challenges graded against weighted rubrics with Socratic coaching.',
    badge: 'Weighted Rubrics',
    headerBg: 'bg-[#FFDC58]',
    Icon: Swords,
  },
  {
    title: 'Smart TypeSafe Jev Routing & Gamified Vault',
    description:
      'Automatic task-aware model routing with reasoning-effort tuning—paired with 1.25x Polymath combos, 20 achievements, Daily Streaks, and Forge Sparks.',
    badge: 'Intelligent Routing',
    headerBg: 'bg-[#A985FF]',
    Icon: GitBranch,
  },
];

export const OnboardingFlowView: React.FC<OnboardingFlowViewProps> = ({
  status,
  profile,
  providers,
  presets,
  jevConfig,
  routingDecisions,
  onRefreshAll,
  onGamificationDelta,
  onOnboardingComplete,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName || 'Career Forger');
  const [headlineTitle, setHeadlineTitle] = useState(
    profile.headlineTitle || 'Builder & Continuous Learner'
  );
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(profile.avatarColor || 'indigo');
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon>(profile.avatarIcon || 'Rocket');
  const [completing, setCompleting] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const mandatorySetupRef = useRef<HTMLDivElement | null>(null);
  const launchGateRef = useRef<HTMLDivElement | null>(null);

  const SelectedAvatarIcon = AVATAR_ICON_MAP[avatarIcon];
  const colorStyle = AVATAR_COLOR_STYLES[avatarColor];

  const handleCompleteLaunch = async () => {
    if (!status.hasActiveProvider || completing) {
      return;
    }
    setCompleting(true);
    setLaunchError(null);
    try {
      await api.completeOnboarding({
        displayName: displayName.trim() || profile.displayName || 'Career Forger',
        headlineTitle:
          headlineTitle.trim() || profile.headlineTitle || 'Builder & Continuous Learner',
        avatarColor,
        avatarIcon,
      });
      await onOnboardingComplete();
    } catch (err) {
      setLaunchError(
        err instanceof Error ? err.message : 'Failed to complete onboarding setup.'
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleProviderContinue = () => {
    if (status.hasActiveProvider) {
      void handleCompleteLaunch();
    } else {
      launchGateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageTransition className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8 pb-32">
        {/* Top First-Run Navigation / Trust Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-base border-2 border-border bg-secondary-background px-5 py-4 shadow-shadow">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
              <Hammer className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-lg font-bold tracking-tight text-foreground">
                  CareerForge
                </span>
                <Badge variant="violet" className="text-[10px] uppercase tracking-wider">
                  First-Run Setup
                </Badge>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Local-First AI Career Architect &amp; Deliberate Practice Engine
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <Badge variant="mint" className="px-3 py-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% Local SQLite Vault
            </Badge>
            <Badge
              variant={status.hasActiveProvider ? 'mint' : 'yellow'}
              className="px-3 py-1 text-xs"
            >
              {status.hasActiveProvider ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  AI Engine Connected ({status.activeProviderCount})
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Step 2 Required: Connect AI Provider
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* 1. Persuasive Hero & Value Showcase */}
        <Card className="overflow-hidden border-2 border-border bg-secondary-background py-0 gap-0 shadow-brutal-lg">
          {/* Animated Neobrutalist Marquee Ticker Banner */}
          <div className="overflow-hidden border-b-2 border-border bg-[#FFDC58] py-2.5 select-none">
            <motion.div
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="flex w-max items-center gap-6 whitespace-nowrap px-3"
            >
              {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="inline-flex items-center gap-6 font-heading text-xs font-bold uppercase tracking-widest text-foreground"
                >
                  <span>{item}</span>
                  <span className="inline-block h-2 w-2 rotate-45 border border-border bg-[#A985FF]" />
                </span>
              ))}
            </motion.div>
          </div>

          <div className="overclock-grid relative border-b-2 border-border bg-secondary-background p-7 sm:p-10">
            {/* Decorative Neobrutalist StarBurst Stickers */}
            <div className="pointer-events-none absolute right-8 top-8 hidden items-center gap-3 lg:flex">
              <span className="rotate-3 rounded-base border-2 border-border bg-[#A985FF] px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                BYO-AI ENGINE
              </span>
              <NeoStarBurst size={42} fill="#FFDC58" />
              <NeoStarBurst size={28} fill="#05E17A" />
            </div>

            <div className="max-w-4xl space-y-5">
              <Badge variant="cyan" className="px-3.5 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Private On-Device SQLite · Zero Cloud Lock-In · Bring Your Own AI
              </Badge>

              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-[1.14]">
                Turn Your Existing Resume Into{' '}
                <span className="mt-1 inline-block rounded-base border-2 border-border bg-[#FFDC58] px-2.5 py-0.5 text-foreground shadow-[3px_3px_0px_0px_var(--border)]">
                  Parallel, Gamified Career Roadmaps
                </span>
              </h1>

              <p className="max-w-3xl text-sm sm:text-base leading-relaxed text-muted-foreground">
                CareerForge analyzes your background to architect independent multi-phase growth
                streams, caches roadmap nodes and deep-dive study guides in local memory for instant
                0ms reuse, evaluates your hands-on practice solutions against weighted rubrics, and
                rewards daily mastery—
                <strong className="font-heading font-bold text-foreground">
                  100% stored locally in SQLite
                </strong>{' '}
                on your machine (
                <code className="rounded-[4px] border-2 border-border bg-background px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">
                  {status.dbPath}
                </code>
                ).
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={() =>
                    mandatorySetupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  <Zap className="h-4 w-4" />
                  {status.hasActiveProvider
                    ? 'Review AI Engine Configuration'
                    : 'Connect Your AI Engine Below'}
                </Button>

                {status.hasActiveProvider && (
                  <Button
                    type="button"
                    variant="mint"
                    size="lg"
                    disabled={completing}
                    onClick={() => void handleCompleteLaunch()}
                  >
                    {completing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Launch CareerForge Now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 4 Persuasive Feature Pillars */}
          <div className="border-b-2 border-border bg-background p-7 sm:p-10">
            <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURE_PILLARS.map(({ title, description, badge, headerBg, Icon }) => (
                <StaggerItem key={title} className="h-full">
                  <div className="neo-card-lift flex h-full flex-col overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-shadow">
                    <div
                      className={cn(
                        'flex items-center justify-between gap-2 border-b-2 border-border px-4 py-3',
                        headerBg
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-base border-2 border-border bg-secondary-background text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                        <Icon className="h-4 w-4 stroke-[2.5]" />
                      </div>
                      <Badge variant="neutral" className="text-[10px] uppercase tracking-wider">
                        {badge}
                      </Badge>
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <h3 className="font-heading text-base font-bold leading-snug text-foreground">
                          {title}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>

          {/* Helpful "Which AI Provider Should I Connect?" Quick Tips Banner */}
          <div className="bg-secondary-background p-6 sm:px-10 sm:py-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                <NeoStarBurst size={22} fill="#22D3EE" />
                Which AI Provider Should I Connect? (Pick Any One or Combine Multiple)
              </div>
              {status.codexCliInstalled && (
                <Badge variant="mint" className="text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Codex CLI installed
                </Badge>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="neo-card-lift rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                <div className="flex items-center gap-2 font-heading text-xs font-bold text-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                  </span>
                  ChatGPT Plus / Pro Codex Subscription
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Run <code>codex login</code> on the machine running CareerForge and sign in
                  with ChatGPT to use your Codex subscription.
                </p>
              </div>

              <div className="neo-card-lift rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                <div className="flex items-center gap-2 font-heading text-xs font-bold text-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#22D3EE] text-foreground">
                    <Server className="h-3.5 w-3.5" />
                  </span>
                  100% Free Offline Ollama
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Want zero cloud traffic and $0 cost? Point CareerForge at your local Ollama server
                  (
                  <code className="rounded-[4px] border border-border bg-secondary-background px-1 py-0.5 font-mono text-[11px] font-bold text-foreground">
                    localhost:11434
                  </code>
                  ) with Qwen, Llama, or DeepSeek models.
                </p>
              </div>

              <div className="neo-card-lift rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                <div className="flex items-center gap-2 font-heading text-xs font-bold text-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-foreground">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  OpenAI / Anthropic / OpenRouter Keys
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Plug in API keys for GPT-4.1, o4-mini, Claude Sonnet 4.5, or OpenRouter—and let
                  TypeSafe Jev route simple vs. deep-reasoning tasks automatically.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Optional Quick Identity Personalization Card */}
        <Card className="overflow-hidden py-0 gap-0">
          <CardHeader className="border-b-2 border-border bg-background py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge variant="neutral" className="text-[10px] uppercase tracking-wider">
                    Step 1 · Optional
                  </Badge>
                  <span className="inline-flex items-center gap-1 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    <User className="h-3.5 w-3.5 stroke-[2.5]" />
                    Quick Identity Personalization
                  </span>
                </div>
                <CardTitle className="mt-2 text-xl">
                  Customize Your Forger Profile
                </CardTitle>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Personalize how you appear in your Career Streams command center and Gamification
                  Vault. You can update this anytime in settings.
                </p>
              </div>

              {/* Live Identity Preview Pill */}
              <div className="flex items-center gap-3.5 rounded-base border-2 border-border bg-secondary-background px-4 py-3 shadow-shadow">
                <motion.div
                  key={`${avatarIcon}-${avatarColor}`}
                  initial={{ scale: 0.85, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={NEO_SPRING}
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-base border-2 border-border shadow-[2px_2px_0px_0px_var(--border)]',
                    colorStyle.avatarBox
                  )}
                >
                  <SelectedAvatarIcon className="h-6 w-6 stroke-[2.25]" />
                </motion.div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-heading text-sm font-bold text-foreground">
                      {displayName.trim() || 'Career Forger'}
                    </span>
                    <Badge variant={colorStyle.badgeVariant} className="text-[10px]">
                      Lvl {profile.globalLevel} · {profile.rankTitle}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {headlineTitle.trim() || 'Builder & Continuous Learner'}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Display Name
                  </label>
                  <Input
                    type="text"
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Career Headline
                  </label>
                  <Input
                    type="text"
                    maxLength={90}
                    value={headlineTitle}
                    onChange={(e) => setHeadlineTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer → Staff Systems Architect"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Avatar Emblem
                  </label>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-4">
                    {AVATAR_ICON_OPTIONS.map((opt) => {
                      const IconComp = AVATAR_ICON_MAP[opt.id];
                      const isSelected = avatarIcon === opt.id;
                      return (
                        <motion.button
                          key={opt.id}
                          type="button"
                          whileHover={{ scale: 1.04, y: -2 }}
                          whileTap={{ scale: 0.94, y: 1 }}
                          transition={NEO_SPRING}
                          onClick={() => setAvatarIcon(opt.id)}
                          className={cn(
                            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-base border-2 border-border px-2.5 py-2 font-heading text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black',
                            isSelected
                              ? colorStyle.activeChip
                              : 'bg-background text-muted-foreground hover:bg-secondary-background hover:text-foreground'
                          )}
                        >
                          <IconComp className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Avatar Accent
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_COLOR_OPTIONS.map((color) => {
                      const cStyle = AVATAR_COLOR_STYLES[color];
                      const isSelected = avatarColor === color;
                      return (
                        <motion.button
                          key={color}
                          type="button"
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.94, y: 1 }}
                          transition={NEO_SPRING}
                          onClick={() => setAvatarColor(color)}
                          className={cn(
                            'inline-flex cursor-pointer items-center gap-2 rounded-base border-2 border-border px-3 py-1.5 font-heading text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black',
                            isSelected
                              ? cStyle.activeChip
                              : 'bg-background text-muted-foreground hover:bg-secondary-background hover:text-foreground'
                          )}
                        >
                          <span
                            className={cn(
                              'h-3 w-3 rounded-[3px] border border-border',
                              cStyle.swatch
                            )}
                          />
                          {cStyle.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Mandatory Step — AI Engine & TypeSafe Jev Setup */}
        <section ref={mandatorySetupRef} className="space-y-5">
          <div
            className={cn(
              'rounded-base border-2 border-border p-5 sm:p-6 shadow-shadow transition-colors',
              status.hasActiveProvider ? 'bg-[#05E17A]/30' : 'bg-[#FFDC58]/60'
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge
                    variant={status.hasActiveProvider ? 'mint' : 'dark'}
                    className="text-[10px] uppercase tracking-wider"
                  >
                    Step 2 · Mandatory Setup Step
                  </Badge>
                  <span className="font-heading text-xs font-bold text-foreground">
                    Required before entering CareerForge
                  </span>
                </div>
                <h2 className="mt-2 font-heading text-xl font-bold text-foreground">
                  Connect Your AI Engine &amp; TypeSafe Jev Router
                </h2>
                <p className="mt-1 max-w-3xl text-xs sm:text-sm text-foreground/85">
                  Enable at least one AI provider below to power resume analysis, curriculum
                  generation, and rubric evaluations. TypeSafe Jev routing is optional—when omitted,
                  CareerForge uses built-in autonomous model routing.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-base border-2 border-border bg-secondary-background px-4 py-2.5 font-heading text-xs font-bold text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                {status.hasActiveProvider ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 stroke-[2.5] text-foreground" />
                    Mandatory Requirement Met ({status.activeProviderCount} Active)
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 stroke-[2.5] text-foreground" />
                    Locked — Connect &amp; Enable 1+ Provider
                  </>
                )}
              </div>
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
            onGoToResume={handleProviderContinue}
          />
        </section>

        {/* 4. Locked / Unlocked Entry Gate CTA Bar */}
        <motion.div
          ref={launchGateRef}
          layout
          transition={NEO_GENTLE_SPRING}
          className="sticky bottom-4 z-30 rounded-base border-2 border-border bg-secondary-background p-4 sm:p-5 shadow-brutal-lg"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start sm:items-center gap-3.5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={status.hasActiveProvider ? 'unlocked' : 'locked'}
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0.8, rotate: 10 }}
                  transition={NEO_SPRING}
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-base border-2 border-border text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
                    status.hasActiveProvider ? 'bg-[#05E17A]' : 'bg-[#FFDC58]'
                  )}
                >
                  {status.hasActiveProvider ? (
                    <Unlock className="h-5 w-5 stroke-[2.5]" />
                  ) : (
                    <Lock className="h-5 w-5 stroke-[2.5]" />
                  )}
                </motion.div>
              </AnimatePresence>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-sm sm:text-base font-bold text-foreground">
                    {status.hasActiveProvider
                      ? 'Setup Complete — Ready to Launch CareerForge!'
                      : 'Entry Gate Locked'}
                  </span>
                  <Badge
                    variant={status.hasActiveProvider ? 'mint' : 'neutral'}
                    className="text-[10px] uppercase tracking-wider"
                  >
                    {status.hasActiveProvider
                      ? `${status.activeProviderCount} Active Provider${status.activeProviderCount === 1 ? '' : 's'}`
                      : '0 Active Providers'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {status.hasActiveProvider
                    ? `Launching as ${displayName.trim() || 'Career Forger'} (${headlineTitle.trim() || 'Builder & Continuous Learner'}). Your workspace is saved locally in SQLite.`
                    : 'Connect and enable at least one AI provider above to unlock CareerForge.'}
                </p>

                <AnimatePresence>
                  {launchError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={NEO_GENTLE_SPRING}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-base border-2 border-border bg-[#FF6B6B] px-3 py-1 font-heading text-xs font-bold text-foreground shadow-[2px_2px_0px_0px_var(--border)]"
                    >
                      <AlertCircle className="h-3.5 w-3.5 stroke-[2.5]" />
                      {launchError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {status.hasActiveProvider ? (
              <Button
                type="button"
                variant="mint"
                size="lg"
                disabled={completing}
                onClick={() => void handleCompleteLaunch()}
                className="shrink-0"
              >
                {completing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching CareerForge...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Complete Setup &amp; Launch CareerForge
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" variant="neutral" size="lg" disabled className="shrink-0">
                <Lock className="h-4 w-4" />
                Complete Setup &amp; Launch CareerForge
              </Button>
            )}
          </div>
        </motion.div>
      </PageTransition>
    </div>
  );
};
