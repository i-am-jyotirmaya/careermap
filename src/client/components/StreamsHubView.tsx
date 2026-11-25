import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Swords,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { NeoSelect } from '@/components/ui/motion-primitives';
import { cn } from '@/lib/utils';
import { api } from '../lib/api.ts';
import { getNextTopic } from '../../shared/learningFlow.ts';
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
  onGoToSetup: () => void;
  compactCards?: boolean;
}

const TEMPLATES = [
  {
    title: 'Distributed systems',
    role: 'Staff Distributed Systems Architect',
    focus:
      'Consensus protocols, replication, event streaming, backpressure, capacity modeling and architecture RFCs.',
  },
  {
    title: 'AI engineering',
    role: 'Staff AI Systems & Agent Engineer',
    focus:
      'Tool-using LLMs, evaluation, memory, retrieval, cost and latency, structured outputs and production reliability.',
  },
  {
    title: 'Engineering leadership',
    role: 'Engineering Manager / Principal Tech Lead',
    focus:
      'Technical strategy, cross-team execution, architecture reviews, incident command, mentoring and stakeholder alignment.',
  },
];

const STREAM_COLORS: Record<CareerStream['colorTheme'], string> = {
  indigo: 'bg-[#88AAEE]',
  emerald: 'bg-[#05E17A]',
  amber: 'bg-[#FFDC58]',
  rose: 'bg-[#FF6B6B]',
  cyan: 'bg-[#22D3EE]',
  violet: 'bg-[#A985FF]',
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
  onGoToSetup,
  compactCards = false,
}) => {
  const activeStream =
    streams.find((s) => s.id === selectedStreamId) ??
    streams.find((s) => s.status === 'active') ??
    streams[0];
  const nextTopic = activeStream ? getNextTopic(activeStream) : undefined;
  const [creating, setCreating] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [role, setRole] = useState('');
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [theme, setTheme] = useState<CareerStream['colorTheme']>('cyan');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLElement | null>(null);

  function openCreator(template?: (typeof TEMPLATES)[number]) {
    setRole(template?.role ?? '');
    setTitle(template?.title ?? '');
    setFocus(template?.focus ?? '');
    setShowCreate(true);
    setError(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'nearest' }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim() || !hasActiveProvider) return;
    setCreating(true);
    setError(null);
    try {
      const result = await api.launchStream({
        customStreamInput: {
          title: title.trim() || role.trim(),
          targetRole: role.trim(),
          focusDescription:
            focus.trim() ||
            `Develop the knowledge and practical skills required for ${role.trim()}.`,
          colorTheme: theme,
        },
      });
      onGamificationDelta(result.gamificationDelta);
      await onRefreshAll();
      onSelectStream(result.stream.id);
      setShowCreate(false);
      setShowAddOptions(false);
      setRole('');
      setTitle('');
      setFocus('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create this roadmap. Please try again.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function manage(action: 'pause' | 'refresh' | 'delete', stream: CareerStream) {
    if (
      action === 'delete' &&
      !window.confirm(`Delete “${stream.title}” and its learning progress? This cannot be undone.`)
    )
      return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (action === 'delete') await api.deleteStream(stream.id);
      else if (action === 'pause')
        await api.updateStreamStatus(stream.id, stream.status === 'active' ? 'paused' : 'active');
      else {
        const res = await api.refreshStreamNodes(stream.id);
        setMessage(res.consistencyNote);
      }
      await onRefreshAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update this roadmap. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">My career roadmaps</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {streams.length
              ? 'Pick a roadmap and keep building your skills, one topic at a time.'
              : 'Choose where you want to go. We’ll help you turn that goal into a learning plan.'}
          </p>
        </div>
        {streams.length > 0 && (
          <Button
            onClick={() => { setShowAddOptions((v) => !v); setShowCreate(false); }}
            aria-expanded={showAddOptions}
            disabled={creating}
          >
            <Plus className="size-4" /> New roadmap
          </Button>
        )}
      </header>
      {!hasActiveProvider && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-base border-2 border-border bg-[#FFDC58]/40 p-4">
          <p className="text-sm">
            Connect an AI provider to create or refresh learning content. Your saved roadmaps are
            still available.
          </p>
          <Button variant="neutral" size="sm" onClick={onGoToSetup}>
            Connect AI
          </Button>
        </div>
      )}

      {(streams.length === 0 || showAddOptions) && (
        <Card className="p-5 sm:p-6">
          <h2 className="font-heading text-xl font-bold">
            {streams.length ? 'Add another roadmap' : 'Create your first roadmap'}
          </h2>
          <div className="mt-1 grid gap-4 sm:grid-cols-2">
            <div className="rounded-base border-2 border-border bg-main/20 p-4">
              <div className="flex items-center gap-2 font-heading font-bold">
                <FileText className="size-5" /> Start with your resume
              </div>
              <p className="my-3 text-sm text-muted-foreground">
                Get suggested career paths based on your experience and goals.
              </p>
              <Button onClick={onGoToResume} disabled={creating} className="w-full">
                Upload resume <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="rounded-base border-2 border-border bg-secondary-background p-4">
              <div className="flex items-center gap-2 font-heading font-bold">
                <Plus className="size-5" /> I know my goal
              </div>
              <p className="my-3 text-sm text-muted-foreground">
                Create a roadmap for a role or skill you already want to pursue.
              </p>
              <Button variant="neutral" onClick={() => openCreator()} disabled={creating} className="w-full">
                Enter a goal
              </Button>
            </div>
          </div>
          <div className="border-t-2 border-border pt-4">
            <p className="mb-2 text-sm font-heading font-bold">Or try a starting point</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((template) => (
                <Button
                  key={template.title}
                  size="sm"
                  variant="neutral"
                  onClick={() => openCreator(template)}
                  disabled={creating}
                >
                  {template.title}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showCreate && (
        <section
          ref={formRef}
          className="rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow sm:p-6"
          aria-label="Create a roadmap"
        >
          <h2 className="text-xl font-heading font-bold">What do you want to learn?</h2>
          <form onSubmit={create} className="mt-4 space-y-4">
            <div>
              <label htmlFor="roadmap-role" className="block font-heading text-sm font-bold">
                Target role or skill
              </label>
              <Input
                id="roadmap-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                placeholder="e.g. Staff .NET engineer"
                className="mt-2"
              />
            </div>
            <div>
              <label htmlFor="roadmap-focus" className="block font-heading text-sm font-bold">
                Focus areas (optional)
              </label>
              <Textarea
                id="roadmap-focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                rows={3}
                placeholder="What would you like to get better at?"
                className="mt-2"
              />
            </div>
            <details className="rounded-base border border-border p-3">
              <summary className="cursor-pointer font-heading text-sm font-bold">
                Customize title and color
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="roadmap-title" className="block text-sm font-bold">
                    Title
                  </label>
                  <Input
                    id="roadmap-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Uses your goal by default"
                  />
                </div>
                <div>
                  <label htmlFor="roadmap-color" className="block text-sm font-bold">
                    Color
                  </label>
                  <NeoSelect
                    id="roadmap-color"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as CareerStream['colorTheme'])}
                    className="w-full"
                  >
                    {['cyan', 'indigo', 'emerald', 'amber', 'rose', 'violet'].map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </NeoSelect>
                </div>
              </div>
            </details>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="neutral"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !role.trim() || !hasActiveProvider}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                {creating ? 'Creating roadmap…' : 'Create roadmap'}
              </Button>
            </div>
          </form>
        </section>
      )}
      {error && (
        <p role="alert" className="rounded-base border-2 border-border bg-[#FF6B6B]/30 p-4 text-sm">
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-base border-2 border-border bg-[#05E17A]/20 p-4 text-sm"
        >
          {message}
        </p>
      )}

      {activeStream && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <aside className="space-y-3" aria-label="Your roadmaps">
            <h2 className="font-heading text-sm font-bold">Your roadmaps ({streams.length})</h2>
            <NeoSelect
              aria-label="Select roadmap"
              value={activeStream.id}
              onChange={(e) => {
                onSelectStream(e.target.value);
                setError(null);
                setMessage(null);
              }}
              className="w-full lg:hidden"
            >
              {streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.title}
                </option>
              ))}
            </NeoSelect>
            <div className="hidden gap-2 lg:grid lg:grid-cols-1">
              {streams.map((stream) => (
                <button
                  key={stream.id}
                  type="button"
                  aria-pressed={activeStream.id === stream.id}
                  onClick={() => {
                    onSelectStream(stream.id);
                    setMessage(null);
                    setError(null);
                  }}
                  className={cn(
                    'min-w-0 rounded-base border-2 border-border p-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    activeStream.id === stream.id
                      ? 'bg-main shadow-brutal-sm'
                      : 'bg-secondary-background hover:bg-background',
                  )}
                >
                  <span className="flex items-start gap-2 break-words font-heading font-bold">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1 size-3 shrink-0 rounded-base border border-border',
                        STREAM_COLORS[stream.colorTheme],
                      )}
                    />
                    {stream.title}
                  </span>
                  <div className="mt-2 flex justify-between gap-2 text-xs">
                    <span>{stream.status === 'paused' ? 'Paused' : `Level ${stream.level}`}</span>
                    <span>{stream.masteryPercent}% mastery</span>
                  </div>
                  {!compactCards && <Progress value={stream.masteryPercent} className="mt-2 h-2" />}
                </button>
              ))}
            </div>
            <Button variant="neutral" size="sm" className="w-full" onClick={onGoToResume}>
              <FileText className="size-4" /> Resume &amp; suggestions
            </Button>
          </aside>
          <section className="min-w-0 space-y-4" aria-label="Selected roadmap">
            <Card className="gap-0 overflow-hidden p-0">
              <div
                className={cn(
                  'border-b-2 border-border p-5',
                  STREAM_COLORS[activeStream.colorTheme],
                )}
              >
                <p className="text-xs font-heading font-bold uppercase tracking-wide">
                  {activeStream.status === 'paused' ? 'Paused roadmap' : 'Current roadmap'}
                </p>
                <h2 className="mt-1 break-words text-2xl font-heading font-bold">
                  {activeStream.title}
                </h2>
                <p className="mt-1 text-sm">{activeStream.targetRole}</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold">{activeStream.masteryPercent}% mastery</span>
                  <span className="text-muted-foreground">
                    {activeStream.resourcesCompleted} resources · {activeStream.problemsSolved}{' '}
                    challenges
                  </span>
                </div>
                <Progress value={activeStream.masteryPercent} />
                {nextTopic ? (
                  <div className="rounded-base border-2 border-border bg-background p-4">
                    <p className="font-heading text-xs font-bold uppercase tracking-wide">
                      Next up
                    </p>
                    <h3 className="mt-1 text-xl font-heading font-bold">{nextTopic.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{nextTopic.summary}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button onClick={() => onOpenTopic(nextTopic)}>
                        {nextTopic.status === 'in_progress'
                          ? 'Continue learning'
                          : 'Start learning'}{' '}
                        <ArrowRight className="size-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {nextTopic.estimatedHours}h estimated
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-base border-2 border-border bg-[#05E17A]/20 p-4">
                    <p className="flex items-center gap-2 font-heading font-bold">
                      <CheckCircle2 className="size-5" /> All topics mastered
                    </p>
                    <p className="mt-1 text-sm">Review your roadmap below or add another one.</p>
                  </div>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer font-heading font-bold">
                    Manage roadmap
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="neutral"
                      disabled={busy || !hasActiveProvider}
                      onClick={() => void manage('refresh', activeStream)}
                    >
                      <RefreshCw className="size-4" /> Refresh topics
                    </Button>
                    <Button
                      size="sm"
                      variant="neutral"
                      disabled={busy}
                      onClick={() => void manage('pause', activeStream)}
                    >
                      {activeStream.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void manage('delete', activeStream)}
                    >
                      <Trash2 className="size-4" /> Delete roadmap
                    </Button>
                  </div>
                </details>
              </div>
            </Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-heading font-bold">All topics</h2>
              <span className="text-xs text-muted-foreground">
                {activeStream.phases.length} phases
              </span>
            </div>
            {activeStream.phases.map((phase) => (
              <details
                key={`${activeStream.id}-${phase.id}`}
                open={phase.topics.some((topic) => topic.id === nextTopic?.id)}
                className="group overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Phase {phase.phaseOrder} ·{' '}
                      {phase.topics.filter((t) => t.status === 'mastered').length}/
                      {phase.topics.length} mastered
                    </p>
                    <h3 className="break-words font-heading font-bold">{phase.title}</h3>
                  </div>
                  <ChevronDown className="size-5 shrink-0 group-open:rotate-180" />
                </summary>
                <div className="border-t border-border">
                  <p className="px-4 py-3 text-sm text-muted-foreground">{phase.objective}</p>
                  {phase.topics.map((topic) => (
                    <button
                      type="button"
                      key={topic.id}
                      onClick={() => onOpenTopic(topic)}
                      className="flex w-full items-center justify-between gap-3 border-t border-border/30 px-4 py-3 text-left hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-heading text-sm font-bold">
                          {topic.title}{' '}
                          {topic.isBossTopic && (
                            <Badge variant="yellow" className="ml-1">
                              Capstone
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {topic.estimatedHours}h · {topic.difficulty}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="size-3" /> {topic.completedResourceCount}/
                            {topic.resourceCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Swords className="size-3" /> {topic.solvedProblemCount}/
                            {topic.problemCount}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-bold">
                        {topic.status === 'mastered' ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          `${topic.masteryScore}%`
                        )}
                        <ArrowRight className="size-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </section>
        </div>
      )}
    </div>
  );
};
