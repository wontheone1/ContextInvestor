/**
 * ============================================================================
 * FILE: components/NewsFeedTable.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * High-Density Institutional News Feed Table & Next / Previous Cursor Paginator
 * with Automatic English Translation & Source Language Indicator.
 *
 * USE CASES:
 * 1. Rendering Context.dev `EnrichedNewsArticle` articles in a scannable,
 *    high-density quantitative terminal layout inspired by Kamino.com and
 *    TradingView, adhering strictly to Zero-Pill metadata discipline (unboxed
 *    inline text separated by `·`).
 * 2. Displaying the automatic English translation for any non-English news
 *    article along with an explicit indicator of which language it was translated
 *    from (e.g., `Auto-translated from Korean (ko) → English`) and an interactive
 *    toggle to view the original source-language headline and excerpt.
 * 3. Implementing Next / Previous button pagination using a cursor stack
 *    (`cursorStack`) while keeping `searchBy`, `filterBy`, and `sortBy` constant
 *    across requests as mandated by Context.dev documentation.
 * 4. Allowing users to bookmark articles directly into Firestore (`saved_articles`).
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Bookmark,
  Sparkles,
  Languages,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type {
  ArticleSentiment,
  EnrichedNewsArticle,
} from '@/lib/translation-service';
import { formatLanguageName } from '@/lib/translation-service';
import { logFunctionCall } from '@/lib/logger';

export type SentimentFilterOption = 'all' | ArticleSentiment;

export interface NewsFeedTableProps {
  articles: EnrichedNewsArticle[];
  isLoading: boolean;
  currentPageIndex: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onBookmarkArticle: (article: EnrichedNewsArticle) => void;
  savedArticleIds: Set<string>;
  onGenerateAIBrief: () => void;
  isGeneratingBrief: boolean;
  companyLabel: string;
  sentimentFilter: SentimentFilterOption;
  onSentimentFilterChange: (filter: SentimentFilterOption) => void;
  isAnalyzingSentiment?: boolean;
  sentimentError?: string | null;
}

/**
 * Formats an ISO 8601 timestamp into a concise tabular date/time string.
 */
