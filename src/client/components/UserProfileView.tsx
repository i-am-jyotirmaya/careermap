import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  Flame,
  Layers,
  Loader2,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Swords,
  Trophy,
  Zap,
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
import { Progress } from '@/components/ui/progress';
import {
  NEO_SPRING,
  NeoStarBurst,
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/motion-primitives';
import { api } from '../lib/api.ts';
import {
  AVATAR_COLOR_MAP,
  AVATAR_COLOR_OPTIONS,
  AVATAR_ICON_MAP,
  AVATAR_ICON_OPTIONS,
  AvatarBadge,
} from './UserAvatarMenu.tsx';
import type {
  AvatarColor,
  AvatarIcon,
  CareerStream,
  PlayerProfile,
  ResumeRecord,
} from '../../shared/types.ts';

export interface UserProfileViewProps {
  profile: PlayerProfile;
  streams: CareerStream[];
  latestResume: ResumeRecord | null;
  onRefreshAll: () => Promise<void>;
  onNavigateVault: () => void;
  onNavigateSettings: () => void;
}

function computeTotalLifetimeXp(globalLevel: number, currentLevelXp: number): number {
  let total = currentLevelXp;
  for (let lvl = 1; lvl < globalLevel; lvl += 1) {
    total += Math.round(150 * Math.pow(1.28, Math.max(0, lvl - 1)));
  }
  return total;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  profile,
  streams,
  latestResume,
  onRefreshAll,
  onNavigateVault,
  onNavigateSettings,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [headlineTitle, setHeadlineTitle] = useState(profile.headlineTitle);
  const [avatarIcon, setAvatarIcon] = useState<AvatarIcon>(profile.avatarIcon);
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(profile.avatarColor);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    setDisplayName(profile.displayName);
    setHeadlineTitle(profile.headlineTitle);
    setAvatarIcon(profile.avatarIcon);
    setAvatarColor(profile.avatarColor);
  }, [
    profile.displayName,
    profile.headlineTitle,
    profile.avatarIcon,
    profile.avatarColor,
  ]);

  const isDirty =
    displayName.trim() !== profile.displayName ||
    headlineTitle.trim() !== profile.headlineTitle ||
    avatarIcon !== profile.avatarIcon ||
    avatarColor !== profile.avatarColor;

  const handleResetEdits = () => {
    setDisplayName(profile.displayName);
    setHeadlineTitle(profile.headlineTitle);
    setAvatarIcon(profile.avatarIcon);
    setAvatarColor(profile.avatarColor);
    setSaveBanner(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setSaveBanner({
        kind: 'err',
        text: 'Display Name cannot be empty.',
      });
      return;
    }

    setSaving(true);
    setSaveBanner(null);
    try {
      await api.updateProfile({
        displayName: trimmedName,
        headlineTitle: headlineTitle.trim(),
        avatarIcon,
        avatarColor,
      });
      await onRefreshAll();
      setSaveBanner({
        kind: 'ok',
        text: 'Saved! Your CareerForge identity, headline, and avatar have been updated.',
      });
    } catch (err) {
      setSaveBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Cross-stream aggregate career stats
  const xpPercent = Math.min(
    100,
    Math.round((profile.globalXp / Math.max(1, profile.xpToNextLevel)) * 100)
  );
  const totalLifetimeXp = computeTotalLifetimeXp(profile.globalLevel, profile.globalXp);
  const activeStreamsCount = streams.filter((s) => s.status === 'active').length;
  const completedStreamsCount = streams.filter((s) => s.status === 'completed').length;
  const totalResourcesCompleted = streams.reduce((sum, s) => sum + s.resourcesCompleted, 0);
  const totalChallengesSolved = streams.reduce((sum, s) => sum + s.problemsSolved, 0);
  const unlockedAchievementsCount = profile.achievements.filter((a) =>
    Boolean(a.unlockedAt)
  ).length;
  const completedQuestsCount = profile.bonusQuests.filter((q) => Boolean(q.completedAt)).length;
  const evaluatedStreams = streams.filter((s) => s.totalEvaluations > 0);
  const avgArenaScore =
    evaluatedStreams.length > 0
      ? Math.round(
          evaluatedStreams.reduce((sum, s) => sum + s.avgScore, 0) / evaluatedStreams.length
        )
      : null;

  return (
    <PageTransition className="space-y-8">
      {/* Hero Banner with Live Identity Preview & Quick Navigation */}
      <div className="overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg">
        {/* Accent Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-[#88AAEE] px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="yellow">
              <Trophy className="h-3.5 w-3.5" />
              Level {profile.globalLevel} · {profile.rankTitle}
            </Badge>
            {profile.polymathMultiplierActive && (
              <Badge variant="mint">
                <Sparkles className="h-3.5 w-3.5" />
                1.25x Polymath Active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-black">
            <span>Engineer Dossier</span>
            <NeoStarBurst fill="#FFDC58" size={24} />
          </div>
        </div>

        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <motion.div
              key={`${avatarColor}-${avatarIcon}`}
              initial={{ scale: 0.88, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={NEO_SPRING}
              className="self-start sm:self-center"
            >
              <AvatarBadge color={avatarColor} icon={avatarIcon} size="xl" />
            </motion.div>

            <div className="space-y-1.5">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {displayName.trim() || profile.displayName}
              </h1>

              <p className="text-sm font-medium text-muted-foreground">
                {headlineTitle.trim() ||
                  profile.headlineTitle ||
                  'Multi-Stream Engineer & Career Architect'}
              </p>

              <div className="w-80 max-w-full pt-1.5">
                <div className="flex items-center justify-between font-mono text-xs font-bold text-foreground">
                  <span>
                    Level XP: {profile.globalXp} / {profile.xpToNextLevel}
                  </span>
                  <span>{xpPercent}%</span>
                </div>
                <Progress
                  value={xpPercent}
                  className="mt-1.5 h-3.5"
                  indicatorClassName="bg-[#05E17A]"
                />
              </div>
            </div>
          </div>

          {/* Quick Navigation Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="yellow" onClick={onNavigateVault}>
              <Trophy className="h-4 w-4" />
              Vault &amp; Achievements
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="neutral" onClick={onNavigateSettings}>
              <Settings className="h-4 w-4" />
              Settings
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left = Identity & Avatar Studio, Right = Cross-Stream Stats + Ledger */}
      <div className="grid gap-8 xl:grid-cols-12">
        {/* Identity & Avatar Editor (5 cols) */}
        <div className="xl:col-span-5">
          <Card className="overflow-hidden py-0 gap-0">
            <CardHeader className="border-b-2 border-border bg-[#A985FF]/35 py-5">
              <CardTitle className="text-lg">Identity &amp; Avatar Studio</CardTitle>
              <CardDescription className="text-xs font-medium text-foreground/80">
                Customize how you appear across your command bar, streams, and progression ledger.
              </CardDescription>
            </CardHeader>

            <CardContent className="py-6">
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Display Name */}
                <div>
                  <label
                    htmlFor="profile-display-name"
                    className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground"
                  >
                    Display Name
                  </label>
                  <Input
                    id="profile-display-name"
                    type="text"
                    maxLength={60}
                    required
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (saveBanner) setSaveBanner(null);
                    }}
                    placeholder="e.g. Alex Rivera"
                    className="mt-1.5 font-heading font-bold"
                  />
                </div>

                {/* Career Headline / Bio */}
                <div>
                  <label
                    htmlFor="profile-headline-title"
                    className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground"
                  >
                    Career Headline / Bio
                  </label>
                  <Input
                    id="profile-headline-title"
                    type="text"
                    maxLength={140}
                    value={headlineTitle}
                    onChange={(e) => {
                      setHeadlineTitle(e.target.value);
                      if (saveBanner) setSaveBanner(null);
                    }}
                    placeholder="e.g. Senior Backend Engineer -> Staff Distributed Systems Architect"
                    className="mt-1.5"
                  />
                </div>

                {/* Avatar Icon Visual Grid (8 choices) */}
                <div>
                  <span className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Avatar Emblem ({AVATAR_ICON_OPTIONS.length} Archetypes)
                  </span>
                  <div className="mt-2 grid grid-cols-4 gap-2.5">
                    {AVATAR_ICON_OPTIONS.map((iconKey) => {
                      const entry = AVATAR_ICON_MAP[iconKey];
                      const IconComp = entry.Icon;
                      const selected = avatarIcon === iconKey;
                      const activeTheme = AVATAR_COLOR_MAP[avatarColor];
                      return (
                        <motion.button
                          key={iconKey}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.94 }}
                          transition={NEO_SPRING}
                          aria-pressed={selected}
                          onClick={() => {
                            setAvatarIcon(iconKey);
                            if (saveBanner) setSaveBanner(null);
                          }}
                          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-base border-2 border-border p-2.5 text-center transition-colors ${
                            selected
                              ? `${activeTheme.badgeBg} text-black shadow-[3px_3px_0px_0px_#000]`
                              : 'bg-background text-foreground shadow-[2px_2px_0px_0px_var(--border)] hover:bg-[#FFDC58]/35'
                          }`}
                        >
                          <IconComp className="h-5 w-5 stroke-[2.25]" />
                          <span className="font-heading text-[11px] font-bold">{entry.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Avatar Color Visual Swatches (6 choices) */}
                <div>
                  <span className="block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Aura Color ({AVATAR_COLOR_OPTIONS.length} Themes)
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {AVATAR_COLOR_OPTIONS.map((colorKey) => {
                      const colorTheme = AVATAR_COLOR_MAP[colorKey];
                      const selected = avatarColor === colorKey;
                      return (
                        <motion.button
                          key={colorKey}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          transition={NEO_SPRING}
                          aria-pressed={selected}
                          onClick={() => {
                            setAvatarColor(colorKey);
                            if (saveBanner) setSaveBanner(null);
                          }}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-base border-2 border-border px-3 py-2 text-left transition-colors ${
                            selected
                              ? `${colorTheme.badgeBg} text-black shadow-[3px_3px_0px_0px_#000]`
                              : 'bg-background text-foreground shadow-[2px_2px_0px_0px_var(--border)] hover:bg-secondary-background'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-base border-2 border-black ${colorTheme.swatchBg} text-black`}
                          >
                            {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </span>
                          <span className="truncate font-heading text-xs font-bold">
                            {colorTheme.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {saveBanner && (
                    <motion.div
                      key={saveBanner.text}
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={NEO_SPRING}
                      className={`flex items-start gap-2 rounded-base border-2 border-border p-3 text-xs text-black shadow-[2px_2px_0px_0px_var(--border)] ${
                        saveBanner.kind === 'ok' ? 'bg-[#05E17A]' : 'bg-[#FF6B6B]'
                      }`}
                    >
                      {saveBanner.kind === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 stroke-[2.5]" />
                      )}
                      <span className="font-heading font-bold">{saveBanner.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2.5 pt-1">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Profile
                  </Button>
                  {isDirty && (
                    <Button
                      type="button"
                      variant="neutral"
                      onClick={handleResetEdits}
                      disabled={saving}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Cross-Stream Career Statistics Grid & Progression Ledger (7 cols) */}
        <div className="space-y-6 xl:col-span-7">
          {/* Cross-Stream Career Statistics Grid */}
          <Card>
            <CardHeader className="border-b-2 border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Cross-Stream Career Statistics</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Unified telemetry across all active roadmaps, study packs, and practice
                    evaluations.
                  </CardDescription>
                </div>
                {profile.lastActiveDate && (
                  <Badge variant="neutral" className="font-mono text-[11px]">
                    Last active: {profile.lastActiveDate}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <StaggerContainer className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Global Level & Rank */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Global Level</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-black">
                        <Trophy className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-heading text-2xl font-black text-foreground">
                      Lvl {profile.globalLevel}
                    </div>
                    <div className="mt-0.5 truncate font-heading text-[11px] font-bold text-foreground">
                      {profile.rankTitle}
                    </div>
                  </div>
                </StaggerItem>

                {/* 2. Total XP */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Total XP</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#88AAEE] text-black">
                        <Sparkles className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      {totalLifetimeXp.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {profile.globalXp} / {profile.xpToNextLevel} in level
                    </div>
                  </div>
                </StaggerItem>

                {/* 3. Forge Sparks */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Forge Sparks</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-black">
                        <Zap className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      ⚡ {profile.forgeSparks}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {profile.activeBuffs.length} active buff
                      {profile.activeBuffs.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </StaggerItem>

                {/* 4. Daily Streak */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Daily Streak</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#FF9F43] text-black">
                        <Flame className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      🔥 {profile.dailyStreak}d
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {profile.streamsWorkedToday.length} stream
                      {profile.streamsWorkedToday.length === 1 ? '' : 's'} worked today
                    </div>
                  </div>
                </StaggerItem>

                {/* 5. Active Streams Count */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Active Streams</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-black">
                        <Layers className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      {activeStreamsCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {streams.length} total · {completedStreamsCount} mastered
                    </div>
                  </div>
                </StaggerItem>

                {/* 6. Total Resources Completed */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Resources Read</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#22D3EE] text-black">
                        <BookOpen className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      {totalResourcesCompleted}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      Completed across streams
                    </div>
                  </div>
                </StaggerItem>

                {/* 7. Total Challenges Solved */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Challenges Solved</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#FF6B6B] text-black">
                        <Swords className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      {totalChallengesSolved}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {avgArenaScore !== null ? `Avg score: ${avgArenaScore}/100` : 'Arena ready'}
                    </div>
                  </div>
                </StaggerItem>

                {/* 8. Unlocked Achievements */}
                <StaggerItem>
                  <div className="neo-card-lift h-full rounded-base border-2 border-border bg-background p-4 shadow-[3px_3px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between font-heading text-xs font-bold text-muted-foreground">
                      <span>Achievements</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#A985FF] text-black">
                        <Award className="h-3.5 w-3.5 stroke-[2.25]" />
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-2xl font-black text-foreground">
                      {unlockedAchievementsCount}/{profile.achievements.length}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {completedQuestsCount}/{profile.bonusQuests.length} quests done
                    </div>
                  </div>
                </StaggerItem>
              </StaggerContainer>

              {/* 9. Latest Uploaded Resume Role & Seniority Card */}
              <div className="rounded-base border-2 border-border bg-[#88AAEE]/20 p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                <div className="flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                  <FileText className="h-4 w-4 stroke-[2.25]" />
                  <span>Latest Resume Profile Snapshot</span>
                </div>

                {latestResume?.profile ? (
                  <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-heading text-sm font-bold text-foreground">
                        {latestResume.profile.currentRole}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Seniority:{' '}
                        <strong className="font-heading text-foreground">
                          {latestResume.profile.seniorityEstimate}
                        </strong>{' '}
                        · {latestResume.profile.yearsOfExperience} yrs experience ·{' '}
                        <span className="font-mono text-[11px] font-bold text-foreground">
                          {latestResume.filename}
                        </span>
                      </div>
                    </div>
                    {latestResume.profile.superpowers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {latestResume.profile.superpowers.slice(0, 3).map((sp) => (
                          <Badge key={sp} variant="yellow" className="text-[11px]">
                            {sp}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : latestResume ? (
                  <p className="mt-2 text-xs text-foreground">
                    Uploaded resume: <strong className="font-heading">{latestResume.filename}</strong>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No resume analyzed yet. Upload a resume in{' '}
                    <strong className="font-heading text-foreground">
                      Resume &amp; Roadmaps
                    </strong>{' '}
                    to benchmark your role, seniority, and personalized career tracks.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Progression Ledger */}
          <Card>
            <CardHeader className="border-b-2 border-border pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Recent Progression Ledger</CardTitle>
                <Badge variant="neutral" className="font-mono text-xs">
                  {profile.recentEvents.length} recent event
                  {profile.recentEvents.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {profile.recentEvents.length === 0 ? (
                <div className="rounded-base border-2 border-dashed border-border bg-background p-4 text-xs text-muted-foreground">
                  Your progression ledger is ready. Launch a career stream, complete study guides,
                  or solve arena challenges to start earning XP and Forge Sparks.
                </div>
              ) : (
                <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {profile.recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-base border-2 border-border bg-background px-3.5 py-2.5 text-xs shadow-[2px_2px_0px_0px_var(--border)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading font-bold text-foreground">
                            {ev.description}
                          </span>
                          {ev.streamTitle && (
                            <Badge variant="default" className="px-2 py-0 text-[10px]">
                              {ev.streamTitle}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {new Date(ev.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="mint" className="font-mono text-[11px]">
                          +{ev.xpAmount} XP
                        </Badge>
                        {ev.sparksAmount > 0 ? (
                          <Badge variant="yellow" className="font-mono text-[11px]">
                            +{ev.sparksAmount}⚡
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
};
