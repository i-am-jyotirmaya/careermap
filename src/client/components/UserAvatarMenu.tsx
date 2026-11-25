import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain,
  ChevronDown,
  Code2,
  Compass,
  Cpu,
  Flame,
  Rocket,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { NEO_SPRING } from '@/components/ui/motion-primitives';
import type {
  AvatarColor,
  AvatarIcon,
  PlayerProfile,
  SystemStatusResponse,
} from '../../shared/types.ts';

export type UserMenuDestination = 'profile' | 'vault' | 'settings';

export interface UserAvatarMenuProps {
  profile: PlayerProfile;
  status: SystemStatusResponse;
  activeDestination: string;
  onNavigate: (dest: UserMenuDestination) => void;
  onOpenConsole: () => void;
}

export interface AvatarColorTheme {
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  swatchBg: string;
  ringActive: string;
  softGlow: string;
}

export const AVATAR_COLOR_MAP: Record<AvatarColor, AvatarColorTheme> = {
  indigo: {
    label: 'Indigo Pulse',
    badgeBg: 'bg-[#88AAEE]',
    badgeBorder: 'border-black',
    badgeText: 'text-black',
    swatchBg: 'bg-[#88AAEE]',
    ringActive: 'ring-black',
    softGlow: 'shadow-[2px_2px_0px_0px_#000]',
  },
  emerald: {
    label: 'Emerald Forge',
    badgeBg: 'bg-[#05E17A]',
    badgeBorder: 'border-black',
    badgeText: 'text-black',
    swatchBg: 'bg-[#05E17A]',
    ringActive: 'ring-black',
    softGlow: 'shadow-[2px_2px_0px_0px_#000]',
  },
  amber: {
    label: 'Amber Spark',
    badgeBg: 'bg-[#FFDC58]',
    badgeBorder: 'border-black',
    badgeText: 'text-black',
    swatchBg: 'bg-[#FFDC58]',
    ringActive: 'ring-black',
    softGlow: 'shadow-[2px_2px_0px_0px_#000]',
  },
  rose: {
    label: 'Rose Ember',
    badgeBg: 'bg-[#FF6B6B]',
    badgeBorder: 'border-black',
    badgeText: 'text-black',
    swatchBg: 'bg-[#FF6B6B]',
    ringActive: 'ring-black',
    softGlow: 'shadow-[2px_2px_0px_0px_#000]',
  },
  cyan: {
    label: 'Cyan Vector',
    badgeBg: 'bg-[#22D3EE]',
    badgeBorder: 'border-black',
    badgeText: 'text-black',
    swatchBg: 'bg-[#22D3EE]',
    ringActive: 'ring-black',
    softGlow: 'shadow-[2px_2px_0px_0px_#000]',
  },
  violet: {
    label: 'Violet Mythic',
    badgeBg: 'bg-[#A985FF]',
    badgeBorder: 'border-black',
    badgeText: 'text-black',
    swatchBg: 'bg-[#A985FF]',
    ringActive: 'ring-black',
    softGlow: 'shadow-[2px_2px_0px_0px_#000]',
  },
};

export const AVATAR_COLOR_OPTIONS: AvatarColor[] = [
  'indigo',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'violet',
];

export const AVATAR_ICON_MAP: Record<
  AvatarIcon,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  User: { label: 'Explorer', Icon: User },
  Rocket: { label: 'Vanguard', Icon: Rocket },
  Code2: { label: 'Craftsman', Icon: Code2 },
  Brain: { label: 'Polymath', Icon: Brain },
  Shield: { label: 'Guardian', Icon: Shield },
  Sparkles: { label: 'Alchemist', Icon: Sparkles },
  Compass: { label: 'Navigator', Icon: Compass },
  Cpu: { label: 'Architect', Icon: Cpu },
};

export const AVATAR_ICON_OPTIONS: AvatarIcon[] = [
  'User',
  'Rocket',
  'Code2',
  'Brain',
  'Shield',
  'Sparkles',
  'Compass',
  'Cpu',
];

export interface AvatarBadgeProps {
  color: AvatarColor;
  icon: AvatarIcon;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  connected?: boolean;
  className?: string;
}

const AVATAR_SIZE_CLASSES: Record<
  NonNullable<AvatarBadgeProps['size']>,
  { wrapper: string; icon: string; dot: string }
