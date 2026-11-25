import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  CheckCircle2,
  Flame,
  Gem,
  Loader2,
  Lock,
  Sparkles,
  Terminal,
  Trophy,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { GamificationDelta, PlayerProfile } from '../../shared/types.ts';

interface Props {
  profile: PlayerProfile;
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  onOpenConsole: () => void;
}

const DEFAULT_TIER_STYLE = 'bg-[#FDBA74] border-2 border-border text-black shadow-shadow';

const TIER_STYLES: Record<string, string> = {
  bronze: DEFAULT_TIER_STYLE,
  silver: 'bg-[#E2E8F0] border-2 border-border text-black shadow-shadow',
  gold: 'bg-[#FFDC58] border-2 border-border text-black shadow-shadow',
  mythic: 'bg-[#A985FF] border-2 border-border text-black shadow-shadow',
  secret: 'bg-[#22D3EE] border-2 border-border text-black shadow-shadow',
};

export const GamificationVaultView: React.FC<Props> = ({
  profile,
  onRefreshAll,
  onGamificationDelta,
  onOpenConsole,
}) => {
  const [nameInput, setNameInput] = useState(profile.displayName);
  const [savingName, setSavingName] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [reliquaryBanner, setReliquaryBanner] = useState<string | null>(null);

  const unlockedCount = profile.achievements.filter((a) => Boolean(a.unlockedAt)).length;
  const xpPct = Math.min(
    100,
    Math.round((profile.globalXp / Math.max(1, profile.xpToNextLevel)) * 100)
  );

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await api.updatePlayerName(nameInput);
      await onRefreshAll();
    } finally {
      setSavingName(false);
    }
  };

  const handleRedeemReliquary = async () => {
    setRedeeming(true);
    setReliquaryBanner(null);
    try {
      const res = await api.redeemReliquary();
      setReliquaryBanner(`${res.rewardTitle}: ${res.rewardDescription}`);
      onGamificationDelta(res.delta);
      await onRefreshAll();
    } catch (err) {
      setReliquaryBanner(err instanceof Error ? err.message : 'Transmutation failed');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <PageTransition className="space-y-8">
      {/* Vibrant Neobrutalist Rank Hero Banner */}
      <div className="overflow-hidden rounded-base border-2 border-border bg-secondary-background shadow-brutal-lg">
        {/* Accent Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-[#FFDC58] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="dark" className="px-3 py-1 text-xs">
              <Trophy className="h-3.5 w-3.5 text-[#FFDC58]" />
              Global Level {profile.globalLevel} · {profile.rankTitle}
            </Badge>
            {profile.polymathMultiplierActive && (
              <Badge variant="mint" className="text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                1.25x Polymath Active Today!
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-black">
            <span>CareerForge Progression Vault</span>
            <NeoStarBurst fill="#A985FF" size={26} />
          </div>
        </div>

        {/* Hero Body */}
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4 lg:max-w-md lg:flex-1">
            <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2.5">
              <Input
                type="text"
                aria-label="Player display name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="max-w-xs font-heading text-lg font-bold"
              />
              {nameInput !== profile.displayName && (
                <Button type="submit" variant="mint" size="sm" disabled={savingName}>
                  {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </Button>
              )}
            </form>

            <div className="w-full max-w-sm">
              <div className="flex justify-between font-mono text-xs font-bold text-foreground">
                <span>
                  Global XP: {profile.globalXp} / {profile.xpToNextLevel}
                </span>
                <span>{xpPct}%</span>
              </div>
              <Progress
                value={xpPct}
                className="mt-1.5 h-4"
                indicatorClassName="bg-[#05E17A]"
              />
            </div>
          </div>

          {/* Brutalist Stat Blocks */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="neo-card-lift rounded-base border-2 border-border bg-[#FFDC58] px-4 py-3 text-black shadow-shadow">
              <div className="inline-flex items-center gap-1 font-heading text-xl font-black sm:text-2xl">
                <Zap className="h-5 w-5 stroke-[2.5]" />
                {profile.forgeSparks}
              </div>
              <div className="mt-0.5 font-heading text-[11px] font-bold uppercase tracking-wide text-black/80">
                Forge Sparks
              </div>
            </div>

            <div className="neo-card-lift rounded-base border-2 border-border bg-[#FF9F43] px-4 py-3 text-black shadow-shadow">
              <div className="inline-flex items-center gap-1 font-heading text-xl font-black sm:text-2xl">
                <Flame className="h-5 w-5 stroke-[2.5]" />
                {profile.dailyStreak}d
              </div>
              <div className="mt-0.5 font-heading text-[11px] font-bold uppercase tracking-wide text-black/80">
                Daily Streak
              </div>
            </div>

            <div className="neo-card-lift rounded-base border-2 border-border bg-[#05E17A] px-4 py-3 text-black shadow-shadow">
              <div className="font-heading text-xl font-black sm:text-2xl">
                {unlockedCount}/{profile.achievements.length}
              </div>
              <div className="mt-0.5 font-heading text-[11px] font-bold uppercase tracking-wide text-black/80">
                Achievements
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Mystery Reliquary + Active Buffs + Bonus Quests */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mystery Spark Reliquary */}
        <div className="flex flex-col justify-between rounded-base border-2 border-border bg-[#A985FF]/25 p-6 shadow-shadow">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#A985FF] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                <Gem className="h-5 w-5 stroke-[2.25]" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground">
                Mystery Spark Reliquary
              </h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foreground">
              Transmute <strong>40 Forge Sparks</strong> into a random mythic reward: 1.6x Focus
              Elixir XP buffs, High-Stakes Bounty Quests, or Philosopher&apos;s Spark Jackpots!
            </p>
            <AnimatePresence mode="wait">
              {reliquaryBanner && (
                <motion.div
                  key={reliquaryBanner}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={NEO_SPRING}
                  className="mt-3.5 rounded-base border-2 border-border bg-[#FFDC58] p-3 text-xs font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]"
                >
                  ✨ {reliquaryBanner}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            type="button"
            variant="violet"
            onClick={handleRedeemReliquary}
            disabled={redeeming || profile.forgeSparks < 40}
            className="mt-5 w-full"
          >
            {redeeming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Transmute 40 Sparks ({profile.forgeSparks} available)
          </Button>
        </div>

        {/* Active XP Buffs & Whispered Forge Rumors */}
        <div className="space-y-4 rounded-base border-2 border-border bg-secondary-background p-6 shadow-shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold text-foreground">
              Active Multiplier Buffs
            </h3>
            {profile.polymathMultiplierActive && (
              <Badge variant="mint" className="text-[10px]">
                1.25x Polymath Active Today!
              </Badge>
            )}
          </div>

          {profile.activeBuffs.length === 0 ? (
            <div className="rounded-base border-2 border-dashed border-border bg-background p-3.5 text-xs text-muted-foreground">
              No active XP elixirs right now. Earn Arena Loot Drops, transmute Sparks, or uncover
              hidden Forge secrets!
            </div>
          ) : (
            <div className="space-y-2.5">
              {profile.activeBuffs.map((b) => (
                <div
                  key={b.id}
                  className="rounded-base border-2 border-border bg-[#FFDC58]/55 p-3 text-xs text-black shadow-[2px_2px_0px_0px_var(--border)]"
                >
                  <div className="flex items-center justify-between font-heading font-bold">
                    <span>{b.label}</span>
                    <Badge variant="neutral" className="px-2 py-0 font-mono text-[10px]">
                      {b.remainingUses} uses left
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-black/85">{b.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Whispered Forge Rumors */}
          <div className="space-y-2 rounded-base border-2 border-border bg-[#22D3EE]/25 p-3.5 text-[11px] text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
            <div className="flex flex-wrap items-center justify-between gap-2 font-heading text-xs font-bold text-foreground">
              <span>Whispered Forge Rumors ({profile.easterEggsFound.length} Secrets Found)</span>
              <Button
                type="button"
                variant="neutral"
                size="xs"
                onClick={onOpenConsole}
                className="h-7 bg-[#FFDC58] px-2 text-[10px] text-black hover:bg-[#FFDC58]"
              >
                <Terminal className="h-3 w-3" /> Oracle (`Ctrl+K`)
              </Button>
            </div>
            <p className="font-medium text-foreground/85">
              • Legends speak of an old 10-key arcade sequence (`↑↑↓↓←→←→BA`)...
            </p>
            <p className="font-medium text-foreground/85">
              • Striking the top-left CareerForge anvil 7 times rapidly awakens ancient heat...
            </p>
            <p className="font-medium text-foreground/85">
              • The Oracle Console responds to `sudo promote`, `jev --explain`, and `rubberduck`.
            </p>
          </div>
        </div>

        {/* Cross-Stream Bonus Quests */}
        <div className="space-y-3.5 rounded-base border-2 border-border bg-secondary-background p-6 shadow-shadow">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold text-foreground">
              Cross-Stream Bonus Quests
            </h3>
            <Badge variant="default" className="font-mono text-[10px]">
              {profile.bonusQuests.filter((q) => Boolean(q.completedAt)).length}/
              {profile.bonusQuests.length}
            </Badge>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {profile.bonusQuests.map((q) => {
              const done = Boolean(q.completedAt);
              const pct = Math.min(
                100,
                Math.round((q.currentCount / Math.max(1, q.targetCount)) * 100)
              );
              return (
                <div
                  key={q.id}
                  className={`rounded-base border-2 border-border p-3.5 text-xs shadow-[2px_2px_0px_0px_var(--border)] ${
                    done ? 'bg-[#05E17A]/25' : 'bg-background'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 font-heading font-bold">
                    <span className="text-foreground">{q.title}</span>
                    <Badge variant="yellow" className="px-2 py-0 font-mono text-[10px]">
                      +{q.xpReward} XP · +{q.sparksReward}⚡
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{q.description}</p>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <Progress
                      value={pct}
                      className="h-3 flex-1"
                      indicatorClassName={done ? 'bg-[#05E17A]' : 'bg-[#88AAEE]'}
                    />
                    <span className="font-mono text-[11px] font-bold text-foreground">
                      {q.currentCount}/{q.targetCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 20 Unlockable Achievements Grid */}
      <div className="rounded-base border-2 border-border bg-secondary-background p-6 shadow-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-xl font-bold text-foreground">
            Unlockable Achievements ({unlockedCount} / {profile.achievements.length})
          </h2>
          <Badge variant="yellow" className="font-mono text-xs">
            {Math.round((unlockedCount / Math.max(1, profile.achievements.length)) * 100)}% Unlocked
          </Badge>
        </div>

        <StaggerContainer
          staggerDelay={0.03}
          className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {profile.achievements.map((ach) => {
            const unlocked = Boolean(ach.unlockedAt);
            const cls = TIER_STYLES[ach.tier] ?? DEFAULT_TIER_STYLE;
            return (
              <StaggerItem key={ach.id}>
                <div
                  className={`flex h-full flex-col justify-between rounded-base p-4 transition-all duration-200 ${
                    unlocked
                      ? `${cls} neo-card-lift`
                      : 'border-2 border-dashed border-border bg-background opacity-70 text-foreground'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-base border-2 border-black bg-secondary-background px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-black">
                        {ach.tier}
                      </span>
                      {unlocked ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-[#05E17A] text-black">
                          <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
                        </div>
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5 font-heading text-sm font-bold text-black">
                      <Award className="h-4 w-4 shrink-0 stroke-[2.25]" />
                      <span>
                        {ach.isSecret && !unlocked ? '??? Secret Achievement' : ach.title}
                      </span>
                    </div>

                    <p
                      className={`mt-1 text-xs leading-relaxed ${
                        unlocked ? 'font-medium text-black/85' : 'text-muted-foreground'
                      }`}
                    >
                      {ach.isSecret && !unlocked
                        ? 'Follow the Whispered Forge Rumors to uncover this hidden feat.'
                        : ach.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-black/20 font-mono text-[11px] font-bold text-black">
                    +{ach.xpBonus} XP · +{ach.sparksBonus} Sparks
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>

      {/* Recent XP Activity Feed */}
      {profile.recentEvents.length > 0 && (
        <div className="rounded-base border-2 border-border bg-secondary-background p-6 shadow-shadow">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold text-foreground">
              Recent Progression Ledger
            </h3>
            <Badge variant="neutral" className="font-mono text-xs">
              {profile.recentEvents.length} Events
            </Badge>
          </div>
          <div className="mt-3.5 max-h-60 space-y-2.5 overflow-y-auto pr-1">
            {profile.recentEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-base border-2 border-border bg-background px-3.5 py-2.5 text-xs shadow-[2px_2px_0px_0px_var(--border)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading font-bold text-foreground">{ev.description}</span>
                  {ev.streamTitle && (
                    <Badge variant="default" className="px-2 py-0 text-[10px]">
                      {ev.streamTitle}
                    </Badge>
                  )}
                </div>
                <Badge variant="mint" className="font-mono text-[11px]">
                  +{ev.xpAmount} XP {ev.sparksAmount > 0 ? `· +${ev.sparksAmount}⚡` : ''}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageTransition>
  );
};
