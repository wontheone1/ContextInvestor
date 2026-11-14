/**
 * ============================================================================
 * FILE: components/WatchlistCarousel.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Followed Companies Watchlist Strip with Embedded Sparklines & Custom Follow Controls.
 *
 * USE CASES:
 * 1. Displaying the user's followed companies (`NVDA`, `Stripe`, `AAPL`, `MSFT`,
 *    `PLTR`, `OpenAI`, plus any custom companies added to their watchlist) with
 *    1-click deep-dive selection.
 * 2. Allowing investors to follow any US ticker or company name directly from the
 *    watchlist header, or unfollow companies (`X`) to customize the landing
 *    Watchlist Intelligence Pulse.
 * 3. Resetting back to the default institutional watchlist with a single click.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { type CompanyPreset } from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';

export interface WatchlistCarouselProps {
  companies: CompanyPreset[];
  activeValue: string;
  activeEntityType: 'auto' | 'name' | 'ticker';
  onSelectPreset: (preset: CompanyPreset) => void;
  onAddCompany?: (rawInput: string) => void;
  onRemoveCompany?: (value: string) => void;
  onResetDefaults?: () => void;
  isCustomized?: boolean;
}

/**
 * Renders a mini SVG sparkline path for a preset company's recent trajectory.
 */
function renderSparklineSvg(points: number[], positive: boolean) {
  const safePoints = points && points.length >= 2 ? points : [50, 52, 51, 54, 56, 58];
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = max - min || 1;
  const width = 84;
  const height = 28;

  const coords = safePoints.map((val, idx) => {
    const x = (idx / (safePoints.length - 1)) * width;
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
 * Renders the Followed Companies Watchlist strip above the Watchlist Intelligence Pulse.
 */
export function WatchlistCarousel({
  companies,
  activeValue,
  activeEntityType,
  onSelectPreset,
  onAddCompany,
  onRemoveCompany,
  onResetDefaults,
  isCustomized = false,
}: WatchlistCarouselProps) {
  const [followInput, setFollowInput] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = followInput.trim();
    if (!trimmed || !onAddCompany) return;
    logFunctionCall('WatchlistCarousel.handleAddSubmit', { query: trimmed });
    onAddCompany(trimmed);
    setFollowInput('');
  };

  return (
    <section aria-label="Followed Companies Watchlist" className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 tracking-tight">
            Companies You Are Following ({companies.length})
          </h2>
          <p className="text-xs text-slate-400">
            Click any company to inspect its deep-dive chart &amp; news, or add companies to update your Watchlist Briefing below.
          </p>
        </div>

        {/* Add to Watchlist inline control */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {onAddCompany && (
            <form onSubmit={handleAddSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={followInput}
                onChange={(e) => setFollowInput(e.target.value)}
                placeholder="Follow ticker or company (e.g. TSLA, Anthropic)..."
                aria-label="Follow ticker or company name"
                className="w-60 sm:w-64 px-2.5 py-1.5 text-xs bg-[#0d1b33] border border-[#212c42] rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-[#09a4ff]"
              />
              <button
                type="submit"
                disabled={!followInput.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#102344] hover:bg-[#16305c] text-[#49afe9] border border-[#09a4ff]/40 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Follow
              </button>
            </form>
          )}

          {isCustomized && onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              title="Reset to default institutional watchlist"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-[#0d1b33] border border-[#212c42] hover:border-slate-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Defaults
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {companies.map((item) => {
          const isSelected =
            activeValue.toLowerCase() === item.value.toLowerCase() &&
            (activeEntityType === 'auto' ||
              activeEntityType === item.entityType);

          return (
            <div
              key={`${item.entityType}-${item.value}`}
              className={`relative group rounded-xl border transition-all ${
                isSelected
                  ? 'bg-[#102344] border-[#09a4ff]'
                  : 'bg-[#0d1b33] border-[#212c42] hover:border-[#49afe9]/60'
              }`}
            >
              {onRemoveCompany && companies.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    logFunctionCall('WatchlistCarousel.onRemoveCompany', {
                      value: item.value,
                    });
                    onRemoveCompany(item.value);
                  }}
                  title={`Unfollow ${item.label}`}
                  className="absolute top-2 right-2 z-10 p-1 rounded bg-[#091326]/80 text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  logFunctionCall('WatchlistCarousel.onSelectPreset', {
                    entityType: item.entityType,
                    value: item.value,
                  });
                  onSelectPreset(item);
                }}
                className="w-full text-left p-4 cursor-pointer"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1 pr-4">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
