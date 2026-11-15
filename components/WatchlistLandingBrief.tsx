/**
 * ============================================================================
 * FILE: components/WatchlistLandingBrief.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Stage 02 — Daily Brief: Cross-Watchlist Synthesis & Ranked Conviction Movers.
 *
 * USE CASES:
 * 1. Distilling news across all followed companies into a single calm executive
 *    takeaway so users read signal before raw headlines.
 * 2. Presenting a scannable company-by-company posture strip where clicking any
 *    company advances directly to Stage 03 (`Research & Compare`) for that company.
 * 3. Ranking the highest-conviction **Bullish Catalysts** and **Bearish Risks**
 *    across the watchlist with clean unboxed metadata (`·` separators), tabular
 *    conviction scores, and 1-click article bookmarking.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  WatchlistCompanyDigest,
  WatchlistDigestResponse,
  WatchlistMoverArticle,
} from '@/lib/watchlist-digest-service';
import { formatTickerWithAdr } from '@/lib/adr-directory';
import { BrandFoxLogo } from '@/components/BrandFoxLogo';
import { logInfo } from '@/lib/logger';

interface WatchlistLandingBriefProps {
  digest: WatchlistDigestResponse | null;
  followedCount: number;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectCompany: (value: string, entityType: 'name' | 'ticker') => void;
  onBookmarkArticle: (article: WatchlistMoverArticle) => void;
  savedArticleIds: Set<string>;
}

type SignalFilterMode = 'ALL' | 'BULLISH' | 'BEARISH';

/**
 * Formats an ISO timestamp into a concise relative age string (`14m ago`, `3h ago`).
 *
 * @param isoTimestamp - UTC ISO timestamp string
 * @returns Concise relative time string
 */
function formatRelativeAge(isoTimestamp: string): string {
  logInfo('WatchlistLandingBrief.formatRelativeAge', { isoTimestamp });
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return 'Recent';

  const diffMs = Date.now() - parsed;
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Renders unboxed inline sentiment text paired with an icon for color-blind accessibility
 * (adhering strictly to Zero-Pill metadata discipline).
 */
function renderInlineStance(
  sentiment: 'Bullish' | 'Bearish' | 'Mixed' | 'Neutral'
) {
  if (sentiment === 'Bullish') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0">
        <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Bullish</span>
      </span>
    );
  }
  if (sentiment === 'Bearish') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 whitespace-nowrap shrink-0">
        <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Bearish</span>
      </span>
    );
  }
  if (sentiment === 'Mixed') {
    return (
      <span className="text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
        Mixed
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-slate-400 whitespace-nowrap shrink-0">
      Neutral
    </span>
  );
}

/**
 * Renders the Daily Brief watchlist summary and ranked Bullish/Bearish conviction movers.
 */
