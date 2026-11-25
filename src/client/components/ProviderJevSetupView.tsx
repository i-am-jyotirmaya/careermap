import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NEO_GENTLE_SPRING,
  NEO_SPRING,
  NeoSelect,
  NeoStarBurst,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/motion-primitives';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { api } from '../lib/api.ts';
import type {
  AIProviderRecord,
  GamificationDelta,
  JevChannel,
  JevConfig,
  JevCostPolicy,
  ProviderModelConfig,
  ProviderType,
  RoutingDecision,
  SystemStatusResponse,
} from '../../shared/types.ts';

interface Props {
  status: SystemStatusResponse;
  providers: AIProviderRecord[];
  presets: Record<
    ProviderType,
    { defaultName: string; defaultBaseUrl: string; models: ProviderModelConfig[] }
  >;
  jevConfig: JevConfig;
  routingDecisions: RoutingDecision[];
  onRefreshAll: () => Promise<void>;
  onGamificationDelta: (delta: GamificationDelta | null) => void;
  onGoToResume: () => void;
  hideContinueButton?: boolean;
}

const PROVIDER_CARDS: Array<{
  type: ProviderType;
  label: string;
  subtitle: string;
  badge: string;
  badgeVariant: 'yellow' | 'cyan' | 'violet' | 'mint' | 'coral';
}> = [
  {
    type: 'codex_subscription',
    label: 'ChatGPT Codex Subscription',
    subtitle: 'Use your ChatGPT sign-in through the local Codex CLI',
    badge: 'Subscription',
    badgeVariant: 'mint',
  },
  {
    type: 'openai',
    label: 'OpenAI API',
    subtitle: 'GPT-4.1, o4-mini, GPT-4.1-mini/nano via API key',
    badge: 'Cloud API',
    badgeVariant: 'cyan',
  },
  {
    type: 'anthropic',
    label: 'Anthropic Claude',
    subtitle: 'Claude Sonnet 4.5, Opus 4.1 & Haiku 3.5',
    badge: 'Cloud API',
    badgeVariant: 'violet',
  },
  {
    type: 'ollama',
    label: 'Ollama (Local)',
    subtitle: '100% local private inference on your machine',
    badge: 'Local Free',
    badgeVariant: 'yellow',
  },
  {
    type: 'openai_compatible',
    label: 'OpenRouter / Compatible',
    subtitle: 'OpenRouter, Groq, LM Studio, Gemini OpenAI endpoint, vLLM',
    badge: 'Multi-Vendor',
    badgeVariant: 'coral',
  },
];

