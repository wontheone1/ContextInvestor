/**
 * ============================================================================
 * FILE: components/WatchlistCarousel.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Featured Equities & Institutional Entities Strip with Embedded Sparklines.
 *
 * USE CASES:
 * 1. Combining Kamino.com's horizontal featured asset strip with TradingView's
 *    embedded SVG sparkline charts for rapid 1-click company news lookups.
 * 2. Allowing investors to switch between Ticker lookups (e.g., `NVDA`, `AAPL`,
 *    `MSFT`, `PLTR`) and Company Name lookups (e.g., `Stripe`, `OpenAI`) with a
 *    single click.
 * ============================================================================
 */

'use client';

import React from 'react';
import { APP_CONFIG, type CompanyPreset } from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';

export interface WatchlistCarouselProps {
  activeValue: string;
  activeEntityType: 'auto' | 'name' | 'ticker';
  onSelectPreset: (preset: CompanyPreset) => void;
}

/**
 * Renders a mini SVG sparkline path for a preset company's recent trajectory.
 */
function renderSparklineSvg(points: number[], positive: boolean) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 84;
  const height = 28;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
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
      aria-hidden="true"
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
 * Renders the Featured Equities & Entities strip above the News Search Terminal.
 */
export function WatchlistCarousel({
  activeValue,
  activeEntityType,
  onSelectPreset,
}: WatchlistCarouselProps) {
  return (
    <section aria-label="Featured Companies Watchlist" className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300 tracking-tight">
          Featured Companies &amp; Equities
        </h2>
        <span className="text-xs text-slate-400">
          US Listed Equities &amp; Private Leaders
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {APP_CONFIG.featuredCompanies.map((item) => {
          const isSelected =
            activeValue.toLowerCase() === item.value.toLowerCase() &&
            (activeEntityType === 'auto' ||
              activeEntityType === item.entityType);

          return (
            <button
              key={`${item.entityType}-${item.value}`}
              type="button"
              onClick={() => {
                logFunctionCall('WatchlistCarousel.onSelectPreset', {
                  entityType: item.entityType,
                  value: item.value,
                });
                onSelectPreset(item);
              }}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#102344] border-[#09a4ff]'
                  : 'bg-[#0d1b33] border-[#212c42] hover:border-[#49afe9]/60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-sm font-bold text-white truncate">
                  {item.label}
                </span>
                {item.entityType === 'ticker' && (
                  <span className="text-xs text-[#49afe9] font-mono-tabular shrink-0">
                    {item.value}
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 truncate mb-3">
                {item.sector}
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-white font-mono-tabular">
                    {item.price}
                  </div>
                  <div
                    className={`text-xs font-mono-tabular ${
                      item.positive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.changePct}
                  </div>
                </div>
                {renderSparklineSvg(item.sparkline, item.positive)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