export function WatchlistLandingBrief({
  digest,
  followedCount,
  isLoading,
  error,
  onRefresh,
  onSelectCompany,
  onBookmarkArticle,
  savedArticleIds,
}: WatchlistLandingBriefProps) {
  const [signalFilter, setSignalFilter] = useState<SignalFilterMode>('ALL');
  const [showAllCompanyCards, setShowAllCompanyCards] = useState<boolean>(true);

  const handleSelectCompany = (
    companyValue: string,
    entityType: 'name' | 'ticker'
  ) => {
    logInfo('WatchlistLandingBrief.handleSelectCompany', {
      companyValue,
      entityType,
    });
    onSelectCompany(companyValue, entityType);
  };

  const handleFilterChange = (mode: SignalFilterMode) => {
    logInfo('WatchlistLandingBrief.handleFilterChange', { mode });
    setSignalFilter(mode);
  };

  const renderMoverRow = (article: WatchlistMoverArticle, rank: number) => {
    const isBullish = article.sentiment === 'Bullish';
    const isSaved = savedArticleIds.has(article.id);

    return (
      <div
        key={`${article.sentiment}-${article.id}-${rank}`}
        className="p-5 border-b border-[#212c42] last:border-b-0 hover:bg-[#10203d] transition-colors flex flex-col justify-between gap-3"
      >
        <div className="space-y-2.5">
          {/* Clean Unboxed Metadata Line */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span
                className={
                  isBullish
                    ? 'font-semibold text-emerald-400'
                    : 'font-semibold text-rose-400'
                }
              >
                0{rank}.
              </span>
              <button
                type="button"
                onClick={() =>
                  handleSelectCompany(
                    article.companyValue,
                    article.companyEntityType
                  )
                }
                title={`Open Step 3 deep-dive research for ${article.companyLabel}`}
                className="inline-flex items-baseline gap-1.5 font-sans font-semibold text-white hover:text-[#49afe9] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{article.companyLabel}</span>
                {article.companyEntityType === 'ticker' && (
                  <span className="font-mono-tabular text-xs text-[#49afe9]">
                    {formatTickerWithAdr(
                      article.companyValue,
                      article.companyLabel
                    )}
                  </span>
                )}
              </button>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              {renderInlineStance(article.sentiment)}
            </div>

            <div className="flex items-center gap-2 text-slate-400 shrink-0">
              <span
                title="Conviction & Materiality Score (1-100): Estimates how strongly this news impacts near-term fundamentals or valuation."
                className={`cursor-help ${
                  isBullish ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {article.convictionScore}% conviction
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeAge(article.publishedAt)}</span>
            </div>
          </div>

          {/* Headline */}
          <div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-[15px] font-semibold text-white hover:text-[#49afe9] transition-colors leading-snug inline-flex items-start gap-1.5 group"
            >
              <span>{article.title}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#49afe9] shrink-0 mt-0.5 transition-colors" />
            </a>
            {article.isTranslated && article.translatedFromLanguage && (
              <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                Auto-translated from {article.translatedFromLanguage} to English
              </p>
            )}
          </div>

          {/* Sentiment Rationale (subtle all-around surface box — no thick left border) */}
          <div className="p-3 rounded-lg bg-[#091326] border border-[#212c42] text-xs text-slate-200 leading-relaxed">
            <span
              className={`font-semibold mr-1.5 ${
                isBullish ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Why {article.sentiment}:
            </span>
            <span>{article.rationale}</span>
          </div>
        </div>

        {/* Footer Actions: Source + Deep Dive Pivot + Save */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                handleSelectCompany(
                  article.companyValue,
                  article.companyEntityType
                )
              }
              className="inline-flex items-center gap-1 text-[#49afe9] hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Inspect {article.companyLabel}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onBookmarkArticle(article)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isSaved
                ? 'bg-[#102344] text-[#49afe9] border-[#09a4ff]/50'
                : 'bg-[#091326] text-slate-300 border-[#212c42] hover:text-white hover:border-slate-500'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-[#49afe9]" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section
      id="watchlist-pulse"
      className="rounded-xl bg-[#0d1b33] border border-[#212c42] overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-6 py-5 border-b border-[#212c42] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <BrandFoxLogo size={26} framed alt="" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
              <span className="text-[#49afe9] font-medium">
                Daily Watchlist Synthesis
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {followedCount} {followedCount === 1 ? 'company' : 'companies'} tracked
              </span>
              {digest && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{digest.sentimentCounts.totalArticles} articles scanned</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400">
                    {digest.sentimentCounts.bullish} bullish
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-400">
                    {digest.sentimentCounts.bearish} bearish
                  </span>
                </>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white text-balance">
              Your Personalized Daily Brief
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#091326] hover:bg-[#102344] text-xs font-semibold text-white border border-[#212c42] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#49afe9] ${
                isLoading ? 'animate-spin' : ''
              }`}
            />
            <span>{isLoading ? 'Synthesizing...' : 'Refresh Brief'}</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && !digest && (
        <div className="p-6 space-y-6 animate-pulse">
          <div className="space-y-2.5">
            <div className="h-4 w-56 bg-[#162747] rounded" />
            <div className="h-4 w-full bg-[#162747] rounded" />
            <div className="h-4 w-5/6 bg-[#162747] rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-24 bg-[#091326] border border-[#212c42] rounded-lg p-4"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-56 bg-[#091326] border border-[#212c42] rounded-lg" />
            <div className="h-56 bg-[#091326] border border-[#212c42] rounded-lg" />
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !digest && (
        <div className="p-6 text-sm text-rose-300 flex flex-wrap items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs font-semibold text-rose-200 hover:bg-rose-950/60 cursor-pointer whitespace-nowrap shrink-0"
          >
            Retry Daily Brief
          </button>
        </div>
      )}

      {/* Empty Watchlist State */}
      {!isLoading && !error && !digest && followedCount === 0 && (
        <div className="p-6 text-sm text-slate-300">
          Follow at least one public equity or private company to generate your cross-watchlist Daily Brief.
        </div>
      )}

      {/* Main Populated Content */}
      {digest && (
        <div>
          {/* 1. Executive Summary + Themes */}
          <div className="p-6 border-b border-[#212c42] space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#49afe9]">
                  Executive Takeaway Across Your Watchlist
                </h3>
                {digest.keyThemes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="text-slate-500">Key themes:</span>
                    <span>{digest.keyThemes.join(' · ')}</span>
                  </div>
                )}
              </div>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-5xl">
                {digest.executiveSummary}
              </p>
            </div>

            {/* 2. Collapsible Company-by-Company Posture Strip */}
            <div className="pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-xs font-medium text-slate-300">
                  Company-by-Company Posture — Click any company to open full research
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllCompanyCards((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#49afe9] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>
                    {showAllCompanyCards
                      ? 'Hide Company Breakdown'
                      : `Show All ${digest.companyDigests.length} Companies`}
                  </span>
                  {showAllCompanyCards ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {showAllCompanyCards && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-[#212c42] rounded-lg bg-[#091326] divide-y md:divide-y-0 md:divide-x divide-[#212c42] overflow-hidden">
                  {digest.companyDigests.map(
                    (company: WatchlistCompanyDigest, idx: number) => (
                      <button
                        key={company.value}
                        type="button"
                        onClick={() =>
                          handleSelectCompany(company.value, company.entityType)
                        }
                        className={`p-4 text-left hover:bg-[#10203d] transition-colors flex flex-col justify-between gap-2.5 cursor-pointer group ${
                          idx >= 3 ? 'lg:border-t lg:border-[#212c42]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold text-white group-hover:text-[#49afe9] transition-colors truncate">
                              {company.label}
                            </span>
                            {company.entityType === 'ticker' ? (
                              <span className="font-mono-tabular text-xs text-[#49afe9] shrink-0">
                                {formatTickerWithAdr(
                                  company.value,
                                  company.label
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 shrink-0">
                                Private
                              </span>
                            )}
                          </div>
                          {renderInlineStance(company.stance)}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {company.summary}
                        </p>

                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono-tabular pt-0.5">
                          <span className="truncate">
                            {company.sector || 'Tracked Company'}
                          </span>
                          <span className="text-[#49afe9] group-hover:text-white transition-colors whitespace-nowrap shrink-0">
                            Inspect ({company.articleCount}) →
                          </span>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Ranked Top Bullish Catalysts vs. Top Bearish Risks */}
          <div>
            <div className="px-6 py-4 border-b border-[#212c42] bg-[#091326]/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Highest-Conviction Catalysts &amp; Risks
                </h3>
                <p className="text-xs text-slate-400">
                  Ranked by materiality across your followed companies
                </p>
              </div>

              {/* Segmented Filter Control */}
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#091326] border border-[#212c42] self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleFilterChange('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    signalFilter === 'ALL'
                      ? 'bg-[#09a4ff] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Both Sides
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('BULLISH')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                    signalFilter === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-300 hover:text-emerald-300'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Upside ({digest.topBullish.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('BEARISH')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                    signalFilter === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-300 hover:text-rose-300'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Risks ({digest.topBearish.length})</span>
                </button>
              </div>
            </div>

            <div
              className={`grid grid-cols-1 ${
                signalFilter === 'ALL'
                  ? 'lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x'
                  : ''
              } divide-[#212c42]`}
            >
              {(signalFilter === 'ALL' || signalFilter === 'BULLISH') && (
                <div className="flex flex-col">
                  <div className="px-5 py-3 border-b border-[#212c42] bg-emerald-500/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">
                        Top Bullish Catalysts
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-400">
                      {digest.topBullish.length} signals
                    </span>
                  </div>

                  {digest.topBullish.length > 0 ? (
                    <div className="divide-y divide-[#212c42]">
                      {digest.topBullish.map((article, idx) =>
                        renderMoverRow(article, idx + 1)
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No strongly bullish catalysts detected across your followed companies right now.
                    </div>
                  )}
                </div>
              )}

              {(signalFilter === 'ALL' || signalFilter === 'BEARISH') && (
                <div className="flex flex-col">
                  <div className="px-5 py-3 border-b border-[#212c42] bg-rose-500/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-semibold text-rose-400">
                        Top Bearish Risks &amp; Headwinds
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-400">
                      {digest.topBearish.length} signals
                    </span>
                  </div>

                  {digest.topBearish.length > 0 ? (
                    <div className="divide-y divide-[#212c42]">
                      {digest.topBearish.map((article, idx) =>
                        renderMoverRow(article, idx + 1)
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No material bearish risk events detected across your followed companies right now.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
