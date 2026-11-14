/**
 * ============================================================================
 * FILE: components/NewsFeedTable.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * High-Density Institutional News Feed Table & Next / Previous Cursor Paginator.
 *
 * USE CASES:
 * 1. Rendering Context.dev `NewsSearchResponse.Data` articles in a scannable,
 *    high-density quantitative terminal layout inspired by Kamino.com and
 *    TradingView, adhering strictly to Zero-Pill metadata discipline (unboxed
 *    inline text separated by `·`).
 * 2. Implementing Next / Previous button pagination using a cursor stack
 *    (`cursorStack`) while keeping `searchBy`, `filterBy`, and `sortBy` constant
 *    across requests as mandated by Context.dev documentation.
 * 3. Allowing users to bookmark articles directly into Firestore (`saved_articles`).
 * ============================================================================
 */

'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import type { NewsSearchResponse } from 'context.dev/resources/news';
import { logFunctionCall } from '@/lib/logger';

export interface NewsFeedTableProps {
  articles: NewsSearchResponse.Data[];
  isLoading: boolean;
  currentPageIndex: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onBookmarkArticle: (article: NewsSearchResponse.Data) => void;
  savedArticleIds: Set<string>;
  onGenerateAIBrief: () => void;
  isGeneratingBrief: boolean;
  companyLabel: string;
  requestId: string | null;
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
 * Maps Context.dev article type values to readable institutional labels.
 */
function formatArticleTypeLabel(type: NewsSearchResponse.Data['type']): string {
  switch (type) {
    case 'press_release':
      return 'Press Release';
    case 'regulatory_filing':
      return 'Regulatory Filing';
    case 'advisory':
      return 'Advisory';
    case 'editorial':
    default:
      return 'Editorial';
  }
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
  requestId,
}: NewsFeedTableProps) {
  return (
    <div className="rounded-xl bg-[#0d1b33] border border-[#212c42] overflow-hidden">
      {/* Table Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#212c42]">
        <div>
          <h2 className="text-base font-bold text-white">
            Live & Historical Coverage: {companyLabel}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono-tabular">
            <span>Page {currentPageIndex + 1}</span>
            <span aria-hidden="true">·</span>
            <span>{articles.length} Articles Loaded</span>
            {requestId && (
              <>
                <span aria-hidden="true">·</span>
                <span>Request ID: {requestId}</span>
              </>
            )}
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
            switching between Ticker and Company Name identification.
          </p>
        </div>
      ) : (
        /* Populated Article List */
        <div className="divide-y divide-[#212c42]">
          {articles.map((article) => {
            const isBookmarked = savedArticleIds.has(article.id);
            const confidencePct =
              article.match?.confidence !== null &&
              article.match?.confidence !== undefined
                ? `${Math.round(article.match.confidence * 100)}% Match`
                : null;

            return (
              <article
                key={article.id}
                className="p-6 hover:bg-[#10203d] transition-colors"
              >
                {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                    <span className="text-[#49afe9] font-medium">
                      {article.source?.name || article.source?.domain || 'News Wire'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatArticleTypeLabel(article.type)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatPublishedTime(article.published_at)}</span>
                    {article.language && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>ISO: {article.language.toUpperCase()}</span>
                      </>
                    )}
                    {confidencePct && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400">{confidencePct}</span>
                      </>
                    )}
                    {article.match?.level && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {article.match.level === 'primary'
                            ? 'Primary Subject'
                            : 'Secondary Mention'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action Affordances */}
                  <div className="flex items-center gap-3 shrink-0">
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
                      <span>{isBookmarked ? 'Saved in Firestore' : 'Save'}</span>
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

                {/* Headline */}
                <h3 className="text-base font-semibold text-white mb-2 leading-snug">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#49afe9] transition-colors"
                  >
                    {article.title}
                  </a>
                </h3>

                {/* Summary Excerpt */}
                {article.description && (
                  <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                    {article.description}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#091326]/60 border-t border-[#212c42]">
        <div className="text-xs text-slate-400 font-mono-tabular">
          Cursor Pagination: searchBy, filterBy &amp; sortBy locked across pages
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
