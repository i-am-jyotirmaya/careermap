import crypto from 'node:crypto';
import { type CareerForgeDB, xpThresholdForLevel } from '../db/database.ts';
import type {
  Achievement,
  BonusAppliedItem,
  BonusQuest,
  GamificationDelta,
  ProblemDifficulty,
} from '../../shared/types.ts';

function dateStringToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStringYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export class GamificationService {
  private readonly db: CareerForgeDB;

  constructor(db: CareerForgeDB) {
    this.db = db;
  }

  public grantXpAndCheckProgression(params: {
    baseXp: number;
    baseSparks?: number;
    streamId?: string;
    source: string;
    description: string;
    consumeBuff?: boolean;
    extraAchievementCodes?: string[];
    questSignals?: {
      resourceCompleted?: boolean;
      evaluationPassed?: boolean;
    };
  }): {
    delta: GamificationDelta;
    bonusesApplied: BonusAppliedItem[];
  } {
    const bonusesApplied: BonusAppliedItem[] = [];
    let totalXp = Math.max(0, Math.round(params.baseXp));
    let totalSparks = Math.max(0, Math.round(params.baseSparks ?? Math.ceil(params.baseXp / 5)));

    const today = dateStringToday();
    const yesterday = dateStringYesterday();

    // Load current profile row
    const profileRow = this.db.db
      .prepare('SELECT * FROM player_profile WHERE id = 1')
      .get() as Record<string, unknown>;

    let dailyStreak = Number(profileRow.daily_streak ?? 0);
    const lastActive = profileRow.last_active_date ? String(profileRow.last_active_date) : null;

    if (lastActive !== today) {
      if (lastActive === yesterday) {
        dailyStreak += 1;
      } else {
        dailyStreak = 1;
      }
    }

    // Track distinct streams worked today for Cross-Stream Polymath Combo!
    const prevDate = profileRow.streams_worked_date ? String(profileRow.streams_worked_date) : null;
    const streamsTodaySet = new Set<string>(
      prevDate === today
        ? (JSON.parse(String(profileRow.streams_worked_today_json || '[]')) as string[])
        : []
    );

    if (params.streamId) {
      streamsTodaySet.add(params.streamId);
    }

    // Apply Multi-Stream Polymath Combo (1.25x XP when advancing 2+ streams on the same day!)
    if (params.streamId && streamsTodaySet.size >= 2 && totalXp > 0) {
      const polyBonus = Math.round(totalXp * 0.25);
      if (polyBonus > 0) {
        totalXp += polyBonus;
        bonusesApplied.push({
          label: 'Polymath Multi-Stream Combo',
          multiplierOrFlat: '1.25x',
          xpAdded: polyBonus,
        });
      }
    }

    // Apply Streak Bonus (5% per streak day, capped at +30%)
    if (dailyStreak >= 2 && totalXp > 0) {
      const pct = Math.min(0.3, dailyStreak * 0.05);
      const streakBonus = Math.round(totalXp * pct);
      if (streakBonus > 0) {
        totalXp += streakBonus;
        bonusesApplied.push({
          label: `${dailyStreak}-Day Forge Streak`,
          multiplierOrFlat: `+${Math.round(pct * 100)}%`,
          xpAdded: streakBonus,
        });
      }
    }

    // Consume active buff if applicable
    if (params.consumeBuff && totalXp > 0) {
      const buff = this.db.consumeOneBuffUse();
      if (buff && buff.multiplier > 1) {
        const buffAdd = Math.round(totalXp * (buff.multiplier - 1));
        totalXp += buffAdd;
        bonusesApplied.push({
          label: buff.label,
          multiplierOrFlat: `${buff.multiplier}x`,
          xpAdded: buffAdd,
        });
      }
    }

    // Update Stream independent XP, Level, and Stream Streak if streamId provided
    let leveledUpStream = false;
    let newStreamLevel: number | undefined;
    let streamTitle: string | null = null;

    if (params.streamId) {
      const sRow = this.db.db
        .prepare('SELECT * FROM career_streams WHERE id = ?')
        .get(params.streamId) as Record<string, unknown> | undefined;

      if (sRow) {
        streamTitle = String(sRow.title);
        let sLevel = Number(sRow.level ?? 1);
        let sXp = Number(sRow.xp ?? 0) + totalXp;
        let sStreak = Number(sRow.streak_days ?? 0);
        const sLastDate = sRow.last_activity_date ? String(sRow.last_activity_date) : null;

        if (sLastDate !== today) {
          sStreak = sLastDate === yesterday ? sStreak + 1 : 1;
        }

        while (sXp >= xpThresholdForLevel(sLevel)) {
          sXp -= xpThresholdForLevel(sLevel);
          sLevel += 1;
          leveledUpStream = true;
        }
        newStreamLevel = sLevel;

        this.db.db
          .prepare(
            `UPDATE career_streams
             SET level = ?, xp = ?, streak_days = ?, last_activity_date = ?, updated_at = ?
             WHERE id = ?`
          )
          .run(sLevel, sXp, sStreak, today, new Date().toISOString(), params.streamId);
      }
    }

    // Advance Bonus Quests
    const completedQuests = this.advanceBonusQuests({
      streamsWorkedTodayCount: streamsTodaySet.size,
      resourceCompleted: params.questSignals?.resourceCompleted ?? false,
      evaluationPassed: params.questSignals?.evaluationPassed ?? false,
    });

    for (const q of completedQuests) {
      totalXp += q.xpReward;
      totalSparks += q.sparksReward;
      bonusesApplied.push({
        label: `Quest Complete: ${q.title}`,
        multiplierOrFlat: `+${q.xpReward} XP`,
        xpAdded: q.xpReward,
      });
    }

    // Check Achievements
    const unlockedAchievements = this.evaluateAndUnlockAchievements({
      streamsWorkedTodayCount: streamsTodaySet.size,
      extraCodes: params.extraAchievementCodes ?? [],
    });

    for (const ach of unlockedAchievements) {
      totalXp += ach.xpBonus;
      totalSparks += ach.sparksBonus;
    }

    // Random Golden Spark Cache Drop (15% chance on Passing Evaluation)
    let lootDropMessage: string | null = null;
    if (params.questSignals?.evaluationPassed && Math.random() < 0.25) {
      const bonusSparks = 35;
      totalSparks += bonusSparks;
      this.db.addActiveBuff({
        label: 'Anvil SurgeDrop',
        description: '1.35x XP boost on your next evaluated practice challenge.',
        multiplier: 1.35,
        remainingUses: 1,
        source: 'Arena Loot Drop',
      });
      lootDropMessage = `Lucky Arena Drop! Found +${bonusSparks} Forge Sparks & a 1.35x Anvil Surge Buff!`;
    }

    // Apply Global XP & Level
    let globalLevel = Number(profileRow.global_level ?? 1);
    let globalXp = Number(profileRow.global_xp ?? 0) + totalXp;
    const initialGlobalLevel = globalLevel;

    while (globalXp >= xpThresholdForLevel(globalLevel)) {
      globalXp -= xpThresholdForLevel(globalLevel);
      globalLevel += 1;
    }

    const nextSparks = Number(profileRow.forge_sparks ?? 0) + totalSparks;

    this.db.db
      .prepare(
        `UPDATE player_profile
         SET global_level = ?, global_xp = ?, forge_sparks = ?, daily_streak = ?,
             last_active_date = ?, streams_worked_today_json = ?, streams_worked_date = ?
         WHERE id = 1`
      )
      .run(
        globalLevel,
        globalXp,
        nextSparks,
        dailyStreak,
        today,
        JSON.stringify([...streamsTodaySet]),
        today
      );

    if (totalXp > 0 || totalSparks > 0) {
      this.db.db
        .prepare(
          `INSERT INTO xp_events (id, stream_id, stream_title, source, xp_amount, sparks_amount, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          params.streamId ?? null,
          streamTitle,
          params.source,
          totalXp,
          totalSparks,
          params.description,
          new Date().toISOString()
        );
    }

    return {
      delta: {
        xpGained: totalXp,
        sparksGained: totalSparks,
        leveledUpGlobal: globalLevel > initialGlobalLevel,
        newGlobalLevel: globalLevel,
        leveledUpStream,
        newStreamLevel,
        unlockedAchievements,
        completedQuests,
        lootDropMessage,
      },
      bonusesApplied,
    };
  }

  public computeSubmissionBaseAndSkillBonuses(params: {
    problemBaseXp: number;
    difficulty: ProblemDifficulty;
    score: number;
    previousBestScore: number | null;
    attemptNumber: number;
    hintsRevealed: number;
  }): {
    baseXpToGrant: number;
    skillBonuses: BonusAppliedItem[];
    achievementCodes: string[];
  } {
    const skillBonuses: BonusAppliedItem[] = [];
    const achievementCodes: string[] = [];

    const passed = params.score >= 70;
    if (!passed) {
      // Consolation effort XP on first revision attempt so constructive effort is still acknowledged
      const effortXp = params.attemptNumber === 1 ? Math.round(params.problemBaseXp * 0.25) : 15;
      return { baseXpToGrant: effortXp, skillBonuses, achievementCodes };
    }

    achievementCodes.push('ARENA_BLOODED');

    // Avoid farming full XP repeatedly on already-passed problems unless improving score!
    let base = params.problemBaseXp;
    if (params.previousBestScore !== null && params.previousBestScore >= 70) {
      const improvement = Math.max(0, params.score - params.previousBestScore);
      base = improvement > 0 ? Math.round(improvement * 3) : 15;
    }

    // Flawless 92+ Bonus
    if (params.score >= 92) {
      achievementCodes.push('FLAWLESS_EXECUTION');
      if (params.previousBestScore === null || params.previousBestScore < 92) {
        const flawlessAdd = Math.round(params.problemBaseXp * 0.35);
        base += flawlessAdd;
        skillBonuses.push({
          label: 'Flawless Craftsmanship (92+)',
          multiplierOrFlat: '+35%',
          xpAdded: flawlessAdd,
        });
      }
    }

    // Iterative Comeback Bonus
    if (params.previousBestScore !== null && params.score - params.previousBestScore >= 15) {
      achievementCodes.push('COMEBACK_KID');
      const comebackAdd = 55;
      base += comebackAdd;
      skillBonuses.push({
        label: 'Iterative Comeback (+15 pts)',
        multiplierOrFlat: '+55 XP',
        xpAdded: comebackAdd,
      });
    }

    // Zero-Hint Pure Instinct Bonus
    if (params.hintsRevealed === 0 && (params.difficulty === 'hard' || params.difficulty === 'boss')) {
      achievementCodes.push('PURE_INSTINCT');
      const instinctAdd = 65;
      base += instinctAdd;
      skillBonuses.push({
        label: 'Zero-Hint Pure Instinct',
        multiplierOrFlat: '+65 XP',
        xpAdded: instinctAdd,
      });
    }

    if (params.difficulty === 'boss') {
      achievementCodes.push('BOSS_SLAYER');
    }

    return { baseXpToGrant: base, skillBonuses, achievementCodes };
  }

  public checkSystemAchievements(): Achievement[] {
    return this.evaluateAndUnlockAchievements({
      streamsWorkedTodayCount: 0,
      extraCodes: [],
    });
  }

  public triggerEasterEgg(params: {
    eggId: 'konami' | 'anvil_seven' | 'terminal_command';
    commandText?: string;
  }): {
    alreadyFound: boolean;
    message: string;
    asciiArt?: string;
    delta: GamificationDelta;
  } {
    const profileRow = this.db.db
      .prepare('SELECT easter_eggs_json FROM player_profile WHERE id = 1')
      .get() as { easter_eggs_json: string };
    const found = new Set<string>(JSON.parse(profileRow.easter_eggs_json || '[]') as string[]);

    const key =
      params.eggId === 'terminal_command'
        ? `terminal:${(params.commandText ?? '').trim().toLowerCase()}`
        : params.eggId;

    const alreadyFound = found.has(key);
    found.add(key);

    this.db.db
      .prepare('UPDATE player_profile SET easter_eggs_json = ? WHERE id = 1')
      .run(JSON.stringify([...found]));

    if (params.eggId === 'konami') {
      if (!alreadyFound) {
        this.db.addActiveBuff({
          label: 'Konami Overclock (1.5x XP)',
          description: '1.5x XP multiplier for your next 2 XP-earning actions!',
          multiplier: 1.5,
          remainingUses: 2,
          source: 'Konami Cheat Code',
        });
      }
      const { delta } = this.grantXpAndCheckProgression({
        baseXp: alreadyFound ? 0 : 50,
        baseSparks: alreadyFound ? 0 : 30,
        source: 'easter_egg',
        description: 'Activated Konami Overclock Sequence!',
        extraAchievementCodes: ['SECRET_KONAMI'],
      });
      return {
        alreadyFound,
        message: alreadyFound
          ? 'Konami Overclock pulsed again! Retro synth grid toggled.'
          : 'CHEAT CODE ACCEPTED! Unlocked "30 Lives Career Cheat", +1.5x Overclock Buff (2 charges), and bonus Sparks!',
        delta,
      };
    }

    if (params.eggId === 'anvil_seven') {
      if (!alreadyFound) {
        this.db.addActiveBuff({
          label: "Hephaestus's Tempered Blade (1.4x)",
          description: '1.4x XP boost forged on the anvil for 2 actions.',
          multiplier: 1.4,
          remainingUses: 2,
          source: 'Sevenfold Anvil Strike',
        });
      }
      const { delta } = this.grantXpAndCheckProgression({
        baseXp: alreadyFound ? 0 : 40,
        baseSparks: alreadyFound ? 0 : 25,
        source: 'easter_egg',
        description: 'Awakened the CareerForge Anvil!',
        extraAchievementCodes: ['SECRET_ANVIL_SEVEN'],
      });
      return {
        alreadyFound,
        message: alreadyFound
          ? 'CLANG! The anvil rings true across your active career streams.'
          : "CLANG x7! Hephaestus smiles upon your craft — 1.4x Tempered Blade Buff forged!",
        delta,
      };
    }

    // Terminal Oracle commands
    const cmd = (params.commandText ?? '').trim().toLowerCase();
    let responseMessage = '';
    let asciiArt: string | undefined;

    if (cmd === 'sudo promote') {
      responseMessage =
        'Nice try! Promotions cannot be `sudo`ed in prod — but here is Secret Root Access XP to speed up the real thing.';
      asciiArt = '[sudo] password for candidate: ********\nGranting Staff+ trajectory privileges... OK';
    } else if (cmd === 'jev --explain') {
      responseMessage =
        'TypeSafe Jev (System One) evaluates (state, typed_questions) -> calibrated choice probabilities in ~400ms, saving frontier tokens for frontier problems!';
      asciiArt = 'state ─▶ [Jev System One] ─▶ P(frontier)=0.84 | P(fast)=0.16';
    } else if (cmd === 'rubberduck') {
      responseMessage =
        'Quack! Explain the bug out loud line-by-line. Half of distributed systems bugs surrender before sentence three.';
      asciiArt = '   __\n <(o )___  "Have you checked idempotency & timeouts?"\n  ( ._> /\n   `---\'';
    } else if (cmd === 'coffee') {
      responseMessage = 'HTTP 418: I am a teapot, brewing dark-roast focus fuel for your streams.';
      asciiArt = '  ( (\n   ) )\n........\n|      |]\n\\      /\n `----\'';
    } else {
      responseMessage = `Oracle Console acknowledged "${cmd}". Try: sudo promote | jev --explain | rubberduck | coffee`;
    }

    const { delta } = this.grantXpAndCheckProgression({
      baseXp: alreadyFound ? 0 : 35,
      baseSparks: alreadyFound ? 0 : 20,
      source: 'easter_egg',
      description: `Oracle Console command discovered: ${cmd || 'help'}`,
      extraAchievementCodes: ['SECRET_TERMINAL_HACKER'],
    });

    return {
      alreadyFound,
      message: responseMessage,
      asciiArt,
      delta,
    };
  }

  public redeemMysteryReliquary(): {
    rewardTitle: string;
    rewardDescription: string;
    delta: GamificationDelta;
  } {
    const cost = 40;
    const row = this.db.db
      .prepare('SELECT forge_sparks FROM player_profile WHERE id = 1')
      .get() as { forge_sparks: number };

    if (row.forge_sparks < cost) {
      throw new Error(`Need ${cost} Forge Sparks to transmute at the Reliquary (you have ${row.forge_sparks}).`);
    }

    this.db.db
      .prepare('UPDATE player_profile SET forge_sparks = forge_sparks - ? WHERE id = 1')
      .run(cost);

    const roll = Math.random();
    let rewardTitle = '';
    let rewardDescription = '';
    let bonusXp = 0;
    let bonusSparks = 0;

    if (roll < 0.4) {
      this.db.addActiveBuff({
        label: 'Mythic Focus Elixir (1.6x XP)',
        description: '1.6x XP multiplier on your next 2 learning or practice completions!',
        multiplier: 1.6,
        remainingUses: 2,
        source: 'Mystery Reliquary',
      });
      rewardTitle = 'Mythic Focus Elixir (1.6x XP)';
      rewardDescription = 'Granted a 2-charge 1.6x XP multiplier buff for upcoming challenges!';
      bonusXp = 35;
    } else if (roll < 0.75) {
      const now = new Date().toISOString();
      this.db.db
        .prepare(
          `INSERT INTO bonus_quests (id, title, description, quest_type, target_count, current_count, xp_reward, sparks_reward, completed_at, created_at)
           VALUES (?, ?, ?, 'mystery_drop', 1, 0, 220, 75, NULL, ?)`
        )
        .run(
          crypto.randomUUID(),
          'Reliquary High-Stakes Bounty',
          'Pass your next practice problem evaluation to claim a 220 XP bounty!',
          now
        );
      rewardTitle = 'Reliquary High-Stakes Bounty Scroll';
      rewardDescription = 'Unfurled a special Bonus Quest worth +220 XP & +75 Sparks on your next passed problem!';
      bonusXp = 25;
    } else {
      bonusXp = 110;
      bonusSparks = 55;
      rewardTitle = 'Philosopher’s Spark Jackpot!';
      rewardDescription = 'Your 40 Sparks crystallized into +110 pure XP and +55 Sparks!';
    }

    const { delta } = this.grantXpAndCheckProgression({
      baseXp: bonusXp,
      baseSparks: bonusSparks,
      source: 'reliquary',
      description: `Reliquary Transmutation: ${rewardTitle}`,
      extraAchievementCodes: ['SECRET_NIGHT_OWL_OR_LOOT'],
    });

    return { rewardTitle, rewardDescription, delta };
  }

  private advanceBonusQuests(params: {
    streamsWorkedTodayCount: number;
    resourceCompleted: boolean;
    evaluationPassed: boolean;
  }): BonusQuest[] {
    const activeQuests = this.db.db
      .prepare('SELECT * FROM bonus_quests WHERE completed_at IS NULL')
      .all() as Array<Record<string, unknown>>;

    const newlyCompleted: BonusQuest[] = [];
    const now = new Date().toISOString();

    for (const q of activeQuests) {
      const id = String(q.id);
      const qType = String(q.quest_type);
      const title = String(q.title);
      const target = Number(q.target_count);
      let current = Number(q.current_count);

      if (qType === 'cross_stream') {
        current = Math.max(current, params.streamsWorkedTodayCount);
      } else if (qType === 'mystery_drop' && params.evaluationPassed) {
        current += 1;
      } else if (title.includes('Knowledge') && params.resourceCompleted) {
        current += 1;
      } else if (title.includes('Arena') && params.evaluationPassed) {
        current += 1;
      }

      const done = current >= target;
      this.db.db
        .prepare('UPDATE bonus_quests SET current_count = ?, completed_at = ? WHERE id = ?')
        .run(Math.min(target, current), done ? now : null, id);

      if (done) {
        newlyCompleted.push({
          id,
          title,
          description: String(q.description),
          questType: qType as BonusQuest['questType'],
          targetCount: target,
          currentCount: target,
          xpReward: Number(q.xp_reward),
          sparksReward: Number(q.sparks_reward),
          completedAt: now,
          createdAt: String(q.created_at),
        });
      }
    }

    return newlyCompleted;
  }

  private evaluateAndUnlockAchievements(params: {
    streamsWorkedTodayCount: number;
    extraCodes: string[];
  }): Achievement[] {
    const codesToUnlock = new Set<string>(params.extraCodes);

    const enabledProviders = this.db.listProviders().filter((p) => p.enabled);
    if (enabledProviders.length >= 1) codesToUnlock.add('ENGINE_IGNITED');
    if (enabledProviders.length >= 2) codesToUnlock.add('MULTI_PROVIDER_FLEET');

    const jevCfg = this.db.getJevConfig();
    if (jevCfg.hasApiKey || this.db.countRoutingDecisions() >= 5) {
      codesToUnlock.add('SYSTEM_ONE_ONLINE');
    }

    if (this.db.getLatestResume()?.profile) {
      codesToUnlock.add('ORIGIN_STORY');
    }

    const activeStreams = this.db.listStreams().filter((s) => s.status === 'active');
    if (activeStreams.length >= 1) codesToUnlock.add('FIRST_STREAM');
    if (activeStreams.length >= 2) codesToUnlock.add('MULTIVERSE_TRAVELER');
    if (activeStreams.length >= 3) codesToUnlock.add('TRIPLE_THREAT');

    const totalCompletedRes = this.db.countTotalCompletedResources();
    if (totalCompletedRes >= 1) codesToUnlock.add('SCHOLAR_FIRST');
    if (totalCompletedRes >= 5) codesToUnlock.add('DEEP_SCHOLAR');

    if (params.streamsWorkedTodayCount >= 2) {
      codesToUnlock.add('CROSS_POLLINATOR');
    }

    const masteredTopicRow = this.db.db
      .prepare("SELECT COUNT(*) as cnt FROM stream_topics WHERE status = 'mastered'")
      .get() as { cnt: number };
    if (masteredTopicRow.cnt >= 1) {
      codesToUnlock.add('TOPIC_MASTER');
    }

    const newlyUnlocked: Achievement[] = [];
    for (const code of codesToUnlock) {
      const unlocked = this.db.unlockAchievementByCode(code);
      if (unlocked) {
        newlyUnlocked.push(unlocked);
      }
    }
    return newlyUnlocked;
  }
}
