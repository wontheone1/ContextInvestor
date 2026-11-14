/**
 * ============================================================================
 * FEATURE: Watchlist News Summary & Top Conviction Movers Landing Section
 * ============================================================================
 *
 * Detailed Feature Overview:
 * Renders the primary landing intelligence experience at the very top of the
 * Contextual Investing dashboard. Before diving into a single company's deep-dive metrics,
 * investors immediately see:
 * 1. An executive cross-watchlist news synthesis covering all companies they
 *    are currently following (`NVDA`, `Stripe`, `AAPL`, `MSFT`, `PLTR`, `OpenAI`,
 *    plus any custom companies added to their watchlist).
 * 2. A scannable company-by-company digest strip with article counts, net
 *    sentiment posture (`Bullish` / `Bearish` / `Mixed` / `Neutral`), and a
 *    1-sentence digest that pivots the deep-dive research view with a single click.
 * 3. Side-by-side (or filterable) **Top Bullish Catalysts** and **Top Bearish
 *    Risks & Headwinds** across any company in the user's watchlist, ranked by
 *    AI conviction/materiality score (`1-100%`) with 1-sentence rationale and
 *    1-click bookmarking.
 *
 * Design & Aesthetic Adherence:
 * - Precision Financial Editorial (`#0A0D12` obsidian canvas, `#11161F` slate
 *   surface, `1px solid #1E2736` exposed structural hairlines).
 * - Zero-pill discipline on static status/sentiment labels (`rounded-[3px]`
 *   uppercase micro-badges with `1px` border).
 * - Single-elevation card discipline (no nested cards inside cards; uses
 *   clean hairline grid dividers).
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Flame,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  WatchlistCompanyDigest,
  WatchlistDigestResponse,
  WatchlistMoverArticle,
} from '@/lib/watchlist-digest-service';
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
 * Renders the top-of-dashboard Watchlist News Summary & Top Bullish/Bearish
 * Conviction Signals section.
 *
 * @param props - Watchlist digest data, loading state, and action callbacks
 * @returns React element
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

  const renderSentimentBadge = (
    sentiment: 'Bullish' | 'Bearish' | 'Mixed' | 'Neutral'
  ) => {
    if (sentiment === 'Bullish') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 whitespace-nowrap shrink-0">
          <TrendingUp className="w-3 h-3" />
          Bullish
        </span>
      );
    }
    if (sentiment === 'Bearish') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/25 whitespace-nowrap shrink-0">
          <TrendingDown className="w-3 h-3" />
          Bearish
        </span>
      );
    }
    if (sentiment === 'Mixed') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/25 whitespace-nowrap shrink-0">
          Mixed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider bg-[#181F2C] text-[#8E9BB0] border border-[#263246] whitespace-nowrap shrink-0">
        Neutral
      </span>
    );
  };

  const renderMoverRow = (article: WatchlistMoverArticle, rank: number) => {
    const isBullish = article.sentiment === 'Bullish';
    const isSaved = savedArticleIds.has(article.id);

    return (
      <div
        key={`${article.sentiment}-${article.id}-${rank}`}
        className="p-4 sm:p-5 border-b border-[#1E2736] last:border-b-0 hover:bg-[#151C28]/75 transition-colors flex flex-col justify-between gap-3"
      >
        <div className="space-y-2.5">
          {/* Top metadata row: Rank + Company button + Conviction Score + Relative Time */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-[3px] text-[11px] font-mono-tabular font-semibold border ${
                  isBullish
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                #{rank}
              </span>

              <button
                type="button"
                onClick={() =>
                  handleSelectCompany(
                    article.companyValue,
                    article.companyEntityType
                  )
                }
                title={`Click to open full deep-dive research for ${article.companyLabel}`}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-[#181F2C] hover:bg-[#1E2736] border border-[#2A364B] text-[#F1F5F9] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="font-semibold">{article.companyLabel}</span>
                {article.companyEntityType === 'ticker' && (
                  <span className="font-mono-tabular text-[11px] text-emerald-400">
                    {article.companyValue}
                  </span>
                )}
              </button>

              {renderSentimentBadge(article.sentiment)}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                title="AI Conviction & Materiality Score (1-100): Measures how strongly this news event impacts the company's near-term valuation or growth trajectory."
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider border cursor-help ${
                  isBullish
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}
              >
                Conviction {article.convictionScore}%
              </span>
              <span className="text-[11px] font-mono-tabular text-[#5A667A]">
                {formatRelativeAge(article.publishedAt)}
              </span>
            </div>
          </div>

          {/* Headline */}
          <div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-[15px] font-semibold text-[#F1F5F9] hover:text-emerald-400 transition-colors leading-snug inline-flex items-start gap-1.5 group"
            >
              <span>{article.title}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#5A667A] group-hover:text-emerald-400 shrink-0 mt-0.5 transition-colors" />
            </a>
            {article.isTranslated && article.translatedFromLanguage && (
              <p className="mt-1 text-[11px] text-[#5A667A] line-clamp-1">
                Auto-translated from {article.translatedFromLanguage} → English
              </p>
            )}
          </div>

          {/* AI Sentiment Rationale */}
          <div
            className={`pl-3 py-1 border-l-2 text-xs leading-relaxed ${
              isBullish
                ? 'border-emerald-500/50 text-[#C8D3E3]'
                : 'border-rose-500/50 text-[#C8D3E3]'
            }`}
          >
            <span
              className={`font-mono-tabular text-[10px] uppercase tracking-wider mr-1.5 font-semibold ${
                isBullish ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Why {article.sentiment}:
            </span>
            {article.rationale}
          </div>
        </div>

        {/* Footer row: Publisher + Deep-Dive Pivot + Save button */}
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[#8E9BB0]">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="font-medium text-[#8E9BB0] truncate">
              {article.sourceName}
            </span>
            <span className="text-[#2A364B]">•</span>
            <button
              type="button"
              onClick={() =>
                handleSelectCompany(
                  article.companyValue,
                  article.companyEntityType
                )
              }
              className="text-[11px] text-[#8E9BB0] hover:text-emerald-400 transition-colors underline underline-offset-2 cursor-pointer whitespace-nowrap"
            >
              Inspect {article.companyLabel} metrics &amp; chart
            </button>
          </div>

          <button
            type="button"
            onClick={() => onBookmarkArticle(article)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-[3px] text-[11px] font-mono-tabular border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isSaved
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-[#181F2C] text-[#8E9BB0] border-[#263246] hover:text-[#F1F5F9] hover:border-[#35445E]'
            }`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-3 h-3 text-emerald-400" />
                Saved
              </>
            ) : (
              <>
                <Bookmark className="w-3 h-3" />
                Save
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
      className="mb-8 bg-[#11161F] border border-[#1E2736] rounded-md overflow-hidden"
    >
      {/* Top Header Strip */}
      <div className="px-4 sm:px-6 py-4 border-b border-[#1E2736] bg-[#0D121A] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <Sparkles className="w-3 h-3" />
              Watchlist Intelligence Pulse
            </span>
            <span className="text-[11px] font-mono-tabular text-[#8E9BB0]">
              Following {followedCount}{' '}
              {followedCount === 1 ? 'Company' : 'Companies'}
            </span>
            {digest && (
              <>
                <span className="text-[#263246]">•</span>
                <span className="text-[11px] font-mono-tabular text-[#8E9BB0]">
                  {digest.sentimentCounts.totalArticles} Live Articles Scanned
                </span>
                <span className="text-[#263246]">•</span>
                <span className="text-[11px] font-mono-tabular text-emerald-400">
                  {digest.sentimentCounts.bullish} Bullish
                </span>
                <span className="text-[11px] font-mono-tabular text-rose-400">
                  {digest.sentimentCounts.bearish} Bearish
                </span>
              </>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#F1F5F9]">
            Your Watchlist News Summary &amp; Top Conviction Signals
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#181F2C] hover:bg-[#1E2736] text-xs font-medium text-[#F1F5F9] border border-[#263246] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-400 ${
                isLoading ? 'animate-spin' : ''
              }`}
            />
            {isLoading ? 'Synthesizing Watchlist...' : 'Refresh Briefing'}
          </button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && !digest && (
        <div className="p-6 space-y-6 animate-pulse">
          <div className="space-y-2.5">
            <div className="h-4 w-64 bg-[#181F2C] rounded" />
            <div className="h-3.5 w-full bg-[#181F2C] rounded" />
            <div className="h-3.5 w-5/6 bg-[#181F2C] rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 bg-[#181F2C]/70 border border-[#1E2736] rounded p-3"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="h-56 bg-[#181F2C]/60 border border-[#1E2736] rounded" />
            <div className="h-56 bg-[#181F2C]/60 border border-[#1E2736] rounded" />
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !digest && (
        <div className="p-6 text-sm text-rose-400 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs font-mono-tabular text-rose-300 hover:bg-rose-500/20 cursor-pointer whitespace-nowrap"
          >
            Retry Watchlist Pulse
          </button>
        </div>
      )}

      {/* Main Content */}
      {digest && (
        <div>
          {/* PART 1: Executive Cross-Watchlist Narrative + Per-Company Digest Grid */}
          <div className="p-4 sm:p-6 border-b border-[#1E2736] space-y-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-mono-tabular uppercase tracking-wider text-[#F1F5F9] font-semibold">
                    Executive Summary Across Followed Companies
                  </h2>
                </div>
                {digest.keyThemes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#5A667A] mr-1">
                      Dominant Themes:
                    </span>
                    {digest.keyThemes.map((theme) => (
                      <span
                        key={theme}
                        className="px-2 py-0.5 rounded-[3px] text-[10px] font-mono-tabular uppercase tracking-wider bg-[#181F2C] text-[#C8D3E3] border border-[#263246]"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-sm sm:text-[15px] text-[#E2E8F0] leading-relaxed">
                {digest.executiveSummary}
              </p>
            </div>

            {/* Per-Company Watchlist Digest Strip */}
            <div className="border border-[#1E2736] rounded bg-[#0A0D12]">
              <div className="px-3.5 py-2 border-b border-[#1E2736] flex items-center justify-between">
                <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#8E9BB0] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#5A667A]" />
                  Company-by-Company Watchlist Digest (Click any company to load deep-dive below)
                </span>
                <span className="text-[10px] font-mono-tabular text-[#5A667A]">
                  {digest.companyDigests.length} Tracked
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#1E2736]">
                {digest.companyDigests.map(
                  (company: WatchlistCompanyDigest, idx: number) => (
                    <button
                      key={company.value}
                      type="button"
                      onClick={() =>
                        handleSelectCompany(company.value, company.entityType)
                      }
                      className={`p-3.5 text-left hover:bg-[#141B26] transition-colors flex flex-col justify-between gap-2 cursor-pointer group ${
                        idx >= 3 ? 'lg:border-t lg:border-[#1E2736]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-[#F1F5F9] group-hover:text-emerald-400 transition-colors truncate">
                            {company.label}
                          </span>
                          {company.entityType === 'ticker' ? (
                            <span className="font-mono-tabular text-[11px] text-emerald-400 shrink-0">
                              {company.value}
                            </span>
                          ) : (
                            <span className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#5A667A] shrink-0">
                              Unlisted
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {renderSentimentBadge(company.stance)}
                        </div>
                      </div>

                      <p className="text-xs text-[#8E9BB0] line-clamp-2 leading-relaxed">
                        {company.summary}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#5A667A] pt-0.5">
                        <span>{company.sector || 'US Market'}</span>
                        <span className="text-[#8E9BB0] group-hover:text-emerald-400 transition-colors">
                          {company.articleCount} articles →
                        </span>
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* PART 2: Top Most Bullish & Top Most Bearish News Across Your Watchlist */}
          <div>
            {/* Subheader + Filter Control Bar */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-[#1E2736] bg-[#0D121A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <h2 className="text-xs sm:text-sm font-semibold text-[#F1F5F9]">
                    Top Bullish &amp; Bearish News Across Your Watchlist
                  </h2>
                  <p className="text-[11px] text-[#8E9BB0]">
                    Highest-conviction upside catalysts and downside risk stories across any company you follow, ranked by materiality.
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="inline-flex items-center rounded bg-[#0A0D12] p-0.5 border border-[#1E2736] self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleFilterChange('ALL')}
                  className={`px-2.5 py-1 rounded-[3px] text-xs font-mono-tabular transition-colors cursor-pointer whitespace-nowrap ${
                    signalFilter === 'ALL'
                      ? 'bg-[#1E2736] text-[#F1F5F9] font-medium'
                      : 'text-[#8E9BB0] hover:text-[#F1F5F9]'
                  }`}
                >
                  Bullish &amp; Bearish
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('BULLISH')}
                  className={`px-2.5 py-1 rounded-[3px] text-xs font-mono-tabular transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    signalFilter === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium'
                      : 'text-[#8E9BB0] hover:text-emerald-400'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  Top Bullish ({digest.topBullish.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('BEARISH')}
                  className={`px-2.5 py-1 rounded-[3px] text-xs font-mono-tabular transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    signalFilter === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium'
                      : 'text-[#8E9BB0] hover:text-rose-400'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" />
                  Top Bearish ({digest.topBearish.length})
                </button>
              </div>
            </div>

            {/* Columns Grid */}
            <div
              className={`grid grid-cols-1 ${
                signalFilter === 'ALL'
                  ? 'lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x'
                  : ''
              } divide-[#1E2736]`}
            >
              {/* Bullish Column */}
              {(signalFilter === 'ALL' || signalFilter === 'BULLISH') && (
                <div className="flex flex-col">
                  <div className="px-4 sm:px-5 py-3 border-b border-[#1E2736] bg-emerald-500/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono-tabular uppercase tracking-wider font-semibold text-emerald-400">
                        Most Bullish Watchlist Catalysts
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-[#8E9BB0]">
                      Top {digest.topBullish.length} Upside Signals
                    </span>
                  </div>

                  {digest.topBullish.length > 0 ? (
                    <div className="divide-y divide-[#1E2736]">
                      {digest.topBullish.map((article, idx) =>
                        renderMoverRow(article, idx + 1)
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#8E9BB0]">
                      No strongly bullish catalysts detected across your followed companies in the current window.
                    </div>
                  )}
                </div>
              )}

              {/* Bearish Column */}
              {(signalFilter === 'ALL' || signalFilter === 'BEARISH') && (
                <div className="flex flex-col">
                  <div className="px-4 sm:px-5 py-3 border-b border-[#1E2736] bg-rose-500/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-mono-tabular uppercase tracking-wider font-semibold text-rose-400">
                        Most Bearish Watchlist Risks &amp; Headwinds
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-[#8E9BB0]">
                      Top {digest.topBearish.length} Downside Signals
                    </span>
                  </div>

                  {digest.topBearish.length > 0 ? (
                    <div className="divide-y divide-[#1E2736]">
                      {digest.topBearish.map((article, idx) =>
                        renderMoverRow(article, idx + 1)
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#8E9BB0]">
                      No material bearish risk events detected across your followed companies in the current window.
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
