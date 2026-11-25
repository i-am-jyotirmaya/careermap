import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Crown,
  Database,
  FileText,
  Flame,
  Layers,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Swords,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NEO_SPRING,
  NeoSelect,
  NeoStarBurst,
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/motion-primitives';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '../lib/api.ts';
import type { CareerStream, GamificationDelta, StreamTopic } from '../../shared/types.ts';

interface Props {
  hasActiveProvider: boolean;
  streams: CareerStream[];
  selectedStreamId: string | null;
  onSelectStream: (streamId: string) => void;
  onOpenTopic: (topic: StreamTopic) => void;
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  onGoToResume: () => void;
  compactCards?: boolean;
}

interface QuickStartTemplate {
  title: string;
  targetRole: string;
  colorTheme: CareerStream['colorTheme'];
  badge: string;
  focusDescription: string;
}

const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    title: 'Staff Distributed Systems Architect',
    targetRole: 'Staff Distributed Systems Architect',
    colorTheme: 'indigo',
    badge: 'Systems & Scale',
    focusDescription:
      'Consensus protocols, multi-region replication, high-throughput event streaming, backpressure and tail-latency resilience, capacity modeling, and staff-level architecture RFCs.',
  },
  {
    title: 'Production Agentic AI Engineer',
    targetRole: 'Staff AI Systems & Agent Engineer',
    colorTheme: 'emerald',
    badge: 'AI Engineering',
    focusDescription:
      'Tool-using LLM orchestration, deterministic evaluation harnesses, memory and retrieval architectures, cost/latency routing guardrails, structured outputs, and production reliability.',
  },
  {
    title: 'Engineering Leadership & Tech Lead',
    targetRole: 'Engineering Manager / Principal Tech Lead',
    colorTheme: 'amber',
    badge: 'Leadership Track',
    focusDescription:
      'Technical strategy and multi-quarter roadmapping, cross-team execution, architecture review governance, incident command, mentoring senior engineers, and stakeholder alignment.',
  },
];

const STREAM_ACCENT: Record<
  CareerStream['colorTheme'],
  { banner: string; tint: string; pill: string }
> = {
  indigo: {
    banner: 'bg-[#88AAEE]',
    tint: 'bg-[#88AAEE]/18',
    pill: 'bg-[#88AAEE] text-black',
  },
  emerald: {
    banner: 'bg-[#05E17A]',
    tint: 'bg-[#05E17A]/18',
    pill: 'bg-[#05E17A] text-black',
  },
  amber: {
    banner: 'bg-[#FFDC58]',
    tint: 'bg-[#FFDC58]/24',
    pill: 'bg-[#FFDC58] text-black',
  },
  rose: {
    banner: 'bg-[#FF6B6B]',
    tint: 'bg-[#FF6B6B]/18',
    pill: 'bg-[#FF6B6B] text-black',
  },
  cyan: {
    banner: 'bg-[#22D3EE]',
    tint: 'bg-[#22D3EE]/18',
    pill: 'bg-[#22D3EE] text-black',
  },
  violet: {
    banner: 'bg-[#A985FF]',
    tint: 'bg-[#A985FF]/18',
    pill: 'bg-[#A985FF] text-black',
  },
};

