/**
 * ============================================================================
 * FILE: components/GracefulErrorBanner.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Calm, Institutional Single-Elevation Recovery Notice with Automatic
 * Cooldown Retry for Rate Limits (`429` / `"Rate exceeded."`) and Transient
 * Gateway Hiccups.
 *
 * USE CASES:
 * 1. Replacing harsh crimson parser-exception banners across `RelatedCompaniesPanel`,
 *    `CompanyProductsPanel`, `AIMarketBriefPanel`, `WatchlistLandingBrief`,
 *    `CohortComparisonWorkspace`, and `ContextualResearchDrawer`.
 * 2. Acting as a client-side defense-in-depth sanitizer via `formatGracefulApiError`
 *    so raw `SyntaxError: Unexpected token 'R', "Rate exceeded." is not valid JSON`
 *    strings are never displayed to investors under any condition.
 * 3. Running a polite 1-time automatic countdown retry (`Auto-retrying in 4s`)
 *    on rate-limit or transient errors (guarded per `contextKey` so repeated
 *    upstream outages never loop endlessly), paired with `Pause` and `Retry Now`
 *    controls.
 * ============================================================================
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Clock, RotateCcw } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { useLanguage } from '@/components/LanguageProvider';
import { logFunctionCall } from '@/lib/logger';

export interface GracefulErrorBannerProps {
  /** Raw or normalized error string */
  error: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Optional secondary action button (e.g., switching mode) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Optional custom heading override for non-rate-limit errors */
  titleOverride?: string;
  /** Key identifying the current entity/query so 1-time auto-retry resets on new searches */
  contextKey?: string;
  /** Whether automatic 1-time retry on transient/rate-limit errors is enabled (default true) */
  enableAutoRetry?: boolean;
  /** Compact layout for narrower containers like the Research Assistant drawer */
  compact?: boolean;
  /** Optional outer margin/spacing class */
  className?: string;
}

/**
 * Renders a calm, single-elevation status and retry surface tailored to whether
 * the error is a temporary rate limit, a transient upstream delay, or a standard
 * request error.
 */
export function GracefulErrorBanner({
  error,
  onRetry,
  secondaryAction,
  titleOverride,
  contextKey = 'default',
  enableAutoRetry = true,
  compact = false,
  className = '',
}: GracefulErrorBannerProps) {
  const { locale, t } = useLanguage();

  const normalized = useMemo(
    () => formatGracefulApiError(error, { locale }),
    [error, locale]
  );

  // Track which contextKey has already consumed its 1-time automatic retry
  // so persistent rate limits never cause an infinite retry loop.
  const [autoRetriedKey, setAutoRetriedKey] = useState<string | null>(null);
  const onRetryRef = useRef(onRetry);
  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  const canAutoRetry =
    Boolean(onRetry) &&
    enableAutoRetry &&
    (normalized.isRateLimit || normalized.isTransient) &&
    autoRetriedKey !== contextKey;

  const [pausedKey, setPausedKey] = useState<string | null>(null);
  const isPaused = pausedKey === contextKey;

  const [secondsLeft, setSecondsLeft] = useState<number>(
    APP_CONFIG.resilience.uiAutoRetryDelaySeconds
  );

  useEffect(() => {
    if (!canAutoRetry || isPaused) {
      return;
    }

    const initialSeconds = APP_CONFIG.resilience.uiAutoRetryDelaySeconds;
    let remaining = initialSeconds;
    const initTimer = setTimeout(() => {
      setSecondsLeft(initialSeconds);
    }, 0);

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setAutoRetriedKey(contextKey);
        logFunctionCall('GracefulErrorBanner.autoRetryTriggered', {
          contextKey,
          errorCode: normalized.errorCode,
        });
        onRetryRef.current?.();
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [canAutoRetry, isPaused, contextKey, normalized.errorCode]);

  const headingText = normalized.isRateLimit
    ? t.resilience.rateLimitTitle
    : normalized.isTransient
      ? t.resilience.transientTitle
      : titleOverride || t.resilience.errorTitle;

  const isSoftNotice = normalized.isRateLimit || normalized.isTransient;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg bg-[#091326] border ${
        isSoftNotice ? 'border-amber-500/30' : 'border-[#2b3b5a]'
      } ${compact ? 'p-3.5' : 'p-4'} flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {isSoftNotice ? (
          <Clock
            className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        ) : (
          <AlertCircle
            className="w-4 h-4 text-slate-300 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}

        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-white">
              {headingText}
            </span>

            {canAutoRetry && !isPaused && (
              <>
                <span className="text-slate-500 text-xs" aria-hidden="true">
                  ·
                </span>
                <span className="text-[11px] text-amber-300 font-mono-tabular whitespace-nowrap">
                  {t.resilience.autoRetryingPrefix} {secondsLeft}
                  {t.resilience.secondsSuffix}
                </span>
                <span className="text-slate-600 text-xs" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logFunctionCall('GracefulErrorBanner.pauseAutoRetry', {
                      contextKey,
                    });
                    setPausedKey(contextKey);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.resilience.pauseAutoRetry}
                </button>
              </>
            )}

            {canAutoRetry && isPaused && (
              <>
                <span className="text-slate-500 text-xs" aria-hidden="true">
                  ·
                </span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {t.resilience.autoRetryPaused}
                </span>
              </>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {normalized.message}
          </p>
        </div>
      </div>

      {(onRetry || secondaryAction) && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                setAutoRetriedKey(contextKey);
                logFunctionCall('GracefulErrorBanner.manualRetry', {
                  contextKey,
                  errorCode: normalized.errorCode,
                });
                onRetry();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {isSoftNotice ? t.resilience.retryNow : t.common.retry}
              </span>
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#0d1b33] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
