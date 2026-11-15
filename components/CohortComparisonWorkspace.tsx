/**
 * ============================================================================
 * FILE: components/CohortComparisonWorkspace.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Natural-Language Cohort Screening & Multi-Company Side-by-Side Comparison
 * Workspace for Contextual Investing.
 *
 * USE CASES:
 * 1. Presenting verified public equities and private unicorns discovered from
 *    natural-language queries (e.g., `"AI CHIP companies with over 200 bn USD
 *    market cap"`), pre-selecting the top 3 matches and letting investors
 *    toggle up to 4 companies or append any custom ticker/company (`+ Add`).
 * 2. Rendering an interactive Normalized Multi-Stock Percentage (`%`) Price
 *    Chart Overlay across `1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, and `5Y`
 *    indexed to `0.00%` at period start with hover crosshair comparison.
 * 3. Comparing selected companies side-by-side across all 4 dimensions:
 *    - Valuation & Market Action (Market Cap / Valuation, Price, Period %,
 *      Trailing P/E, Forward P/E, EPS, 52W Range bar, Volume / Funding)
 *    - Company Profile & Scale (Revenue, Headcount, HQ, Founded Year,
 *      Industries, Website)
 *    - Live News Sentiment Score & Top Catalyst Headline
 *    - 1-click Watchlist Follow/Unfollow and Single-Company Deep Dive pivot.
 * ============================================================================
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import type {
  ChartRange,
  PublicCompanyMarketOverview,
} from '@/lib/market-data-service';
import type {
  CohortScreenResponse,
  ComparedCompanyDossier,
  ScreenedCandidateItem,
} from '@/lib/query-intent';
import { logFunctionCall } from '@/lib/logger';

const CHART_RANGES: ChartRange[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'];

export interface CohortComparisonWorkspaceProps {
  query: string;
  screenResult: CohortScreenResponse | null;
  isScreening: boolean;
  screenError: string | null;
  selectedIds: string[];
  onToggleCandidate: (id: string) => void;
  onAddCustomCompany: (rawQuery: string) => Promise<void>;
  isAddingCustom: boolean;
  customAddError: string | null;
  dossiersById: Record<string, ComparedCompanyDossier>;
  comparativeSummary: string | null;
  isHydratingComparison: boolean;
  activeRange: ChartRange;
  onRangeChange: (nextRange: ChartRange) => void;
  onRefreshScreen: () => void;
  onSwitchToSingleMode: () => void;
  onOpenDeepDive: (searchQuery: string, entityType: 'ticker' | 'name') => void;
  followedValuesLower: Set<string>;
  pendingFollowValues?: Set<string>;
  onToggleFollowCompany: (
    value: string,
    label: string,
    sector?: string | null
  ) => void;
  onBatchFollowCompanies?: (candidates: ScreenedCandidateItem[]) => void;
  onRunSampleQuery: (sampleQuery: string) => void;
}

interface NormalizedSeriesItem {
  id: string;
  symbol: string;
  name: string;
  color: string;
  latestPrice: number;
  periodReturnPct: number;
  points: Array<{
    normX: number;
    timestamp: number;
    close: number;
    pct: number;
  }>;
}

/**
 * Formats an epoch timestamp (seconds or milliseconds) into a concise chart label.
 *
 * @param rawTs - Timestamp from market chart series
 * @param range - Active chart timeframe
 * @returns Formatted date/time string
 */
function formatChartTimestamp(rawTs: number, range: ChartRange): string {
  const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  if (range === '1D' || range === '5D') {
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: range === '5Y' || range === '1Y' ? 'numeric' : undefined,
  });
}

/**
 * Formats a signed percentage value (`+12.40%` or `-3.15%`).
 *
 * @param pct - Percentage value
 * @returns Signed formatted percentage string
 */
