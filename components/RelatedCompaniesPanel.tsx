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
import { formatTickerWithAdr } from '@/lib/adr-directory';
import type {
  RelatedCompaniesResponse,
  RelatedCompanyItem,
  RelationshipCategory,
} from '@/lib/related-companies-service';
import { useLanguage } from '@/components/LanguageProvider';
import { GracefulErrorBanner } from '@/components/GracefulErrorBanner';
import {
  translateRelationshipCategory,
  translateRelationshipDescription,
} from '@/lib/i18n';
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
  const { locale, t } = useLanguage();
  const isKo = locale === 'ko';
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
      aria-label={t.relatedCompanies.headerTitle}
      className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-6 mb-6"
    >
      {/* Panel Header & Relationship Filter Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-5 border-b border-[#212c42]">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-white">
              {t.relatedCompanies.headerTitle}:{' '}
              {data?.resolvedCompanyName || searchedQuery}
            </h2>
            {!isLoading && data && (
              <span className="text-xs text-slate-400 font-mono-tabular">
                ·{' '}
                {isKo
                  ? `${data.companies.length}개 고유 기업`
                  : `${data.companies.length} Unique Companies`}
                {multiRelCount > 0
                  ? isKo
                    ? ` · ${multiRelCount}개 복합 관계`
                    : ` · ${multiRelCount} Multi-Relationship`
                  : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {isKo ? (
              <>
                <span className="text-slate-200 font-medium">
                  {t.common.plusFollow}
                </span>{' '}
                버튼을 눌러 현재 화면을 유지한 채 공급사·고객사·경쟁사를 관심종목에 추가하거나, 기업명을 클릭해 심층 분석으로 이동하세요.
              </>
            ) : (
              <>
                Click{' '}
                <span className="text-slate-200 font-medium">+ Follow</span> to
                add suppliers, customers, or peers to your watchlist in place,
                or click a company name to open its full deep dive.
              </>
            )}
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
                {t.relatedCompanies.allGroups}
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
                    <span>
                      {translateRelationshipCategory(g.category, locale)}
                    </span>
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
                title={
                  isKo
                    ? '현재 그룹의 미팔로우 기업을 검증 후 관심종목에 일괄 추가'
                    : 'Verify and add unfollowed companies in this view to your watchlist'
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#49afe9] hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#09a4ff]/40 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {anyBatchPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.watchlist.verifyingButton}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {activeFilter === 'all'
                        ? isKo
                          ? `상위 ${Math.min(4, visibleUnfollowed.length)}개 팔로우`
                          : `${t.relatedCompanies.followTopPrefix} ${Math.min(4, visibleUnfollowed.length)}`
                        : isKo
                          ? `${translateRelationshipCategory(activeFilter, locale)} (${Math.min(4, visibleUnfollowed.length)}) 팔로우`
                          : `${t.relatedCompanies.followGroupPrefix} ${activeFilter} (${Math.min(4, visibleUnfollowed.length)})`}
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
            title={t.common.refresh}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>{t.common.refresh}</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <GracefulErrorBanner
          error={error}
          onRetry={onRefresh}
          contextKey={`related:${searchedQuery.trim().toLowerCase()}:${locale}`}
          className={visibleGroups.length > 0 ? 'mb-5' : ''}
        />
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
          {t.relatedCompanies.emptyGroup} ({searchedQuery})
        </div>
      ) : visibleGroups.length > 0 ? (
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
                  title={translateRelationshipCategory(group.category, locale)}
                  count={group.companies.length}
                  tooltip={translateRelationshipDescription(
                    group.category,
                    group.description,
                    locale
                  )}
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
                          title={`${t.relatedCompanies.pivotTooltipPrefix} ${company.name}`}
                          className="flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#09a4ff] rounded"
                        >
                          <div className="flex items-baseline gap-1.5 mb-0.5 min-w-0">
                            <span className="text-sm font-semibold text-white truncate">
                              {company.name}
                            </span>
                            {company.ticker && (
                              <span className="text-xs font-medium text-[#49afe9] font-mono-tabular shrink-0">
                                {formatTickerWithAdr(
                                  company.ticker,
                                  company.name,
                                  company.isAdr
                                )}
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
                              {t.relatedCompanies.alsoInPrefix}{' '}
                              {otherRelationships
                                .map((rel) =>
                                  translateRelationshipCategory(rel, locale)
                                )
                                .join(' · ')}
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
                                ? `${t.common.unfollow} ${company.name}`
                                : `${t.common.follow} ${company.name}`
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
                                  <span>{t.common.following}</span>
                                </span>
                                <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                  {t.common.unfollow}
                                </span>
                              </span>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 text-[#49afe9]" />
                                <span>{t.common.follow}</span>
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
      ) : null}
    </section>
  );
}