function formatPublishedTime(iso: string | null): string {
  if (!iso) return 'Timestamp N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Maps article type values to readable institutional labels and concise English tooltips.
 */
function getArticleTypeInfo(type: EnrichedNewsArticle['type']): {
  label: string;
  tooltip: string;
} {
  switch (type) {
    case 'press_release':
      return {
        label: 'Press Release',
        tooltip: 'Official announcement issued directly by the company.',
      };
    case 'regulatory_filing':
      return {
        label: 'Regulatory Filing',
        tooltip:
          'Official financial or compliance disclosure filed with market regulators.',
      };
    case 'advisory':
      return {
        label: 'Advisory',
        tooltip:
          'Technical, security, or operational notice published for users or investors.',
      };
    case 'editorial':
    default:
      return {
        label: 'Editorial',
        tooltip:
          'Independent news reporting and market analysis from media publications.',
      };
  }
}

/**
 * Renders an inline metadata tag with a clean English hover/focus tooltip.
 */
function TagWithTooltip({
  children,
  tooltip,
  className = '',
}: {
  children: React.ReactNode;
  tooltip: string;
  className?: string;
}) {
  return (
    <span
      tabIndex={0}
      title={tooltip}
      aria-label={tooltip}
      className={`group relative inline-flex items-center cursor-help border-b border-dotted border-slate-500/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#09a4ff] rounded-xs ${className}`}
    >
      <span>{children}</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition-opacity duration-150 absolute left-0 top-full mt-2 z-40 w-56 px-2.5 py-2 rounded-lg bg-[#060d1b] border border-[#2b3b5a] text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-xl whitespace-normal"
      >
        {tooltip}
      </span>
    </span>
  );
}

function getSentimentTooltip(sentiment: ArticleSentiment): string {
  switch (sentiment) {
    case 'Bullish':
      return 'Headline indicates positive momentum, growth, or favorable catalysts.';
    case 'Bearish':
      return 'Headline indicates downside risk, headwinds, or negative catalysts.';
    case 'Neutral':
    default:
      return 'Headline is informational or balanced with no strong directional bias.';
  }
}

function renderSentimentBadge(
  sentiment: ArticleSentiment | null | undefined,
  isAnalyzingSentiment?: boolean
) {
  if (!sentiment) {
    if (isAnalyzingSentiment) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border border-[#212c42] bg-[#091326] text-slate-400 shrink-0 animate-pulse">
          Analyzing...
        </span>
      );
    }
    return null;
  }

  const tooltip = getSentimentTooltip(sentiment);

  if (sentiment === 'Bullish') {
    return (
      <span
        tabIndex={0}
        title={tooltip}
        aria-label={`Bullish: ${tooltip}`}
        className="group relative inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 shrink-0 cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
      >
        <TrendingUp className="w-3 h-3" aria-hidden="true" />
        <span>Bullish</span>
        <span
          role="tooltip"
          className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-40 w-52 px-2.5 py-2 rounded-lg bg-[#060d1b] border border-[#2b3b5a] text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-xl whitespace-normal text-left"
        >
          {tooltip}
        </span>
      </span>
    );
  }

  if (sentiment === 'Bearish') {
    return (
      <span
        tabIndex={0}
        title={tooltip}
        aria-label={`Bearish: ${tooltip}`}
        className="group relative inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border border-rose-500/35 bg-rose-500/15 text-rose-300 shrink-0 cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
      >
        <TrendingDown className="w-3 h-3" aria-hidden="true" />
        <span>Bearish</span>
        <span
          role="tooltip"
          className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-40 w-52 px-2.5 py-2 rounded-lg bg-[#060d1b] border border-[#2b3b5a] text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-xl whitespace-normal text-left"
        >
          {tooltip}
        </span>
      </span>
    );
  }

  return (
    <span
      tabIndex={0}
      title={tooltip}
      aria-label={`Neutral: ${tooltip}`}
      className="group relative inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border border-slate-500/35 bg-slate-500/15 text-slate-300 shrink-0 cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
    >
      <Minus className="w-3 h-3" aria-hidden="true" />
      <span>Neutral</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-40 w-52 px-2.5 py-2 rounded-lg bg-[#060d1b] border border-[#2b3b5a] text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-xl whitespace-normal text-left"
      >
        {tooltip}
      </span>
    </span>
  );
}

/**
 * Renders the institutional news feed table and Next / Previous cursor controls.
 */
export function NewsFeedTable({
  articles,
  isLoading,
  currentPageIndex,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  onBookmarkArticle,
  savedArticleIds,
  onGenerateAIBrief,
  isGeneratingBrief,
  companyLabel,
  sentimentFilter,
  onSentimentFilterChange,
  isAnalyzingSentiment = false,
  sentimentError = null,
}: NewsFeedTableProps) {
  // Tracks which translated article IDs have their original source text toggled open
  const [expandedOriginalIds, setExpandedOriginalIds] = useState<Set<string>>(
    new Set()
  );

  const sentimentCounts = {
    all: articles.length,
    Bullish: articles.filter((a) => a.sentiment === 'Bullish').length,
    Bearish: articles.filter((a) => a.sentiment === 'Bearish').length,
    Neutral: articles.filter((a) => a.sentiment === 'Neutral').length,
  };

  const filteredArticles =
    sentimentFilter === 'all'
      ? articles
      : articles.filter((a) => a.sentiment === sentimentFilter);

  /**
   * Toggles the visibility of the original non-English text for a translated article.
   */
  const toggleOriginalText = (articleId: string) => {
    logFunctionCall('NewsFeedTable.toggleOriginalText', { articleId });
    setExpandedOriginalIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl bg-[#0d1b33] border border-[#212c42]">
      {/* Table Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#212c42] rounded-t-xl">
        <div>
          <h2 className="text-base font-bold text-white">
            News Coverage: {companyLabel}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono-tabular">
            <span>Page {currentPageIndex + 1}</span>
            <span aria-hidden="true">·</span>
            <span>{articles.length} Articles Loaded</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#49afe9]">
              Global Coverage · Auto-Translated to English
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              logFunctionCall('NewsFeedTable.onGenerateAIBrief', {
                companyLabel,
                articleCount: articles.length,
              });
              onGenerateAIBrief();
            }}
            disabled={isGeneratingBrief || articles.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#102344] hover:bg-[#16305c] border border-[#09a4ff]/50 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#49afe9]" />
            <span>
              {isGeneratingBrief
                ? 'Synthesizing Brief...'
                : 'Synthesize AI Brief'}
            </span>
          </button>

          {/* Next / Previous Cursor Pagination Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                logFunctionCall('NewsFeedTable.onPreviousPage', {
                  fromPage: currentPageIndex + 1,
                });
                onPreviousPage();
              }}
              disabled={!hasPreviousPage || isLoading}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              onClick={() => {
                logFunctionCall('NewsFeedTable.onNextPage', {
                  fromPage: currentPageIndex + 1,
                });
                onNextPage();
              }}
              disabled={!hasNextPage || isLoading}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sentiment Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[#091326]/50 border-b border-[#212c42]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400 mr-1.5">
            Headline Sentiment:
          </span>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'Bullish', label: 'Bullish' },
              { id: 'Bearish', label: 'Bearish' },
              { id: 'Neutral', label: 'Neutral' },
            ] as const
          ).map((option) => {
            const isActive = sentimentFilter === option.id;
            const count = sentimentCounts[option.id];
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  logFunctionCall('NewsFeedTable.onSentimentFilterChange', {
                    sentiment: option.id,
                  });
                  onSentimentFilterChange(option.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? option.id === 'Bullish'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : option.id === 'Bearish'
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : option.id === 'Neutral'
                          ? 'bg-slate-500/20 border-slate-400/50 text-white'
                          : 'bg-[#102344] border-[#09a4ff] text-white'
                    : 'bg-[#091326] border-[#212c42] text-slate-300 hover:text-white'
                }`}
              >
                <span>{option.label}</span>
                <span className="text-[11px] opacity-80 font-mono-tabular">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {sentimentError && (
          <span className="text-xs text-rose-300">{sentimentError}</span>
        )}
      </div>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="divide-y divide-[#212c42]">
          {[0, 1, 2, 3].map((skeletonIdx) => (
            <div key={skeletonIdx} className="p-6 animate-pulse">
              <div className="h-3.5 w-64 bg-[#162747] rounded mb-3" />
              <div className="h-5 w-3/4 bg-[#162747] rounded mb-2" />
              <div className="h-4 w-full bg-[#162747] rounded" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center">
          <p className="text-sm font-medium text-slate-300 mb-1">
            No articles matched your current filter criteria.
          </p>
          <p className="text-xs text-slate-400">
            Try expanding the publication date range to &ldquo;All Dates Included&rdquo; or
            searching with another ticker or company name.
          </p>
        </div>
      ) : filteredArticles.length === 0 ? (
        /* Filtered Sentiment Empty State */
        <div className="p-12 text-center">
          <p className="text-sm font-medium text-slate-300 mb-2">
            No {sentimentFilter} headlines found on this page.
          </p>
          <button
            type="button"
            onClick={() => onSentimentFilterChange('all')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors cursor-pointer"
          >
            Show All Sentiments ({articles.length})
          </button>
        </div>
      ) : (
        /* Populated Article List */
        <div className="divide-y divide-[#212c42]">
          {filteredArticles.map((article) => {
            const isBookmarked = savedArticleIds.has(article.id);
            const confidencePct =
              article.match?.confidence !== null &&
              article.match?.confidence !== undefined
                ? `${Math.round(article.match.confidence * 100)}% Match`
                : null;

            const isAutoTranslated =
              Boolean(article.isTranslated) ||
              Boolean(article.translatedFromLanguage) ||
              Boolean(
                article.language && article.language.toLowerCase() !== 'en'
              );

            const sourceLangLabel = article.translatedFromLanguage
              ? formatLanguageName(article.translatedFromLanguage)
              : article.language && article.language.toLowerCase() !== 'en'
                ? formatLanguageName(article.language)
                : null;

            const showOriginal = expandedOriginalIds.has(article.id);
            const articleTypeInfo = getArticleTypeInfo(article.type);

            return (
              <article
                key={article.id}
                className="p-6 hover:bg-[#10203d] transition-colors"
              >
                {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                    <span className="text-[#49afe9] font-medium">
                      {article.source?.name ||
                        article.source?.domain ||
                        'News Wire'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <TagWithTooltip tooltip={articleTypeInfo.tooltip}>
                      {articleTypeInfo.label}
                    </TagWithTooltip>
                    <span aria-hidden="true">·</span>
                    <span>{formatPublishedTime(article.published_at)}</span>
                    {isAutoTranslated && sourceLangLabel ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <TagWithTooltip
                          className="text-amber-300 font-medium border-amber-400/50"
                          tooltip={`Automatically translated into English from ${sourceLangLabel}.`}
                        >
                          Auto-translated from {sourceLangLabel}
                        </TagWithTooltip>
                      </>
                    ) : (
                      article.language && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>English</span>
                        </>
                      )
                    )}
                    {confidencePct && (
                      <>
                        <span aria-hidden="true">·</span>
                        <TagWithTooltip
                          className="text-emerald-400 border-emerald-500/50"
                          tooltip="Relevance confidence score linking this article to the company."
                        >
                          {confidencePct}
                        </TagWithTooltip>
                      </>
                    )}
                    {article.match?.level && (
                      <>
                        <span aria-hidden="true">·</span>
                        <TagWithTooltip
                          tooltip={
                            article.match.level === 'primary'
                              ? 'This company is the main subject of the article.'
                              : 'This company is mentioned alongside other topics or peers.'
                          }
                        >
                          {article.match.level === 'primary'
                            ? 'Primary Subject'
                            : 'Secondary Mention'}
                        </TagWithTooltip>
                      </>
                    )}
                  </div>

                  {/* Action Affordances */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isAutoTranslated &&
                      (article.originalTitle || article.originalDescription) && (
                        <button
                          type="button"
                          onClick={() => toggleOriginalText(article.id)}
                          className="flex items-center gap-1 text-xs font-medium text-[#49afe9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Languages className="w-3.5 h-3.5" />
                          <span>
                            {showOriginal
                              ? 'Hide Original'
                              : `View Original (${sourceLangLabel})`}
                          </span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => onBookmarkArticle(article)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        isBookmarked
                          ? 'text-[#09a4ff]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isBookmarked ? 'Saved' : 'Save'}</span>
                    </button>

                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-[#49afe9] transition-colors"
                    >
                      <span>Read Source</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* English Headline + Small Gemini Sentiment Badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#49afe9] transition-colors"
                    >
                      {article.title}
                    </a>
                  </h3>
                  {renderSentimentBadge(
                    article.sentiment,
                    isAnalyzingSentiment
                  )}
                </div>

                {/* English Summary Excerpt */}
                {article.description && (
                  <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                    {article.description}
                  </p>
                )}

                {/* Concise AI Sentiment Explanation */}
                {article.sentimentReason ? (
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-300 max-w-4xl">
                    <span
                      className={`font-semibold ${
                        article.sentiment === 'Bullish'
                          ? 'text-emerald-400'
                          : article.sentiment === 'Bearish'
                            ? 'text-rose-400'
                            : 'text-slate-200'
                      }`}
                    >
                      AI Sentiment Rationale ({article.sentiment || 'Neutral'}):
                    </span>{' '}
                    <span>{article.sentimentReason}</span>
                  </p>
                ) : (
                  isAnalyzingSentiment && (
                    <p className="mt-2.5 text-xs text-slate-500 animate-pulse">
                      Generating AI sentiment rationale...
                    </p>
                  )
                )}

                {/* Collapsible Original Source-Language Text Box */}
                {isAutoTranslated &&
                  showOriginal &&
                  (article.originalTitle || article.originalDescription) && (
                    <div className="mt-3 p-3.5 rounded-lg bg-[#091326] border border-[#212c42] text-xs text-slate-300">
                      <div className="text-slate-400 font-mono-tabular mb-1">
                        Original Source Text ({sourceLangLabel}):
                      </div>
                      {article.originalTitle && (
                        <div className="font-semibold text-white mb-1">
                          {article.originalTitle}
                        </div>
                      )}
                      {article.originalDescription && (
                        <div className="text-slate-300 leading-relaxed">
                          {article.originalDescription}
                        </div>
                      )}
                    </div>
                  )}
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#091326]/60 border-t border-[#212c42] rounded-b-xl">
        <div className="text-xs text-slate-400">
          Hover or focus article tags for definitions
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={!hasPreviousPage || isLoading}
            className="flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous Page</span>
          </button>
          <span className="text-xs text-slate-300 font-mono-tabular px-2">
            Page {currentPageIndex + 1}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNextPage || isLoading}
            className="flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Next Page</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