function formatSignedPct(pct: number): string {
  if (!Number.isFinite(pct)) return '0.00%';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

/**
 * Renders the 52-week low-to-high range bar and numeric endpoints for a public equity.
 */
function FiftyTwoWeekBar({
  low,
  high,
  current,
}: {
  low: number | null;
  high: number | null;
  current: number;
}) {
  if (
    low === null ||
    high === null ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    high <= low
  ) {
    return <span className="text-slate-500">—</span>;
  }

  const ratio = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 font-mono-tabular">
        <span>${low.toFixed(2)}</span>
        <span>${high.toFixed(2)}</span>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-[#091326] overflow-hidden">
        <div
          className="h-full bg-[#09a4ff] rounded-full"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Renders the Natural-Language Cohort Screening & Side-by-Side Comparison Workspace.
 */
export function CohortComparisonWorkspace({
  query,
  screenResult,
  isScreening,
  screenError,
  selectedIds,
  onToggleCandidate,
  onAddCustomCompany,
  isAddingCustom,
  customAddError,
  dossiersById,
  comparativeSummary,
  isHydratingComparison,
  activeRange,
  onRangeChange,
  onRefreshScreen,
  onOpenDeepDive,
  onSwitchToSingleMode,
  followedValuesLower,
  pendingFollowValues,
  onToggleFollowCompany,
  onBatchFollowCompanies,
  onRunSampleQuery,
}: CohortComparisonWorkspaceProps) {
  const [customTickerInput, setCustomTickerInput] = useState<string>('');
  const [hoverNormX, setHoverNormX] = useState<number | null>(null);

  const candidates = useMemo(
    () => screenResult?.candidates ?? [],
    [screenResult]
  );

  const selectedCandidates = useMemo(() => {
    const byId = new Map<string, ScreenedCandidateItem>();
    for (const c of candidates) {
      byId.set(c.id, c);
    }
    return selectedIds
      .map((id) => byId.get(id))
      .filter((c): c is ScreenedCandidateItem => Boolean(c));
  }, [candidates, selectedIds]);

  // Assign deterministic series colors to selected companies in selection order
  const colorBySelectedId = useMemo(() => {
    const map = new Map<string, string>();
    selectedIds.forEach((id, idx) => {
      const palette = APP_CONFIG.cohortScreener.seriesColors;
      map.set(id, palette[idx % palette.length]);
    });
    return map;
  }, [selectedIds]);

  // Build normalized % return series for all selected public stocks that have chart points
  const { publicSeries, privateSelected } = useMemo(() => {
    const pub: NormalizedSeriesItem[] = [];
    const priv: ScreenedCandidateItem[] = [];

    for (const cand of selectedCandidates) {
      const dossier = dossiersById[cand.id];
      const market =
        dossier?.market ?? screenResult?.initialMarketById[cand.id] ?? null;

      if (market?.kind === 'public') {
        const pubMarket = market as PublicCompanyMarketOverview;
        const validPts = (pubMarket.points || []).filter(
          (p) => typeof p.close === 'number' && Number.isFinite(p.close) && p.close > 0
        );
        if (validPts.length >= 2) {
          const baseClose = validPts[0].close;
          const denom = Math.max(1, validPts.length - 1);
          const normalizedPts = validPts.map((pt, idx) => ({
            normX: idx / denom,
            timestamp: pt.timestamp,
            close: pt.close,
            pct: ((pt.close - baseClose) / baseClose) * 100,
          }));
          const lastPct = normalizedPts[normalizedPts.length - 1]?.pct ?? 0;

          pub.push({
            id: cand.id,
            symbol: pubMarket.symbol,
            name: pubMarket.companyName || cand.name,
            color: colorBySelectedId.get(cand.id) || '#09a4ff',
            latestPrice: pubMarket.price,
            periodReturnPct: lastPct,
            points: normalizedPts,
          });
        }
      } else if (cand.kind === 'private' || market?.kind === 'private') {
        priv.push(cand);
      }
    }

    return { publicSeries: pub, privateSelected: priv };
  }, [selectedCandidates, dossiersById, screenResult, colorBySelectedId]);

  // SVG chart geometry & bounds
  const chartGeometry = useMemo(() => {
    const width = 920;
    const height = 270;
    const padLeft = 56;
    const padRight = 20;
    const padTop = 18;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (publicSeries.length === 0) {
      return null;
    }

    let minPct = 0;
    let maxPct = 0;
    for (const s of publicSeries) {
      for (const p of s.points) {
        if (p.pct < minPct) minPct = p.pct;
        if (p.pct > maxPct) maxPct = p.pct;
      }
    }

    const span = Math.max(2, maxPct - minPct);
    const yMin = minPct - span * 0.12;
    const yMax = maxPct + span * 0.12;
    const yRange = Math.max(1e-6, yMax - yMin);

    const toX = (normX: number) => padLeft + normX * plotW;
    const toY = (pct: number) => padTop + ((yMax - pct) / yRange) * plotH;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const val = yMax - t * yRange;
      return {
        val,
        y: padTop + t * plotH,
      };
    });

    const refPts = publicSeries[0].points;
    const startLabel = formatChartTimestamp(refPts[0].timestamp, activeRange);
    const midLabel = formatChartTimestamp(
      refPts[Math.floor(refPts.length / 2)].timestamp,
      activeRange
    );
    const endLabel = formatChartTimestamp(
      refPts[refPts.length - 1].timestamp,
      activeRange
    );

    const paths = publicSeries.map((s) => {
      const d = s.points
        .map(
          (pt, idx) =>
            `${idx === 0 ? 'M' : 'L'} ${toX(pt.normX).toFixed(2)} ${toY(pt.pct).toFixed(2)}`
        )
        .join(' ');
      const lastPt = s.points[s.points.length - 1];
      return {
        ...s,
        pathD: d,
        endX: toX(lastPt.normX),
        endY: toY(lastPt.pct),
      };
    });

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      yMin,
      yMax,
      zeroY: yMin <= 0 && yMax >= 0 ? toY(0) : null,
      yTicks,
      startLabel,
      midLabel,
      endLabel,
      paths,
      toX,
      toY,
    };
  }, [publicSeries, activeRange]);

  // Interactive hover snapshot across all plotted series
  const hoverDetails = useMemo(() => {
    if (hoverNormX === null || !chartGeometry || publicSeries.length === 0) {
      return null;
    }

    const clamped = Math.min(1, Math.max(0, hoverNormX));
    const items = publicSeries
      .map((s) => {
        const idx = Math.min(
          s.points.length - 1,
          Math.max(0, Math.round(clamped * (s.points.length - 1)))
        );
        const pt = s.points[idx];
        return {
          id: s.id,
          symbol: s.symbol,
          name: s.name,
          color: s.color,
          close: pt.close,
          pct: pt.pct,
          timestamp: pt.timestamp,
          x: chartGeometry.toX(pt.normX),
          y: chartGeometry.toY(pt.pct),
        };
      })
      .sort((a, b) => b.pct - a.pct);

    const dateLabel = items[0]
      ? formatChartTimestamp(items[0].timestamp, activeRange)
      : '';

    return {
      crosshairX: chartGeometry.toX(clamped),
      dateLabel,
      items,
    };
  }, [hoverNormX, chartGeometry, publicSeries, activeRange]);

  /**
   * Handles submitting the inline `+ Add ticker or company` form.
   */
  const handleCustomAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTickerInput.trim();
    if (!trimmed) return;
    logFunctionCall('CohortComparisonWorkspace.handleCustomAddSubmit', {
      query: trimmed,
    });
    await onAddCustomCompany(trimmed);
    setCustomTickerInput('');
  };

  // 1. Initial Screening Skeleton State
  if (isScreening && !screenResult) {
    return (
      <section
        aria-label="Screening matching companies"
        className="space-y-6 mb-10"
      >
        <div className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3.5 w-48 bg-[#162849] rounded animate-pulse" />
              <div className="h-6 w-96 max-w-full bg-[#162849] rounded animate-pulse" />
            </div>
            <div className="h-9 w-40 bg-[#162849] rounded-lg animate-pulse" />
          </div>
          <div className="border-t border-[#212c42] pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-24 bg-[#091326] border border-[#212c42] rounded-lg p-4 space-y-2 animate-pulse"
              >
                <div className="h-4 w-32 bg-[#162849] rounded" />
                <div className="h-3 w-full bg-[#162849] rounded" />
                <div className="h-3 w-2/3 bg-[#162849] rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 space-y-4">
          <div className="h-5 w-64 bg-[#162849] rounded animate-pulse" />
          <div className="h-60 w-full bg-[#091326] rounded-lg animate-pulse" />
        </div>
      </section>
    );
  }

  // 2. Error State
  if (screenError && !screenResult) {
    return (
      <section className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              Unable to complete natural-language cohort screen
            </h3>
            <p className="text-sm text-rose-300">{screenError}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefreshScreen}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Retry Screen
            </button>
            <button
              type="button"
              onClick={onSwitchToSingleMode}
              className="px-4 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Single-Company Mode
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 3. Empty Match State
  if (screenResult && candidates.length === 0) {
    return (
      <section className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 mb-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              No verified companies matched &ldquo;{screenResult.query}&rdquo;
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              Try relaxing the valuation threshold, broadening the sector phrase, or switching to Single-Company mode.
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToSingleMode}
            className="px-4 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Treat as Single Company
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#212c42]">
          <span className="text-xs text-slate-400">Try a verified cohort screen:</span>
          {APP_CONFIG.cohortScreener.sampleQueries.map((sq) => (
            <button
              key={sq.label}
              type="button"
              onClick={() => onRunSampleQuery(sq.query)}
              className="px-3 py-1.5 text-xs font-medium text-[#49afe9] bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {sq.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (!screenResult) {
    return null;
  }

  const maxReached =
    selectedIds.length >= APP_CONFIG.cohortScreener.maxCompareColumns;

  return (
    <section
      aria-label="Cohort Screening and Multi-Company Comparison"
      className="space-y-6 mb-10"
    >
      {/* SECTION 1: Interpreted Query Banner + Candidate Selection Checklist */}
      <div className="bg-[#0d1b33] border border-[#212c42] rounded-xl divide-y divide-[#212c42]">
        {/* Header Row */}
        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="text-[#49afe9] font-medium">
                Cohort Screen &amp; Side-by-Side Comparison
              </span>
              <span aria-hidden="true">·</span>
              <span>Theme: {screenResult.interpretedTheme}</span>
              {screenResult.constraintSummary && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-emerald-300">
                    Filter: {screenResult.constraintSummary}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {screenResult.strictMatchCount} verified{' '}
                {screenResult.strictMatchCount === 1 ? 'match' : 'matches'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white text-balance">
              Suggested Matches for &ldquo;{query}&rdquo;
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefreshScreen}
              disabled={isScreening}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] disabled:opacity-50 border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isScreening ? 'Screening...' : 'Refresh Screen'}</span>
            </button>

            <button
              type="button"
              onClick={onSwitchToSingleMode}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Single-Company View</span>
            </button>
          </div>
        </div>

        {/* Candidate Picker Toolbar + Batch Follow Selected + Custom Add Input */}
        <div className="px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#0a162b]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-300 font-mono-tabular">
              <span>
                Comparing {selectedIds.length} of{' '}
                {APP_CONFIG.cohortScreener.maxCompareColumns} max companies
              </span>
              <span className="mx-2 text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-400">
                Follow individual matches or batch-follow checked peers
              </span>
            </div>

            {(() => {
              const unfollowedSelected = selectedCandidates.filter((c) => {
                const qKey = c.searchQuery.trim().toLowerCase();
                const nKey = c.name.trim().toLowerCase();
                return (
                  !followedValuesLower.has(qKey) &&
                  !followedValuesLower.has(nKey)
                );
              });
              if (!onBatchFollowCompanies || unfollowedSelected.length === 0) {
                return null;
              }
              const isBatchPending = unfollowedSelected.some((c) => {
                const qKey = c.searchQuery.trim().toLowerCase();
                const nKey = c.name.trim().toLowerCase();
                return Boolean(
                  pendingFollowValues?.has(qKey) ||
                    pendingFollowValues?.has(nKey)
                );
              });

              return (
                <button
                  type="button"
                  disabled={isBatchPending}
                  onClick={() => {
                    logFunctionCall(
                      'CohortComparisonWorkspace.onBatchFollowSelected',
                      {
                        count: unfollowedSelected.length,
                        companies: unfollowedSelected.map((c) => c.searchQuery),
                      }
                    );
                    onBatchFollowCompanies(unfollowedSelected);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#49afe9] hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#09a4ff]/40 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isBatchPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Following...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        Follow Selected ({unfollowedSelected.length})
                      </span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>

          <form
            onSubmit={handleCustomAddSubmit}
            className="flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={customTickerInput}
              onChange={(e) => setCustomTickerInput(e.target.value)}
              placeholder="Add ticker or unicorn (e.g. AMD, OpenAI)..."
              aria-label="Add custom ticker or company to comparison"
              className="w-56 sm:w-64 px-3 py-1.5 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] font-mono-tabular"
            />
            <button
              type="submit"
              disabled={isAddingCustom || !customTickerInput.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingCustom ? 'Adding...' : 'Add to Compare'}</span>
            </button>
          </form>
        </div>

        {customAddError && (
          <div className="px-6 py-2.5 text-xs text-rose-300 bg-rose-950/30">
            {customAddError}
          </div>
        )}

        {/* Candidate Hairline Selection Grid (No nested card-in-card boxes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#212c42]">
          {candidates.map((cand) => {
            const isSelected = selectedIds.includes(cand.id);
            const seriesColor = colorBySelectedId.get(cand.id);
            const disableCheck = !isSelected && maxReached;
            const followKey = cand.searchQuery.trim().toLowerCase();
            const nameKey = cand.name.trim().toLowerCase();
            const isCandFollowed =
              followedValuesLower.has(followKey) ||
              followedValuesLower.has(nameKey);
            const isCandPending = Boolean(
              pendingFollowValues?.has(followKey) ||
                pendingFollowValues?.has(nameKey)
            );

            return (
              <div
                key={cand.id}
                className={`p-4 flex flex-col justify-between gap-3 transition-colors border-b border-[#212c42] ${
                  isSelected ? 'bg-[#102344]/65' : 'hover:bg-[#0f203d]/50'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      disabled={disableCheck}
                      onClick={() => {
                        logFunctionCall(
                          'CohortComparisonWorkspace.toggleCandidate',
                          { id: cand.id, nextSelected: !isSelected }
                        );
                        onToggleCandidate(cand.id);
                      }}
                      className={`flex items-center gap-2.5 text-left group ${
                        disableCheck
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? 'border-transparent text-slate-950'
                            : 'border-slate-500 bg-[#091326] group-hover:border-slate-300'
                        }`}
                        style={
                          isSelected
                            ? { backgroundColor: seriesColor || '#09a4ff' }
                            : undefined
                        }
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <div>
                        <span className="text-sm font-semibold text-white">
                          {cand.name}
                        </span>
                        <span className="ml-1.5 text-xs text-slate-400 font-mono-tabular">
                          {cand.ticker ? cand.ticker : 'Private'}
                        </span>
                      </div>
                    </button>

                    <span className="text-xs font-semibold text-white font-mono-tabular whitespace-nowrap shrink-0">
                      {cand.valuationDisplay || 'Unlisted'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {cand.matchReason}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 text-[11px] text-slate-400">
                  <div className="truncate min-w-0">
                    <span>
                      {cand.sector ||
                        (cand.kind === 'private'
                          ? 'Private Growth'
                          : 'Public Equity')}
                    </span>
                    {!cand.passesThreshold && (
                      <>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-amber-300">Below threshold</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isCandPending}
                      onClick={() => {
                        logFunctionCall(
                          'CohortComparisonWorkspace.candidateCardFollow',
                          {
                            searchQuery: cand.searchQuery,
                            name: cand.name,
                            nextAction: isCandFollowed ? 'unfollow' : 'follow',
                          }
                        );
                        onToggleFollowCompany(
                          cand.searchQuery,
                          cand.name,
                          cand.sector
                        );
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                        isCandFollowed
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-[#091326] text-slate-200 border-[#212c42] hover:border-[#09a4ff] hover:text-white'
                      }`}
                    >
                      {isCandPending ? (
                        <Loader2 className="w-3 h-3 animate-spin text-[#49afe9]" />
                      ) : isCandFollowed ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 text-[#49afe9]" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenDeepDive(cand.searchQuery, cand.entityType)
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#49afe9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Deep Dive</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Normalized Multi-Stock Percentage (%) Price Chart Overlay */}
      {selectedCandidates.length > 0 && (
        <div className="bg-[#0d1b33] border border-[#212c42] rounded-xl divide-y divide-[#212c42]">
          <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-white">
                Normalized Relative Price Performance (% Return Indexed to 0.00%)
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono-tabular">
                {publicSeries.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5">
                    <span
                      className="w-3 h-0.5 rounded-full inline-block"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-white font-medium">{s.symbol}</span>
                    <span
                      className={
                        s.periodReturnPct >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }
                    >
                      {formatSignedPct(s.periodReturnPct)}
                    </span>
                  </span>
                ))}
                {privateSelected.map((priv) => (
                  <span key={priv.id} className="text-slate-400">
                    {priv.name} · Privately Held (valuation &amp; news compared below)
                  </span>
                ))}
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 p-1 bg-[#091326] border border-[#212c42] rounded-lg self-start lg:self-auto">
              {CHART_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    logFunctionCall(
                      'CohortComparisonWorkspace.handleRangeChange',
                      { range: r }
                    );
                    onRangeChange(r);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 font-mono-tabular cursor-pointer ${
                    activeRange === r
                      ? 'bg-[#09a4ff] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Viewport */}
          <div className="p-6">
            {chartGeometry ? (
              <div className="space-y-3">
                {/* Interactive Hover Readout Bar */}
                <div className="min-h-[24px] flex flex-wrap items-center justify-between gap-3 text-xs font-mono-tabular">
                  {hoverDetails ? (
                    <>
                      <span className="text-slate-300">
                        {hoverDetails.dateLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-4">
                        {hoverDetails.items.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1.5"
                          >
                            <span
                              className="w-2.5 h-0.5 inline-block"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-white font-semibold">
                              {item.symbol}
                            </span>
                            <span className="text-slate-300">
                              ${item.close.toFixed(2)}
                            </span>
                            <span
                              className={
                                item.pct >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }
                            >
                              ({formatSignedPct(item.pct)})
                            </span>
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">
                      Hover across the chart to inspect synchronized relative % returns and share prices ({activeRange} window)
                    </span>
                  )}
                </div>

                <div className="w-full overflow-hidden">
                  <svg
                    viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                    className="w-full h-[250px] sm:h-[270px] select-none touch-none"
                    onPointerMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX =
                        ((e.clientX - rect.left) / rect.width) *
                        chartGeometry.width;
                      const norm =
                        (relX - chartGeometry.padLeft) / chartGeometry.plotW;
                      if (norm >= 0 && norm <= 1) {
                        setHoverNormX(norm);
                      } else {
                        setHoverNormX(null);
                      }
                    }}
                    onPointerLeave={() => setHoverNormX(null)}
                  >
                    {/* Horizontal Y Grid Lines */}
                    {chartGeometry.yTicks.map((tick, idx) => (
                      <g key={idx}>
                        <line
                          x1={chartGeometry.padLeft}
                          x2={chartGeometry.width - chartGeometry.padRight}
                          y1={tick.y}
                          y2={tick.y}
                          stroke="#1a2740"
                          strokeWidth={1}
                        />
                        <text
                          x={chartGeometry.padLeft - 8}
                          y={tick.y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[11px] font-mono"
                        >
                          {formatSignedPct(tick.val)}
                        </text>
                      </g>
                    ))}

                    {/* 0.00% Indexed Baseline */}
                    {chartGeometry.zeroY !== null && (
                      <line
                        x1={chartGeometry.padLeft}
                        x2={chartGeometry.width - chartGeometry.padRight}
                        y1={chartGeometry.zeroY}
                        y2={chartGeometry.zeroY}
                        stroke="#475569"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* Normalized Return Polylines */}
                    {chartGeometry.paths.map((series) => (
                      <g key={series.id}>
                        <path
                          d={series.pathD}
                          fill="none"
                          stroke={series.color}
                          strokeWidth={2.25}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx={series.endX}
                          cy={series.endY}
                          r={3.5}
                          fill={series.color}
                        />
                      </g>
                    ))}

                    {/* Interactive Crosshair & Snapped Points */}
                    {hoverDetails && (
                      <g>
                        <line
                          x1={hoverDetails.crosshairX}
                          x2={hoverDetails.crosshairX}
                          y1={chartGeometry.padTop}
                          y2={
                            chartGeometry.height - chartGeometry.padBottom
                          }
                          stroke="#94a3b8"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        {hoverDetails.items.map((pt) => (
                          <circle
                            key={pt.id}
                            cx={pt.x}
                            cy={pt.y}
                            r={4.5}
                            fill={pt.color}
                            stroke="#091326"
                            strokeWidth={1.5}
                          />
                        ))}
                      </g>
                    )}

                    {/* X-Axis Period Labels */}
                    <text
                      x={chartGeometry.padLeft}
                      y={chartGeometry.height - 8}
                      textAnchor="start"
                      className="fill-slate-400 text-[11px] font-mono"
                    >
                      {chartGeometry.startLabel}
                    </text>
                    <text
                      x={chartGeometry.padLeft + chartGeometry.plotW / 2}
                      y={chartGeometry.height - 8}
                      textAnchor="middle"
                      className="fill-slate-400 text-[11px] font-mono"
                    >
                      {chartGeometry.midLabel}
                    </text>
                    <text
                      x={chartGeometry.width - chartGeometry.padRight}
                      y={chartGeometry.height - 8}
                      textAnchor="end"
                      className="fill-slate-400 text-[11px] font-mono"
                    >
                      {chartGeometry.endLabel}
                    </text>
                  </svg>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-300">
                Selected cohort consists exclusively of privately held companies — compare private valuations, funding scale, firmographics, and live news catalysts in the matrix below.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: 4-Dimension Side-by-Side Comparison Matrix */}
      {selectedCandidates.length > 0 ? (
        <div className="bg-[#0d1b33] border border-[#212c42] rounded-xl divide-y divide-[#212c42] overflow-hidden">
          {/* Executive Comparative AI Takeaway Strip */}
          <div className="p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-4xl">
              <div className="flex items-center gap-2 text-xs text-[#49afe9] font-medium">
                <span>Side-by-Side Quantitative &amp; Fundamental Matrix</span>
                {isHydratingComparison && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">
                      Updating company profiles &amp; news catalysts...
                    </span>
                  </>
                )}
              </div>
              {comparativeSummary ? (
                <p className="text-sm text-slate-200 leading-relaxed">
                  {comparativeSummary}
                </p>
              ) : isHydratingComparison ? (
                <div className="space-y-1.5 pt-1">
                  <div className="h-3.5 w-full max-w-2xl bg-[#162849] rounded animate-pulse" />
                  <div className="h-3.5 w-3/4 max-w-xl bg-[#162849] rounded animate-pulse" />
                </div>
              ) : (
                <p className="text-sm text-slate-300">
                  Comparing valuation multiples, historical return momentum, corporate scale, and live news sentiment across your selected cohort.
                </p>
              )}
            </div>
          </div>

          {/* Horizontal Scrollable Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[#212c42] bg-[#0a162b]">
                  <th className="w-52 min-w-[190px] py-4 px-5 text-xs font-semibold text-slate-300 align-top">
                    Metric / Dimension
                  </th>
                  {selectedCandidates.map((cand) => {
                    const color = colorBySelectedId.get(cand.id) || '#09a4ff';
                    const followKey = cand.searchQuery.trim().toLowerCase();
                    const isFollowed =
                      followedValuesLower.has(followKey) ||
                      followedValuesLower.has(cand.name.trim().toLowerCase());
                    const isMatrixPending = Boolean(
                      pendingFollowValues?.has(followKey) ||
                        pendingFollowValues?.has(cand.name.trim().toLowerCase())
                    );

                    return (
                      <th
                        key={cand.id}
                        className="min-w-[220px] py-4 px-5 border-l border-[#212c42] align-top"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-1 rounded-sm shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-sm font-bold text-white">
                                  {cand.name}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                                {cand.ticker
                                  ? `${cand.ticker} · Public Equity`
                                  : 'Privately Held'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isMatrixPending}
                              onClick={() =>
                                onToggleFollowCompany(
                                  cand.searchQuery,
                                  cand.name,
                                  cand.sector
                                )
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                                isFollowed
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-[#091326] text-slate-200 border-[#212c42] hover:border-[#09a4ff]'
                              }`}
                            >
                              {isMatrixPending ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#49afe9]" />
                              ) : isFollowed ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Following</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Follow</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onOpenDeepDive(
                                  cand.searchQuery,
                                  cand.entityType
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#49afe9] hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>Deep Dive</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#212c42] text-xs">
                {/* GROUP 1 HEADER: Valuation & Market Action */}
                <tr className="bg-[#091326]/70">
                  <td
                    colSpan={selectedCandidates.length + 1}
                    className="py-2.5 px-5 text-xs font-semibold text-[#49afe9]"
                  >
                    01. Valuation &amp; Market Action
                  </td>
                </tr>

                {/* Market Cap / Private Valuation */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Market Cap / Valuation
                  </td>
                  {selectedCandidates.map((cand) => {
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    const val =
                      m?.kind === 'public'
                        ? m.metrics.marketCap || cand.valuationDisplay
                        : m?.kind === 'private'
                          ? m.latestValuation || cand.valuationDisplay
                          : cand.valuationDisplay;
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] font-semibold text-white font-mono-tabular"
                      >
                        {val || '—'}
                      </td>
                    );
                  })}
                </tr>

                {/* Share Price / Status */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Share Price / Status
                  </td>
                  {selectedCandidates.map((cand) => {
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-100 font-mono-tabular"
                      >
                        {m?.kind === 'public'
                          ? `$${m.price.toFixed(2)} ${m.currency || 'USD'}`
                          : 'Privately Held'}
                      </td>
                    );
                  })}
                </tr>

                {/* Period Return (%) */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    {activeRange} Price Return
                  </td>
                  {selectedCandidates.map((cand) => {
                    const seriesMatch = publicSeries.find(
                      (s) => s.id === cand.id
                    );
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    const pct =
                      seriesMatch?.periodReturnPct ??
                      (m?.kind === 'public' ? m.changePercent : null);
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] font-semibold font-mono-tabular"
                      >
                        {pct !== null ? (
                          <span
                            className={
                              pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {formatSignedPct(pct)}
                          </span>
                        ) : m?.kind === 'private' && m.lastRound ? (
                          <span className="text-slate-300 font-normal">
                            Last round: {m.lastRound}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Trailing P/E */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Trailing P/E (TTM)
                  </td>
                  {selectedCandidates.map((cand) => {
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200 font-mono-tabular"
                      >
                        {m?.kind === 'public'
                          ? m.metrics.trailingPE || '—'
                          : 'N/A (Private)'}
                      </td>
                    );
                  })}
                </tr>

                {/* Forward P/E */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Forward P/E
                  </td>
                  {selectedCandidates.map((cand) => {
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200 font-mono-tabular"
                      >
                        {m?.kind === 'public'
                          ? m.metrics.forwardPE || '—'
                          : 'N/A (Private)'}
                      </td>
                    );
                  })}
                </tr>

                {/* EPS (TTM) */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Diluted EPS (TTM)
                  </td>
                  {selectedCandidates.map((cand) => {
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200 font-mono-tabular"
                      >
                        {m?.kind === 'public'
                          ? m.metrics.trailingEps || '—'
                          : 'N/A (Private)'}
                      </td>
                    );
                  })}
                </tr>

                {/* 52-Week Range */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    52-Week Price Range
                  </td>
                  {selectedCandidates.map((cand) => {
                    const m =
                      dossiersById[cand.id]?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42]"
                      >
                        {m?.kind === 'public' ? (
                          <FiftyTwoWeekBar
                            low={m.metrics.fiftyTwoWeekLow}
                            high={m.metrics.fiftyTwoWeekHigh}
                            current={m.price}
                          />
                        ) : (
                          <span className="text-slate-500 font-mono-tabular">
                            Unlisted
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Volume / Total Funding */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Trading Volume / Funding
                  </td>
                  {selectedCandidates.map((cand) => {
                    const d = dossiersById[cand.id];
                    const m =
                      d?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    const val =
                      m?.kind === 'public'
                        ? m.metrics.volume
                          ? `${m.metrics.volume} shs`
                          : '—'
                        : m?.kind === 'private'
                          ? m.totalFunding ||
                            d?.profile?.funding.totalUsdDisplay ||
                            '—'
                          : '—';
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200 font-mono-tabular"
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>

                {/* GROUP 2 HEADER: Company Profile & Firmographics */}
                <tr className="bg-[#091326]/70">
                  <td
                    colSpan={selectedCandidates.length + 1}
                    className="py-2.5 px-5 text-xs font-semibold text-[#49afe9]"
                  >
                    02. Company Profile &amp; Operating Scale
                  </td>
                </tr>

                {/* Annual Revenue */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Annual Revenue / Est. Scale
                  </td>
                  {selectedCandidates.map((cand) => {
                    const d = dossiersById[cand.id];
                    const m =
                      d?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    const rev =
                      (m?.kind === 'public' ? m.metrics.totalRevenue : null) ||
                      d?.profile?.revenueDisplay ||
                      (m?.kind === 'private' ? m.estimatedRevenue : null);

                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-100 font-mono-tabular"
                      >
                        {rev ? (
                          rev
                        ) : isHydratingComparison && !d?.profile ? (
                          <span className="inline-block h-3.5 w-24 bg-[#162849] rounded animate-pulse" />
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Employee Headcount */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Employee Headcount
                  </td>
                  {selectedCandidates.map((cand) => {
                    const d = dossiersById[cand.id];
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200 font-mono-tabular"
                      >
                        {d?.profile?.employeesDisplay ? (
                          d.profile.employeesDisplay
                        ) : isHydratingComparison && !d?.profile ? (
                          <span className="inline-block h-3.5 w-20 bg-[#162849] rounded animate-pulse" />
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Headquarters */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Headquarters
                  </td>
                  {selectedCandidates.map((cand) => {
                    const d = dossiersById[cand.id];
                    const m =
                      d?.market ??
                      screenResult.initialMarketById[cand.id] ??
                      null;
                    const hq =
                      d?.profile?.headquartersShort ||
                      (m?.kind === 'private' ? m.headquarters : null);
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200"
                      >
                        {hq ? (
                          hq
                        ) : isHydratingComparison && !d?.profile ? (
                          <span className="inline-block h-3.5 w-28 bg-[#162849] rounded animate-pulse" />
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Founded Year */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Founded
                  </td>
                  {selectedCandidates.map((cand) => {
                    const d = dossiersById[cand.id];
                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-200 font-mono-tabular"
                      >
                        {d?.profile?.foundedYear ? (
                          d.profile.foundedYear
                        ) : isHydratingComparison && !d?.profile ? (
                          <span className="inline-block h-3.5 w-12 bg-[#162849] rounded animate-pulse" />
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Industries & Domain */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    Industries &amp; Website
                  </td>
                  {selectedCandidates.map((cand) => {
                    const d = dossiersById[cand.id];
                    const industriesText =
                      d?.profile?.industries && d.profile.industries.length > 0
                        ? d.profile.industries.slice(0, 3).join(' · ')
                        : cand.sector || '—';
                    const domain = d?.profile?.domain || null;

                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] text-slate-300 space-y-1"
                      >
                        <div>{industriesText}</div>
                        {domain && (
                          <div>
                            <a
                              href={`https://${domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#49afe9] hover:underline font-mono-tabular"
                            >
                              <span>{domain}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* GROUP 3 HEADER: Live News Sentiment & Top Catalyst */}
                <tr className="bg-[#091326]/70">
                  <td
                    colSpan={selectedCandidates.length + 1}
                    className="py-2.5 px-5 text-xs font-semibold text-[#49afe9]"
                  >
                    03. Live News Sentiment &amp; Top Catalyst
                  </td>
                </tr>

                {/* Sentiment Score & Breakdown */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3 px-5 font-medium text-slate-300">
                    News Sentiment Posture
                  </td>
                  {selectedCandidates.map((cand) => {
                    const pulse = dossiersById[cand.id]?.newsPulse ?? null;
                    if (!pulse) {
                      return (
                        <td
                          key={cand.id}
                          className="py-3 px-5 border-l border-[#212c42]"
                        >
                          {isHydratingComparison ? (
                            <span className="inline-block h-3.5 w-32 bg-[#162849] rounded animate-pulse" />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      );
                    }

                    const postureColor =
                      pulse.netPosture === 'Bullish'
                        ? 'text-emerald-400'
                        : pulse.netPosture === 'Bearish'
                          ? 'text-rose-400'
                          : pulse.netPosture === 'Mixed'
                            ? 'text-amber-300'
                            : 'text-slate-300';

                    return (
                      <td
                        key={cand.id}
                        className="py-3 px-5 border-l border-[#212c42] space-y-1 font-mono-tabular"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${postureColor}`}>
                            {pulse.netPosture}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-200">
                            {pulse.bullishPct}% Bullish
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {pulse.bullishCount} Bullish · {pulse.bearishCount}{' '}
                          Bearish · {pulse.neutralCount} Neutral
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Top Catalyst / Risk Headline */}
                <tr className="hover:bg-[#0f203d]/40">
                  <td className="py-3.5 px-5 font-medium text-slate-300 align-top">
                    Top Catalyst Headline
                  </td>
                  {selectedCandidates.map((cand) => {
                    const pulse = dossiersById[cand.id]?.newsPulse ?? null;
                    if (!pulse) {
                      return (
                        <td
                          key={cand.id}
                          className="py-3.5 px-5 border-l border-[#212c42]"
                        >
                          {isHydratingComparison ? (
                            <div className="space-y-1.5">
                              <div className="h-3.5 w-full bg-[#162849] rounded animate-pulse" />
                              <div className="h-3.5 w-2/3 bg-[#162849] rounded animate-pulse" />
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      );
                    }

                    const cat = pulse.topCatalyst;
                    if (!cat) {
                      return (
                        <td
                          key={cand.id}
                          className="py-3.5 px-5 border-l border-[#212c42] text-slate-500"
                        >
                          No recent headlines
                        </td>
                      );
                    }

                    const sentColor =
                      cat.sentiment === 'Bullish'
                        ? 'text-emerald-400'
                        : cat.sentiment === 'Bearish'
                          ? 'text-rose-400'
                          : 'text-slate-400';

                    return (
                      <td
                        key={cand.id}
                        className="py-3.5 px-5 border-l border-[#212c42] align-top space-y-1.5"
                      >
                        <a
                          href={cat.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-white hover:text-[#49afe9] leading-snug line-clamp-3 inline-flex items-start gap-1 transition-colors"
                        >
                          <span>{cat.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                        </a>
                        <div className="text-[11px] text-slate-400">
                          <span className={sentColor}>{cat.sentiment}</span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span>{cat.sourceName}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 text-center text-sm text-slate-300">
          Select at least one company from the verified candidates above to view normalized price performance and side-by-side comparison metrics.
        </div>
      )}
    </section>
  );
}
