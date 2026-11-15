/**
 * ============================================================================
 * FILE: components/CompanyProductsPanel.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Single-Elevation Institutional Panel displaying Company Products & Services,
 * Operating Revenue Segments, Monetization Summary, Target Customer Groups, and
 * Cited Official Web Sources inside Single-Company Research (`01. Price &
 * Fundamentals` sub-tab).
 *
 * USE CASES:
 * 1. Giving equity and private-market investors an immediate breakdown of what
 *    a company sells (`productLines`), how its operating divisions generate
 *    revenue (`revenueSegments`), and who buys its offerings
 *    (`primaryCustomerSegments`) directly beneath price charts and multiples.
 * 2. Allowing zero-latency client-side filtering across product categories when
 *    a company spans multiple commercial lines (e.g., `AI Compute Hardware`,
 *    `Networking`, `Enterprise Software`).
 * 3. Surfacing clickable official product, solutions, and investor relations
 *    URLs (`sources[]`) returned by Context.dev `web.answers` (`mode: 'fast'`).
 * ============================================================================
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  Layers,
  RotateCcw,
} from 'lucide-react';
import {
  getDistinctProductCategories,
  type CompanyProductsData,
} from '@/lib/company-products-types';
import { GracefulErrorBanner } from '@/components/GracefulErrorBanner';
import { logFunctionCall } from '@/lib/logger';
import { useLanguage } from './LanguageProvider';

interface CompanyProductsPanelProps {
  searchedQuery: string;
  data: CompanyProductsData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

/**
 * Renders the dedicated Company Products, Revenue Segments & Target Customers
 * section with loading skeleton, populated hairline tables/grids, category
 * filters, official source citations, and error/empty recovery states.
 *
 * @param props - `CompanyProductsPanelProps`
 * @returns JSX section element
 */
