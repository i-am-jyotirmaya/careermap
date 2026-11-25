import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  FileText,
  Flame,
  Layers,
  Loader2,
  Rocket,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  NEO_SPRING,
  NeoStarBurst,
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/motion-primitives';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '../lib/api.ts';
import type {
  CareerStream,
  GamificationDelta,
  ResumeRecord,
  SkillRating,
  SuggestedRoadmap,
} from '../../shared/types.ts';

interface Props {
  hasActiveProvider: boolean;
  latestResume: ResumeRecord | null;
  streams: CareerStream[];
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  onGoToSetup: () => void;
  onOpenStream: (streamId: string) => void;
}

const SAMPLE_RESUME = `ALEX RIVERA — Senior Full-Stack & Backend Engineer
Experience: 5.5 Years | Location: Remote

SUMMARY
Backend-leaning Full-Stack Software Engineer experienced in TypeScript, Node.js, PostgreSQL, Redis, and React. Built high-throughput payment webhooks and developer APIs serving 40k+ businesses. Looking to grow into Staff Distributed Systems Architecture, Production AI/Agentic Systems, and Technical Leadership.

EXPERIENCE
Senior Software Engineer — FinFlow Systems (2023 – Present)
- Designed idempotent event-driven webhook pipeline processing 12M events/day with Node.js, Kafka, and PostgreSQL.
- Reduced p99 API latency by 42% through query indexing, connection pooling, and Redis read-through caching.
- Mentored 3 mid-level engineers and led sprint architecture reviews.

Software Engineer — CloudPulse Analytics (2021 – 2023)
- Built real-time React + TypeScript observability dashboards and REST/GraphQL APIs.
- Automated CI/CD deployments using Docker, GitHub Actions, and Terraform on AWS ECS.

SKILLS
Languages: TypeScript, JavaScript, SQL, Python (basic), Go (learning)
Systems & Cloud: PostgreSQL, Redis, Kafka, Docker, AWS (ECS, RDS, S3), REST APIs
Frontend: React, Tailwind CSS, Vite`;

const THEME_ACCENT: Record<
  SuggestedRoadmap['colorTheme'],
  { banner: string; sticker: string }
> = {
  indigo: { banner: 'bg-[#88AAEE]', sticker: 'bg-[#FFDC58]' },
  emerald: { banner: 'bg-[#05E17A]', sticker: 'bg-[#FFDC58]' },
  amber: { banner: 'bg-[#FFDC58]', sticker: 'bg-[#05E17A]' },
  rose: { banner: 'bg-[#FF6B6B]', sticker: 'bg-[#FFDC58]' },
  cyan: { banner: 'bg-[#22D3EE]', sticker: 'bg-[#FFDC58]' },
  violet: { banner: 'bg-[#A985FF]', sticker: 'bg-[#FFDC58]' },
};

const SKILL_BADGE_VARIANT: Record<
  SkillRating['level'],
  'neutral' | 'default' | 'mint' | 'yellow'
> = {
  beginner: 'neutral',
  intermediate: 'default',
  advanced: 'mint',
  expert: 'yellow',
};

