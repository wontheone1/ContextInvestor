/**
 * ============================================================================
 * FILE: components/NewsSearchControlBar.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Structured Context.dev `POST /v1/news/search` Filter, Entity & Sort Control Bar.
 *
 * USE CASES:
 * 1. Switching company identification between Company Name (`entity.type = 'name'`)
 *    and Stock Ticker (`entity.type = 'ticker'` with optional stock exchange).
 * 2. Selecting publication date ranges (`filterBy.date.from` and `filterBy.date.to`)
 *    via quick time-window presets (`All Dates`, `24h`, `7d`, `30d`, `90d`) or
 *    explicit custom start/end date inputs.
 * 3. Selecting optional category filters (`articleType`, `articleLanguage`,
 *    `sourceCountry`, or `sourceDomain`) and sorting standards (`newest` vs `relevance`).
 * ============================================================================
 */

'use client';

import React from 'react';
import { Search, RotateCcw, Database } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';

export type DatePreset = 'all' | '24h' | '7d' | '30d' | '90d' | 'custom';

export interface NewsSearchControlState {
  entityType: 'name' | 'ticker';
  entityValue: string;
  exchange: string;
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
  cacheStatus: 'hit' | 'miss' | 'live' | 'idle';
}

/**
 * Renders the interactive Context.dev company news search control bar.
 */
