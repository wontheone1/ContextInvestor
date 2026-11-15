/**
 * ============================================================================
 * FILE: components/RelatedCompaniesPanel.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Related Companies & Supply-Chain Ecosystem Suggestions Panel with Inline
 * 1-Click Watchlist Follow Controls.
 *
 * USE CASES:
 * 1. Suggesting high-signal related companies to explore or follow whenever a
 *    user researches a target company.
 * 2. Grouping related companies by relationship (`Suppliers`, `Customers`,
 *    `Peers & Competitors`, `Strategic Partners`), where a single company can
 *    appear across multiple relationship groups simultaneously.
 * 3. Allowing investors to click `+ Follow` / `Following` on individual supply-chain
 *    partners, customers, or competitors—or batch-follow unfollowed companies in
 *    the active group—without losing their current company deep dive.
 * ============================================================================
 */

'use client';

import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Loader2, Plus, RefreshCw } from 'lucide-react';
import type {
  RelatedCompaniesResponse,
  RelatedCompanyItem,
  RelationshipCategory,
} from '@/lib/related-companies-service';
import { logFunctionCall } from '@/lib/logger';

export interface RelatedCompaniesPanelProps {
  searchedQuery: string;
  data: RelatedCompaniesResponse | null;
  isLoading: boolean;
  error: string | null;
  onSelectCompany: (company: RelatedCompanyItem) => void;
  onRefresh: () => void;
  followedValuesLower: Set<string>;
  pendingFollowValues: Set<string>;
  onToggleFollowCompany: (company: RelatedCompanyItem) => void;
  onBatchFollowCompanies?: (companies: RelatedCompanyItem[]) => void;
}

type GroupFilter = 'all' | RelationshipCategory;

/**
 * Checks whether a related company is already in the user's followed watchlist.
 */
function isRelatedItemFollowed(
  company: RelatedCompanyItem,
  followedValuesLower: Set<string>
): boolean {
  const qKey = company.searchQuery.trim().toLowerCase();
  const nKey = company.name.trim().toLowerCase();
  const tKey = company.ticker ? company.ticker.trim().toLowerCase() : '';
  return (
    followedValuesLower.has(qKey) ||
    followedValuesLower.has(nKey) ||
    (Boolean(tKey) && followedValuesLower.has(tKey))
  );
}

/**
 * Checks whether a related company currently has an active verification request in flight.
 */
function isRelatedItemPending(
  company: RelatedCompanyItem,
  pendingFollowValues: Set<string>
): boolean {
  const qKey = company.searchQuery.trim().toLowerCase();
  const nKey = company.name.trim().toLowerCase();
  const tKey = company.ticker ? company.ticker.trim().toLowerCase() : '';
  return (
    pendingFollowValues.has(qKey) ||
    pendingFollowValues.has(nKey) ||
    (Boolean(tKey) && pendingFollowValues.has(tKey))
  );
}