export const ResumeRoadmapView: React.FC<Props> = ({
  hasActiveProvider,
  latestResume,
  streams,
  onRefreshAll,
  onGamificationDelta,
  onGoToSetup,
  onOpenStream,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filename, setFilename] = useState(latestResume?.filename ?? '');
  const [fileFormat, setFileFormat] = useState(latestResume?.fileFormat ?? 'txt');
  const [rawText, setRawText] = useState(latestResume?.rawText ?? '');
  const [careerGoalsNote, setCareerGoalsNote] = useState(latestResume?.careerGoalsNote ?? '');
  const [parsingFile, setParsingFile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [consistencyInfo, setConsistencyInfo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showEditor, setShowEditor] = useState(!latestResume);

  const handleFileSelected = async (file: File) => {
    setParsingFile(true);
    setErrorMsg(null);
    try {
      const parsed = await api.parseResumeFile(file);
      setFilename(parsed.filename);
      setFileFormat(parsed.fileFormat);
      setRawText(parsed.rawText);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse resume file');
    } finally {
      setParsingFile(false);
    }
  };

  const handleAnalyze = async () => {
    if (!hasActiveProvider) {
      setErrorMsg('Please configure at least one AI provider in Step 1 first.');
      return;
    }
    setAnalyzing(true);
    setErrorMsg(null);
    setConsistencyInfo(null);
    try {
      const res = await api.analyzeResume({
        filename: filename || 'Uploaded Resume.txt',
        fileFormat: fileFormat || 'txt',
        rawText,
        careerGoalsNote,
        existingResumeId: latestResume?.id,
      });
      setConsistencyInfo(res.consistencyNote);
      onGamificationDelta(res.gamificationDelta);
      await onRefreshAll();
      setShowEditor(false);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Resume analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLaunchRoadmap = async (rm: SuggestedRoadmap) => {
    if (rm.activatedStreamId && streams.some((stream) => stream.id === rm.activatedStreamId)) {
      onOpenStream(rm.activatedStreamId);
      return;
    }
    setLaunchingId(rm.id);
    setErrorMsg(null);
    try {
      const res = await api.launchStream({
        resumeId: latestResume?.id,
        suggestedRoadmapId: rm.id,
      });
      onGamificationDelta(res.gamificationDelta);
      await onRefreshAll();
      onOpenStream(res.stream.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to launch career stream');
    } finally {
      setLaunchingId(null);
    }
  };

  const profile = latestResume?.profile ?? null;
  const roadmaps = latestResume?.suggestedRoadmaps ?? [];

  return (
    <PageTransition className="space-y-6 text-foreground">
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-heading text-3xl font-bold">Resume &amp; career suggestions</h1><p className="mt-1 text-sm text-muted-foreground">Use your experience to find your next career goal.</p></div>{latestResume && <Button variant="neutral" onClick={() => setShowEditor((v) => !v)} aria-expanded={showEditor}>{showEditor ? 'Hide resume editor' : 'Update resume'}</Button>}</header>
      {!showEditor && consistencyInfo && <p role="status" className="rounded-base border-2 border-border bg-[#05E17A]/20 p-3 text-sm">{consistencyInfo}</p>}
      {!showEditor && errorMsg && <p role="alert" className="rounded-base border-2 border-border bg-[#FF6B6B]/20 p-3 text-sm">{errorMsg}</p>}
      {!hasActiveProvider && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-base border-2 border-border bg-[#FFDC58] p-4 text-black shadow-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background shadow-[2px_2px_0px_0px_var(--border)]">
              <AlertCircle className="h-5 w-5 text-black" />
            </div>
            <div className="text-sm font-medium text-black">
              <strong className="font-heading font-black">Step 1 Prerequisite:</strong> Set up an
              AI provider first so CareerForge can analyze your resume and synthesize personalized
              roadmaps.
            </div>
          </div>
          <Button type="button" variant="neutral" size="sm" onClick={onGoToSetup}>
            Go to AI Engine Setup
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Upload & Paste Panel */}
      {showEditor && <Card className="overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-brutal-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-[#88AAEE] px-6 py-4 text-black">
          <div className="inline-flex items-center gap-2 font-heading text-xs font-black uppercase tracking-wider text-black">
            <FileText className="h-4 w-4" />
            Your resume
          </div>
          <Button
            type="button"
            variant="yellow"
            size="sm"
            onClick={() => {
              setFilename('Sample_Senior_Engineer_Resume.txt');
              setFileFormat('txt');
              setRawText(SAMPLE_RESUME);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Load Sample Resume
          </Button>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">Upload or paste your resume</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Supports local parsing of{' '}
                <strong className="font-heading font-bold text-foreground">.pdf</strong>,{' '}
                <strong className="font-heading font-bold text-foreground">.docx</strong>,{' '}
                <strong className="font-heading font-bold text-foreground">.md</strong>, and{' '}
                <strong className="font-heading font-bold text-foreground">.txt</strong> — all
                stored strictly in your local SQLite database.
              </p>
            </div>
            <NeoStarBurst size={28} fill="#FFDC58" className="hidden shrink-0 sm:block" />
          </div>

          {/* Tactile Brutalist Drag and Drop Zone */}
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ y: 1 }}
            transition={NEO_SPRING}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFileSelected(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Choose a resume file"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            className={cn(
              'mt-5 flex cursor-pointer flex-col items-center justify-center rounded-base border-3 border-dashed border-border p-7 text-center transition-all duration-200',
              dragging
                ? 'bg-[#FFDC58]/50 -translate-y-0.5 shadow-shadow'
                : 'bg-secondary-background hover:bg-[#FFDC58]/20 hover:shadow-shadow'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelected(f);
              }}
            />
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-base border-2 border-border text-black shadow-[2px_2px_0px_0px_var(--border)]',
                filename ? 'bg-[#05E17A]' : 'bg-[#FFDC58]'
              )}
            >
              {parsingFile ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
            </div>
            <div className="mt-3 font-heading text-sm font-black text-foreground sm:text-base">
              {filename
                ? `Loaded: ${filename} (${rawText.length.toLocaleString()} chars)`
                : 'Click or drag & drop your resume (.pdf, .docx, .md, .txt)'}
            </div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">
              Parsed 100% locally on your machine before AI roadmap analysis
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {(['PDF', 'DOCX', 'MD', 'TXT'] as const).map((ext) => (
                <Badge key={ext} variant="neutral" className="px-2 py-0 text-[10px]">
                  .{ext}
                </Badge>
              ))}
            </div>
          </motion.div>

          {/* Editable Extracted Text + Aspirations */}
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label htmlFor="resume-text" className="block font-heading text-sm font-bold text-foreground">
                Extracted / Pasted Resume Content
              </label>
              <Textarea
                id="resume-text"
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Upload a file above or paste your resume markdown/text here..."
                className="mt-1.5 bg-background font-mono text-xs leading-relaxed"
              />
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <label htmlFor="resume-goals" className="block font-heading text-sm font-bold text-foreground">
                  Optional Target Direction / Interests
                </label>
                <Textarea
                  id="resume-goals"
                  rows={4}
                  value={careerGoalsNote}
                  onChange={(e) => setCareerGoalsNote(e.target.value)}
                  placeholder="e.g. Interested in Staff Backend Architecture, Applied AI Agents, and Tech Lead readiness..."
                  className="mt-1.5 bg-background text-xs leading-relaxed"
                />
              </div>

              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={handleAnalyze}
                disabled={analyzing || parsingFile || !hasActiveProvider || rawText.trim().length < 40}
                className="mt-4 w-full text-xs sm:text-sm"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing resume…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {latestResume
                      ? 'Update suggestions'
                      : 'Find my career paths'}
                  </>
                )}
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {consistencyInfo && (
              <motion.div
                key="consistency-info"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={NEO_SPRING}
                className="mt-5 flex items-center gap-2.5 rounded-base border-2 border-border bg-[#05E17A] p-3.5 font-heading text-xs font-bold text-black shadow-shadow"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-black" />
                <span>{consistencyInfo}</span>
              </motion.div>
            )}

            {errorMsg && (
              <motion.div
                key="error-msg"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={NEO_SPRING}
                className="mt-5 flex items-center gap-2.5 rounded-base border-2 border-border bg-[#FF6B6B] p-3.5 font-heading text-xs font-bold text-black shadow-shadow"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-black" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>}

      {/* Extracted Career Profile Snapshot */}
      {profile && (
        <details className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-brutal-sm"><summary className="cursor-pointer font-heading font-bold">View analyzed profile &amp; skills</summary><div className="mt-4">
        <Card className="overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-brutal-lg">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border bg-background px-6 py-5">
            <div className="max-w-3xl">
              <Badge variant="mint" className="uppercase tracking-wider">
                <Award className="h-3.5 w-3.5" />
                AI Career Profile Synthesis
              </Badge>
              <h2 className="mt-2.5 font-heading text-xl font-black text-foreground sm:text-2xl">
                {profile.headline}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {profile.summary}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" className="px-3 py-1 text-xs">
                Role: {profile.currentRole}
              </Badge>
              <Badge variant="yellow" className="px-3 py-1 text-xs">
                Tier: {profile.seniorityEstimate} ({profile.yearsOfExperience} yrs)
              </Badge>
            </div>
          </div>

          <StaggerContainer className="grid gap-4 p-6 md:grid-cols-3">
            <StaggerItem className="h-full">
              <Card
                size="sm"
                className="h-full overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-shadow"
              >
                <div className="flex items-center gap-2 border-b-2 border-border bg-[#05E17A] px-4 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-black">
                  <CheckCircle2 className="h-4 w-4" />
                  Core Superpowers
                </div>
                <ul className="space-y-2 p-4 text-xs leading-relaxed text-foreground">
                  {profile.superpowers.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-base border border-border bg-[#05E17A] text-black">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{s}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </StaggerItem>

            <StaggerItem className="h-full">
              <Card
                size="sm"
                className="h-full overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-shadow"
              >
                <div className="flex items-center gap-2 border-b-2 border-border bg-[#FFDC58] px-4 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-black">
                  <Target className="h-4 w-4" />
                  High-Leverage Growth Gaps
                </div>
                <ul className="space-y-2 p-4 text-xs leading-relaxed text-foreground">
                  {profile.growthGaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-base border border-border bg-[#FFDC58] text-black">
                        <Target className="h-3 w-3" />
                      </span>
                      <span className="font-medium">{g}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </StaggerItem>

            <StaggerItem className="h-full">
              <Card
                size="sm"
                className="h-full overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-shadow"
              >
                <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-[#A985FF] px-4 py-2.5 font-heading text-xs font-black uppercase tracking-wider text-black">
                  <span>Detected Skill Matrix</span>
                  <span className="rounded-base border border-border bg-secondary-background px-1.5 py-0.5 text-[10px]">
                    {profile.skills.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-4">
                  {profile.skills.map((sk, i) => (
                    <Badge
                      key={i}
                      variant={SKILL_BADGE_VARIANT[sk.level]}
                      title={`${sk.category} · ${sk.yearsEvidence}`}
                      className="text-[11px]"
                    >
                      {sk.name} · {sk.level}
                    </Badge>
                  ))}
                </div>
              </Card>
            </StaggerItem>
          </StaggerContainer>
        </Card></div></details>
      )}

      {/* Suggested Multi-Stream Career Roadmaps */}
      {roadmaps.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-base border-2 border-border bg-secondary-background p-5 shadow-shadow">
            <div>
              <h2 className="font-heading text-xl font-black text-foreground sm:text-2xl">
                Suggested career paths ({roadmaps.length})
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a path to turn it into your personal learning roadmap.
              </p>
            </div>
            {streams.length > 0 && (
              <Badge variant="mint" className="px-3 py-1 text-xs">
                <Layers className="h-3.5 w-3.5" />
                {streams.length} Independent Stream{streams.length > 1 ? 's' : ''} Active
              </Badge>
            )}
          </div>

          <StaggerContainer className="grid gap-6 lg:grid-cols-2">
            {[...roadmaps].sort((a, b) => b.fitScore - a.fitScore).map((rm) => {
              const linkedStream = rm.activatedStreamId
                ? streams.find((s) => s.id === rm.activatedStreamId)
                : null;
              const isLaunching = launchingId === rm.id;
              const accent = THEME_ACCENT[rm.colorTheme] ?? THEME_ACCENT.indigo;

              return (
                <StaggerItem key={rm.id} className="h-full">
                  <Card className="neo-card-lift flex h-full flex-col justify-between overflow-hidden border-2 border-border bg-secondary-background p-0 shadow-shadow">
                    <div>
                      {/* Neo-Pop Header + Fit-Score Sticker */}
                      <div
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-2 border-b-2 border-border px-6 py-3.5 text-black',
                          accent.banner
                        )}
                      >
                        <span className="rounded-base border-2 border-border bg-secondary-background px-2.5 py-0.5 font-heading text-[11px] font-black uppercase tracking-wider text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                          {rm.category.replace('_', ' ')}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-base border-2 border-border bg-secondary-background px-2.5 py-0.5 font-heading text-[11px] font-bold uppercase text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                            <Flame className="h-3.5 w-3.5 fill-[#FFDC58] text-black" />
                            {rm.marketDemand} · ~{rm.estimatedWeeks}w
                          </span>
                          <span
                            className={cn(
                              '-rotate-2 rounded-base border-2 border-border px-2.5 py-0.5 font-heading text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_var(--border)]',
                              accent.sticker
                            )}
                          >
                            {rm.fitScore}% Fit
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 p-6">
                        <div>
                          <h3 className="font-heading text-xl font-black text-foreground">
                            {rm.title}
                          </h3>
                          <p className="mt-1 font-heading text-xs font-bold text-foreground/85">
                            Target Role: {rm.targetRole} — {rm.tagline}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                            {rm.whyItFits}
                          </p>
                        </div>

                        {/* Bridge & Gap Skill Chips */}
                        <details className="rounded-base border border-border p-3"><summary className="cursor-pointer font-heading text-sm font-bold">Skills and roadmap preview</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-base border-2 border-border bg-[#05E17A]/16 p-3 shadow-[2px_2px_0px_0px_var(--border)]">
                            <div className="font-heading text-[10px] font-black uppercase tracking-wider text-foreground">
                              Bridge Skills You Have
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {rm.bridgeSkills.slice(0, 5).map((b, i) => (
                                <span
                                  key={i}
                                  className="rounded-base border border-border bg-[#05E17A] px-2 py-0.5 font-heading text-[10px] font-bold text-black"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-base border-2 border-border bg-[#FFDC58]/24 p-3 shadow-[2px_2px_0px_0px_var(--border)]">
                            <div className="font-heading text-[10px] font-black uppercase tracking-wider text-foreground">
                              Gap Skills You&apos;ll Forge
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {rm.gapSkillsToBuild.slice(0, 5).map((g, i) => (
                                <span
                                  key={i}
                                  className="rounded-base border border-border bg-[#FFDC58] px-2 py-0.5 font-heading text-[10px] font-bold text-black"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {rm.phasesPreview.length > 0 && (
                          <div className="space-y-1.5 rounded-base border-2 border-border bg-background p-3.5">
                            {rm.phasesPreview.slice(0, 3).map((ph, idx) => (
                              <div key={idx} className="text-xs leading-relaxed text-muted-foreground">
                                <strong className="font-heading font-black text-foreground">
                                  {ph.title}:
                                </strong>{' '}
                                {ph.keyTopics.join(' · ')}
                              </div>
                            ))}
                          </div>
                        )}</details>
                      </div>
                    </div>

                    <div className="border-t-2 border-border bg-background p-5">
                      {linkedStream ? (
                        <Button
                          type="button"
                          variant="mint"
                          onClick={() => onOpenStream(linkedStream.id)}
                          className="w-full text-xs"
                        >
                          <Compass className="h-4 w-4" />
                          Open roadmap · {linkedStream.masteryPercent}% complete
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant={
                            rm.preparedPhases && rm.preparedPhases.length > 0 ? 'mint' : 'default'
                          }
                          onClick={() => handleLaunchRoadmap(rm)}
                          disabled={launchingId !== null || (!hasActiveProvider && !rm.preparedPhases?.length)}
                          className="w-full text-xs"
                        >
                          {isLaunching ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Opening roadmap…
                            </>
                          ) : (
                            <>
                              <Rocket className="h-4 w-4" />
                              Start this roadmap
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      )}
    </PageTransition>
  );
};
