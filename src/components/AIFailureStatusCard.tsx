import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Wrench } from 'lucide-react';

export type AIFailingProvider = {
  id: string;
  name: string;
  status?: string;
  message?: string;
};

export function solutionForAIStatus(status?: string) {
  switch (status) {
    case 'invalid_credentials':
    case 'access_denied':
      return 'Replace the stored API key or token in AI Settings.';
    case 'configuration_error':
    case 'invalid_base_url':
      return 'Review the model name and base URL for this provider.';
    case 'rate_limited':
      return 'Use Cloud fallback for now, then retry once the rate limit clears.';
    case 'provider_unavailable':
    case 'timeout':
    case 'unreachable':
      return 'Switch to Cloud or repair connectivity before using this provider again.';
    default:
      return 'Open AI Settings to inspect the provider health details and update its configuration.';
  }
}

type Props = {
  providers: AIFailingProvider[];
  switchingToCloud: boolean;
  onOpenSettings: () => void;
  onSwitchToCloud: () => void;
  compact?: boolean;
};

export default function AIFailureStatusCard({
  providers,
  switchingToCloud,
  onOpenSettings,
  onSwitchToCloud,
  compact = false,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [providers.length]);

  useEffect(() => {
    if (providers.length <= 1) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % providers.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [providers.length]);

  const provider = providers[activeIndex] || null;
  const solution = provider ? solutionForAIStatus(provider.status) : '';
  const panelClass = compact
    ? 'rounded-xl border border-red-500/30 bg-red-500/10 p-4'
    : 'rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-[0_0_0_1px_rgba(239,68,68,0.06)]';

  const headline = useMemo(() => {
    if (!provider) return '';
    return `${provider.name} failing`;
  }, [provider]);

  if (!provider) return null;

  return (
    <div className={panelClass}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
            <AlertTriangle size={14} />
            API Status
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-red-400/30 bg-red-500/20 px-2.5 py-1 font-medium text-red-100">
              {headline}
            </span>
            {providers.length > 1 && (
              <span className="text-red-200/80">
                {activeIndex + 1}/{providers.length} failing provider{providers.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-red-100">
            {provider.message || 'This provider is not healthy.'}
          </p>
          <div className="mt-2 flex items-start gap-2 text-sm text-red-200/90">
            <Wrench size={15} className="mt-0.5 shrink-0" />
            <span>{solution}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenSettings}
            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-50 hover:bg-red-500/20"
          >
            Open AI Settings
          </button>
          <button
            onClick={onSwitchToCloud}
            disabled={switchingToCloud}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={switchingToCloud ? 'animate-spin' : ''} />
            {switchingToCloud ? 'Switching…' : 'Switch to Cloud'}
          </button>
        </div>
      </div>
    </div>
  );
}
