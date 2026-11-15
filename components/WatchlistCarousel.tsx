/**
 * ============================================================================
 * FILE: components/WatchlistCarousel.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Followed Companies Watchlist Strip with Verified Company Follow Controls,
 * Explicit Sparkline Timeframe (`1D` / `5D` / `1M` / `6M` / `1Y`), and Honest
 * Private-Company Valuation Cards (Zero Fabricated Sparklines).
 *
 * USE CASES:
 * 1. Displaying the user's followed companies (`NVDA`, `Stripe`, `AAPL`, `MSFT`,
 *    `PLTR`, `OpenAI`, plus any verified custom companies) with 1-click deep-dive
 *    selection.
 * 2. Showing real historical price sparklines and period `%` returns with an
 *    explicit timeframe label (`1M` / 1-Month by default, switchable across
 *    `1D`, `5D`, `1M`, `6M`, `1Y`) strictly for listed public equities.
 * 3. Rendering clean private-market status and disclosed valuation metadata for
 *    private companies (`Stripe`, `OpenAI`, `Anthropic`, etc.) with NO fake
 *    price graphs or fabricated `%` stock changes.
 * 4. Validating newly followed tickers/companies against real market & corporate
 *    records before adding them, surfacing inline validation errors when a
 *    non-existent company (e.g. `"asgadsgasd"`) is entered.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { AlertCircle, Check, Loader2, Plus, RotateCcw, X } from 'lucide-react';
import { formatTickerWithAdr } from '@/lib/adr-directory';
import {
  APP_CONFIG,
  type CompanyPreset,
  type WatchlistSparklineRange,
} from '@/lib/config';
import { useLanguage } from '@/components/LanguageProvider';
import {
  translatePresetMetadata,
  translateWatchlistRangeDescription,
} from '@/lib/i18n';
import { logFunctionCall } from '@/lib/logger';

export interface WatchlistCarouselProps {
  companies: CompanyPreset[];
  activeValue: string;
  activeEntityType: 'auto' | 'name' | 'ticker';
  sparklineRange: WatchlistSparklineRange;
  onSparklineRangeChange: (nextRange: WatchlistSparklineRange) => void;
  isHydratingQuotes?: boolean;
  onSelectPreset: (preset: CompanyPreset) => void;
  onAddCompany?: (rawInput: string) => Promise<boolean>;
  isAddingCompany?: boolean;
  followError?: string | null;
  onClearFollowError?: () => void;
  onRemoveCompany?: (value: string) => void;
  onResetDefaults?: () => void;
  isCustomized?: boolean;
}

/**
 * Renders a mini SVG sparkline path strictly from real historical public-equity closes.
 * Returns `null` if fewer than 2 real price points exist — never fabricates placeholder series.
 *
 * @param points - Real historical closing prices for the active timeframe
 * @param positive - Whether the period return is non-negative
 * @param rangeLabel - Timeframe label for accessible description
 */
