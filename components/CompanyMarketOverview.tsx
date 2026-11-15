/**
 * ============================================================================
 * FILE: components/CompanyMarketOverview.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Interactive Company Price Chart & Key Investment Metrics Overview Panel.
 *
 * USE CASES:
 * 1. Rendering an interactive historical SVG price & volume chart with timeframe
 *    switching (`1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, `5Y`), crosshair hover
 *    scrubbing, and Day / 52-Week range bars for US, ADR, and Korea Exchange
 *    (KOSPI `.KS` & KOSDAQ `.KQ`) equities.
 * 2. Displaying structured key investment metrics (Valuation, Growth &
 *    Profitability, Per-Share & Consensus) in pure currency units (`$` USD or
 *    pure integer `₩` & `조`/`억` KRW) with tabular numerals and tooltips.
 * 3. Rendering a grounded private-market valuation and metrics summary when the
 *    searched company is privately held (e.g. Stripe, OpenAI).
 * ============================================================================
 */

'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  Check,
  Plus,
  Loader2,
} from 'lucide-react';
import { formatTickerWithAdr, isAdrTicker } from '@/lib/adr-directory';
import {
  formatSharePriceByCurrency,
  getKrxMarketFromSymbol,
} from '@/lib/krx-directory';
import type {
  ChartRange,
  CompanyMarketOverviewData,
  PriceChartPoint,
} from '@/lib/market-data-service';
import { useLanguage } from '@/components/LanguageProvider';
import {
  translatePresetMetadata,
  type AppLocale,
} from '@/lib/i18n';
import { logFunctionCall } from '@/lib/logger';

export interface CompanyMarketOverviewProps {
  data: CompanyMarketOverviewData | null;
  isLoading: boolean;
  isLoadingChart: boolean;
  error: string | null;
  activeRange: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  onRetry: () => void;
  searchedQuery: string;
  isFollowed?: boolean;
  isFollowPending?: boolean;
  onToggleFollow?: () => void;
}