export default function CompanyProductsPanel({
  searchedQuery,
  data,
  isLoading,
  error,
  onRefresh,
}: CompanyProductsPanelProps) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const distinctCategories = useMemo(
    () => (data ? getDistinctProductCategories(data.productLines) : []),
    [data]
  );

  const effectiveCategory =
    selectedCategory === 'all' || distinctCategories.includes(selectedCategory)
      ? selectedCategory
      : 'all';

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    if (effectiveCategory === 'all') return data.productLines;
    return data.productLines.filter(
      (item) => item.category === effectiveCategory
    );
  }, [data, effectiveCategory]);

  // 1. Geometry-matched skeleton while initial portfolio extraction runs
  if (isLoading && !data) {
    return (
      <section
        aria-busy="true"
        aria-label={t.companyProducts.headerTitle}
        className="bg-[#0d1b33] border border-[#212c42] rounded-xl divide-y divide-[#212c42] mb-6"
      >
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#49afe9]" />
              <h3 className="text-base font-bold tracking-tight text-white">
                {t.companyProducts.headerTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {t.companyProducts.loadingPortfolio}
            </p>
          </div>
          <div className="h-8 w-24 bg-[#162849] rounded-lg animate-pulse shrink-0" />
        </div>

        <div className="p-6 space-y-3">
          <div className="h-4 w-4/5 bg-[#162849] rounded animate-pulse" />
          <div className="h-3.5 w-3/5 bg-[#162849] rounded animate-pulse" />
        </div>

        <div className="divide-y divide-[#212c42]">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="px-6 py-3.5 flex items-center justify-between gap-4"
            >
              <div className="h-3.5 w-40 bg-[#162849] rounded animate-pulse" />
              <div className="h-3.5 flex-1 max-w-md bg-[#162849] rounded animate-pulse hidden sm:block" />
              <div className="h-3.5 w-24 bg-[#162849] rounded animate-pulse" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#212c42]">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`p-5 space-y-2.5 ${idx < 2 ? 'md:border-b md:border-[#212c42]' : ''}`}
            >
              <div className="h-4 w-48 bg-[#162849] rounded animate-pulse" />
              <div className="h-3.5 w-full bg-[#162849] rounded animate-pulse" />
              <div className="h-3.5 w-3/4 bg-[#162849] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 2. Error recovery state when no cached/previous data is available
  if (error && !data) {
    return (
      <section
        aria-label={t.companyProducts.headerTitle}
        className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 mb-6"
      >
        <GracefulErrorBanner
          error={error}
          onRetry={() => {
            logFunctionCall('CompanyProductsPanel.retry', { searchedQuery });
            onRefresh();
          }}
          titleOverride={t.companyProducts.headerTitle}
          contextKey={`products:${searchedQuery.trim().toLowerCase()}`}
        />
      </section>
    );
  }

  // 3. Empty state
  if (!data || data.productLines.length === 0) {
    return (
      <section
        aria-label={t.companyProducts.headerTitle}
        className="bg-[#0d1b33] border border-[#212c42] rounded-xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">
            {t.companyProducts.headerTitle}
          </h3>
          <p className="text-xs text-slate-400">
            {t.companyProducts.emptyPortfolio}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            logFunctionCall('CompanyProductsPanel.refreshEmpty', {
              searchedQuery,
            });
            onRefresh();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.common.refresh}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label={t.companyProducts.headerTitle}
      className="bg-[#0d1b33] border border-[#212c42] rounded-xl divide-y divide-[#212c42] mb-6"
    >
      {/* Header Bar */}
      <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="w-4 h-4 text-[#49afe9] shrink-0" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
              {t.companyProducts.headerTitle}
            </h3>
            {data.domain && (
              <>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <a
                  href={`https://${data.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono-tabular text-[#49afe9] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{data.domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {t.companyProducts.headerSubtitle}
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            logFunctionCall('CompanyProductsPanel.manualRefresh', {
              searchedQuery,
              companyName: data.companyName,
            });
            onRefresh();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] disabled:opacity-50 border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          <span>{isLoading ? t.common.loading : t.common.refresh}</span>
        </button>
      </div>

      {/* Block 1: Business Model Summary & Primary Target Customer Groups */}
      <div className="px-6 py-4 space-y-2.5 bg-[#0a162b]/60">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {t.companyProducts.monetizationLabel}
        </div>
        <p className="text-sm text-slate-100 leading-relaxed">
          {data.businessModelSummary}
        </p>

        {data.primaryCustomerSegments.length > 0 && (
          <div className="pt-1 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-400 mr-2">
              {t.companyProducts.targetCustomersLabel}
            </span>
            <span>
              {data.primaryCustomerSegments.map((seg, idx) => (
                <React.Fragment key={`${seg}-${idx}`}>
                  {idx > 0 && (
                    <span className="mx-2 text-slate-500" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className="text-slate-200">{seg}</span>
                </React.Fragment>
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Block 2: Operating Revenue Segments Breakdown Table */}
      {data.revenueSegments.length > 0 && (
        <div>
          <div className="px-6 py-3 bg-[#091326]/60 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-[#49afe9]">
              {t.companyProducts.revenueSegmentsHeader} (
              <span className="font-mono-tabular">
                {data.revenueSegments.length}
              </span>
              )
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-t border-b border-[#212c42] text-[11px] font-semibold text-slate-400 bg-[#091326]/35">
                  <th className="py-2.5 px-6 w-[28%]">
                    {t.companyProducts.colSegmentName}
                  </th>
                  <th className="py-2.5 px-4">
                    {t.companyProducts.colKeyOfferings}
                  </th>
                  <th className="py-2.5 px-6 text-right w-[24%] whitespace-nowrap">
                    {t.companyProducts.colShareScale}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#212c42] text-xs">
                {data.revenueSegments.map((seg, idx) => (
                  <tr
                    key={`${seg.segmentName}-${idx}`}
                    className="hover:bg-[#102344]/45 transition-colors"
                  >
                    <td className="py-3 px-6 font-semibold text-white align-top">
                      {seg.segmentName}
                    </td>
                    <td className="py-3 px-4 text-slate-300 leading-relaxed align-top">
                      {seg.keyOfferings}
                    </td>
                    <td className="py-3 px-6 text-right font-mono-tabular text-[#49afe9] font-medium align-top">
                      {seg.shareOrScaleNote || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block 3: Core Commercial Product & Service Lines Grid */}
      <div>
        <div className="px-6 py-3 bg-[#091326]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="text-xs font-semibold text-[#49afe9]">
            {t.companyProducts.productLinesHeader} (
            <span className="font-mono-tabular">{visibleProducts.length}</span>)
          </h4>

          {distinctCategories.length >= 2 && (
            <div
              role="tablist"
              aria-label={t.companyProducts.productLinesHeader}
              className="flex flex-wrap items-center gap-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveCategory === 'all'}
                onClick={() => {
                  logFunctionCall('CompanyProductsPanel.filterCategory', {
                    category: 'all',
                  });
                  setSelectedCategory('all');
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  effectiveCategory === 'all'
                    ? 'bg-[#09a4ff] text-white'
                    : 'text-slate-300 hover:text-white bg-[#091326] border border-[#212c42]'
                }`}
              >
                {t.companyProducts.allCategories} ({data.productLines.length})
              </button>
              {distinctCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={effectiveCategory === cat}
                  onClick={() => {
                    logFunctionCall('CompanyProductsPanel.filterCategory', {
                      category: cat,
                    });
                    setSelectedCategory(cat);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    effectiveCategory === cat
                      ? 'bg-[#09a4ff] text-white'
                      : 'text-slate-300 hover:text-white bg-[#091326] border border-[#212c42]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 border-t border-[#212c42]">
          {visibleProducts.map((prod, idx) => {
            const isLastSingle = idx === visibleProducts.length - 1;
            const isLastRowMd =
              visibleProducts.length % 2 === 0
                ? idx >= visibleProducts.length - 2
                : idx === visibleProducts.length - 1;

            return (
              <div
                key={`${prod.name}-${idx}`}
                className={`p-5 flex flex-col justify-between gap-2.5 hover:bg-[#102344]/40 transition-colors ${
                  idx % 2 === 0 ? 'md:border-r md:border-[#212c42]' : ''
                } ${!isLastSingle ? 'border-b border-[#212c42]' : ''} ${
                  isLastRowMd ? 'md:border-b-0' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-white">
                        {prod.name}
                      </span>
                      {prod.category && (
                        <>
                          <span
                            className="mx-1.5 text-slate-500"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                          <span className="text-xs text-slate-400">
                            {prod.category}
                          </span>
                        </>
                      )}
                    </div>

                    {prod.flagshipUrl && (
                      <a
                        href={prod.flagshipUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#49afe9] hover:text-white transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>{t.companyProducts.officialPageLink}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {prod.description}
                  </p>
                </div>

                {prod.targetCustomers && (
                  <div className="pt-1 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-500 mr-1.5">
                      {t.companyProducts.targetBuyersPrefix}
                    </span>
                    <span className="text-slate-300">
                      {prod.targetCustomers}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Block 4: Cited Official Sources Footer */}
      {data.sources.length > 0 && (
        <div className="px-6 py-3.5 bg-[#091326]/45 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="font-semibold text-slate-400 whitespace-nowrap shrink-0">
            {t.companyProducts.officialSourcesPrefix} (
            <span className="font-mono-tabular">{data.sources.length}</span>):
          </span>
          {data.sources.map((src, idx) => (
            <a
              key={`${src.url}-${idx}`}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono-tabular text-xs text-[#49afe9] hover:text-white hover:underline transition-colors whitespace-nowrap shrink-0"
            >
              <span className="text-slate-500">[{idx + 1}]</span>
              <span>{src.displayLabel}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