> = {
  sm: {
    wrapper: 'h-8 w-8',
    icon: 'h-4 w-4 stroke-[2.25]',
    dot: 'h-3 w-3 -bottom-1 -right-1',
  },
  md: {
    wrapper: 'h-9 w-9',
    icon: 'h-4.5 w-4.5 stroke-[2.25]',
    dot: 'h-3 w-3 -bottom-1 -right-1',
  },
  lg: {
    wrapper: 'h-12 w-12',
    icon: 'h-6 w-6 stroke-[2.25]',
    dot: 'h-3.5 w-3.5 -bottom-1 -right-1',
  },
  xl: {
    wrapper: 'h-16 w-16',
    icon: 'h-8 w-8 stroke-[2.25]',
    dot: 'h-4 w-4 -bottom-1 -right-1',
  },
};

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  color,
  icon,
  size = 'md',
  connected = false,
  className = '',
}) => {
  const theme = AVATAR_COLOR_MAP[color] ?? AVATAR_COLOR_MAP.indigo;
  const iconEntry = AVATAR_ICON_MAP[icon] ?? AVATAR_ICON_MAP.User;
  const sizeSpec = AVATAR_SIZE_CLASSES[size];
  const IconComponent = iconEntry.Icon;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-base border-2 border-black text-black shadow-[2px_2px_0px_0px_#000] ${sizeSpec.wrapper} ${theme.badgeBg}`}
      >
        <IconComponent className={sizeSpec.icon} />
      </div>
      {connected && (
        <span
          title="AI Engine Connected"
          className={`absolute rounded-full border-2 border-black bg-[#05E17A] ${sizeSpec.dot}`}
        />
      )}
    </div>
  );
};

