/**
 * ============================================================================
 * FILE: components/NewsSearchControlBar.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Unified Company Search, Natural-Language Cohort Screener Entry & Progressive
 * Context.dev `POST /v1/news/search` Filter/Sort Control Bar.
 *
 * USE CASES:
 * 1. Unified search bar auto-detecting direct Company Name / US Stock Ticker
 *    lookups (`NVDA`, `Stripe`, `OpenAI`) vs. natural-language multi-company
 *    screening queries (`"AI chip companies with over 200 bn USD market cap"`).
 * 2. Offering 1-click sample natural-language screening queries and an explicit
 *    escape hatch to switch between Cohort Screen and Single-Company modes.
 * 3. Progressively disclosing publication date ranges (`filterBy.date`), sort
 *    order, per-page limit, and publisher/language facets behind a clean
 *    `News Filters & Sort` toggle so new users are never overwhelmed.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import {
  detectSearchQueryIntent,
  type SearchWorkspaceMode,
} from '@/lib/query-intent';
import { logFunctionCall } from '@/lib/logger';

export type DatePreset = 'all' | '24h' | '7d' | '30d' | '90d' | 'custom';

export interface NewsSearchControlState {
  entityType: 'auto' | 'name' | 'ticker';
  entityValue: string;
  sortBy: 'newest' | 'relevance';
  limit: number;
  datePreset: DatePreset;
  customDateFrom: string;
  customDateTo: string;
  filterCategory:
    | 'none'
    | 'articleType'
    | 'articleLanguage'
    | 'sourceCountry'
    | 'sourceDomain';
  selectedArticleType:
    | 'editorial'
    | 'press_release'
    | 'regulatory_filing'
    | 'advisory';
  selectedLanguage: string;
  selectedCountry: string;
  sourceDomainInput: string;
}

export interface NewsSearchControlBarProps {
  state: NewsSearchControlState;
  onChange: (updated: Partial<NewsSearchControlState>) => void;
  onSubmitSearch: (forceRefreshCache?: boolean) => void;
  isLoading: boolean;
  workspaceMode?: SearchWorkspaceMode;
  isScreeningCohort?: boolean;
  onRunSampleNaturalQuery?: (sampleQuery: string) => void;
  onForceWorkspaceMode?: (mode: SearchWorkspaceMode) => void;
}

/**
 * Formats a concise human-readable summary of active single-company news filters.
 */
function buildActiveFilterSummary(state: NewsSearchControlState): string {
  const parts: string[] = [];
  parts.push(state.sortBy === 'newest' ? 'Newest' : 'Relevance');

  if (state.datePreset !== 'all') {
    const presetLabels: Record<DatePreset, string> = {
      all: 'All Dates',
      '24h': '24h',
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
      custom: 'Custom Dates',
    };
    parts.push(presetLabels[state.datePreset]);
  }

  if (state.filterCategory !== 'none') {
    parts.push('Filtered');
  }

  return parts.join(' · ');
}

/**
 * Renders the unified company & natural-language cohort search control bar
 * with progressive disclosure for advanced news filters.
 */
