import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Hammer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api.ts';
import { ProviderJevSetupView } from './ProviderJevSetupView.tsx';
import type {
  AIProviderRecord,
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

export const OnboardingFlowView: React.FC<OnboardingFlowViewProps> = (props) => {
  const { status, profile, onOnboardingComplete } = props;
  const [step, setStep] = useState(status.hasActiveProvider ? 2 : 1);
  const [displayName, setDisplayName] = useState('');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionVerified = status.connectedProviderCount > 0;

  async function finish() {
    setCompleting(true);
    setError(null);
    try {
      await api.completeOnboarding({ displayName: displayName.trim() || profile.displayName });
      await onOnboardingComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup. Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  function goToStep(next: number) {
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-base border-2 border-border bg-[#FFDC58] shadow-brutal-sm">
          <Hammer className="size-5" />
        </span>
        <span className="font-heading text-xl font-bold">CareerForge</span>
      </header>
      <div>
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">
          Build your career, one step at a time.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Create a personal roadmap, learn a topic, and practice what you've learned. Your progress
          stays on this machine.
        </p>
      </div>
      <ol
        aria-label="Setup progress"
        className="grid grid-cols-2 gap-3 text-sm font-heading font-bold"
      >
        {['Connect AI', 'Get started'].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            className={`flex items-center gap-2 rounded-base border-2 border-border p-3 ${step === index + 1 ? 'bg-main shadow-brutal-sm' : 'bg-secondary-background'}`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-base border border-border bg-secondary-background">
              {step > index + 1 ? <CheckCircle2 className="size-4" /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {step === 1 ? (
        <section className="space-y-4" aria-label="Connect AI">
          <div>
            <h2 className="text-xl font-heading font-bold">Choose an AI provider</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You only need one. Models are selected automatically; you can add providers or
              configure routing later in Settings.
            </p>
          </div>
          <ProviderJevSetupView
            {...props}
            onGoToResume={() => goToStep(2)}
            onProviderVerified={() => goToStep(2)}
            hideContinueButton
            simpleSetup
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-base border-2 border-border bg-secondary-background p-4 shadow-brutal-sm">
            <p role="status" className="flex-1 text-sm text-muted-foreground">
              {connectionVerified
                ? 'AI connection verified. You’re ready to go.'
                : status.hasActiveProvider
                  ? 'Provider saved, but not verified. Check the connection before continuing.'
                  : 'Connect a provider to continue.'}
            </p>
            <Button disabled={!status.hasActiveProvider} onClick={() => goToStep(2)}>
              Next <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : (
        <Card className="space-y-5 p-5 sm:p-7">
          <div>
            <h2 className="text-2xl font-heading font-bold">Make it yours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a name if you like. You can personalize your profile later.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void finish();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="setup-name" className="block text-sm font-heading font-bold">
                Your name (optional)
              </label>
              <Input
                id="setup-name"
                autoComplete="given-name"
                maxLength={50}
                placeholder={profile.displayName}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-2"
              />
            </div>
            {!connectionVerified && (
              <p className="rounded-base border-2 border-border bg-[#FFDC58]/30 p-3 text-sm">
                Your provider is saved but hasn't been verified. You can still open the dashboard,
                but generation may require fixing your connection in Settings.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-base border-2 border-border bg-[#FF6B6B]/30 p-3 text-sm"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <Button type="button" variant="neutral" onClick={() => goToStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={!status.hasActiveProvider || completing}>
                {completing ? <Loader2 className="size-4 animate-spin" /> : null}{' '}
                {completing ? 'Opening dashboard…' : 'Open dashboard'}{' '}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        </Card>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Your data is stored locally. AI requests use the provider you choose.
      </p>
    </main>
  );
};