function GroupHeadingWithTooltip({
  title,
  count,
  tooltip,
}: {
  title: string;
  count: number;
  tooltip: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-3">
      <span
        tabIndex={0}
        title={tooltip}
        aria-label={`${title}: ${tooltip}`}
        className="group relative inline-flex items-center text-xs font-semibold text-[#49afe9] cursor-help border-b border-dotted border-[#49afe9]/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#09a4ff] rounded-xs"
      >
        <span>{title}</span>
        <span
          role="tooltip"
          className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 transition-opacity duration-150 absolute left-0 top-full mt-2 z-40 w-56 px-2.5 py-2 rounded-lg bg-[#060d1b] border border-[#2b3b5a] text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-xl whitespace-normal"
        >
          {tooltip}
        </span>
      </span>
      <span className="text-xs text-slate-400 font-mono-tabular">{count}</span>
    </div>
  );
}

/**
 * Renders suggested related companies grouped by business relationship with
 * non-destructive inline `+ Follow` / `Following` controls.
 */
export function RelatedCompaniesPanel({
  searchedQuery,
  data,
  isLoading,
  error,
  onSelectCompany,
  onRefresh,
  followedValuesLower,
  pendingFollowValues,
  onToggleFollowCompany,
  onBatchFollowCompanies,
}: RelatedCompaniesPanelProps) {
  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>('all');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const groups = data?.groups ?? [];
  const activeFilter: GroupFilter =
    selectedGroup !== 'all' &&
    !groups.some((g) => g.category === selectedGroup)
      ? 'all'
      : selectedGroup;

  const visibleGroups =
    activeFilter === 'all'
      ? groups
      : groups.filter((g) => g.category === activeFilter);

  const multiRelCount =
    data?.companies.filter((c) => c.relationships.length > 1).length ?? 0;

  // Deduplicate visible unfollowed (and followable) companies for 1-click batch follow
  const visibleUnfollowed = useMemo(() => {
    const seen = new Set<string>();
    const list: RelatedCompanyItem[] = [];
    for (const grp of visibleGroups) {
      for (const comp of grp.companies) {
        if (seen.has(comp.key)) continue;
        seen.add(comp.key);
        if (
          comp.canFollow !== false &&
          !isRelatedItemFollowed(comp, followedValuesLower)
        ) {
          list.push(comp);
        }
      }
    }
    return list;
  }, [visibleGroups, followedValuesLower]);

  const anyBatchPending = visibleUnfollowed.some((c) =>
    isRelatedItemPending(c, pendingFollowValues)
  );

  return (
    <section
      id="ecosystem"
      aria-label="Related Companies by Relationship"
      className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 mb-6"
    >
      {/* Panel Header & Relationship Filter Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-5 border-b border-[#212c42]">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-white">
              Related Companies to Explore:{' '}
              {data?.resolvedCompanyName || searchedQuery}
            </h2>
            {!isLoading && data && (
              <span className="text-xs text-slate-400 font-mono-tabular">
                · {data.companies.length} Unique Companies
                {multiRelCount > 0
                  ? ` · ${multiRelCount} Multi-Relationship`
                  : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Click <span className="text-slate-200 font-medium">+ Follow</span>{' '}
            to add suppliers, customers, or peers to your watchlist in place, or
            click a company name to open its full deep dive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isLoading && groups.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#091326] rounded-lg border border-[#212c42]">
              <button
                type="button"
                onClick={() => setSelectedGroup('all')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-[#09a4ff] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All Groups
              </button>
              {groups.map((g) => {
                const isActive = activeFilter === g.category;
                return (
                  <button
                    key={g.category}
                    type="button"
                    onClick={() => setSelectedGroup(g.category)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#09a4ff] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{g.category}</span>
                    <span className="ml-1 opacity-80 font-mono-tabular">
                      ({g.companies.length})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading &&
            onBatchFollowCompanies &&
            visibleUnfollowed.length > 0 && (
              <button
                type="button"
                disabled={anyBatchPending}
                onClick={() => {
                  const batchSlice = visibleUnfollowed.slice(0, 4);
                  logFunctionCall(
                    'RelatedCompaniesPanel.onBatchFollowCompanies',
                    {
                      activeFilter,
                      count: batchSlice.length,
                    }
                  );
                  onBatchFollowCompanies(batchSlice);
                }}
                title="Verify and add unfollowed companies in this view to your watchlist"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#49afe9] hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#09a4ff]/40 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {anyBatchPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Following...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      Follow{' '}
                      {activeFilter === 'all'
                        ? `Top ${Math.min(4, visibleUnfollowed.length)}`
                        : `${activeFilter} (${Math.min(4, visibleUnfollowed.length)})`}
                    </span>
                  </>
                )}
              </button>
            )}

          <button
            type="button"
            onClick={() => {
              logFunctionCall('RelatedCompaniesPanel.onRefresh', {
                searchedQuery,
              });
              onRefresh();
            }}
            disabled={isLoading}
            title="Refresh related company suggestions"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-500/40 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-pulse">
          {[0, 1, 2, 3].map((colIdx) => (
            <div key={colIdx} className="space-y-3">
              <div className="h-4 w-32 bg-[#162747] rounded" />
              <div className="h-14 w-full bg-[#162747] rounded" />
              <div className="h-14 w-full bg-[#162747] rounded" />
              <div className="h-14 w-full bg-[#162747] rounded" />
            </div>
          ))}
        </div>
      ) : !error && visibleGroups.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          No related company suggestions available for {searchedQuery}.
        </div>
      ) : (
        /* Grouped Multi-Relationship Columns (Clean Hairline Dividers, Zero Nested Cards) */
        <div
          className={
            visibleGroups.length === 1
              ? 'grid grid-cols-1 gap-6'
              : visibleGroups.length === 2
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-0 md:divide-x md:divide-[#212c42]'
                : visibleGroups.length === 3
                  ? 'grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-[#212c42]'
                  : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 xl:gap-0 xl:divide-x xl:divide-[#212c42]'
          }
        >
          {visibleGroups.map((group, groupIdx) => {
            const colPadding =
              visibleGroups.length === 1
                ? ''
                : groupIdx === 0
                  ? 'md:pr-5 xl:pr-5'
                  : groupIdx === visibleGroups.length - 1
                    ? 'md:pl-5 xl:pl-5'
                    : 'md:px-5 xl:px-5';

            return (
              <div key={group.category} className={colPadding}>
                <GroupHeadingWithTooltip
                  title={group.category}
                  count={group.companies.length}
                  tooltip={group.description}
                />

                <div
                  className={
                    visibleGroups.length === 1
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 divide-y md:divide-y-0 divide-[#212c42]/70'
                      : 'divide-y divide-[#212c42]/70'
                  }
                >
                  {group.companies.map((company) => {
                    const otherRelationships = company.relationships.filter(
                      (rel) => rel !== group.category
                    );
                    const isCrossHighlighted = hoveredKey === company.key;
                    const isFollowed = isRelatedItemFollowed(
                      company,
                      followedValuesLower
                    );
                    const isPending = isRelatedItemPending(
                      company,
                      pendingFollowValues
                    );

                    return (
                      <div
                        key={`${group.category}-${company.key}`}
                        onMouseEnter={() => setHoveredKey(company.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        className={`py-2.5 px-2.5 -mx-2.5 rounded-lg transition-colors flex items-start justify-between gap-2.5 ${
                          isCrossHighlighted
                            ? 'bg-[#12264a]'
                            : 'hover:bg-[#10203d]'
                        }`}
                      >
                        {/* Left Sibling Button: Pivot Research Deep Dive */}
                        <button
                          type="button"
                          onFocus={() => setHoveredKey(company.key)}
                          onBlur={() => setHoveredKey(null)}
                          onClick={() => {
                            logFunctionCall(
                              'RelatedCompaniesPanel.onSelectCompany',
                              {
                                fromQuery: searchedQuery,
                                selectedName: company.name,
                                selectedQuery: company.searchQuery,
                                entityType: company.entityType,
                                relationships: company.relationships,
                              }
                            );
                            onSelectCompany(company);
                          }}
                          className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#09a4ff] rounded"
                        >
                          <div className="flex items-baseline gap-1.5 mb-0.5 min-w-0">
                            <span className="text-sm font-semibold text-white truncate">
                              {company.name}
                            </span>
                            {company.ticker && (
                              <span className="text-xs font-medium text-[#49afe9] font-mono-tabular shrink-0">
                                {company.ticker}
                              </span>
                            )}
                            <ArrowUpRight
                              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                isCrossHighlighted
                                  ? 'text-[#09a4ff]'
                                  : 'text-slate-500'
                              }`}
                              aria-hidden="true"
                            />
                          </div>

                          <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                            {company.rationale}
                          </p>

                          {otherRelationships.length > 0 && (
                            <div className="mt-1 text-[11px] text-amber-300/90 font-mono-tabular truncate">
                              Also in: {otherRelationships.join(' · ')}
                            </div>
                          )}
                        </button>

                        {/* Right Sibling Button: Independent 1-Click Follow / Unfollow (only rendered for followable companies) */}
                        {(isFollowed || company.canFollow !== false) && (
                          <button
                            type="button"
                            disabled={isPending}
                            onFocus={() => setHoveredKey(company.key)}
                            onBlur={() => setHoveredKey(null)}
                            onClick={() => {
                              logFunctionCall(
                                'RelatedCompaniesPanel.onToggleFollowCompany',
                                {
                                  fromQuery: searchedQuery,
                                  companyName: company.name,
                                  searchQuery: company.searchQuery,
                                  nextAction: isFollowed ? 'unfollow' : 'follow',
                                }
                              );
                              onToggleFollowCompany(company);
                            }}
                            title={
                              isFollowed
                                ? `Unfollow ${company.name}`
                                : `Add ${company.name} to your Watchlist without leaving ${searchedQuery}`
                            }
                            className={`group mt-0.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                              isFollowed
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-rose-500/20 hover:text-rose-200 hover:border-rose-500/50'
                                : 'bg-[#091326] text-slate-200 border-[#212c42] hover:border-[#09a4ff] hover:text-white'
                            }`}
                          >
                            {isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin text-[#49afe9]" />
                            ) : isFollowed ? (
                              <span className="inline-grid items-center justify-items-center">
                                <span className="col-start-1 row-start-1 inline-flex items-center gap-1 transition-opacity duration-150 group-hover:opacity-0">
                                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>Following</span>
                                </span>
                                <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                  Unfollow
                                </span>
                              </span>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-[#49afe9]" />
                                <span>Follow</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