const CHART_RANGES: ChartRange[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'];

/**
 * Formats a share price cleanly in pure KRW (`₩` integer, zero decimals) or USD (`$`, 2 decimals).
 */
function formatPrice(value: number | null | undefined, currency = 'USD'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if ((currency || '').toUpperCase() === 'KRW') {
    return formatSharePriceByCurrency(value, 'KRW');
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a signed price change delta (`+₩1,200` for KRW vs `+3.45` for USD).
 */
function formatSignedPriceDelta(delta: number, currency = 'USD'): string {
  if (!Number.isFinite(delta)) return '0.00';
  if ((currency || '').toUpperCase() === 'KRW') {
    const sign = delta >= 0 ? '+' : '-';
    return `${sign}₩${Math.round(Math.abs(delta)).toLocaleString('en-US')}`;
  }
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
}

/**
 * Formats a pre-formatted per-share metric string (EPS, Analyst Target) without
 * duplicating currency symbols when server-side KRW formatting already added `₩`.
 */
function formatPerShareMetricString(
  raw: string | null | undefined,
  currency = 'USD'
): string {
  if (!raw || !raw.trim()) return '—';
  const trimmed = raw.trim();
  if (/^[+-]?[₩$]/.test(trimmed)) {
    return trimmed;
  }
  if ((currency || '').toUpperCase() === 'KRW') {
    const parsed = Number(trimmed.replace(/,/g, ''));
    if (Number.isFinite(parsed)) {
      return formatSharePriceByCurrency(parsed, 'KRW');
    }
    return `₩${trimmed}`;
  }
  return `$${trimmed}`;
}

function formatVolume(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return '—';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

function formatAxisDate(ts: number, range: ChartRange, locale: AppLocale): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const intlLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
  if (range === '1D') {
    return d.toLocaleTimeString(intlLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (range === '5D') {
    return d.toLocaleDateString(intlLocale, {
      month: 'short',
      day: 'numeric',
    });
  }
  if (range === '5Y') {
    return d.toLocaleDateString(intlLocale, {
      month: 'short',
      year: '2-digit',
    });
  }
  return d.toLocaleDateString(intlLocale, {
    month: 'short',
    day: 'numeric',
  });
}

function formatTooltipTimestamp(ts: number, range: ChartRange, locale: AppLocale): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const intlLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
  if (range === '1D' || range === '5D') {
    return d.toLocaleString(intlLocale, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleDateString(intlLocale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function MetricLabelWithTooltip({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <span
      tabIndex={0}
      title={tooltip}
      aria-label={`${label}: ${tooltip}`}
      className="group relative inline-flex items-center text-xs text-slate-400 cursor-help border-b border-dotted border-slate-600/80 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#09a4ff] rounded-xs"
    >
      <span>{label}</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition-opacity duration-150 absolute left-0 bottom-full mb-2 z-40 w-52 px-2.5 py-2 rounded-lg bg-[#060d1b] border border-[#2b3b5a] text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-xl whitespace-normal"
      >
        {tooltip}
      </span>
    </span>
  );
}

function RangeBar({
  label,
  low,
  high,
  current,
  currency,
}: {
  label: string;
  low: number | null;
  high: number | null;
  current: number;
  currency: string;
}) {
  if (
    typeof low !== 'number' ||
    typeof high !== 'number' ||
    Number.isNaN(low) ||
    Number.isNaN(high) ||
    high <= low
  ) {
    return null;
  }

  const pct = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100));

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-mono-tabular">
          {formatPrice(low, currency)} – {formatPrice(high, currency)}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-[#162747]">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#09a4ff] border border-white/80"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Interactive SVG Price + Volume Chart with pointer crosshair scrubbing.
 */
function InteractivePriceChart({
  points,
  previousClose,
  range,
  currency,
  isPositive,
}: {
  points: PriceChartPoint[];
  previousClose: number;
  range: ChartRange;
  currency: string;
  isPositive: boolean;
}) {
  const { locale, t } = useLanguage();
  const gradientId = useId().replace(/:/g, '');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isKrw = (currency || '').toUpperCase() === 'KRW';
  const width = 800;
  const height = 270;
  const padLeft = 10;
  const padRight = isKrw ? 78 : 68;
  const padTop = 16;
  const padBottom = 28;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const closes = points.map((p) => p.close);
    const minVal = Math.min(...closes, previousClose);
    const maxVal = Math.max(...closes, previousClose);
    const span = maxVal - minVal || maxVal * 0.02 || 1;
    const yMin = minVal - span * 0.08;
    const yMax = maxVal + span * 0.08;
    const yRange = yMax - yMin || 1;

    const maxVol = Math.max(...points.map((p) => p.volume ?? 0), 1);

    const coords = points.map((p, idx) => {
      const x =
        points.length === 1
          ? padLeft + plotWidth / 2
          : padLeft + (idx / (points.length - 1)) * plotWidth;
      const y = padTop + (1 - (p.close - yMin) / yRange) * plotHeight;
      const volRatio = (p.volume ?? 0) / maxVol;
      const volBarHeight = Math.max(0, volRatio * (plotHeight * 0.18));
      return { x, y, volBarHeight, point: p };
    });

    const linePath = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    const baselineY = padTop + plotHeight;
    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`
        : '';

    const prevCloseY =
      padTop + (1 - (previousClose - yMin) / yRange) * plotHeight;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const val = yMax - ratio * yRange;
      const y = padTop + ratio * plotHeight;
      return { val, y };
    });

    const xTickIndices =
      points.length <= 5
        ? points.map((_, i) => i)
        : [0, 0.25, 0.5, 0.75, 1].map((r) =>
            Math.min(points.length - 1, Math.round(r * (points.length - 1)))
          );

    return {
      coords,
      linePath,
      areaPath,
      prevCloseY,
      yTicks,
      xTickIndices,
      baselineY,
    };
  }, [points, previousClose, plotWidth, plotHeight]);

  if (!geometry) return null;

  const strokeColor = isPositive ? '#10b981' : '#f43f5e';
  const activeCoord =
    hoverIndex !== null && geometry.coords[hoverIndex]
      ? geometry.coords[hoverIndex]
      : geometry.coords[geometry.coords.length - 1];

  const hoveredPoint = activeCoord.point;
  const pointDelta = hoveredPoint.close - previousClose;
  const pointDeltaPct =
    previousClose > 0 ? (pointDelta / previousClose) * 100 : 0;

  const handlePointerPosition = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const clampedX = Math.min(padLeft + plotWidth, Math.max(padLeft, svgX));
    const ratio = (clampedX - padLeft) / plotWidth;
    const idx = Math.min(
      geometry.coords.length - 1,
      Math.max(0, Math.round(ratio * (geometry.coords.length - 1)))
    );
    setHoverIndex(idx);
  };

  return (
    <div>
      {/* Compact Interactive Point Readout Bar (Zero Overlap) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono-tabular mb-2 min-h-[20px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-300">
            {formatTooltipTimestamp(hoveredPoint.timestamp, range, locale)}
          </span>
          <span>
            {t.marketOverview.closeLabel}:{' '}
            <strong className="text-white font-semibold">
              {formatPrice(hoveredPoint.close, currency)}
            </strong>
          </span>
          {hoveredPoint.high !== null && hoveredPoint.low !== null && (
            <span>
              {t.marketOverview.highLowLabel}:{' '}
              <span className="text-slate-200">
                {formatPrice(hoveredPoint.high, currency)} /{' '}
                {formatPrice(hoveredPoint.low, currency)}
              </span>
            </span>
          )}
          {hoveredPoint.volume !== null && (
            <span>
              {t.marketOverview.volLabel}:{' '}
              <span className="text-slate-200">
                {formatVolume(hoveredPoint.volume)}
              </span>
            </span>
          )}
        </div>
        <span
          className={
            pointDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'
          }
        >
          {formatSignedPriceDelta(pointDelta, currency)} (
          {pointDelta >= 0 ? '+' : ''}
          {pointDeltaPct.toFixed(2)}%)
        </span>
      </div>

      {/* Responsive Interactive SVG Chart */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none touch-none"
          role="img"
          aria-label="Company stock price history chart"
          onMouseMove={(e) => handlePointerPosition(e.clientX, e.currentTarget)}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchMove={(e) => {
            if (e.touches[0]) {
              handlePointerPosition(e.touches[0].clientX, e.currentTarget);
            }
          }}
          onTouchEnd={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Right Y-Axis Price Labels */}
          {geometry.yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + plotWidth}
                y2={tick.y}
                stroke="#212c42"
                strokeWidth="1"
              />
              <text
                x={width - 4}
                y={tick.y + 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="var(--font-mono), monospace"
              >
                {isKrw
                  ? `₩${Math.round(tick.val).toLocaleString('en-US')}`
                  : tick.val.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Baseline / Previous Close Reference Line */}
          {geometry.prevCloseY >= padTop &&
            geometry.prevCloseY <= geometry.baselineY && (
              <line
                x1={padLeft}
                y1={geometry.prevCloseY}
                x2={padLeft + plotWidth}
                y2={geometry.prevCloseY}
                stroke="#49afe9"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}

          {/* Subtle Volume Histogram Bars */}
          {geometry.coords.map((c, idx) => {
            if (c.volBarHeight <= 0) return null;
            const barWidth = Math.max(
              1.5,
              Math.min(8, plotWidth / geometry.coords.length - 1)
            );
            return (
              <rect
                key={`v-${idx}`}
                x={c.x - barWidth / 2}
                y={geometry.baselineY - c.volBarHeight}
                width={barWidth}
                height={c.volBarHeight}
                fill="#49afe9"
                fillOpacity={hoverIndex === idx ? 0.45 : 0.16}
                rx="1"
              />
            );
          })}

          {/* Area Gradient & Price Line */}
          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path
            d={geometry.linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Crosshair & Active Point Marker */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={activeCoord.x}
                y1={padTop}
                x2={activeCoord.x}
                y2={geometry.baselineY}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={padLeft}
                y1={activeCoord.y}
                x2={padLeft + plotWidth}
                y2={activeCoord.y}
                stroke="#94a3b8"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="5"
                fill={strokeColor}
                stroke="#091326"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-Axis Time/Date Labels */}
          {geometry.xTickIndices.map((idx, tickIdx) => {
            const c = geometry.coords[idx];
            if (!c) return null;
            const anchor =
              tickIdx === 0
                ? 'start'
                : tickIdx === geometry.xTickIndices.length - 1
                  ? 'end'
                  : 'middle';
            return (
              <text
                key={`x-${tickIdx}-${idx}`}
                x={c.x}
                y={height - 6}
                textAnchor={anchor}
                fill="#94a3b8"
                fontSize="11"
                fontFamily="var(--font-mono), monospace"
              >
                {formatAxisDate(c.point.timestamp, range, locale)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Renders the Price Chart + Key Investment Metrics section.
 */
export function CompanyMarketOverview({
  data,
  isLoading,
  isLoadingChart,
  error,
  activeRange,
  onRangeChange,
  onRetry,
  searchedQuery,
  isFollowed = false,
  isFollowPending = false,
  onToggleFollow,
}: CompanyMarketOverviewProps) {
  const { locale, t } = useLanguage();
  const isKo = locale === 'ko';

  if (isLoading) {
    return (
      <section
        id="market-overview"
        aria-label={t.marketOverview.keyInvestmentMetrics}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch"
      >
        <div className="lg:col-span-8 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 animate-pulse">
          <div className="h-5 w-48 bg-[#162747] rounded mb-3" />
          <div className="h-8 w-36 bg-[#162747] rounded mb-6" />
          <div className="h-56 w-full bg-[#162747] rounded" />
        </div>
        <div className="lg:col-span-4 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 animate-pulse">
          <div className="h-5 w-40 bg-[#162747] rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="h-5 w-full bg-[#162747] rounded" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        id="market-overview"
        aria-label={t.marketOverview.unavailableTitle}
        className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 mb-6 flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-base font-bold text-white mb-1">
            {t.marketOverview.unavailableTitle} ({searchedQuery})
          </h2>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.common.retry}</span>
        </button>
      </section>
    );
  }

  if (!data) return null;

  if (data.kind === 'private') {
    const undisclosedLabel = isKo ? '비공개' : 'Undisclosed';
    const privateRows = [
      {
        label: t.marketOverview.estValuation,
        value: data.latestValuation || undisclosedLabel,
        tooltip: t.marketOverview.estValuationTooltip,
      },
      {
        label: t.marketOverview.fundingStage,
        value: data.lastRound || undisclosedLabel,
        tooltip: t.marketOverview.fundingStageTooltip,
      },
      {
        label: isKo ? '누적 투자 유치' : 'Total Funding',
        value: data.totalFunding || undisclosedLabel,
        tooltip: isKo
          ? '현재까지 공개된 누적 프라이빗 투자 유치 금액'
          : 'Cumulative disclosed private capital raised.',
      },
      {
        label: isKo ? '추정 매출' : 'Est. Revenue',
        value: data.estimatedRevenue || undisclosedLabel,
        tooltip: isKo
          ? '가장 최근 보도된 연간 매출 또는 연간 환산 매출(ARR)'
          : 'Most recently reported annual revenue or annualized run rate.',
      },
      {
        label: t.marketOverview.sectorCategory,
        value: translatePresetMetadata(
          data.sector || (isKo ? '비상장 테크' : 'Private Technology'),
          locale
        ),
        tooltip: isKo ? '주요 산업 분류' : 'Primary industry classification.',
      },
      {
        label: t.companyProfile.headquarters,
        value: data.headquarters || (isKo ? '미국' : 'United States'),
        tooltip: isKo ? '본사 소재지' : 'Corporate headquarters location.',
      },
      {
        label: isKo ? '최고경영자 (CEO)' : 'Chief Executive',
        value: data.ceo || '—',
        tooltip: isKo ? '현직 최고경영자(CEO)' : 'Current Chief Executive Officer.',
      },
    ];

    return (
      <section
        id="market-overview"
        aria-label={t.marketOverview.privateMetricsHeader}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch"
      >
        <div className="lg:col-span-8 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
                  <span className="text-[#49afe9] font-medium">
                    {translatePresetMetadata(
                      data.listingNote || t.marketOverview.privateCompanyBadge,
                      locale
                    )}
                  </span>
                  {data.sector && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{translatePresetMetadata(data.sector, locale)}</span>
                    </>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">
                  {data.companyName}
                </h2>
              </div>

              {onToggleFollow && (isFollowed || data.canFollow !== false) && (
                <button
                  type="button"
                  disabled={isFollowPending}
                  onClick={() => {
                    logFunctionCall('CompanyMarketOverview.onToggleFollow', {
                      companyName: data.companyName,
                      kind: 'private',
                      nextState: isFollowed ? 'unfollow' : 'follow',
                    });
                    onToggleFollow();
                  }}
                  title={
                    isFollowed
                      ? `${t.common.unfollow} ${data.companyName}`
                      : `${t.common.follow} ${data.companyName}`
                  }
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                    isFollowed
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-200 hover:border-rose-500/50'
                      : 'bg-[#091326] text-[#49afe9] border-[#09a4ff]/40 hover:bg-[#102344] hover:text-white'
                  }`}
                >
                  {isFollowPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.watchlist.verifyingButton}</span>
                    </>
                  ) : isFollowed ? (
                    <span className="inline-grid items-center justify-items-center">
                      <span className="col-start-1 row-start-1 inline-flex items-center gap-1.5 transition-opacity duration-150 group-hover:opacity-0">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{t.common.following}</span>
                      </span>
                      <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        {t.common.unfollow}
                      </span>
                    </span>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {t.common.follow} {data.companyName}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl mb-5">
              {data.summary}
            </p>
          </div>

          <div className="pt-4 border-t border-[#212c42] flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              {t.marketOverview.privateDataDisclaimer}
            </p>
            {data.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {data.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#49afe9] hover:text-white transition-colors"
                  >
                    <span className="truncate max-w-[160px]">{src.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6">
          <h3 className="text-sm font-bold text-white mb-1">
            {t.marketOverview.privateMetricsHeader}
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            {isKo
              ? '보고된 투자 유치 및 기업가치 요약'
              : 'Reported capital & valuation profile'}
          </p>

          <div className="divide-y divide-[#212c42]">
            {privateRows.map((row) => (
              <div
                key={row.label}
                className="py-2.5 flex items-center justify-between gap-4"
              >
                <MetricLabelWithTooltip
                  label={row.label}
                  tooltip={row.tooltip}
                />
                <span className="text-xs font-semibold text-white font-mono-tabular text-right">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Public US / ADR / KRX (KOSPI & KOSDAQ) Equity View
  const isPositive = data.change >= 0;
  const isKrwEquity = (data.currency || '').toUpperCase() === 'KRW';
  const isFlat = isKrwEquity
    ? Math.abs(data.change) < 0.5
    : Math.abs(data.change) < 0.005;
  const krxMarket = getKrxMarketFromSymbol(data.symbol);
  const isAdrEquity = Boolean(
    !krxMarket && (data.isAdr || isAdrTicker(data.symbol, data.companyName))
  );
  const displaySymbol = formatTickerWithAdr(
    data.symbol,
    data.companyName,
    isAdrEquity
  );

  const metricGroups: Array<{
    heading: string;
    items: Array<{ label: string; value: string; tooltip: string }>;
  }> = [
    {
      heading: isKo ? '밸류에이션 및 규모' : 'Valuation & Size',
      items: [
        {
          label: t.marketOverview.marketCap,
          value: data.metrics.marketCap || '—',
          tooltip: t.marketOverview.marketCapTooltip,
        },
        {
          label: isKo ? '기업가치 (EV)' : 'Enterprise Value',
          value: data.metrics.enterpriseValue || '—',
          tooltip: isKo
            ? '시가총액에 총부채를 더하고 현금성 자산을 차감한 기업가치(EV)'
            : 'Market capitalization plus total debt minus cash and equivalents.',
        },
        {
          label: t.marketOverview.peRatioTtm,
          value: data.metrics.trailingPE || '—',
          tooltip: t.marketOverview.peRatioTooltip,
        },
        {
          label: t.marketOverview.forwardPe,
          value: data.metrics.forwardPE || '—',
          tooltip: t.marketOverview.forwardPeTooltip,
        },
        {
          label: isKo ? 'PBR (주가순자산비율)' : 'P/B Ratio',
          value: data.metrics.priceToBook || '—',
          tooltip: isKo
            ? '주당 순자산가치(BPS) 대비 현재 주가 배수'
            : 'Share price relative to book value per share.',
        },
        {
          label: t.marketOverview.epsTtm,
          value: formatPerShareMetricString(
            data.metrics.trailingEps,
            data.currency
          ),
          tooltip: t.marketOverview.epsTooltip,
        },
      ],
    },
    {
      heading: isKo ? '성장성 및 수익성' : 'Growth & Profitability',
      items: [
        {
          label: isKo ? '매출액 (TTM)' : 'Revenue (TTM)',
          value: data.metrics.totalRevenue || '—',
          tooltip: isKo
            ? '최근 12개월(TTM) 누적 총매출액'
            : 'Total trailing 12-month top-line revenue.',
        },
        {
          label: isKo ? '매출 성장률' : 'Revenue Growth',
          value: data.metrics.revenueGrowth || '—',
          tooltip: isKo
            ? '전년 동기 대비 분기 매출 성장률(YoY)'
            : 'Year-over-year quarterly revenue growth rate.',
        },
        {
          label: isKo ? '순이익률' : 'Net Margin',
          value: data.metrics.profitMargins || '—',
          tooltip: isKo
            ? '총매출 대비 당기순이익 비율'
            : 'Net income as a percentage of total revenue.',
        },
        {
          label: isKo ? '영업이익률' : 'Op Margin',
          value: data.metrics.operatingMargins || '—',
          tooltip: isKo
            ? '총매출 대비 영업이익 비율'
            : 'Operating income as a percentage of total revenue.',
        },
        {
          label: isKo ? '자기자본이익률 (ROE)' : 'ROE',
          value: data.metrics.returnOnEquity || '—',
          tooltip: isKo
            ? '최근 12개월 기준 주주 자본 대비 순이익 수익률'
            : 'Return on shareholders’ equity over the trailing 12 months.',
        },
        {
          label: isKo ? '목표주가 컨센서스' : 'Analyst Target',
          value: formatPerShareMetricString(
            data.metrics.targetMeanPrice,
            data.currency
          ),
          tooltip: isKo
            ? krxMarket
              ? '증권사 애널리스트 12개월 평균 목표주가 컨센서스'
              : '월가 애널리스트 12개월 평균 목표주가 컨센서스'
            : krxMarket
              ? 'Consensus mean 12-month analyst price target (KRW).'
              : 'Wall Street consensus mean 12-month price target.',
        },
      ],
    },
    {
      heading: isKo ? '배당 · 변동성 · 유동성' : 'Yield, Risk & Liquidity',
      items: [
        {
          label: isKo ? '배당수익률' : 'Dividend Yield',
          value: data.metrics.dividendYield || '—',
          tooltip: isKo
            ? '현재 주가 대비 연간 배당금 비율'
            : 'Annualized dividend payout as a percentage of share price.',
        },
        {
          label: isKo ? '베타 (5년)' : 'Beta (5Y)',
          value: data.metrics.beta || '—',
          tooltip: isKo
            ? krxMarket
              ? '벤치마크 지수 대비 최근 5년 월간 주가 변동성 민감도'
              : 'S&P 500 지수 대비 최근 5년 월간 주가 변동성 민감도'
            : krxMarket
              ? '5-year monthly volatility sensitivity relative to benchmark index.'
              : '5-year monthly volatility sensitivity relative to the S&P 500.',
        },
        {
          label: isKo ? '거래량' : 'Volume',
          value: data.metrics.volume || '—',
          tooltip: isKo
            ? '최근 거래일 누적 주식 거래량'
            : 'Total shares traded during the latest session.',
        },
        {
          label: isKo ? '평균 거래량' : 'Avg Volume',
          value: data.metrics.averageVolume || '—',
          tooltip: isKo
            ? '일평균 주식 거래량'
            : 'Average daily share trading volume.',
        },
      ],
    },
  ];

  return (
    <section
      id="market-overview"
      aria-label={t.marketOverview.keyInvestmentMetrics}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch"
    >
      {/* Left 8 Columns: Interactive Price Chart */}
      <div className="lg:col-span-8 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 flex flex-col justify-between">
        <div>
          {/* Header Row: Identity, Price, and Timeframe Selector */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-4 border-b border-[#212c42]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
                <span className="text-[#49afe9] font-semibold font-mono-tabular">
                  {displaySymbol}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {krxMarket === 'KOSPI'
                    ? isKo
                      ? 'KOSPI 상장 주식'
                      : 'KOSPI Listed Equity'
                    : krxMarket === 'KOSDAQ'
                      ? isKo
                        ? 'KOSDAQ 상장 주식'
                        : 'KOSDAQ Listed Equity'
                      : isAdrEquity
                        ? isKo
                          ? '미국 거래 ADR 주식'
                          : 'US-Traded ADR Equity'
                        : isKo
                          ? '미국 상장 주식'
                          : 'US Listed Equity'}
                </span>
                {data.sector && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{translatePresetMetadata(data.sector, locale)}</span>
                  </>
                )}
                {data.industry && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{translatePresetMetadata(data.industry, locale)}</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {data.companyName}
                </h2>
                {onToggleFollow && (
                  <button
                    type="button"
                    disabled={isFollowPending}
                    onClick={() => {
                      logFunctionCall('CompanyMarketOverview.onToggleFollow', {
                        symbol: data.symbol,
                        kind: 'public',
                        nextState: isFollowed ? 'unfollow' : 'follow',
                      });
                      onToggleFollow();
                    }}
                    title={
                      isFollowed
                        ? `${t.common.unfollow} ${displaySymbol}`
                        : `${t.common.follow} ${displaySymbol}`
                    }
                    className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                      isFollowed
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-200 hover:border-rose-500/50'
                        : 'bg-[#091326] text-[#49afe9] border-[#09a4ff]/40 hover:bg-[#102344] hover:text-white'
                    }`}
                  >
                    {isFollowPending ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{t.watchlist.verifyingButton}</span>
                      </>
                    ) : isFollowed ? (
                      <span className="inline-grid items-center justify-items-center">
                        <span className="col-start-1 row-start-1 inline-flex items-center gap-1 transition-opacity duration-150 group-hover:opacity-0">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{t.common.following}</span>
                        </span>
                        <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          {t.common.unfollow}
                        </span>
                      </span>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>
                          {t.common.follow} {displaySymbol}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-baseline gap-3 font-mono-tabular">
                <span className="text-2xl sm:text-3xl font-bold text-white">
                  {formatPrice(data.price, data.currency)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                    isFlat
                      ? 'text-slate-300'
                      : isPositive
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}
                >
                  {isFlat ? (
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  ) : isPositive ? (
                    <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>
                    {formatSignedPriceDelta(data.change, data.currency)} (
                    {isPositive ? '+' : ''}
                    {data.changePercent.toFixed(2)}%)
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {activeRange === '1D'
                    ? t.marketOverview.todayReturn
                    : `${activeRange} ${t.marketOverview.rangeReturnSuffix}`}
                </span>
              </div>
            </div>

            {/* Interactive Timeframe Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-[#091326] rounded-lg border border-[#212c42]">
              {CHART_RANGES.map((rangeKey) => {
                const active = activeRange === rangeKey;
                return (
                  <button
                    key={rangeKey}
                    type="button"
                    disabled={isLoadingChart}
                    onClick={() => {
                      logFunctionCall('CompanyMarketOverview.onRangeChange', {
                        symbol: data.symbol,
                        range: rangeKey,
                      });
                      onRangeChange(rangeKey);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#09a4ff] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {rangeKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart Body */}
          <div className={isLoadingChart ? 'opacity-60 transition-opacity' : ''}>
            <InteractivePriceChart
              points={data.points}
              previousClose={data.previousClose}
              range={activeRange}
              currency={data.currency}
              isPositive={isPositive}
            />
          </div>
        </div>

        {/* Bottom Range Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 mt-4 border-t border-[#212c42]">
          <RangeBar
            label={t.marketOverview.dayRange}
            low={data.metrics.dayLow}
            high={data.metrics.dayHigh}
            current={data.price}
            currency={data.currency}
          />
          <RangeBar
            label={t.marketOverview.week52Range}
            low={data.metrics.fiftyTwoWeekLow}
            high={data.metrics.fiftyTwoWeekHigh}
            current={data.price}
            currency={data.currency}
          />
        </div>
      </div>

      {/* Right 4 Columns: Key Investment Metrics */}
      <aside className="lg:col-span-4 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6">
        <div className="flex items-baseline justify-between gap-2 pb-3 mb-4 border-b border-[#212c42]">
          <div>
            <h3 className="text-base font-bold text-white">
              {t.marketOverview.keyInvestmentMetrics}
            </h3>
            <p className="text-xs text-slate-400">
              {isKo
                ? `밸류에이션 · 수익성 · 컨센서스 (${displaySymbol})`
                : `Valuation, profitability & consensus (${displaySymbol})`}
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono-tabular">
            {data.currency}
          </span>
        </div>

        <div className="space-y-4">
          {metricGroups.map((group) => (
            <div key={group.heading}>
              <div className="text-xs font-semibold text-[#49afe9] mb-2">
                {group.heading}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pb-3 border-b border-[#212c42]/80">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <MetricLabelWithTooltip
                      label={item.label}
                      tooltip={item.tooltip}
                    />
                    <span className="text-xs font-semibold text-white font-mono-tabular text-right">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