function renderSparklineSvg(
  points: number[] | undefined,
  positive: boolean,
  rangeLabel: string
) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const validPoints = points.filter(
    (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
  );
  if (validPoints.length < 2) {
    return null;
  }

  const min = Math.min(...validPoints);
  const max = Math.max(...validPoints);
  const range = max - min || 1;
  const width = 84;
  const height = 28;

  const coords = validPoints.map((val, idx) => {
    const x = (idx / (validPoints.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor = positive ? '#10b981' : '#f43f5e';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible shrink-0"
      role="img"
      aria-label={`${rangeLabel} share price sparkline`}
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}

/**
 * Renders the Followed Companies Watchlist strip above the Watchlist Intelligence Pulse.
 */
export function WatchlistCarousel({
  companies,
  activeValue,
  activeEntityType,
  sparklineRange,
  onSparklineRangeChange,
  isHydratingQuotes = false,
  onSelectPreset,
  onAddCompany,
  isAddingCompany = false,
  followError = null,
  onClearFollowError,
  onRemoveCompany,
  onResetDefaults,
  isCustomized = false,
}: WatchlistCarouselProps) {
  const { locale, t } = useLanguage();
  const isKo = locale === 'ko';
  const [followInput, setFollowInput] = useState('');

  const rangeDescription = translateWatchlistRangeDescription(
    sparklineRange,
    locale
  );

  /**
   * Submits a candidate ticker or company name for server-side existence verification
   * before adding to the followed watchlist.
   */
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = followInput.trim();
    if (!trimmed || !onAddCompany || isAddingCompany) return;
    logFunctionCall('WatchlistCarousel.handleAddSubmit', { query: trimmed });
    const added = await onAddCompany(trimmed);
    if (added) {
      setFollowInput('');
    }
  };

  return (
    <section aria-label={t.watchlist.carouselHeader} className="mb-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200 tracking-tight">
              {t.watchlist.carouselHeader} ({companies.length}
              {isKo ? t.watchlist.followedCountSuffix : ''})
            </h2>
            <span className="text-xs text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-[#49afe9] font-mono-tabular">
              {isKo
                ? `${rangeDescription} (${sparklineRange}) 상장 주가 차트`
                : `${rangeDescription} (${sparklineRange}) public stock chart`}
              {isHydratingQuotes
                ? isKo
                  ? ' · 업데이트 중...'
                  : ' · Updating...'
                : ''}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isKo
              ? `상장 주식은 실시간 ${rangeDescription} (${sparklineRange}) 주가 및 스파크라인을 표시하며, 비상장 기업은 공개 기업가치를 표시합니다 (상장 차트 없음).`
              : `Public equities show live ${rangeDescription.toLowerCase()} (${sparklineRange}) price & sparkline · Private companies show disclosed valuation (no public share chart).`}
          </p>
        </div>

        {/* Timeframe Selector + Verified Follow Input */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-center">
          {/* Interactive Sparkline Timeframe Selector */}
          <div
            role="group"
            aria-label={t.watchlist.returnWindowLabel}
            className="flex items-center gap-0.5 p-0.5 bg-[#0d1b33] border border-[#212c42] rounded-lg"
          >
            {APP_CONFIG.watchlist.supportedRanges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  if (r !== sparklineRange) {
                    logFunctionCall('WatchlistCarousel.onSparklineRangeChange', {
                      range: r,
                    });
                    onSparklineRangeChange(r);
                  }
                }}
                title={`${translateWatchlistRangeDescription(r, locale)} (${r})`}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 font-mono-tabular cursor-pointer ${
                  sparklineRange === r
                    ? 'bg-[#09a4ff] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {onAddCompany && (
            <form onSubmit={handleAddSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={followInput}
                disabled={isAddingCompany}
                onChange={(e) => {
                  setFollowInput(e.target.value);
                  if (followError && onClearFollowError) {
                    onClearFollowError();
                  }
                }}
                placeholder={t.watchlist.followInputPlaceholder}
                aria-label={t.watchlist.followInputPlaceholder}
                aria-invalid={Boolean(followError)}
                className={`w-60 sm:w-64 px-2.5 py-1.5 text-xs bg-[#0d1b33] border rounded-lg text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-60 ${
                  followError
                    ? 'border-rose-500/70 focus:border-rose-400'
                    : 'border-[#212c42] focus:border-[#09a4ff]'
                }`}
              />
              <button
                type="submit"
                disabled={!followInput.trim() || isAddingCompany}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#102344] hover:bg-[#16305c] text-[#49afe9] border border-[#09a4ff]/40 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAddingCompany ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.watchlist.verifyingButton}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.common.follow}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {isCustomized && onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              title={t.watchlist.resetDefaults}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-[#0d1b33] border border-[#212c42] hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.watchlist.resetDefaults}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Validation Error Banner when a non-existent company is submitted */}
      {followError && (
        <div
          role="alert"
          className="mb-3 px-3.5 py-2 rounded-lg bg-rose-950/35 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{followError}</span>
          </div>
          {onClearFollowError && (
            <button
              type="button"
              onClick={onClearFollowError}
              aria-label={t.common.close}
              className="p-0.5 text-rose-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="p-6 rounded-xl bg-[#0d1b33] border border-[#212c42] flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-300">
            {isKo ? (
              <>
                현재 팔로우 중인 기업이 없습니다. 상단 입력창에서 검색하거나 아래 테마의{' '}
                <span className="font-semibold text-white">
                  {t.common.plusFollow}
                </span>{' '}
                버튼을 누르거나 기본 관심종목을 복원하세요.
              </>
            ) : (
              <>
                You are not following any companies right now. Use the form
                above, click{' '}
                <span className="font-semibold text-white">+ Follow</span> on
                any company below, or restore the default institutional
                watchlist.
              </>
            )}
          </p>
          {onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#09a4ff] hover:bg-[#078be0] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.watchlist.resetDefaults}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {companies.map((item) => {
            const isSelected =
              activeValue.toLowerCase() === item.value.toLowerCase() &&
              (activeEntityType === 'auto' ||
                activeEntityType === item.entityType);

            const isPublicEquity =
              item.kind !== 'private' && item.entityType === 'ticker';
            const effectiveTimeframe = item.timeframe || sparklineRange;
            const displayTicker = isPublicEquity
              ? formatTickerWithAdr(item.value, item.label, item.isAdr)
              : '';
            const sparklineNode = isPublicEquity
              ? renderSparklineSvg(
                  item.sparkline,
                  item.positive,
                  `${effectiveTimeframe} (${displayTicker})`
                )
              : null;

            // Ensure legacy private presets never display a stale "+X.XX%" string
            const rawPrivateSubtext =
              !isPublicEquity &&
              item.changePct &&
              !/^[+-]?\d+(\.\d+)?%$/.test(item.changePct.trim())
                ? item.changePct
                : 'Unlisted · No public share chart';

            const privateSubtext = translatePresetMetadata(
              rawPrivateSubtext,
              locale
            );

            return (
              <div
                key={`${item.entityType}-${item.value}`}
                className={`flex flex-col justify-between rounded-xl border transition-all p-4 ${
                  isSelected
                    ? 'bg-[#102344] border-[#09a4ff]'
                    : 'bg-[#0d1b33] border-[#212c42] hover:border-[#49afe9]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  {isPublicEquity ? (
                    <span className="text-xs text-[#49afe9] font-mono-tabular font-semibold shrink-0">
                      {displayTicker}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {t.common.privateCompany}
                    </span>
                  )}

                  {onRemoveCompany && (
                    <button
                      type="button"
                      onClick={() => {
                        logFunctionCall('WatchlistCarousel.onRemoveCompany', {
                          value: item.value,
                        });
                        onRemoveCompany(item.value);
                      }}
                      title={`${t.common.unfollow} ${item.label}`}
                      className="group/unfollow inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-200 hover:border-rose-500/50"
                    >
                      <span className="inline-grid items-center justify-items-center">
                        <span className="col-start-1 row-start-1 inline-flex items-center gap-1 transition-opacity duration-150 group-hover/unfollow:opacity-0">
                          <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                          <span>{t.common.following}</span>
                        </span>
                        <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 group-hover/unfollow:opacity-100">
                          {t.common.unfollow}
                        </span>
                      </span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logFunctionCall('WatchlistCarousel.onSelectPreset', {
                      entityType: item.entityType,
                      value: item.value,
                    });
                    onSelectPreset(item);
                  }}
                  title={`${t.watchlist.clickToResearchTooltip} (${item.label})`}
                  className="w-full flex-1 flex flex-col justify-between text-left cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-bold text-white truncate mb-0.5">
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-400 truncate mb-3">
                      {translatePresetMetadata(item.sector, locale)}
                    </div>
                  </div>

                  {isPublicEquity ? (
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white font-mono-tabular">
                          {item.price}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-mono-tabular whitespace-nowrap">
                          <span
                            className={
                              item.positive ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {item.changePct}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-400">
                            {effectiveTimeframe}
                          </span>
                        </div>
                      </div>
                      {sparklineNode}
                    </div>
                  ) : (
                    <div className="pt-0.5">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {t.watchlist.privateUnlistedSubtext}
                      </div>
                      <div className="text-xs text-slate-400 font-mono-tabular truncate">
                        {privateSubtext}
                      </div>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
