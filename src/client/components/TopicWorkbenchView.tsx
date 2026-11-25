import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Database,
  ExternalLink,
  GitBranch,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Swords,
  Terminal,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NEO_GENTLE_SPRING, NeoSelect } from '@/components/ui/motion-primitives';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '../lib/api.ts';
import { FlashcardDeck, MarkdownView } from './MarkdownView.tsx';
import { RoadmapFlowGraph } from './RoadmapFlowGraph.tsx';
import type {
  AppPreferences,
  CareerStream,
  GamificationDelta,
  LearningResource,
  PracticeProblem,
  ProblemArchetype,
  ProblemDifficulty,
  RoutingDecision,
  SolutionSubmission,
  StreamTopic,
} from '../../shared/types.ts';

interface Props {
  topicId: string;
  hasActiveProvider?: boolean;
  onGoToSetup?: () => void;
  onBackToStream: (streamId: string) => void;
  onSelectTopic?: (topicId: string) => void;
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  defaultShowRoadmapGraph?: boolean;
  defaultLanguageHint?: AppPreferences['defaultLanguageHint'];
  animationsEnabled?: boolean;
}

export const TopicWorkbenchView: React.FC<Props> = ({
  topicId,
  hasActiveProvider = true,
  onGoToSetup,
  onBackToStream,
  onSelectTopic,
  onRefreshAll,
  onGamificationDelta,
  defaultShowRoadmapGraph,
  defaultLanguageHint,
  animationsEnabled = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [fallbackTopicId, setFallbackTopicId] = useState<string | null>(null);
  const [showRoadmapGraph, setShowRoadmapGraph] = useState<boolean>(
    defaultShowRoadmapGraph ?? false
  );
  const loadSeqRef = useRef(0);
  const shouldAnimate = animationsEnabled !== false;

  const effectiveTopicId = fallbackTopicId ?? topicId;
  const [stream, setStream] = useState<CareerStream | null>(null);
  const [topic, setTopic] = useState<StreamTopic | null>(null);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [submissions, setSubmissions] = useState<SolutionSubmission[]>([]);

  const [subTab, setSubTab] = useState<'learn' | 'practice'>('learn');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  // Resource generation & custom resource
  const [focusNote, setFocusNote] = useState('');
  const [generatingRes, setGeneratingRes] = useState(false);
  const [servedFromMemory, setServedFromMemory] = useState(false);
  const [resourceConsistencyNote, setResourceConsistencyNote] = useState<string | null>(null);
  const [showCustomResForm, setShowCustomResForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  // Problem generation & solution workspace
  const [archetype, setArchetype] = useState<ProblemArchetype>('coding_implementation');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('standard');
  const [generatingProb, setGeneratingProb] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingEval, setSubmittingEval] = useState(false);
  const [askingCoach, setAskingCoach] = useState(false);
  const [coachReply, setCoachReply] = useState<string | null>(null);
  const [showExemplar, setShowExemplar] = useState(false);
  const [latestDecisionBanner, setLatestDecisionBanner] = useState<RoutingDecision | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadWorkspace = async (targetTopicId: string) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setErrorMsg(null);
    setResourceConsistencyNote(null);
    try {
      const ws = await api.getTopicWorkspace(targetTopicId);
      if (seq !== loadSeqRef.current) return;
      setStream(ws.stream);
      setTopic(ws.topic);
      setResources(ws.resources);
      setProblems(ws.problems);
      setSubmissions(ws.recentSubmissions);
      setServedFromMemory(Boolean(ws.servedFromMemory));
      setFocusNote(ws.lastResourceFocusNote ?? '');
      setDifficulty(ws.topic.isBossTopic ? 'boss' : 'standard');

      const firstRes = ws.resources.find((resource) => !resource.isCompleted) ?? ws.resources[0];
      setSelectedResourceId(firstRes ? firstRes.id : null);

      const firstProb = ws.problems.find((problem) => problem.draftSolution && problem.bestScore === null) ?? ws.problems[0];
      setSelectedProblemId(firstProb ? firstProb.id : null);
      setSolutionText(
        firstProb ? firstProb.draftSolution || firstProb.starterTemplate : ''
      );
      setCoachReply(null);
      setShowExemplar(false);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load topic workspace');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setFallbackTopicId(null);
  }, [topicId]);

  useEffect(() => {
    if (defaultShowRoadmapGraph !== undefined) {
      setShowRoadmapGraph(defaultShowRoadmapGraph);
    }
  }, [defaultShowRoadmapGraph]);

  useEffect(() => {
    void loadWorkspace(effectiveTopicId);
  }, [effectiveTopicId]);

  const activeResource =
    resources.find((r) => r.id === selectedResourceId) ?? resources[0] ?? null;

  const activeProblem =
    problems.find((p) => p.id === selectedProblemId) ?? problems[0] ?? null;

  const problemSubmissions = activeProblem
    ? submissions.filter((s) => s.problemId === activeProblem.id)
    : [];
  const latestSubmission = problemSubmissions[0] ?? null;

  const handleSelectProblem = (prob: PracticeProblem) => {
    setSelectedProblemId(prob.id);
    setSolutionText(prob.draftSolution || prob.starterTemplate);
    setCoachReply(null);
    setShowExemplar(false);
  };

  const handleGenerateResources = async (isRefresh = false) => {
    setGeneratingRes(true);
    setErrorMsg(null);
    setResourceConsistencyNote(null);
    try {
      const res = await api.generateTopicResources(effectiveTopicId, focusNote, isRefresh);
      setResources(res.resources);
      setTopic(res.topic);
      setStream(res.stream);
      setServedFromMemory(true);
      setResourceConsistencyNote(res.consistencyNote);
      if (res.routingDecision) {
        setLatestDecisionBanner(res.routingDecision);
      }
      if (res.resources.length > 0) {
        setSelectedResourceId((prev) => {
          if (prev && res.resources.some((r) => r.id === prev)) return prev;
          const guide = res.resources.find((r) => r.kind === 'generated_guide');
          return guide ? guide.id : res.resources[0]!.id;
        });
      }
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to prepare learning resources');
    } finally {
      setGeneratingRes(false);
    }
  };

  const handleToggleResourceComplete = async (resItem: LearningResource) => {
    try {
      const resp = await api.updateResource(resItem.id, {
        isCompleted: !resItem.isCompleted,
      });
      setResources(resp.resources);
      setTopic(resp.topic);
      setStream(resp.stream);
      onGamificationDelta(resp.gamificationDelta);
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update resource');
    }
  };

  const handleToggleBookmark = async (resItem: LearningResource) => {
    const resp = await api.updateResource(resItem.id, {
      isBookmarked: !resItem.isBookmarked,
    });
    setResources(resp.resources);
  };

  const handleAddCustomResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await api.addCustomResource(effectiveTopicId, {
      title: customTitle,
      url: customUrl,
      notes: customNotes,
    });
    setResources(resp.resources);
    setStream(resp.stream);
    setSelectedResourceId(resp.resource.id);
    setCustomTitle('');
    setCustomUrl('');
    setCustomNotes('');
    setShowCustomResForm(false);
    await onRefreshAll();
  };

  const handleGenerateProblem = async () => {
    setGeneratingProb(true);
    setErrorMsg(null);
    try {
      const resp = await api.generatePracticeProblem(effectiveTopicId, {
        archetype,
        difficulty,
      });
      setProblems(resp.problems);
      setTopic(resp.topic);
      setStream(resp.stream);
      setSelectedProblemId(resp.problem.id);
      setSolutionText(resp.problem.starterTemplate);
      setCoachReply(null);
      setShowExemplar(false);
      setLatestDecisionBanner(resp.routingDecision);
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate practice problem');
    } finally {
      setGeneratingProb(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeProblem) return;
    setSavingDraft(true);
    try {
      await api.saveProblemDraft(activeProblem.id, solutionText);
      setProblems((prev) =>
        prev.map((p) => (p.id === activeProblem.id ? { ...p, draftSolution: solutionText } : p))
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRevealHint = async () => {
    if (!activeProblem) return;
    const resp = await api.revealHint(activeProblem.id);
    setProblems((prev) => prev.map((p) => (p.id === resp.problem.id ? resp.problem : p)));
  };

  const handleAskCoach = async () => {
    if (!activeProblem) return;
    setAskingCoach(true);
    setErrorMsg(null);
    try {
      const resp = await api.askMentorCoach(activeProblem.id, solutionText);
      setCoachReply(resp.coachingMarkdown);
      setLatestDecisionBanner(resp.routingDecision);
      if (resp.problem) {
        setProblems((prev) => prev.map((p) => (p.id === resp.problem.id ? resp.problem : p)));
      }
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Mentor hint request failed');
    } finally {
      setAskingCoach(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!activeProblem) return;
    setSubmittingEval(true);
    setErrorMsg(null);
    try {
      const resp = await api.submitSolution(activeProblem.id, solutionText);
      setProblems(resp.problems);
      setSubmissions(resp.recentSubmissions);
      setTopic(resp.topic);
      setStream(resp.stream);
      setLatestDecisionBanner(resp.routingDecision);
      onGamificationDelta(resp.gamificationDelta);
      await onRefreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Solution evaluation failed');
    } finally {
      setSubmittingEval(false);
    }
  };

  if (loading && (!topic || !stream)) {
    return (
      <Card className="items-center justify-center py-20 text-center">
        <CardContent className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-base border-2 border-black bg-[#FFDC58] shadow-[3px_3px_0px_0px_#000]">
            <Loader2 className="h-6 w-6 animate-spin text-black" />
          </div>
          <p className="font-heading text-sm font-bold text-foreground">
            Loading Topic Workbench...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!topic || !stream) {
    return (
      <Card className="p-8 text-center">
        <p role="alert" className="font-heading text-base font-bold text-foreground">{errorMsg || 'Topic not found.'}</p><Button onClick={() => void loadWorkspace(effectiveTopicId)}>Try again</Button>
      </Card>
    );
  }

  const totalRoadmapNodes = stream.phases.reduce(
    (sum, phase) => sum + phase.topics.length,
    0
  );
  const allTopics = stream.phases.flatMap((phase) => phase.topics);
  const topicIndex = allTopics.findIndex((candidate) => candidate.id === topic.id);
  const nextTopic = allTopics[topicIndex + 1];

  const editorLanguage = activeProblem?.languageHint || defaultLanguageHint || 'markdown';
  const solutionLineCount = solutionText ? solutionText.split('\n').length : 1;

  return (
    <div className="space-y-6">
      {!hasActiveProvider && <div className="flex flex-wrap items-center justify-between gap-3 rounded-base border-2 border-border bg-[#FFDC58]/40 p-4"><p className="text-sm">Your saved learning materials are available. Connect AI to generate new content or evaluate solutions.</p>{onGoToSetup && <Button variant="neutral" size="sm" onClick={onGoToSetup}>Connect AI</Button>}</div>}
      {/* Top Stream & Topic Context Header */}
      <Card className="overflow-hidden py-0">
        <div
          className={cn(
            'h-2.5 w-full border-b-2 border-border',
            topic.isBossTopic
              ? 'bg-[#FFDC58]'
              : topic.status === 'mastered'
                ? 'bg-[#05E17A]'
                : 'bg-main'
          )}
        />
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="neutral"
              size="xs"
              onClick={() => onBackToStream(stream.id)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to roadmap
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {loading && (
                <Badge variant="cyan">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Switching node...
                </Badge>
              )}
              {topic.isBossTopic && (
                <Badge variant="yellow">
                  <Crown className="h-3.5 w-3.5" /> Boss Capstone
                </Badge>
              )}
              <Badge
                variant={
                  topic.status === 'mastered'
                    ? 'mint'
                    : topic.status === 'in_progress'
                      ? 'default'
                      : 'neutral'
                }
              >
                {topic.status.replace('_', ' ')} · {topic.masteryScore}%
              </Badge>
              <Button
                type="button"
                size="xs"
                variant={showRoadmapGraph ? 'yellow' : 'neutral'}
                onClick={() => setShowRoadmapGraph((prev) => !prev)}
                aria-expanded={showRoadmapGraph}
              >
                <Workflow className="h-3.5 w-3.5" />
                <span>Roadmap map</span>
                <span className="rounded-[4px] border border-black bg-white px-1.5 py-0 font-mono text-[10px] font-extrabold text-black">
                  {totalRoadmapNodes}
                </span>
                {showRoadmapGraph ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="min-w-0 break-words">{stream.title} · Topic {topicIndex + 1} of {totalRoadmapNodes}</span>{nextTopic && <Button variant="neutral" size="xs" onClick={() => onSelectTopic ? onSelectTopic(nextTopic.id) : setFallbackTopicId(nextTopic.id)}>Next topic <ChevronDown className="size-4 -rotate-90" /></Button>}</div>

          <h1 className="mt-3.5 font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {topic.title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>

          {/* Compact Topic Mastery Progress Bar */}
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <Progress
              value={topic.masteryScore}
              className="h-3.5 max-w-sm flex-1"
              indicatorClassName={
                topic.status === 'mastered'
                  ? 'bg-[#05E17A]'
                  : topic.isBossTopic
                    ? 'bg-[#FFDC58]'
                    : 'bg-main'
              }
            />
            <span className="font-mono text-xs font-extrabold text-foreground">
              {topic.masteryScore}% Mastery
            </span>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-border pt-4">
            <div className="inline-flex flex-wrap gap-2 rounded-base border-2 border-border bg-background p-1.5 shadow-[2px_2px_0px_0px_var(--border)]">
              <Button
                type="button"
                size="sm"
                variant={subTab === 'learn' ? 'default' : 'neutral'}
                aria-pressed={subTab === 'learn'}
                onClick={() => setSubTab('learn')}
                className={cn(
                  subTab !== 'learn' && 'border-transparent bg-transparent shadow-none hover:border-border'
                )}
              >
                <BookOpen className="h-4 w-4" />
                Learn ({topic.completedResourceCount}/{resources.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={subTab === 'practice' ? 'yellow' : 'neutral'}
                aria-pressed={subTab === 'practice'}
                onClick={() => setSubTab('practice')}
                className={cn(
                  subTab !== 'practice' && 'border-transparent bg-transparent shadow-none hover:border-border'
                )}
              >
                <Swords className="h-4 w-4" />
                Practice ({topic.solvedProblemCount}/{problems.length})
              </Button>
            </div>

            {latestDecisionBanner && (
              <details className="max-w-full text-xs"><summary className="cursor-pointer font-heading font-bold text-muted-foreground">AI generation details</summary><div className="mt-2 flex flex-wrap items-center gap-1.5 break-all rounded-base border-2 border-border bg-[#A985FF]/35 px-3 py-1.5 text-xs font-heading font-bold text-foreground">
                <GitBranch className="h-3.5 w-3.5 text-black" />
                <span>
                  {latestDecisionBanner.decidedBy === 'typesafe_jev'
                    ? 'Jev Routed:'
                    : 'Auto Routed:'}{' '}
                  <strong className="font-extrabold text-black">
                    {latestDecisionBanner.selectedProviderName}/{latestDecisionBanner.selectedModel}
                  </strong>{' '}
                  ({latestDecisionBanner.reasoningEffort})
                </span>
              </div></details>
            )}
          </div>

          <AnimatePresence initial={false}>
            {errorMsg && (
              <motion.div
                initial={shouldAnimate ? { opacity: 0, y: -6 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldAnimate ? { opacity: 0, y: -6 } : undefined}
                transition={{ duration: 0.18 }}
                className="mt-4 flex items-center gap-2 rounded-base border-2 border-black bg-[#FF6B6B] p-3 text-xs font-heading font-bold text-black shadow-[3px_3px_0px_0px_#000]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-black" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Interactive Precomputed Roadmap Flow Graph with Smooth Collapse/Expand */}
      <AnimatePresence initial={false}>
        {showRoadmapGraph && (
          <motion.div
            key="roadmap-flow-panel"
            initial={shouldAnimate ? { opacity: 0, height: 0, y: -8 } : false}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={shouldAnimate ? { opacity: 0, height: 0, y: -8 } : undefined}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden pb-1.5 pr-1.5"
          >
            <RoadmapFlowGraph
              stream={stream}
              activeTopicId={topic.id}
              onSelectTopic={(nextId) => {
                if (nextId !== topic.id) {
                  if (onSelectTopic) {
                    onSelectTopic(nextId);
                  } else {
                    setFallbackTopicId(nextId);
                  }
                }
              }}
              animationsEnabled={animationsEnabled}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smooth Animated Sub-Tab Switcher Content */}
      <AnimatePresence mode="wait" initial={false}>
        {subTab === 'learn' ? (
          <motion.div
            key="tab-learn"
            initial={shouldAnimate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldAnimate ? { opacity: 0, y: -8 } : undefined}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            {/* Action Bar */}
            <Card size="sm">
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <h2 className="font-heading text-base font-bold">Learning resources</h2>
                  {resourceConsistencyNote && (
                    <p role="status" className="break-words text-xs text-muted-foreground">{resourceConsistencyNote}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleGenerateResources(resources.length > 0)}
                    disabled={generatingRes || !hasActiveProvider}
                  >
                    {generatingRes ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {resources.length > 0
                          ? 'Checking for updates…'
                          : 'Preparing resources…'}
                      </>
                    ) : resources.length > 0 ? (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Refresh resources
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate study guide
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="neutral"
                    onClick={() => setShowCustomResForm((v) => !v)}
                  >
                    <Plus className="h-4 w-4" />
                    Add a link
                  </Button>
                </div>
                <details className="text-sm"><summary className="cursor-pointer font-heading font-bold">Customize generation</summary><label htmlFor="topic-focus" className="mt-2 block text-xs text-muted-foreground">Optional focus area</label><Input id="topic-focus" value={focusNote} onChange={(e) => setFocusNote(e.target.value)} placeholder="What should the guide focus on?" className="mt-2" />{servedFromMemory && <p className="mt-2 text-xs text-muted-foreground">Saved resources are reused unless the focus changes.</p>}</details>
              </CardContent>
            </Card>

            {/* Custom External Resource Form */}
            <AnimatePresence initial={false}>
              {showCustomResForm && (
                <motion.div
                  key="custom-res-form"
                  initial={shouldAnimate ? { opacity: 0, height: 0, y: -6 } : false}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={shouldAnimate ? { opacity: 0, height: 0, y: -6 } : undefined}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden pb-1.5 pr-1.5"
                >
                  <Card size="sm" className="bg-[#FFFDF7]">
                    <CardContent>
                      <form onSubmit={handleAddCustomResource} className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            type="text"
                            required
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="Resource Title"
                          />
                          <Input
                            type="url"
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            placeholder="https://... (optional)"
                          />
                        </div>
                        <Textarea
                          rows={2}
                          value={customNotes}
                          onChange={(e) => setCustomNotes(e.target.value)}
                          placeholder="Personal notes or key takeaways..."
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="submit" variant="mint" size="sm">
                            Save Resource
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {resources.length === 0 ? (
              <Card className="border-dashed bg-secondary-background p-6 text-center sm:p-10">
                <CardContent className="flex flex-col items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-base border-2 border-black bg-[#88AAEE] shadow-[3px_3px_0px_0px_#000]">
                    <BookOpen className="h-7 w-7 text-black" />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-extrabold text-foreground">
                    Start learning this topic
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Generate a study guide to get explanations, flashcards, and recommended reading.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Resource Sidebar List */}
                <div className="lg:hidden"><label htmlFor="mobile-resource" className="block font-heading text-sm font-bold">Choose a resource</label><NeoSelect id="mobile-resource" value={activeResource?.id ?? ''} onChange={(e) => setSelectedResourceId(e.target.value)} className="mt-2 w-full">{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.isCompleted ? '✓ ' : ''}{resource.title}</option>)}</NeoSelect></div>
                <div className="hidden space-y-3 lg:col-span-4 lg:block">
                  {resources.map((r) => {
                    const selected = activeResource?.id === r.id;
                    return (
                      <div
                        key={r.id}
                        role="button"
                        aria-pressed={selected}
                        tabIndex={0}
                        onClick={() => setSelectedResourceId(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedResourceId(r.id);
                          }
                        }}
                        className={cn(
                          'cursor-pointer rounded-base border-2 border-black p-3.5 neo-press focus:outline-none focus-visible:ring-2 focus-visible:ring-black',
                          selected
                            ? 'bg-[#88AAEE] shadow-[4px_4px_0px_0px_#000]'
                            : 'bg-secondary-background shadow-[3px_3px_0px_0px_#000] hover:bg-[#FFFDF7]'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'rounded-[4px] border border-black px-1.5 py-0.5 font-heading text-[10px] font-extrabold uppercase tracking-wider text-black',
                              r.kind === 'generated_guide' ? 'bg-[#FFDC58]' : 'bg-[#22D3EE]'
                            )}
                          >
                            {r.kind === 'generated_guide'
                              ? 'AI Deep-Dive Guide'
                              : r.kind.replace('external_', 'External ')}
                          </span>
                          <span className="rounded-[4px] border border-black bg-white px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-black">
                            +{r.xpReward} XP
                          </span>
                        </div>
                        <div className="mt-2 font-heading text-xs font-bold text-black">
                          {r.title}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-black/80">
                          <span>
                            {r.providerOrAuthor} · ~{r.estimatedMinutes}m
                          </span>
                          {r.isCompleted && (
                            <span className="inline-flex items-center gap-1 rounded-[4px] border border-black bg-[#05E17A] px-1.5 py-0.5 font-heading text-[9px] font-extrabold uppercase text-black">
                              <CheckCircle2 className="h-3 w-3 text-black" />
                              Done
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Active Resource Reader */}
                {activeResource && (
                  <Card className="lg:col-span-8">
                    <CardContent className="space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-border pb-4">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-heading text-xl font-extrabold text-foreground">
                            {activeResource.title}
                          </h2>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            <strong className="text-foreground">
                              {activeResource.providerOrAuthor}
                            </strong>{' '}
                            · ~{activeResource.estimatedMinutes} mins · {activeResource.whyRelevant}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {activeResource.url && (
                            <a
                              href={activeResource.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(buttonVariants({ variant: 'neutral', size: 'sm' }))}
                            >
                              Open link
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Button
                            type="button"
                            variant={activeResource.isBookmarked ? 'yellow' : 'neutral'}
                            size="icon-sm"
                            onClick={() => handleToggleBookmark(activeResource)}
                            title="Bookmark"
                            aria-label="Bookmark resource"
                            aria-pressed={activeResource.isBookmarked}
                          >
                            <Bookmark className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={activeResource.isCompleted ? 'mint' : 'default'}
                            size="sm"
                            onClick={() => handleToggleResourceComplete(activeResource)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {activeResource.isCompleted
                              ? 'Completed'
                              : `Mark Completed (+${activeResource.xpReward} XP)`}
                          </Button>
                        </div>
                      </div>

                      <MarkdownView content={activeResource.contentMarkdown} />
                      <FlashcardDeck cards={activeResource.flashcards} />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          /* ================= TAB 2: PRACTICE ARENA & EVALUATOR ================= */
          <motion.div
            key="tab-practice"
            initial={shouldAnimate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldAnimate ? { opacity: 0, y: -8 } : undefined}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Challenge Generator Controls */}
            <Card size="sm">
              <CardContent className="flex flex-wrap items-center gap-3">
                <NeoSelect
                  aria-label="Challenge type"
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value as ProblemArchetype)}
                >
                  <option value="coding_implementation">Coding &amp; Implementation</option>
                  <option value="system_design">System &amp; Architecture Design</option>
                  <option value="debugging_incident">Production Debugging / Incident</option>
                  <option value="architecture_review">Code / RFC Critique</option>
                  <option value="leadership_scenario">Technical Leadership Scenario</option>
                </NeoSelect>

                <NeoSelect
                  aria-label="Challenge difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as ProblemDifficulty)}
                >
                  <option value="warmup">Warmup (75 XP)</option>
                  <option value="standard">Standard (120 XP)</option>
                  <option value="hard">Hard (180 XP · Pure Instinct Eligible)</option>
                  <option value="boss">Boss Capstone (280 XP · Mythic Badge)</option>
                </NeoSelect>

                <Button
                  type="button"
                  variant="yellow"
                  onClick={handleGenerateProblem}
                  disabled={generatingProb || !hasActiveProvider}
                >
                  {generatingProb ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating challenge…
                    </>
                  ) : (
                    <>
                      <Swords className="h-4 w-4" />
                      Create challenge
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Problem Switcher Pills */}
            {problems.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {problems.map((p, idx) => {
                  const isCurrent = activeProblem?.id === p.id;
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={isCurrent ? 'yellow' : 'neutral'}
                      aria-pressed={isCurrent}
                      className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-left"
                      onClick={() => handleSelectProblem(p)}
                    >
                      <span>
                        #{idx + 1} {p.title}
                      </span>
                      {p.bestScore !== null && (
                        <span
                          className={cn(
                            'rounded-[4px] border border-black px-1.5 py-0 font-mono text-[10px] font-extrabold text-black',
                            p.bestScore >= 70 ? 'bg-[#05E17A]' : 'bg-[#FF6B6B]'
                          )}
                        >
                          {p.bestScore}/100
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}

            {!activeProblem ? (
              <Card className="border-dashed bg-[#FFFDF7] p-12 text-center">
                <CardContent className="flex flex-col items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-base border-2 border-black bg-[#FFDC58] shadow-[3px_3px_0px_0px_#000]">
                    <Swords className="h-7 w-7 text-black" />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-extrabold text-foreground">
                    Step Into the Practice Arena
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Choose an archetype &amp; difficulty above and click{' '}
                    <strong className="text-foreground">Generate Practice Challenge</strong> to test
                    your mastery and receive rubric-graded AI feedback!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 xl:grid-cols-12">
                {/* LEFT 6 COLS: Problem Statement, Rubric & Hints */}
                <Card className="xl:col-span-6">
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="yellow" className="uppercase tracking-wider">
                        {activeProblem.difficulty} · {activeProblem.archetype.replace('_', ' ')}
                      </Badge>
                      <Badge variant="violet" className="font-mono">
                        Reward: +{activeProblem.xpReward} Base XP
                      </Badge>
                    </div>

                    <h2 className="font-heading text-xl font-extrabold text-foreground">
                      {activeProblem.title}
                    </h2>
                    <MarkdownView content={activeProblem.scenarioMarkdown} />

                    {activeProblem.requirements.length > 0 && (
                      <div className="rounded-base border-2 border-border bg-[#88AAEE]/20 p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                        <div className="font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                          Requirements
                        </div>
                        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-foreground/90 marker:font-bold marker:text-black">
                          {activeProblem.requirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeProblem.constraints.length > 0 && (
                      <div className="rounded-base border-2 border-border bg-[#FFDC58]/30 p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                        <div className="font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                          Constraints &amp; Edge Cases
                        </div>
                        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-foreground/90 marker:font-bold marker:text-black">
                          {activeProblem.constraints.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evaluation Rubric */}
                    <div className="rounded-base border-2 border-border bg-[#05E17A]/20 p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                      <div className="font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                        Evaluation Rubric
                      </div>
                      <div className="mt-2 space-y-2">
                        {activeProblem.rubric.map((r, i) => (
                          <div key={i} className="text-xs leading-relaxed text-foreground/90">
                            <strong className="font-heading font-bold text-black">
                              {r.criterion} ({r.weight} pts):
                            </strong>{' '}
                            {r.description}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Progressive Hints & Live Socratic Mentor */}
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-wrap gap-2.5">
                        {activeProblem.hints.length > 0 &&
                          activeProblem.hintsRevealed < activeProblem.hints.length && (
                            <Button
                              type="button"
                              variant="yellow"
                              size="sm"
                              onClick={handleRevealHint}
                            >
                              <Lightbulb className="h-3.5 w-3.5" />
                              Reveal Hint ({activeProblem.hintsRevealed}/{activeProblem.hints.length})
                            </Button>
                          )}

                        <Button
                          type="button"
                          variant="violet"
                          size="sm"
                          onClick={handleAskCoach}
                          disabled={askingCoach || !hasActiveProvider}
                        >
                          {askingCoach ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          Ask Socratic AI Mentor on My Draft
                        </Button>
                      </div>

                      {activeProblem.hintsRevealed > 0 && (
                        <div className="space-y-2">
                          {activeProblem.hints
                            .slice(0, activeProblem.hintsRevealed)
                            .map((hint, idx) => (
                              <motion.div
                                key={idx}
                                initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
                                animate={{ opacity: 1, y: 0 }}
                                transition={NEO_GENTLE_SPRING}
                                className="rounded-base border-2 border-black bg-[#FFDC58]/45 p-3 text-xs font-medium text-black shadow-[2px_2px_0px_0px_#000]"
                              >
                                <strong className="font-heading font-extrabold">
                                  Hint {idx + 1}:
                                </strong>{' '}
                                {hint}
                              </motion.div>
                            ))}
                        </div>
                      )}

                      <AnimatePresence initial={false}>
                        {coachReply && (
                          <motion.div
                            initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldAnimate ? { opacity: 0, y: -6 } : undefined}
                            transition={NEO_GENTLE_SPRING}
                            className="rounded-base border-2 border-black bg-[#A985FF]/25 p-4 shadow-[3px_3px_0px_0px_#000]"
                          >
                            <div className="mb-2 flex items-center gap-1.5 font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                              <HelpCircle className="h-4 w-4 text-black" />
                              Socratic Mentor Coaching
                            </div>
                            <MarkdownView content={coachReply} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>

                {/* RIGHT 6 COLS: Brutalist Solution Editor & AI Evaluation Feedback */}
                <div className="space-y-5 xl:col-span-6">
                  <Card>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-heading text-sm font-extrabold text-foreground">
                          Your Solution ({editorLanguage})
                        </span>
                        <Button
                          type="button"
                          variant="neutral"
                          size="xs"
                          onClick={handleSaveDraft}
                          disabled={savingDraft}
                        >
                          {savingDraft ? 'Saving draft...' : 'Save Draft to SQLite'}
                        </Button>
                      </div>

                      {/* Neobrutalist Terminal Code Editor Frame */}
                      <div className="overflow-hidden rounded-base border-2 border-black bg-[#111111] shadow-shadow transition-shadow focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
                        <div className="flex items-center justify-between border-b-2 border-black bg-[#FFDC58] px-3.5 py-2 text-black">
                          <div className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-full border border-black bg-[#FF6B6B]" />
                            <span className="h-3 w-3 rounded-full border border-black bg-white" />
                            <span className="h-3 w-3 rounded-full border border-black bg-[#05E17A]" />
                            <span className="ml-2 inline-flex items-center gap-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-black">
                              <Terminal className="h-3.5 w-3.5" />
                              solution.{editorLanguage}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-black/80">
                            {solutionLineCount} {solutionLineCount === 1 ? 'line' : 'lines'}
                          </span>
                        </div>

                        <Textarea
                          rows={15}
                          value={solutionText}
                          onChange={(e) => setSolutionText(e.target.value)}
                          onBlur={() => void handleSaveDraft()}
                          placeholder="Write your code, architecture design, SQL, or structured engineering solution here..."
                          className="min-h-[320px] rounded-none border-0 bg-[#111111] p-4 font-mono text-xs leading-relaxed text-[#05E17A] shadow-none selection:bg-[#FFDC58] selection:text-black placeholder:text-[#05E17A]/40 focus-visible:translate-x-0 focus-visible:translate-y-0 focus-visible:ring-0"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="mint"
                        size="lg"
                        className="w-full"
                        onClick={handleSubmitSolution}
                        disabled={submittingEval || !hasActiveProvider || solutionText.trim().length < 10}
                      >
                        {submittingEval ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Evaluating Solution Against Rubric...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Submit Solution for AI Evaluation
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Evaluation Feedback Card */}
                  <AnimatePresence mode="wait">
                    {latestSubmission && (
                      <motion.div
                        key={latestSubmission.id}
                        initial={shouldAnimate ? { opacity: 0, y: 12, scale: 0.99 } : false}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldAnimate ? { opacity: 0, y: -8 } : undefined}
                        transition={NEO_GENTLE_SPRING}
                      >
                        <Card>
                          <CardContent className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-base border-2 border-black bg-[#FFDC58] shadow-[2px_2px_0px_0px_#000]">
                                    <Award className="h-4 w-4 text-black" />
                                  </div>
                                  <span className="font-heading text-base font-extrabold text-foreground">
                                    Attempt #{latestSubmission.attemptNumber} Evaluation
                                  </span>
                                  <Badge
                                    variant={
                                      latestSubmission.verdict === 'mastered'
                                        ? 'mint'
                                        : latestSubmission.verdict === 'passed'
                                          ? 'default'
                                          : 'coral'
                                    }
                                    className="uppercase"
                                  >
                                    {latestSubmission.verdict.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                                  Graded by{' '}
                                  <strong className="text-foreground">
                                    {latestSubmission.evaluatedByModel}
                                  </strong>{' '}
                                  · +{latestSubmission.xpAwarded} XP Earned
                                </p>
                              </div>

                              <div className="rounded-base border-2 border-black bg-[#FFDC58] px-3.5 py-1.5 text-right shadow-[3px_3px_0px_0px_#000]">
                                <div className="font-heading text-2xl font-black leading-none text-black">
                                  {latestSubmission.score}
                                  <span className="font-mono text-xs font-bold text-black/75">
                                    /100
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Applied Gamified Bonuses */}
                            {latestSubmission.bonusesApplied.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {latestSubmission.bonusesApplied.map((b, i) => (
                                  <Badge key={i} variant="yellow">
                                    ⚡ {b.label} ({b.multiplierOrFlat} · +{b.xpAdded} XP)
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <p className="text-xs font-medium leading-relaxed text-foreground">
                              {latestSubmission.summaryFeedback}
                            </p>

                            {/* Animated Rubric Breakdown Bars */}
                            {latestSubmission.rubricBreakdown.length > 0 && (
                              <div className="space-y-3 rounded-base border-2 border-border bg-[#FFFDF7] p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                                <div className="font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                                  Rubric Breakdown
                                </div>
                                {latestSubmission.rubricBreakdown.map((rb, idx) => {
                                  const pct =
                                    rb.maxScore > 0
                                      ? Math.max(
                                          0,
                                          Math.min(100, Math.round((rb.score / rb.maxScore) * 100))
                                        )
                                      : 0;
                                  const barColor =
                                    pct >= 80
                                      ? 'bg-[#05E17A]'
                                      : pct >= 55
                                        ? 'bg-[#FFDC58]'
                                        : 'bg-[#FF6B6B]';

                                  return (
                                    <div key={idx} className="space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between gap-2 font-heading font-bold text-foreground">
                                        <span>{rb.criterion}</span>
                                        <span className="rounded-[4px] border border-black bg-white px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-black">
                                          {rb.score}/{rb.maxScore}
                                        </span>
                                      </div>

                                      <div className="h-3 w-full overflow-hidden rounded-[4px] border-2 border-black bg-white shadow-[1px_1px_0px_0px_#000]">
                                        <motion.div
                                          initial={shouldAnimate ? { width: 0 } : false}
                                          animate={{ width: `${pct}%` }}
                                          transition={{
                                            type: 'spring',
                                            stiffness: 210,
                                            damping: 26,
                                            delay: shouldAnimate ? idx * 0.065 : 0,
                                          }}
                                          className={cn(
                                            'h-full',
                                            barColor,
                                            pct > 0 && pct < 100 && 'border-r-2 border-black'
                                          )}
                                        />
                                      </div>

                                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                                        {rb.comment}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-base border-2 border-black bg-[#05E17A]/25 p-3.5 shadow-[2px_2px_0px_0px_#000]">
                                <div className="font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                                  Strengths
                                </div>
                                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-foreground/90 marker:font-bold marker:text-black">
                                  {latestSubmission.strengths.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="rounded-base border-2 border-black bg-[#FFDC58]/35 p-3.5 shadow-[2px_2px_0px_0px_#000]">
                                <div className="font-heading text-xs font-extrabold uppercase tracking-wider text-black">
                                  Actionable Improvements
                                </div>
                                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-foreground/90 marker:font-bold marker:text-black">
                                  {latestSubmission.improvements.map((imp, i) => (
                                    <li key={i}>{imp}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {latestSubmission.exemplarApproachMarkdown && (
                              <div className="pt-1">
                                <Button
                                  type="button"
                                  variant="neutral"
                                  size="xs"
                                  onClick={() => setShowExemplar((v) => !v)}
                                >
                                  {showExemplar ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                  {showExemplar
                                    ? 'Hide Exemplar Reference Solution'
                                    : 'View Exemplar Reference Solution'}
                                </Button>

                                <AnimatePresence initial={false}>
                                  {showExemplar && (
                                    <motion.div
                                      key="exemplar-panel"
                                      initial={
                                        shouldAnimate ? { opacity: 0, height: 0, y: -6 } : false
                                      }
                                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                                      exit={
                                        shouldAnimate ? { opacity: 0, height: 0, y: -6 } : undefined
                                      }
                                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                                      className="overflow-hidden pb-1 pr-1"
                                    >
                                      <div className="mt-3 rounded-base border-2 border-black bg-[#FFFDF7] p-4 shadow-[2px_2px_0px_0px_#000]">
                                        <MarkdownView
                                          content={latestSubmission.exemplarApproachMarkdown}
                                        />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