export const ProviderJevSetupView: React.FC<Props> = ({
  status,
  providers,
  presets,
  jevConfig,
  routingDecisions,
  onRefreshAll,
  onGamificationDelta,
  onGoToResume,
  hideContinueButton = false,
}) => {
  const defaultType: ProviderType = 'codex_subscription';
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<ProviderType>(defaultType);
  const [name, setName] = useState(presets[defaultType]?.defaultName ?? 'ChatGPT Codex Subscription');
  const [baseUrl, setBaseUrl] = useState(
    presets[defaultType]?.defaultBaseUrl ?? ''
  );
  const [secretInput, setSecretInput] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerBanner, setProviderBanner] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Jev form state
  const [jevEnabled, setJevEnabled] = useState(jevConfig.enabled);
  const [jevChannel, setJevChannel] = useState<JevChannel>(jevConfig.channel);
  const [jevBaseUrl, setJevBaseUrl] = useState(jevConfig.baseUrl);
  const [jevModel, setJevModel] = useState(jevConfig.model);
  const [jevCostPolicy, setJevCostPolicy] = useState<JevCostPolicy>(jevConfig.costPolicy);
  const [jevApiKeyInput, setJevApiKeyInput] = useState('');
  const [savingJev, setSavingJev] = useState(false);
  const [testingJev, setTestingJev] = useState(false);
  const [jevBanner, setJevBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const selectPresetType = (t: ProviderType) => {
    setEditingId(undefined);
    setSelectedType(t);
    const p = presets[t];
    if (p) {
      setName(p.defaultName);
      setBaseUrl(p.defaultBaseUrl);
    }
    setSecretInput('');
    setProviderBanner(null);
  };

  const loadProviderIntoEditor = (prov: AIProviderRecord) => {
    setEditingId(prov.id);
    setSelectedType(prov.type);
    setName(prov.name);
    setBaseUrl(prov.baseUrl);
    setSecretInput('');
    setProviderBanner(null);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProvider(true);
    setProviderBanner(null);
    try {
      const res = await api.saveProvider({
        id: editingId,
        name,
        type: selectedType,
        enabled: true,
        baseUrl: selectedType === 'codex_subscription' ? '' : baseUrl,
        apiKeyOrSecret: secretInput || undefined,
        codexAuthMode: selectedType === 'codex_subscription' ? 'cli_exec' : undefined,
        autoVerify: true,
      });
      onGamificationDelta(res.gamificationDelta);
      setSecretInput('');
      setEditingId(res.provider.id);

      if (res.verificationResult?.ok) {
        setProviderBanner({
          kind: 'ok',
          text: `Connected & Verified "${res.provider.name}"! ${res.verificationResult.message} CareerForge will automatically select models from this provider per task.`,
        });
      } else if (res.verificationResult && !res.verificationResult.ok) {
        setProviderBanner({
          kind: 'err',
          text: `Saved "${res.provider.name}", but live verification failed: ${res.verificationResult.message}`,
        });
      } else {
        setProviderBanner({
          kind: 'ok',
          text: `Saved "${res.provider.name}". CareerForge manages model selection automatically.`,
        });
      }
      await onRefreshAll();
    } catch (err) {
      setProviderBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to save provider',
      });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingProviderId(id);
    try {
      const res = await api.testProvider(id);
      setProviderBanner({
        kind: res.ok ? 'ok' : 'err',
        text: res.message,
      });
      await onRefreshAll();
    } catch (err) {
      setProviderBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Provider test failed',
      });
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleToggleProviderEnabled = async (prov: AIProviderRecord) => {
    await api.saveProvider({
      id: prov.id,
      name: prov.name,
      type: prov.type,
      enabled: !prov.enabled,
      baseUrl: prov.baseUrl,
      codexAuthMode: prov.codexAuthMode,
      codexAuthPath: prov.codexAuthPath,
      models: prov.models,
      priority: prov.priority,
      autoVerify: false,
    });
    await onRefreshAll();
  };

  const handleDeleteProvider = async (id: string) => {
    await api.deleteProvider(id);
    if (editingId === id) {
      setEditingId(undefined);
    }
    await onRefreshAll();
  };

  const handleChannelChange = (ch: JevChannel) => {
    setJevChannel(ch);
    if (ch === 'typesafe') {
      setJevBaseUrl('https://api.typesafe.ai/v1/systemone');
      setJevModel('jev-latest');
    } else if (ch === 'openrouter') {
      setJevBaseUrl('https://openrouter.ai/api/alpha/decisions');
      setJevModel('~typesafe/jev-latest');
    } else if (ch === 'vercel') {
      setJevBaseUrl('https://ai-gateway.vercel.sh/typesafe/v1/systemone');
      setJevModel('typesafe-ai/jev');
    }
  };

  const handleSaveJev = async (clearKey = false) => {
    setSavingJev(true);
    setJevBanner(null);
    try {
      const res = await api.saveJev({
        enabled: jevEnabled,
        apiKey: clearKey ? undefined : jevApiKeyInput || undefined,
        clearApiKey: clearKey,
        channel: jevChannel,
        baseUrl: jevBaseUrl,
        model: jevModel,
        costPolicy: jevCostPolicy,
        autoVerify: true,
      });
      setJevApiKeyInput('');
      if (res.unlockedAchievements.length > 0) {
        onGamificationDelta({
          xpGained: res.unlockedAchievements.reduce((a, b) => a + b.xpBonus, 0),
          sparksGained: res.unlockedAchievements.reduce((a, b) => a + b.sparksBonus, 0),
          leveledUpGlobal: false,
          newGlobalLevel: 1,
          leveledUpStream: false,
          unlockedAchievements: res.unlockedAchievements,
          completedQuests: [],
        });
      }
      if (res.config.hasApiKey) {
        if (res.verificationResult?.ok) {
          setJevBanner({
            kind: 'ok',
            text: `Jev Configured & Verified (${res.config.channel} · policy: ${res.config.costPolicy}) — ${res.verificationResult.message}`,
          });
        } else if (res.verificationResult && !res.verificationResult.ok) {
          setJevBanner({
            kind: 'err',
            text: `Jev Configured (${res.config.maskedApiKey}), live check note: ${res.verificationResult.message}`,
          });
        } else {
          setJevBanner({
            kind: 'ok',
            text: `Jev Configured (${res.config.channel} · policy: ${res.config.costPolicy}).`,
          });
        }
      } else {
        setJevBanner({
          kind: 'ok',
          text: `Saved in Autonomous Self-Routing mode (policy: ${res.config.costPolicy}).`,
        });
      }
      await onRefreshAll();
    } catch (err) {
      setJevBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to save Jev config',
      });
    } finally {
      setSavingJev(false);
    }
  };

  const handleTestJev = async () => {
    setTestingJev(true);
    setJevBanner(null);
    try {
      const res = await api.testJev();
      setJevBanner({
        kind: res.ok ? 'ok' : 'err',
        text: res.message,
      });
      await onRefreshAll();
    } catch (err) {
      setJevBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Jev test failed',
      });
    } finally {
      setTestingJev(false);
    }
  };

  const renderProviderStatusBadge = (p: AIProviderRecord) => {
    if (p.connectionStatus === 'connected') {
      return (
        <Badge variant="mint">
          <Wifi className="h-3 w-3" />
          Connected &amp; Verified
        </Badge>
      );
    }
    if (p.connectionStatus === 'failed') {
      return (
        <Badge variant="coral">
          <WifiOff className="h-3 w-3" />
          Connection Failed
        </Badge>
      );
    }
    if (p.connectionStatus === 'disabled') {
      return <Badge variant="neutral">Disabled</Badge>;
    }
    return (
      <Badge variant="yellow">
        <Clock className="h-3 w-3" />
        Saved · Not Verified
      </Badge>
    );
  };

  const renderJevStatusBadge = () => {
    if (jevConfig.status === 'configured_verified') {
      return (
        <Badge variant="mint">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Configured &amp; Verified
        </Badge>
      );
    }
    if (jevConfig.status === 'configured') {
      return (
        <Badge variant="yellow">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Configured
        </Badge>
      );
    }
    if (jevConfig.status === 'disabled') {
      return <Badge variant="neutral">Disabled (Autonomous Active)</Badge>;
    }
    return <Badge variant="default">Not Configured · Autonomous Router Active</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Step 1 Hero Banner */}
      <Card className="overflow-hidden border-2 border-border bg-secondary-background py-0 gap-0 shadow-brutal-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-[#88AAEE] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="dark">STEP 1</Badge>
            <span className="inline-flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider text-foreground">
              <Cpu className="h-3.5 w-3.5 stroke-[2.5]" />
              Multi-Provider AI Engine &amp; TypeSafe Jev Router
            </span>
          </div>
          <NeoStarBurst size={24} fill="#FFDC58" />
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Configure Your Inference Fleet
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Connect your AI providers once — you never have to assign models to individual tasks.
                CareerForge automatically discovers models and uses TypeSafe&apos;s Jev (or its
                built-in Autonomous Router when Jev is not configured) to choose the right model per
                task.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-base border-2 border-border bg-background px-3 py-1 font-heading font-bold text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                  <Database className="h-3.5 w-3.5" />
                  Local SQLite:{' '}
                  <code className="rounded-[4px] border border-border bg-secondary-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {status.dbPath}
                  </code>
                </span>

                <Badge variant={status.connectedProviderCount > 0 ? 'mint' : 'neutral'} className="px-3 py-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Connected &amp; Verified: {status.connectedProviderCount} / {status.activeProviderCount}
                </Badge>

                <Badge
                  variant={
                    jevConfig.status === 'configured_verified'
                      ? 'mint'
                      : jevConfig.status === 'configured'
                        ? 'yellow'
                        : 'violet'
                  }
                  className="px-3 py-1"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  TypeSafe Jev:{' '}
                  {jevConfig.status === 'configured_verified'
                    ? 'Configured & Verified'
                    : jevConfig.status === 'configured'
                      ? 'Configured'
                      : 'Autonomous Self-Routing'}
                </Badge>
              </div>
            </div>

            {status.hasActiveProvider && !hideContinueButton && (
              <Button
                type="button"
                variant="mint"
                size="lg"
                onClick={onGoToResume}
                className="shrink-0"
              >
                Continue to Launch Gate
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Two-Column Grid */}
      <div className="grid gap-8 xl:grid-cols-12">
        {/* LEFT 7 COLS: Provider Builder & Configured Fleet */}
        <div className="space-y-6 xl:col-span-7">
          <Card className="overflow-hidden py-0 gap-0">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-background py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                  <Server className="h-4 w-4 stroke-[2.5]" />
                </div>
                <CardTitle className="text-lg">
                  {editingId ? 'Edit AI Provider' : 'Add AI Provider'}
                </CardTitle>
              </div>
              {editingId && (
                <Button
                  type="button"
                  variant="neutral"
                  size="xs"
                  onClick={() => selectPresetType('openai')}
                >
                  + Create New Instead
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-6">
              {/* Provider Type Picker */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PROVIDER_CARDS.map((card) => {
                  const active = selectedType === card.type;
                  return (
                    <motion.button
                      key={card.type}
                      type="button"
                      whileHover={{ x: -2, y: -2 }}
                      whileTap={{ x: 2, y: 2 }}
                      transition={NEO_SPRING}
                      onClick={() => selectPresetType(card.type)}
                      className={cn(
                        'cursor-pointer rounded-base border-2 border-border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black',
                        active
                          ? 'bg-[#FFDC58] text-foreground shadow-shadow'
                          : 'bg-secondary-background text-foreground shadow-[2px_2px_0px_0px_var(--border)] hover:bg-background'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <Badge
                          variant={active ? 'dark' : card.badgeVariant}
                          className="text-[10px] uppercase tracking-wider"
                        >
                          {card.badge}
                        </Badge>
                        <AnimatePresence>
                          {active && (
                            <motion.span
                              initial={{ scale: 0, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              transition={NEO_SPRING}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-[#05E17A] text-foreground"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="mt-2 font-heading text-sm font-bold text-foreground">
                        {card.label}
                      </div>
                      <div
                        className={cn(
                          'mt-1 text-[11px] leading-snug',
                          active ? 'text-foreground/85 font-medium' : 'text-muted-foreground'
                        )}
                      >
                        {card.subtitle}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Provider Configuration Form */}
              <form onSubmit={handleSaveProvider} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                      Display Name
                    </label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  {selectedType !== 'codex_subscription' && (
                    <div>
                      <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                        Base API URL
                      </label>
                      <Input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        required
                        className="font-mono text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Special ChatGPT Codex Subscription Auth Selector */}
                <AnimatePresence mode="wait" initial={false}>
                  {selectedType === 'codex_subscription' ? (
                    <motion.div
                      key="codex-auth"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={NEO_GENTLE_SPRING}
                      className="space-y-3.5 rounded-base border-2 border-border bg-background p-4 shadow-[2px_2px_0px_0px_var(--border)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                          Codex CLI
                        </span>
                        <Badge variant={status.codexCliInstalled ? 'mint' : 'neutral'}>
                          {status.codexCliInstalled ? 'Installed' : 'Not found'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {status.codexCliInstalled ? null : 'Install the Codex CLI on the machine running CareerForge. '}
                        Run <code>codex login</code> and sign in with ChatGPT, then save and verify.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="standard-auth"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={NEO_GENTLE_SPRING}
                    >
                      <label className="mb-1.5 block font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                        {selectedType === 'ollama'
                          ? 'API Key (Optional for Local Ollama)'
                          : 'API Key / Secret Token'}
                      </label>
                      <Input
                        type="password"
                        value={secretInput}
                        onChange={(e) => setSecretInput(e.target.value)}
                        placeholder={
                          editingId
                            ? 'Leave blank to keep existing saved key, or enter a new key'
                            : selectedType === 'anthropic'
                              ? 'sk-ant-...'
                              : selectedType === 'ollama'
                                ? 'Not required for localhost:11434'
                                : 'sk-...'
                        }
                        className="font-mono text-sm"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Automatic Model Selection Notice */}
                <div className="rounded-base border-2 border-border bg-[#A985FF]/25 p-4 shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="flex items-center gap-2 font-heading text-xs font-bold text-foreground">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-base border-2 border-border bg-[#A985FF] text-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span>Zero-Config Automatic Model Assignment</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    You do not need to pick or assign models for any task. CareerForge automatically
                    catalogs this provider&apos;s models and dynamically selects the right model &amp;
                    reasoning effort for resume analysis, roadmaps, learning guides, and evaluations.
                  </p>
                </div>

                <AnimatePresence>
                  {providerBanner && (
                    <motion.div
                      key={`${providerBanner.kind}-${providerBanner.text}`}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={NEO_GENTLE_SPRING}
                      className={cn(
                        'flex items-start gap-2.5 rounded-base border-2 border-border p-3.5 text-xs font-medium text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
                        providerBanner.kind === 'ok' ? 'bg-[#05E17A]' : 'bg-[#FF6B6B]'
                      )}
                    >
                      {providerBanner.kind === 'ok' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-foreground" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5] text-foreground" />
                      )}
                      <span className="leading-relaxed">{providerBanner.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  disabled={savingProvider}
                  className="w-full"
                >
                  {savingProvider ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Server className="h-4 w-4" />
                  )}
                  {editingId ? 'Save & Verify Connection' : 'Connect & Verify AI Provider'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Configured Providers List */}
          <Card className="overflow-hidden py-0 gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b-2 border-border bg-background py-4">
              <CardTitle className="text-base">
                AI Providers ({providers.length})
              </CardTitle>
              <Badge variant={providers.length > 0 ? 'mint' : 'neutral'}>
                {providers.length} Configured
              </Badge>
            </CardHeader>

            <CardContent className="p-6">
              {providers.length === 0 ? (
                <div className="rounded-base border-2 border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                  No providers connected yet. Choose a provider card above and click{' '}
                  <strong className="font-heading font-bold text-foreground">
                    Connect &amp; Verify AI Provider
                  </strong>
                  .
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {providers.map((p) => (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={NEO_GENTLE_SPRING}
                        className={cn(
                          'neo-card-lift rounded-base border-2 border-border p-4 shadow-[2px_2px_0px_0px_var(--border)]',
                          p.connectionStatus === 'connected'
                            ? 'bg-[#05E17A]/15'
                            : p.enabled
                              ? 'bg-secondary-background'
                              : 'bg-background opacity-75'
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-heading text-sm font-bold text-foreground">
                                {p.name}
                              </span>
                              {renderProviderStatusBadge(p)}
                              <Badge variant="neutral" className="font-mono text-[11px]">
                                {p.type}
                              </Badge>
                              {p.maskedSecret && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {p.maskedSecret}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Auto-managed model pool ({p.models.filter((m) => m.enabled).length}{' '}
                              models available to router)
                            </p>
                            {p.lastTestMessage && (
                              <p
                                className={cn(
                                  'inline-block rounded-[4px] border border-border px-2 py-0.5 text-xs font-medium text-foreground',
                                  p.lastTestStatus === 'ok'
                                    ? 'bg-[#05E17A]/35'
                                    : 'bg-[#FF6B6B]/45'
                                )}
                              >
                                {p.lastTestMessage}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="mint"
                              size="xs"
                              onClick={() => handleTestProvider(p.id)}
                              disabled={testingProviderId === p.id}
                            >
                              {testingProviderId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Re-Verify
                            </Button>
                            <Button
                              type="button"
                              variant="neutral"
                              size="xs"
                              onClick={() => loadProviderIntoEditor(p)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant={p.enabled ? 'neutral' : 'yellow'}
                              size="xs"
                              onClick={() => handleToggleProviderEnabled(p)}
                            >
                              {p.enabled ? 'Disable' : 'Enable'}
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="icon-sm"
                              onClick={() => handleDeleteProvider(p.id)}
                              title="Delete provider"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT 5 COLS: TypeSafe Jev Configuration Status & Automatic Routing Telemetry */}
        <div className="space-y-6 xl:col-span-5">
          <Card className="overflow-hidden py-0 gap-0">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b-2 border-border bg-[#FFDC58] py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-base border-2 border-border bg-secondary-background text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                  <GitBranch className="h-4 w-4 stroke-[2.5]" />
                </div>
                <CardTitle className="text-lg text-foreground">
                  TypeSafe&apos;s Jev Model Router
                </CardTitle>
              </div>
              {renderJevStatusBadge()}
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              <p className="text-xs leading-relaxed text-muted-foreground">
                TypeSafe&apos;s <strong className="font-heading font-bold text-foreground">Jev</strong>{' '}
                (`systemone`) automatically decides which model and reasoning effort to use for every
                task. When Jev is not configured, CareerForge chooses models on its own automatically.
              </p>

              <div className="flex items-center justify-between gap-3 rounded-base border-2 border-border bg-background px-3.5 py-2.5 shadow-[2px_2px_0px_0px_var(--border)]">
                <div>
                  <div className="font-heading text-xs font-bold text-foreground">
                    Enable TypeSafe Jev Decision Engine
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Falls back to Autonomous Router automatically when off or unconfigured
                  </div>
                </div>
                <Switch
                  size="sm"
                  checked={jevEnabled}
                  onCheckedChange={(checked) => setJevEnabled(checked)}
                />
              </div>

              {jevConfig.hasApiKey && (
                <div className="rounded-base border-2 border-border bg-[#05E17A]/25 px-3.5 py-2.5 text-xs text-foreground shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="font-heading font-bold text-foreground">
                    Jev Status:{' '}
                    {jevConfig.status === 'configured_verified'
                      ? 'Configured & Live Verified'
                      : 'Configured'}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    Channel: {jevConfig.channel} · Key: {jevConfig.maskedApiKey} · Policy:{' '}
                    {jevConfig.costPolicy}
                  </div>
                  {jevConfig.lastTestMessage && (
                    <div className="mt-1 text-[11px] font-medium text-foreground">
                      {jevConfig.lastTestMessage}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-heading text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Jev Gateway Channel
                    </label>
                    <NeoSelect
                      value={jevChannel}
                      onChange={(e) => handleChannelChange(e.target.value as JevChannel)}
                      className="w-full text-xs"
                    >
                      <option value="typesafe">TypeSafe Official (api.typesafe.ai)</option>
                      <option value="openrouter">OpenRouter Decisions API</option>
                      <option value="vercel">Vercel AI Gateway</option>
                      <option value="custom">Custom Endpoint</option>
                    </NeoSelect>
                  </div>

                  <div>
                    <label className="mb-1 block font-heading text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Routing Cost Policy
                    </label>
                    <NeoSelect
                      value={jevCostPolicy}
                      onChange={(e) => setJevCostPolicy(e.target.value as JevCostPolicy)}
                      className="w-full text-xs"
                    >
                      <option value="quality_first">Quality First (Prefer Frontier/Reasoning)</option>
                      <option value="balanced">Balanced (Optimal Quality / Cost)</option>
                      <option value="cost_saver">Cost Saver (Prefer Free Local / Economy)</option>
                    </NeoSelect>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-heading text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Jev Endpoint
                    </label>
                    <Input
                      type="text"
                      value={jevBaseUrl}
                      onChange={(e) => setJevBaseUrl(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-heading text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Jev Decision Model
                    </label>
                    <Input
                      type="text"
                      value={jevModel}
                      onChange={(e) => setJevModel(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-heading text-[11px] font-bold uppercase tracking-wider text-foreground">
                    Jev API Key (Optional —{' '}
                    {jevConfig.hasApiKey
                      ? `Saved: ${jevConfig.maskedApiKey}`
                      : 'Currently Empty -> Autonomous Mode'}
                    )
                  </label>
                  <Input
                    type="password"
                    value={jevApiKeyInput}
                    onChange={(e) => setJevApiKeyInput(e.target.value)}
                    placeholder="Enter TypeSafe API key (or OpenRouter key) — or leave blank for autonomous routing"
                    className="font-mono text-xs"
                  />
                </div>

                <AnimatePresence>
                  {jevBanner && (
                    <motion.div
                      key={`${jevBanner.kind}-${jevBanner.text}`}
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={NEO_GENTLE_SPRING}
                      className={cn(
                        'rounded-base border-2 border-border p-3 text-xs font-medium text-foreground shadow-[2px_2px_0px_0px_var(--border)]',
                        jevBanner.kind === 'ok' ? 'bg-[#05E17A]' : 'bg-[#FFDC58]'
                      )}
                    >
                      {jevBanner.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="yellow"
                    size="sm"
                    onClick={() => handleSaveJev(false)}
                    disabled={savingJev}
                    className="flex-1"
                  >
                    {savingJev && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Router Settings
                  </Button>
                  <Button
                    type="button"
                    variant="violet"
                    size="sm"
                    onClick={handleTestJev}
                    disabled={testingJev}
                  >
                    {testingJev ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Test Jev Key
                  </Button>
                  {jevConfig.hasApiKey && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleSaveJev(true)}
                    >
                      Clear Key
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Automatic Routing & Memory Cache Telemetry */}
          <Card className="overflow-hidden py-0 gap-0">
            <CardHeader className="flex flex-row items-center justify-between border-b-2 border-border bg-background py-4">
              <CardTitle className="text-sm sm:text-base">
                In-Memory Node &amp; Resource Cache
              </CardTitle>
              <Badge variant="mint">AI-Free Reuse Active</Badge>
            </CardHeader>

            <CardContent className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-base border-2 border-border bg-[#88AAEE]/40 p-3 shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="font-heading text-xl font-bold text-foreground">
                    {status.memoryCache.cachedRoadmaps}
                  </div>
                  <div className="font-heading text-[11px] font-bold text-muted-foreground">
                    Roadmaps
                  </div>
                </div>
                <div className="rounded-base border-2 border-border bg-[#05E17A]/40 p-3 shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="font-heading text-xl font-bold text-foreground">
                    {status.memoryCache.cachedTopicNodes}
                  </div>
                  <div className="font-heading text-[11px] font-bold text-muted-foreground">
                    Topic Nodes
                  </div>
                </div>
                <div className="rounded-base border-2 border-border bg-[#FFDC58]/60 p-3 shadow-[2px_2px_0px_0px_var(--border)]">
                  <div className="font-heading text-xl font-bold text-foreground">
                    {status.memoryCache.cachedResourcePacks}
                  </div>
                  <div className="font-heading text-[11px] font-bold text-muted-foreground">
                    Resource Packs
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
                    Automatic Task Model Selection Log ({routingDecisions.length})
                  </span>
                </div>
                {routingDecisions.length === 0 ? (
                  <div className="rounded-base border-2 border-dashed border-border bg-background p-4 text-xs text-muted-foreground">
                    As you analyze resumes, practice, and evaluate solutions, CareerForge&apos;s
                    automatic model selections appear here.
                  </div>
                ) : (
                  <StaggerContainer className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                    {routingDecisions.slice(0, 10).map((d) => (
                      <StaggerItem key={d.id}>
                        <div className="neo-card-lift rounded-base border-2 border-border bg-background px-3.5 py-2.5 text-xs shadow-[2px_2px_0px_0px_var(--border)]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-heading font-bold text-foreground">
                              {d.purpose}
                            </span>
                            <Badge
                              variant={d.decidedBy === 'typesafe_jev' ? 'mint' : 'yellow'}
                              className="text-[10px]"
                            >
                              {d.decidedBy === 'typesafe_jev' ? 'TypeSafe Jev' : 'Auto-Selected'}
                            </Badge>
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                            → {d.selectedProviderName}/{d.selectedModel} ({d.reasoningEffort},{' '}
                            {Math.round(d.confidence * 100)}%)
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