export const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({
  profile,
  status,
  activeDestination,
  onNavigate,
  onOpenConsole,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const isMenuDestinationActive =
    activeDestination === 'profile' ||
    activeDestination === 'vault' ||
    activeDestination === 'settings';

  const unlockedCount = profile.achievements.filter((a) => Boolean(a.unlockedAt)).length;
  const totalAchievements = profile.achievements.length;
  const xpPercent = Math.min(
    100,
    Math.round((profile.globalXp / Math.max(1, profile.xpToNextLevel)) * 100)
  );
  const hasConnectedProvider = status.connectedProviderCount > 0;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        event.target instanceof Node &&
        !menuContainerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectDestination = (dest: UserMenuDestination) => {
    setIsOpen(false);
    onNavigate(dest);
  };

  const handleTriggerConsole = () => {
    setIsOpen(false);
    onOpenConsole();
  };

  return (
    <div ref={menuContainerRef} className="relative">
      {/* Top-Right Neobrutalist User Avatar Trigger */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`neo-press group inline-flex cursor-pointer items-center gap-2.5 rounded-base border-2 border-border px-2.5 py-1.5 text-left sm:pr-3 ${
          isOpen || isMenuDestinationActive
            ? 'bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)] translate-x-[1px] translate-y-[1px]'
            : 'bg-secondary-background text-foreground shadow-shadow hover:bg-background'
        }`}
      >
        <AvatarBadge
          color={profile.avatarColor}
          icon={profile.avatarIcon}
          size="sm"
          connected={hasConnectedProvider}
        />

        <div className="hidden sm:flex sm:items-center sm:gap-2">
          <div className="max-w-[130px]">
            <div className="truncate font-heading text-xs font-bold leading-tight text-foreground">
              {profile.displayName}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] font-bold leading-none text-muted-foreground">
              <span className="text-foreground">Lvl {profile.globalLevel}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5 text-foreground">
                ⚡ {profile.forgeSparks}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 stroke-[2.5] text-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Floating Right-Aligned Neobrutalist Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            aria-label="User navigation menu"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={NEO_SPRING}
            className="absolute right-0 top-full z-50 mt-2.5 w-80 origin-top-right overflow-hidden rounded-base border-2 border-border bg-secondary-background text-foreground shadow-brutal-lg sm:w-[22rem]"
          >
            {/* Profile Header Card */}
            <div className="border-b-2 border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <AvatarBadge
                  color={profile.avatarColor}
                  icon={profile.avatarIcon}
                  size="lg"
                  connected={hasConnectedProvider}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-heading text-sm font-bold text-foreground">
                      {profile.displayName}
                    </div>
                    <Badge variant="default" className="font-mono text-[10px]">
                      Lvl {profile.globalLevel}
                    </Badge>
                  </div>

                  {profile.headlineTitle && (
                    <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                      {profile.headlineTitle}
                    </p>
                  )}

                  <div className="mt-1 inline-block rounded-base border border-border bg-[#FFDC58] px-2 py-0.5 font-heading text-[10px] font-bold text-black">
                    {profile.rankTitle}
                  </div>
                </div>
              </div>

              {/* XP Progress Mini-Bar */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between font-mono text-[11px] font-bold text-foreground">
                  <span>
                    XP {profile.globalXp} / {profile.xpToNextLevel}
                  </span>
                  <span>{xpPercent}%</span>
                </div>
                <Progress
                  value={xpPercent}
                  className="mt-1.5 h-3"
                  indicatorClassName="bg-[#05E17A]"
                />
              </div>

              {/* Streak, Sparks & Polymath Multiplier Pills */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant="coral" className="text-[11px]">
                  <Flame className="h-3 w-3" />
                  🔥 {profile.dailyStreak}d
                </Badge>
                <Badge variant="yellow" className="text-[11px]">
                  <Zap className="h-3 w-3" />
                  {profile.forgeSparks} Sparks
                </Badge>
                {profile.polymathMultiplierActive && (
                  <Badge variant="mint" className="text-[11px]">
                    <Sparkles className="h-3 w-3" />
                    1.25x Polymath
                  </Badge>
                )}
              </div>
            </div>

            {/* Menu Actions */}
            <div className="space-y-1.5 p-2.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelectDestination('profile')}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-base border-2 px-3 py-2.5 text-left transition-all duration-150 ${
                  activeDestination === 'profile'
                    ? 'border-border bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)]'
                    : 'border-transparent bg-secondary-background text-foreground hover:border-border hover:bg-background hover:shadow-[2px_2px_0px_0px_var(--border)]'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#88AAEE] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                  <User className="h-4 w-4 stroke-[2.25]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-xs font-bold text-foreground">User Profile</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    Identity, avatar &amp; career stats
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelectDestination('vault')}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-base border-2 px-3 py-2.5 text-left transition-all duration-150 ${
                  activeDestination === 'vault'
                    ? 'border-border bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)]'
                    : 'border-transparent bg-secondary-background text-foreground hover:border-border hover:bg-background hover:shadow-[2px_2px_0px_0px_var(--border)]'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                  <Trophy className="h-4 w-4 stroke-[2.25]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-xs font-bold text-foreground">
                      Vault &amp; Achievements
                    </span>
                    <Badge variant="violet" className="px-2 py-0 font-mono text-[10px]">
                      {unlockedCount}/{totalAchievements}
                    </Badge>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    Reliquary, buffs, quests &amp; badges
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelectDestination('settings')}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-base border-2 px-3 py-2.5 text-left transition-all duration-150 ${
                  activeDestination === 'settings'
                    ? 'border-border bg-[#FFDC58] text-black shadow-[2px_2px_0px_0px_var(--border)]'
                    : 'border-transparent bg-secondary-background text-foreground hover:border-border hover:bg-background hover:shadow-[2px_2px_0px_0px_var(--border)]'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#05E17A] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                  <Settings className="h-4 w-4 stroke-[2.25]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-xs font-bold text-foreground">Settings</span>
                    <Badge
                      variant={hasConnectedProvider ? 'mint' : 'neutral'}
                      className="px-2 py-0 font-mono text-[10px]"
                    >
                      {status.connectedProviderCount} Connected
                    </Badge>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    AI Engine, Jev Router, Cache &amp; Danger Zone
                  </div>
                </div>
              </button>

              <div className="my-1.5 border-t-2 border-border" />

              <button
                type="button"
                role="menuitem"
                onClick={handleTriggerConsole}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-base border-2 border-border bg-[#22D3EE]/20 px-3 py-2 text-left text-foreground transition-all duration-150 hover:bg-[#22D3EE]/45 hover:shadow-[2px_2px_0px_0px_var(--border)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#22D3EE] text-black shadow-[2px_2px_0px_0px_var(--border)]">
                    <Terminal className="h-4 w-4 stroke-[2.25]" />
                  </div>
                  <div>
                    <div className="font-heading text-xs font-bold text-foreground">
                      Secret Oracle Console
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Invoke terminal commands &amp; lore
                    </div>
                  </div>
                </div>
                <kbd className="rounded-base border-2 border-border bg-[#FFDC58] px-2 py-0.5 font-mono text-[10px] font-bold text-black shadow-[2px_2px_0px_0px_var(--border)]">
                  Ctrl+K
                </kbd>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