export function NewsSearchControlBar({
  state,
  onChange,
  onSubmitSearch,
  isLoading,
  cacheStatus,
}: NewsSearchControlBarProps) {
  /**
   * Handles form submission to execute a fresh page-1 Context.dev search.
   */
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logFunctionCall('NewsSearchControlBar.handleFormSubmit', {
      entityType: state.entityType,
      entityValue: state.entityValue,
      sortBy: state.sortBy,
      datePreset: state.datePreset,
    });
    onSubmitSearch(false);
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="p-6 rounded-xl bg-[#0d1b33] border border-[#212c42] mb-6"
    >
      {/* Top Row: Entity Type Selector, Input Query, Sort Standard, Page Size, Submit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* 1. Identify Company By: Name or Ticker */}
        <div className="lg:col-span-3">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Identify Company By (searchBy.entity)
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#091326] rounded-lg border border-[#212c42]">
            <button
              type="button"
              onClick={() =>
                onChange({
                  entityType: 'ticker',
                  entityValue:
                    state.entityValue === 'Stripe'
                      ? 'NVDA'
                      : state.entityValue,
                })
              }
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.entityType === 'ticker'
                  ? 'bg-[#09a4ff] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Stock Ticker
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  entityType: 'name',
                  entityValue:
                    state.entityValue === 'NVDA'
                      ? 'NVIDIA'
                      : state.entityValue,
                })
              }
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.entityType === 'name'
                  ? 'bg-[#09a4ff] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Company Name
            </button>
          </div>
        </div>

        {/* 2. Company Name or Ticker Value (+ Optional Exchange when Ticker) */}
        <div className="lg:col-span-4 flex gap-2">
          <div className="flex-1">
            <label
              htmlFor="company-entity-input"
              className="block text-xs font-medium text-slate-300 mb-2"
            >
              {state.entityType === 'ticker'
                ? 'Ticker Symbol (e.g. NVDA, AAPL, MSFT)'
                : 'Company Name (e.g. Stripe, OpenAI, SpaceX)'}
            </label>
            <input
              id="company-entity-input"
              type="text"
              value={state.entityValue}
              onChange={(e) => onChange({ entityValue: e.target.value })}
              placeholder={
                state.entityType === 'ticker'
                  ? 'Enter ticker (NVDA)...'
                  : 'Enter company name (Stripe)...'
              }
              className="w-full px-3.5 py-2.5 text-sm text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] font-mono-tabular"
            />
          </div>

          {state.entityType === 'ticker' && (
            <div className="w-32 shrink-0">
              <label
                htmlFor="ticker-exchange-select"
                className="block text-xs font-medium text-slate-300 mb-2"
              >
                Exchange
              </label>
              <select
                id="ticker-exchange-select"
                value={state.exchange}
                onChange={(e) => onChange({ exchange: e.target.value })}
                className="w-full px-2.5 py-2.5 text-sm text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] font-mono-tabular"
              >
                <option value="">Any</option>
                {APP_CONFIG.filters.exchanges.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 3. Sorting Standard (newest vs relevance) */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Sort Standard (sortBy)
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#091326] rounded-lg border border-[#212c42]">
            <button
              type="button"
              onClick={() => onChange({ sortBy: 'newest' })}
              className={`py-2 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              className={`py-2 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.sortBy === 'relevance'
                  ? 'bg-[#09a4ff] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Relevance
            </button>
          </div>
        </div>

        {/* 4. Page Limit & Search Action */}
        <div className="lg:col-span-3 flex items-end gap-2">
          <div className="w-24 shrink-0">
            <label
              htmlFor="page-limit-select"
              className="block text-xs font-medium text-slate-300 mb-2"
            >
              Per Page
            </label>
            <select
              id="page-limit-select"
              value={state.limit}
              onChange={(e) =>
                onChange({ limit: parseInt(e.target.value, 10) || 4 })
              }
              className="w-full px-2.5 py-2.5 text-sm text-white bg-[#091326] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] font-mono-tabular"
            >
              <option value={4}>4 rows</option>
              <option value={8}>8 rows</option>
              <option value={10}>10 rows</option>
              <option value={15}>15 rows</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? 'Searching...' : 'Search News'}</span>
          </button>

          <button
            type="button"
            title="Bypass Firestore Cache and Refresh Live from Context.dev"
            onClick={() => onSubmitSearch(true)}
            disabled={isLoading}
            className="p-2.5 text-slate-300 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#212c42] my-4" />

      {/* Bottom Row: Selectable Date Range (All Included + Presets + Custom Dates) & Optional Facet Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* Selectable Date Range */}
        <div className="lg:col-span-6">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Publication Date Range (filterBy.date)
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All Dates Included' },
                { id: '24h', label: 'Last 24h' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: '90d', label: 'Last 90 Days' },
                { id: 'custom', label: 'Custom Window' },
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
                  From Date (Inclusive)
                </label>
                <input
                  id="date-from-input"
                  type="date"
                  value={state.customDateFrom}
                  onChange={(e) => onChange({ customDateFrom: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="date-to-input"
                  className="block text-xs text-slate-400 mb-1"
                >
                  To Date (Inclusive)
                </label>
                <input
                  id="date-to-input"
                  type="date"
                  value={state.customDateTo}
                  onChange={(e) => onChange({ customDateTo: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs text-white bg-[#091326] border border-[#212c42] rounded-lg font-mono-tabular"
                />
              </div>
            </div>
          )}
        </div>

        {/* Category Filter Selector (All Included by default) */}
        <div className="lg:col-span-4 flex gap-2">
          <div className="flex-1">
            <label
              htmlFor="filter-category-select"
              className="block text-xs font-medium text-slate-300 mb-2"
            >
              Additional Filter Facet
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
                All Types, Languages, Countries & Domains Included
              </option>
              <option value="articleType">Filter by Article Type</option>
              <option value="articleLanguage">Filter by Article Language</option>
              <option value="sourceCountry">Filter by Publisher Country</option>
              <option value="sourceDomain">Filter by Publisher Domain</option>
            </select>
          </div>

          {state.filterCategory === 'articleType' && (
            <div className="w-44 shrink-0">
              <label
                htmlFor="article-type-select"
                className="block text-xs font-medium text-slate-300 mb-2"
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
            <div className="w-44 shrink-0">
              <label
                htmlFor="article-lang-select"
                className="block text-xs font-medium text-slate-300 mb-2"
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
            <div className="w-44 shrink-0">
              <label
                htmlFor="source-country-select"
                className="block text-xs font-medium text-slate-300 mb-2"
              >
                Publisher Country
              </label>
              <select
                id="source-country-select"
                value={state.selectedCountry}
                onChange={(e) => onChange({ selectedCountry: e.target.value })}
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
            <div className="w-44 shrink-0">
              <label
                htmlFor="source-domain-input"
                className="block text-xs font-medium text-slate-300 mb-2"
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
        </div>

        {/* Firestore Cache Read Status Indicator */}
        <div className="lg:col-span-2 flex items-center justify-end">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-tabular">
            <Database className="w-3.5 h-3.5 text-[#49afe9]" />
            <span>
              Cache:{' '}
              {cacheStatus === 'hit'
                ? 'FIRESTORE HIT'
                : cacheStatus === 'live'
                  ? 'CACHED TO DB'
                  : 'READY'}
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}