export const StreamsHubView: React.FC<Props> = ({
  hasActiveProvider,
  streams,
  selectedStreamId,
  onSelectStream,
  onOpenTopic,
  onRefreshAll,
  onGamificationDelta,
  onGoToResume,
  compactCards = false,
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customTheme, setCustomTheme] = useState<CareerStream['colorTheme']>('cyan');
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [refreshingNodes, setRefreshingNodes] = useState(false);
  const [streamConsistencyNote, setStreamConsistencyNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const customFormRef = useRef<HTMLFormElement | null>(null);

  const activeStream =
    streams.find((s) => s.id === selectedStreamId) ?? streams[0] ?? null;

  const activeStreamsCount = streams.filter((s) => s.status === 'active').length;
  const averageMasteryPercent =
    streams.length > 0
      ? Math.round(streams.reduce((sum, s) => sum + s.masteryPercent, 0) / streams.length)
      : 0;
  const totalChallengesSolved = streams.reduce((sum, s) => sum + s.problemsSolved, 0);
  const totalResourcesCompleted = streams.reduce((sum, s) => sum + s.resourcesCompleted, 0);

  const handleApplyTemplate = (tpl: QuickStartTemplate) => {
    setCustomTitle(tpl.title);
    setCustomRole(tpl.targetRole);
    setCustomDesc(tpl.focusDescription);
    setCustomTheme(tpl.colorTheme);
    setErrorMsg(null);
    setShowCustomModal(true);
    setTimeout(() => {
      customFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasActiveProvider) {
      setErrorMsg('Configure at least one AI provider first.');
      return;
    }
    setCreatingCustom(true);
    setErrorMsg(null);
    try {
      const res = await api.launchStream({
        customStreamInput: {
          title: customTitle,
          targetRole: customRole,
          focusDescription: customDesc,
          colorTheme: customTheme,
        },
      });
      onGamificationDelta(res.gamificationDelta);
      setCustomTitle('');
      setCustomRole('');
      setCustomDesc('');
      setShowCustomModal(false);
      await onRefreshAll();
      onSelectStream(res.stream.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create stream');
    } finally {
      setCreatingCustom(false);
    }
  };

  const handleTogglePause = async (stream: CareerStream) => {
    const next = stream.status === 'active' ? 'paused' : 'active';
    await api.updateStreamStatus(stream.id, next);
    await onRefreshAll();
  };

  const handleDelete = async (stream: CareerStream) => {
    await api.deleteStream(stream.id);
    await onRefreshAll();
  };

  const handleRefreshStreamNodes = async (stream: CareerStream) => {
    setRefreshingNodes(true);
    setStreamConsistencyNote(null);
    setErrorMsg(null);
    try {
      const res = await api.refreshStreamNodes(stream.id);
      setStreamConsistencyNote(res.consistencyNote);
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to refresh roadmap nodes');
    } finally {
      setRefreshingNodes(false);
    }
  };

  return (
    <PageTransition className="space-y-8 text-foreground">
      {/* Command Center Hero Header */}
      <Card className="overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-brutal-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-[#FFDC58] px-6 py-3">
          <div className="inline-flex items-center gap-2 font-heading text-xs font-black uppercase tracking-wider text-black">
            <Layers className="h-4 w-4" />
            Independent Multi-Stream Command Center
          </div>
          <Badge variant="neutral" className="text-[11px]">
            1.25x Polymath Combo Ready
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-5 p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                Your Parallel Career Growth Streams ({streams.length})
              </h1>
              <NeoStarBurst size={26} fill="#FFDC58" className="hidden sm:block" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Each stream tracks its own Level, XP, Mastery %, learning library, and practice
              evaluations independently. Earn XP in 2+ streams on the same day for a{' '}
              <span className="inline-block rounded-base border-2 border-border bg-[#FFDC58] px-1.5 py-0.5 font-heading text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                1.25x Polymath Combo Bonus
              </span>
              !
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="neutral" onClick={onGoToResume}>
              <FileText className="h-4 w-4" />
              + Launch from Resume Roadmaps
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => setShowCustomModal((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              New Custom Stream
            </Button>
          </div>
        </div>
      </Card>

      {/* Dashboard KPI Summary Row */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <div className="neo-card-lift rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Streams
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-base border-2 border-border bg-[#88AAEE] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-black text-foreground">
                {activeStreamsCount}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {streams.length > 0 ? `of ${streams.length} total` : 'ready to launch'}
              </span>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="neo-card-lift rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Average Mastery %
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-black text-foreground">
                {averageMasteryPercent}%
              </span>
              <span className="text-xs font-medium text-muted-foreground">across streams</span>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="neo-card-lift rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Challenges Solved
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                <Swords className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-black text-foreground">
                {totalChallengesSolved}
              </span>
              <span className="text-xs font-medium text-muted-foreground">rubric-verified</span>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="neo-card-lift rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Resources Completed
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-base border-2 border-border bg-[#A985FF] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-heading text-3xl font-black text-foreground">
                {totalResourcesCompleted}
              </span>
              <span className="text-xs font-medium text-muted-foreground">guides &amp; packs</span>
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Custom Stream Creator Drawer */}
      <AnimatePresence initial={false}>
        {showCustomModal && (
          <motion.form
            key="custom-stream-drawer"
            ref={customFormRef}
            onSubmit={handleCreateCustom}
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={NEO_SPRING}
            className="overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-[#A985FF] px-6 py-4 text-black">
              <div>
                <h3 className="font-heading text-base font-black text-black">
                  Architect a Custom Independent Career Stream
                </h3>
                <p className="text-xs font-medium text-black/80">
                  Review or customize the details below, then click Generate Stream Curriculum.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="yellow" className="uppercase tracking-wider">
                  3-Phase Curriculum + Boss Capstone
                </Badge>
                <Button
                  type="button"
                  variant="neutral"
                  size="icon-sm"
                  onClick={() => setShowCustomModal(false)}
                  aria-label="Close custom stream drawer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Stream Title
                  </label>
                  <Input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Production Agentic AI Engineering"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Target Role
                  </label>
                  <Input
                    type="text"
                    required
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="e.g. Staff AI Systems Engineer"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Accent Theme
                  </label>
                  <NeoSelect
                    value={customTheme}
                    onChange={(e) =>
                      setCustomTheme(e.target.value as CareerStream['colorTheme'])
                    }
                    className="mt-1.5 w-full"
                  >
                    <option value="cyan">Cyan</option>
                    <option value="indigo">Indigo</option>
                    <option value="emerald">Emerald</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                    <option value="violet">Violet</option>
                  </NeoSelect>
                </div>
              </div>

              <div>
                <label className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                  Skills, Goals &amp; Focus Areas
                </label>
                <Textarea
                  rows={3}
                  required
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Describe what you want to master in this independent stream..."
                  className="mt-1.5"
                />
              </div>

              {errorMsg && (
                <div className="rounded-base border-2 border-border bg-[#FF6B6B] px-3.5 py-2.5 font-heading text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="neutral"
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="mint" disabled={creatingCustom}>
                  {creatingCustom ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Generate Stream Curriculum
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {streams.length === 0 ? (
        <Card className="overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-brutal-lg">
          <div className="border-b-2 border-border bg-background px-6 py-6 sm:px-8">
            <div className="max-w-2xl">
              <Badge variant="yellow" className="uppercase tracking-wider">
                <Compass className="h-3.5 w-3.5" />
                Welcome Dashboard Launchpad
              </Badge>
              <h2 className="mt-3 font-heading text-xl font-black text-foreground sm:text-2xl">
                Ignite Your First Career Growth Stream
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Choose how you want to start: analyze your existing resume for personalized career
                tracks, or pick a curated Quick-Start blueprint below to launch a stream right away.
              </p>
            </div>
          </div>

          <StaggerContainer className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
            {/* Card A: Upload Resume & Generate Personalized Roadmaps */}
            <StaggerItem className="h-full">
              <Card className="neo-card-lift flex h-full flex-col justify-between overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-shadow">
                <div>
                  <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-[#88AAEE] px-6 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-base border-2 border-border bg-secondary-background text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <Badge variant="yellow" className="uppercase tracking-wider">
                      Recommended Path
                    </Badge>
                  </div>

                  <div className="p-6">
                    <h3 className="font-heading text-lg font-black text-foreground">
                      Tailored From Your Existing Resume
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      Upload a PDF, DOCX, Markdown, or plain-text resume. CareerForge extracts your
                      skill superpowers and growth gaps, then precomputes multi-phase roadmaps
                      cached in local memory for instant stream activation.
                    </p>

                    <ul className="mt-5 space-y-2.5 text-xs font-medium text-foreground">
                      <li className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-black">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                        Skill gap diagnosis &amp; role-fit scoring
                      </li>
                      <li className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-black">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                        Vertical, leadership, and specialist frontier tracks
                      </li>
                      <li className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-black">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                        Precomputed topic nodes cached locally in SQLite
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-t-2 border-border bg-background p-6">
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    onClick={onGoToResume}
                    className="w-full text-xs sm:text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    Upload Resume &amp; Generate Personalized Roadmaps
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </StaggerItem>

            {/* Card B: Launch a Quick-Start Stream Template */}
            <StaggerItem className="h-full">
              <Card className="neo-card-lift flex h-full flex-col justify-between overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-shadow">
                <div>
                  <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-[#05E17A] px-6 py-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-base border-2 border-border bg-secondary-background text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <Badge variant="neutral" className="uppercase tracking-wider">
                      Instant Blueprints
                    </Badge>
                  </div>

                  <div className="p-6">
                    <h3 className="font-heading text-lg font-black text-foreground">
                      Launch a Quick-Start Stream Template
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      No resume handy? Select a battle-tested starter blueprint below to
                      pre-populate the Custom Stream architect and generate your 3-phase curriculum
                      in one click.
                    </p>

                    <div className="mt-5 space-y-3">
                      {QUICK_START_TEMPLATES.map((tpl) => {
                        const accent = STREAM_ACCENT[tpl.colorTheme];
                        return (
                          <motion.button
                            key={tpl.title}
                            type="button"
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleApplyTemplate(tpl)}
                            className="neo-press group flex w-full cursor-pointer items-start justify-between gap-3 rounded-base border-2 border-border bg-background p-3.5 text-left shadow-shadow hover:bg-secondary-background"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-heading text-xs font-black text-foreground">
                                  {tpl.title}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-base border-2 border-border px-2 py-0.5 font-heading text-[10px] font-bold uppercase shadow-[1px_1px_0px_0px_var(--border)]',
                                    accent.pill
                                  )}
                                >
                                  {tpl.badge}
                                </span>
                              </div>
                              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                {tpl.focusDescription}
                              </p>
                            </div>
                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-base border-2 border-border bg-[#FFDC58] px-2.5 py-1 font-heading text-[10px] font-bold uppercase text-black shadow-[2px_2px_0px_0px_var(--border)]">
                              Use
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          </StaggerContainer>
        </Card>
      ) : (
        <>
          {/* Multi-Stream Comparison Cards */}
          <StaggerContainer
            className={
              compactCards
                ? 'grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid gap-5 md:grid-cols-2 xl:grid-cols-3'
            }
          >
            {streams.map((s) => {
              const selected = activeStream?.id === s.id;
              const style = STREAM_ACCENT[s.colorTheme];
              const xpPct = Math.min(
                100,
                Math.round((s.xp / Math.max(1, s.xpToNextLevel)) * 100)
              );

              return (
                <StaggerItem key={s.id} className="h-full">
                  <div
                    onClick={() => onSelectStream(s.id)}
                    className={cn(
                      'neo-card-lift flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-base border-2 border-border bg-secondary-background',
                      selected
                        ? 'shadow-brutal-lg ring-2 ring-black -translate-x-[2px] -translate-y-[2px]'
                        : 'shadow-shadow'
                    )}
                  >
                    {/* Top Neo-Pop Stream Accent Header */}
                    <div
                      className={cn(
                        'flex items-center justify-between gap-2 border-b-2 border-border text-black',
                        style.banner,
                        compactCards ? 'px-3.5 py-2' : 'px-5 py-3'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block rounded-base border-2 border-border bg-secondary-background px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                          Lvl {s.level} · {s.status}
                        </span>
                        {selected && (
                          <Badge
                            variant="dark"
                            className="px-1.5 py-0 text-[9px] uppercase tracking-wider"
                          >
                            Active
                          </Badge>
                        )}
                      </div>

                      <div className="rounded-base border-2 border-border bg-secondary-background px-2 py-0.5 text-right shadow-[2px_2px_0px_0px_var(--border)]">
                        <span
                          className={cn(
                            'font-heading font-black text-foreground',
                            compactCards ? 'text-xs' : 'text-sm'
                          )}
                        >
                          {s.masteryPercent}%
                        </span>
                        <span className="ml-1 font-heading text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          Mastery
                        </span>
                      </div>
                    </div>

                    <div className={cn('flex-1', compactCards ? 'p-3.5' : 'p-5')}>
                      <h3
                        className={cn(
                          'font-heading font-black text-foreground',
                          compactCards ? 'truncate text-sm' : 'text-base'
                        )}
                      >
                        {s.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                        Target: {s.targetRole}
                      </p>

                      {/* Independent Stream XP Bar */}
                      <div className={compactCards ? 'mt-3' : 'mt-4'}>
                        <div className="mb-1.5 flex justify-between font-mono text-[11px] font-bold text-foreground">
                          <span>
                            Stream XP: {s.xp} / {s.xpToNextLevel}
                          </span>
                          <span>{xpPct}%</span>
                        </div>
                        <Progress
                          value={xpPct}
                          className={compactCards ? 'h-3' : 'h-4'}
                          indicatorClassName={style.banner}
                        />
                      </div>

                      <div
                        className={cn(
                          'grid grid-cols-4 gap-1.5 border-t-2 border-border text-center',
                          compactCards ? 'mt-3 pt-2.5 text-[10px]' : 'mt-4 pt-3.5 text-[11px]'
                        )}
                      >
                        <div className="rounded-base border border-border/30 bg-background py-1">
                          <div className="font-heading font-black text-foreground">
                            {s.resourcesCompleted}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground">
                            Study
                          </div>
                        </div>
                        <div className="rounded-base border border-border/30 bg-background py-1">
                          <div className="font-heading font-black text-foreground">
                            {s.problemsSolved}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground">
                            Solved
                          </div>
                        </div>
                        <div className="rounded-base border border-border/30 bg-[#05E17A]/20 py-1">
                          <div className="font-heading font-black text-foreground">
                            {s.totalEvaluations > 0 ? `${s.avgScore}%` : '—'}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground">
                            Avg Eval
                          </div>
                        </div>
                        <div className="rounded-base border border-border/30 bg-[#FFDC58]/35 py-1">
                          <div className="inline-flex items-center justify-center gap-0.5 font-heading font-black text-foreground">
                            <Flame className="h-3 w-3 fill-[#FFDC58] text-black" />
                            {s.streakDays}d
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground">
                            Streak
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          {/* Selected Stream Detailed 3-Phase Roadmap */}
          {activeStream && (
            <motion.div
              key={activeStream.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={NEO_SPRING}
              className="overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg"
            >
              <div
                className={cn(
                  'flex flex-wrap items-start justify-between gap-4 border-b-2 border-border p-6',
                  STREAM_ACCENT[activeStream.colorTheme].tint
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="mint">
                      <Database className="h-3 w-3" />
                      Roadmap Nodes Cached in Memory (AI-Free Navigation)
                    </Badge>
                    <Badge
                      variant="neutral"
                      className={cn('uppercase', STREAM_ACCENT[activeStream.colorTheme].pill)}
                    >
                      Lvl {activeStream.level} · {activeStream.targetRole}
                    </Badge>
                  </div>
                  <h2 className="mt-2.5 font-heading text-2xl font-black text-foreground">
                    {activeStream.title}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {activeStream.description}
                  </p>
                  {streamConsistencyNote && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-base border-2 border-border bg-[#05E17A] px-3 py-1 font-heading text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {streamConsistencyNote}
                    </div>
                  )}
                  {errorMsg && !showCustomModal && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-base border-2 border-border bg-[#FF6B6B] px-3 py-1 font-heading text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                      {errorMsg}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleRefreshStreamNodes(activeStream)}
                    disabled={refreshingNodes}
                  >
                    {refreshingNodes ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Refresh Nodes on Demand
                  </Button>
                  <Button
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => handleTogglePause(activeStream)}
                  >
                    {activeStream.status === 'active' ? (
                      <>
                        <Pause className="h-3.5 w-3.5" /> Pause Stream
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Resume Stream
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(activeStream)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>

              <div className="space-y-6 p-6">
                {activeStream.phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="rounded-base border-2 border-border bg-background p-5 shadow-shadow"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b-2 border-border pb-3">
                      <div>
                        <Badge variant="violet" className="uppercase tracking-wider">
                          Phase {phase.phaseOrder}
                        </Badge>
                        <h3 className="mt-2 font-heading text-lg font-black text-foreground">
                          {phase.title}
                        </h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {phase.objective}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {phase.topics.map((topic) => {
                        const mastered = topic.status === 'mastered';
                        const inProg = topic.status === 'in_progress';
                        return (
                          <div
                            key={topic.id}
                            className={cn(
                              'neo-card-lift flex flex-col justify-between overflow-hidden rounded-base border-2 border-border shadow-shadow',
                              topic.isBossTopic
                                ? 'bg-[#FFDC58]/28'
                                : mastered
                                  ? 'bg-[#05E17A]/20'
                                  : inProg
                                    ? 'bg-[#88AAEE]/18'
                                    : 'bg-secondary-background'
                            )}
                          >
                            <div>
                              {/* Topic Status / Boss Strip */}
                              <div
                                className={cn(
                                  'flex items-center justify-between gap-2 border-b-2 border-border px-4 py-2 text-black',
                                  topic.isBossTopic
                                    ? 'bg-[#FFDC58]'
                                    : mastered
                                      ? 'bg-[#05E17A]'
                                      : inProg
                                        ? 'bg-[#88AAEE]'
                                        : 'bg-background'
                                )}
                              >
                                <span className="inline-flex items-center gap-1 font-heading text-[10px] font-black uppercase tracking-wider text-foreground">
                                  {topic.isBossTopic ? (
                                    <span className="inline-flex items-center gap-1 text-black">
                                      <Crown className="h-3.5 w-3.5" /> BOSS CAPSTONE
                                    </span>
                                  ) : (
                                    `${topic.difficulty} · ~${topic.estimatedHours}h`
                                  )}
                                </span>

                                {mastered ? (
                                  <Badge variant="mint" className="bg-secondary-background text-[10px]">
                                    <CheckCircle2 className="h-3 w-3" /> Mastered
                                  </Badge>
                                ) : (
                                  <span className="rounded-base border-2 border-border bg-secondary-background px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground shadow-[1px_1px_0px_0px_var(--border)]">
                                    {topic.masteryScore}%
                                  </span>
                                )}
                              </div>

                              <div className="p-4">
                                <h4 className="font-heading text-sm font-black text-foreground">
                                  {topic.title}
                                </h4>
                                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                  {topic.summary}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {topic.keySkills.slice(0, 4).map((sk, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded-base border border-border bg-secondary-background px-2 py-0.5 font-heading text-[10px] font-bold text-foreground shadow-[1px_1px_0px_0px_var(--border)]"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 border-t-2 border-border bg-secondary-background p-4">
                              <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <BookOpen className="h-3.5 w-3.5 text-foreground" />
                                  {topic.completedResourceCount}/{topic.resourceCount} Resources
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Swords className="h-3.5 w-3.5 text-foreground" />
                                  {topic.solvedProblemCount}/{topic.problemCount} Challenges
                                </span>
                              </div>

                              <Button
                                type="button"
                                variant={
                                  topic.isBossTopic ? 'yellow' : mastered ? 'mint' : 'default'
                                }
                                size="sm"
                                onClick={() => onOpenTopic(topic)}
                                className="w-full"
                              >
                                <Award className="h-3.5 w-3.5" />
                                Open Learning &amp; Practice Arena
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </PageTransition>
  );
};