export function NewsSearchControlBar({
  state,
  onChange,
  onSubmitSearch,
  isLoading,
  workspaceMode = 'single',
  isScreeningCohort = false,
  onRunSampleNaturalQuery,
  onForceWorkspaceMode,
}: NewsSearchControlBarProps) {
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const detectedIntent = detectSearchQueryIntent(state.entityValue);
  const busy = isLoading || isScreeningCohort;
  const hasNonDefaultFilters =
    state.datePreset !== 'all' ||
    state.filterCategory !== 'none' ||
    state.sortBy !== 'newest' ||
    state.limit !== 4;

  /**
   * Handles form submission to execute either a natural-language cohort screen
   * or a fresh page-1 single-company search.
   */
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logFunctionCall('NewsSearchControlBar.handleFormSubmit', {
      entityType: state.entityType,
      entityValue: state.entityValue,
      detectedIntent,
      sortBy: state.sortBy,
      datePreset: state.datePreset,
    });
    onSubmitSearch(false);
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="p-5 sm:p-6 rounded-xl bg-[#0d1b33] border border-[#212c42] mb-6"
    >
      {/* Primary Focused Search Row */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label
              htmlFor="company-entity-input"
              className="block text-xs font-medium text-slate-300"
            >
              Search a Ticker, Private Company, or Natural-Language Market Screen
            </label>
            <span className="text-xs text-slate-400 font-mono-tabular">
              Mode:{' '}
              <span className="text-[#49afe9]">
                {detectedIntent === 'cohort'
                  ? 'Cohort Screen & Compare'
                  : 'Single-Company Deep Dive'}
              </span>
            </span>
          </div>
          <input
            id="company-entity-input"
            type="text"
            value={state.entityValue}
            onChange={(e) =>
              onChange({
                entityValue: e.target.value,
                entityType: 'auto',
              })
            }
            placeholder="Try NVDA, Stripe, or 'AI chip companies with over 200 bn USD market cap'..."
            className="w-full px-4 py-2.5 text-sm text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] font-mono-tabular"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-5 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>
              {busy
                ? detectedIntent === 'cohort'
                  ? 'Screening...'
                  : 'Searching...'
                : detectedIntent === 'cohort'
                  ? 'Screen & Compare'
                  : 'Search Company'}
            </span>
          </button>

          {workspaceMode === 'single' && (
            <button
              type="button"
              onClick={() => {
                logFunctionCall('NewsSearchControlBar.toggleFilters', {
                  nextOpen: !isFiltersExpanded,
                });
                setIsFiltersExpanded((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 py-2.5 px-3.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isFiltersExpanded || hasNonDefaultFilters
                  ? 'bg-[#102344] border-[#09a4ff]/60 text-white'
                  : 'bg-[#091326] border-[#212c42] text-slate-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#49afe9]" />
              <span>Filters ({buildActiveFilterSummary(state)})</span>
              {isFiltersExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          )}

          <button
            type="button"
            title="Refresh live data"
            onClick={() => onSubmitSearch(true)}
            disabled={busy}
            className="p-2.5 text-slate-300 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Natural-Language Screening Examples & Mode Escape Hatch Row */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1">
            Try a natural screen:
          </span>
          {APP_CONFIG.cohortScreener.sampleQueries.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                logFunctionCall(
                  'NewsSearchControlBar.handleSampleNaturalQuery',
                  { query: item.query }
                );
                onRunSampleNaturalQuery?.(item.query);
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        {onForceWorkspaceMode && state.entityValue.trim().length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>
              Viewing:{' '}
              <span className="text-slate-200 font-medium">
                {workspaceMode === 'cohort'
                  ? 'Cohort Comparison'
                  : 'Single Company'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                onForceWorkspaceMode(
                  workspaceMode === 'cohort' ? 'single' : 'cohort'
                )
              }
              className="text-[#49afe9] hover:text-white font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {workspaceMode === 'cohort'
                ? 'Switch to Single Company'
                : 'Run as Cohort Screen'}
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Advanced News Filters & Sort (Single-Company Mode) */}
      {workspaceMode === 'single' && isFiltersExpanded && (
        <div className="mt-4 pt-4 border-t border-[#212c42] space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            {/* Publication Date Range */}
            <div className="lg:col-span-6">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Publication Date Range
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All Dates' },
                    { id: '24h', label: 'Last 24h' },
                    { id: '7d', label: 'Last 7d' },
                    { id: '30d', label: 'Last 30d' },
                    { id: '90d', label: 'Last 90d' },
                    { id: 'custom', label: 'Custom' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange({ datePreset: preset.id })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      state.datePreset === preset.id
                        ? 'bg-[#102344] border-[#09a4ff] text-white'
                        : 'bg-[#091326] border-[#212c42] text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {state.datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label
                      htmlFor="date-from-input"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      From Date
                    </label>
                    <input
                      id="date-from-input"
                      type="date"
                      value={state.customDateFrom}
                      onChange={(e) =>
                        onChange({ customDateFrom: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="date-to-input"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      To Date
                    </label>
                    <input
                      id="date-to-input"
                      type="date"
                      value={state.customDateTo}
                      onChange={(e) =>
                        onChange({ customDateTo: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg font-mono-tabular"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sort Order & Rows Per Page */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Sort Order
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#091326] rounded-lg border border-[#212c42]">
                <button
                  type="button"
                  onClick={() => onChange({ sortBy: 'newest' })}
                  className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    state.sortBy === 'newest'
                      ? 'bg-[#09a4ff] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Newest
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ sortBy: 'relevance' })}
                  className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    state.sortBy === 'relevance'
                      ? 'bg-[#09a4ff] text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Relevance
                </button>
              </div>
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="page-limit-select"
                className="block text-xs font-medium text-slate-300 mb-2"
              >
                Articles Per Page
              </label>
              <select
                id="page-limit-select"
                value={state.limit}
                onChange={(e) =>
                  onChange({ limit: parseInt(e.target.value, 10) || 4 })
                }
                className="w-full px-3 py-2 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] font-mono-tabular"
              >
                <option value={4}>4 articles per page</option>
                <option value={8}>8 articles per page</option>
                <option value={10}>10 articles per page</option>
                <option value={15}>15 articles per page</option>
              </select>
            </div>
          </div>

          {/* Category Filter Row */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label
                htmlFor="filter-category-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Source / Language / Type Facet
              </label>
              <select
                id="filter-category-select"
                value={state.filterCategory}
                onChange={(e) =>
                  onChange({
                    filterCategory: e.target
                      .value as NewsSearchControlState['filterCategory'],
                  })
                }
                className="w-full px-3 py-2 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff]"
              >
                <option value="none">
                  All Types, Languages, Countries &amp; Domains Included
                </option>
                <option value="articleType">Filter by Article Type</option>
                <option value="articleLanguage">Filter by Article Language</option>
                <option value="sourceCountry">Filter by Publisher Country</option>
                <option value="sourceDomain">Filter by Publisher Domain</option>
              </select>
            </div>

            {state.filterCategory === 'articleType' && (
              <div className="w-48 shrink-0">
                <label
                  htmlFor="article-type-select"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Article Type
                </label>
                <select
                  id="article-type-select"
                  value={state.selectedArticleType}
                  onChange={(e) =>
                    onChange({
                      selectedArticleType: e.target
                        .value as NewsSearchControlState['selectedArticleType'],
                    })
                  }
                  className="w-full px-3 py-2 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg"
                >
                  {APP_CONFIG.filters.articleTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {state.filterCategory === 'articleLanguage' && (
              <div className="w-48 shrink-0">
                <label
                  htmlFor="article-lang-select"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Language
                </label>
                <select
                  id="article-lang-select"
                  value={state.selectedLanguage}
                  onChange={(e) =>
                    onChange({ selectedLanguage: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg"
                >
                  {APP_CONFIG.filters.languages.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {state.filterCategory === 'sourceCountry' && (
              <div className="w-48 shrink-0">
                <label
                  htmlFor="source-country-select"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Publisher Country
                </label>
                <select
                  id="source-country-select"
                  value={state.selectedCountry}
                  onChange={(e) =>
                    onChange({ selectedCountry: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg"
                >
                  {APP_CONFIG.filters.countries.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {state.filterCategory === 'sourceDomain' && (
              <div className="w-48 shrink-0">
                <label
                  htmlFor="source-domain-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Publisher Domain
                </label>
                <input
                  id="source-domain-input"
                  type="text"
                  value={state.sourceDomainInput}
                  onChange={(e) =>
                    onChange({ sourceDomainInput: e.target.value })
                  }
                  placeholder="reuters.com"
                  className="w-full px-3 py-2 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg font-mono-tabular"
                />
              </div>
            )}

            {hasNonDefaultFilters && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    datePreset: 'all',
                    filterCategory: 'none',
                    sortBy: 'newest',
                    limit: 4,
                  })
                }
                className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#091326] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
