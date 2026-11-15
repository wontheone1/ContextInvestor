/**
 * ============================================================================
 * FILE: components/CollapsibleCompanyProfile.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Compact, Progressive-Disclosure Company Profile Bar & Expandable Firmographic
 * Dossier powered by Context.dev Company Search (`POST /v1/company/search`).
 *
 * USE CASES:
 * 1. Keeping the Company Research workspace fast and uncluttered by rendering
 *    a collapsed 1-line firmographic preview (`Company Name · Org Type · HQ ·
 *    Headcount · Founded Year · Stage / Est. Revenue`) directly beneath the
 *    Company Research header.
 * 2. Allowing investors who want deeper corporate background to expand a clean
 *    3-column dossier displaying:
 *    - Company description, official website domain, and verified social links
 *      (LinkedIn, X, GitHub, Crunchbase, YouTube, Instagram, Wellfound)
 *    - Headquarters address, founding year, employee headcount, and stock symbols
 *    - Industry classifications and estimated annual revenue range
 *    - Funding stage, total disclosed funding, latest round, and chronological
 *      funding round history (`rounds[]`)
 * 3. Automatically resetting to collapsed whenever the user pivots to a new
 *    company without layout shift or intrusive candidate pickers.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { formatTickerWithAdr } from '@/lib/adr-directory';
import type { CompanyProfileData } from '@/lib/company-profile-service';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { useLanguage } from '@/components/LanguageProvider';
import type { AppLocale } from '@/lib/i18n';
import { logFunctionCall } from '@/lib/logger';

export interface CollapsibleCompanyProfileProps {
  searchedQuery: string;
  profile: CompanyProfileData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const US_PROFILE_EXCHANGES = new Set([
  'NASDAQ',
  'NYSE',
  'AMEX',
  'ARCA',
  'BATS',
  'OTC',
  'OTCMKTS',
  'US',
]);

/**
 * Formats stock symbols listed in a Context.dev company profile so US-traded
 * ADR tickers display `(ADR)` while explicit foreign-exchange symbols (e.g.
 * `KRX:000660`, `TWSE:2330`) remain clearly distinguishable.
 */
function formatProfileStockSymbol(rawSym: string, companyName: string): string {
  const trimmed = rawSym.trim();
  if (!trimmed) return '';
  if (trimmed.includes(':')) {
    const [exch, sym] = trimmed.split(':');
    const upperExch = (exch || '').trim().toUpperCase();
    const cleanSym = (sym || '').trim();
    if (US_PROFILE_EXCHANGES.has(upperExch) && cleanSym) {
      return `${upperExch}:${formatTickerWithAdr(cleanSym, companyName)}`;
    }
    return trimmed;
  }
  return formatTickerWithAdr(trimmed, companyName);
}

/**
 * Builds the compact 1-line metadata segments displayed in the collapsed bar.
 *
 * @param profile - Normalized CompanyProfileData
 * @returns Ordered array of concise metadata strings
 */
function buildSummarySegments(
  profile: CompanyProfileData,
  locale: AppLocale
): Array<{ text: string; mono?: boolean }> {
  const isKo = locale === 'ko';
  const segments: Array<{ text: string; mono?: boolean }> = [];

  if (profile.organizationTypeLabel) {
    const orgLabel =
      isKo && profile.organizationTypeLabel === 'Public Company'
        ? '상장 기업'
        : isKo && profile.organizationTypeLabel === 'Private Company'
          ? '비상장 기업'
          : profile.organizationTypeLabel;
    segments.push({ text: orgLabel });
  }
  if (profile.headquartersShort) {
    segments.push({ text: profile.headquartersShort });
  }
  if (profile.employeesDisplay) {
    segments.push({ text: profile.employeesDisplay, mono: true });
  }
  if (profile.foundedYear) {
    segments.push({
      text: isKo ? `${profile.foundedYear}년 설립` : `Est. ${profile.foundedYear}`,
      mono: true,
    });
  }
  if (profile.funding.stageLabel) {
    segments.push({
      text: isKo
        ? `단계: ${profile.funding.stageLabel}`
        : `Stage: ${profile.funding.stageLabel}`,
    });
  } else if (profile.revenueDisplay) {
    segments.push({
      text: isKo
        ? `추정 매출: ${profile.revenueDisplay}`
        : `Est. Rev: ${profile.revenueDisplay}`,
      mono: true,
    });
  }

  return segments;
}

/**
 * Renders the collapsible 1-line company profile bar and expandable 3-column
 * firmographic, industry/revenue, and funding round dossier.
 *
 * @param props - CollapsibleCompanyProfileProps
 * @returns React element
 */
export function CollapsibleCompanyProfile({
  searchedQuery,
  profile,
  isLoading,
  error,
  onRetry,
}: CollapsibleCompanyProfileProps) {
  const { locale, t } = useLanguage();
  const isKo = locale === 'ko';
  const [expandedForQuery, setExpandedForQuery] = useState<string | null>(null);
  const normalizedQueryKey = searchedQuery.trim().toLowerCase();
  const isExpanded = Boolean(profile) && expandedForQuery === normalizedQueryKey;

  /**
   * Toggles the expanded dossier for the active company query.
   */
  const handleToggleExpand = () => {
    if (!profile) return;
    const nextExpanded = !isExpanded;
    logFunctionCall('CollapsibleCompanyProfile.handleToggleExpand', {
      searchedQuery,
      companyName: profile.name,
      expanded: nextExpanded,
    });
    setExpandedForQuery(nextExpanded ? normalizedQueryKey : null);
  };

  /**
   * Retries fetching the company profile when a transient error occurs.
   */
  const handleRetryClick = () => {
    logFunctionCall('CollapsibleCompanyProfile.handleRetryClick', {
      searchedQuery,
    });
    onRetry();
  };

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="mb-6 bg-[#0d1b33] border border-[#212c42] rounded-lg px-4 py-2.5 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Building2 className="w-4 h-4 text-[#49afe9] shrink-0" />
          <div className="h-4 w-40 rounded bg-[#162747] animate-pulse" />
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <div className="h-3.5 w-64 rounded bg-[#13223f] animate-pulse hidden sm:block" />
        </div>
        <div className="h-6 w-24 rounded bg-[#13223f] animate-pulse shrink-0" />
      </div>
    );
  }

  if (error) {
    const safeProfileError = formatGracefulApiError(error, { locale }).message;
    return (
      <div className="mb-6 bg-[#0d1b33] border border-[#212c42] rounded-lg px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0 text-xs text-slate-300 truncate">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">
            {isKo
              ? `${searchedQuery} 기업 프로필: ${safeProfileError}`
              : `Company profile (${searchedQuery}): ${safeProfileError}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRetryClick}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-[#49afe9] hover:text-white bg-[#102344] hover:bg-[#16305c] border border-[#212c42] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          {t.common.retry}
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mb-6 bg-[#0d1b33] border border-[#212c42] rounded-lg px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0 text-xs text-slate-400 truncate">
          <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="truncate">
            {isKo
              ? `“${searchedQuery}”에 대한 구조화된 기업 프로필 데이터가 없습니다.`
              : `No structured company profile record found for “${searchedQuery}”.`}
          </span>
        </div>
      </div>
    );
  }

  const summarySegments = buildSummarySegments(profile, locale);

  return (
    <section
      aria-label={`${t.companyProfile.corporateDossier}: ${profile.name}`}
      className="mb-6 bg-[#0d1b33] border border-[#212c42] rounded-lg overflow-hidden"
    >
      {/* Compact 1-Line Summary Bar (Collapsed by Default) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={handleToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-[#102240] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden text-xs sm:text-[13px] text-slate-300">
          <Building2 className="w-4 h-4 text-[#49afe9] shrink-0" />
          <span className="font-semibold text-white whitespace-nowrap shrink-0">
            {profile.name}
          </span>

          {summarySegments.length > 0 && (
            <div className="flex items-center gap-2 min-w-0 truncate text-slate-300">
              {summarySegments.map((seg, idx) => (
                <React.Fragment key={`${seg.text}-${idx}`}>
                  <span className="text-slate-500 shrink-0" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={`truncate ${
                      seg.mono ? 'font-mono-tabular text-slate-200' : ''
                    }`}
                  >
                    {seg.text}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
          aria-expanded={isExpanded}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-[#49afe9] hover:text-white bg-[#102344] hover:bg-[#16305c] border border-[#212c42] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isExpanded ? (
            <>
              <span>{t.companyProfile.hideProfile}</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>{t.companyProfile.showProfile}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Expandable Firmographic, Industry & Funding Dossier */}
      {isExpanded && (
        <div className="border-t border-[#212c42] bg-[#0a162b]">
          {/* Overview Description + Website Domain & Social Links */}
          <div className="p-4 sm:p-5 border-b border-[#212c42] space-y-3">
            <p className="text-sm leading-relaxed text-slate-200 max-w-[90ch]">
              {profile.description ||
                (isKo
                  ? `Context.dev 기업 검색을 통해 조회된 ${profile.name} 기업 프로필입니다.`
                  : `${profile.name} (${profile.organizationTypeLabel}) corporate profile retrieved via Context.dev Company Search.`)}
            </p>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-300">
              {profile.domain && (
                <a
                  href={`https://${profile.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#49afe9] hover:underline whitespace-nowrap"
                >
                  <span>{profile.domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {profile.socials.map((soc, idx) => (
                <React.Fragment key={soc.platform}>
                  {(profile.domain || idx > 0) && (
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <a
                    href={soc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-[#49afe9] transition-colors whitespace-nowrap"
                  >
                    <span>{soc.platform}</span>
                    <ExternalLink className="w-3 h-3 opacity-75" />
                  </a>
                </React.Fragment>
              ))}

              {profile.operatingStatusLabel && (
                <>
                  {(profile.domain || profile.socials.length > 0) && (
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <span className="text-slate-400 whitespace-nowrap">
                    {isKo ? '운영 상태: ' : 'Status: '}
                    <span className="text-slate-200">
                      {profile.operatingStatusLabel}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 3-Column Hairline Grid: Firmographics | Industries & Revenue | Funding History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#212c42]">
            {/* Column 1: Headquarters, Founding Year & Headcount */}
            <div className="p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400">
                {t.companyProfile.headquartersAndScale}
              </h3>
              <dl className="space-y-2.5 text-xs">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-400 shrink-0">
                    {t.companyProfile.headquarters}
                  </dt>
                  <dd className="text-slate-100 text-right">
                    {profile.headquartersFull ||
                      profile.headquartersShort ||
                      (isKo ? '비공개' : 'Not disclosed')}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-400 shrink-0">
                    {t.companyProfile.founded}
                  </dt>
                  <dd className="text-slate-100 font-mono-tabular text-right">
                    {profile.foundedYear
                      ? profile.foundedYear
                      : isKo
                        ? '비공개'
                        : 'Not disclosed'}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-400 shrink-0">
                    {t.companyProfile.employees}
                  </dt>
                  <dd className="text-slate-100 font-mono-tabular text-right">
                    {profile.employeesDisplay ||
                      (isKo ? '비공개' : 'Not disclosed')}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-400 shrink-0">
                    {t.companyProfile.organizationType}
                  </dt>
                  <dd className="text-slate-100 text-right">
                    {isKo && profile.organizationTypeLabel === 'Public Company'
                      ? '상장 기업'
                      : isKo &&
                          profile.organizationTypeLabel === 'Private Company'
                        ? '비상장 기업'
                        : profile.organizationTypeLabel}
                    {profile.stockSymbols.length > 0 && (
                      <span className="font-mono-tabular text-slate-300">
                        {' '}
                        ·{' '}
                        {profile.stockSymbols
                          .map((s) => formatProfileStockSymbol(s, profile.name))
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Column 2: Industries & Estimated Revenue */}
            <div className="p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400">
                {t.companyProfile.industriesAndRevenue}
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400 mb-1">
                    {t.companyProfile.industries}
                  </div>
                  <p className="text-slate-100 leading-relaxed">
                    {profile.industries.length > 0
                      ? profile.industries.join(' · ')
                      : isKo
                        ? '미분류'
                        : 'Not classified'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#212c42]/70 flex items-baseline justify-between gap-4">
                  <span className="text-slate-400 shrink-0">
                    {t.companyProfile.estAnnualRevenue}
                  </span>
                  <span className="text-slate-100 font-mono-tabular font-medium text-right">
                    {profile.revenueDisplay ||
                      (isKo ? '비공개' : 'Not disclosed')}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: Funding Stage & Chronological Round History */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xs font-semibold text-slate-400">
                  {t.companyProfile.fundingAndRoundHistory}
                </h3>
                {profile.funding.stageLabel && (
                  <span className="text-xs font-medium text-[#49afe9] whitespace-nowrap">
                    {profile.funding.stageLabel}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-400 shrink-0">
                    {t.companyProfile.totalFundingRaised}
                  </span>
                  <span className="text-slate-100 font-mono-tabular text-right">
                    {profile.funding.totalUsdDisplay
                      ? `${profile.funding.totalUsdDisplay}${
                          profile.funding.roundCount > 0
                            ? isKo
                              ? ` (${profile.funding.roundCount}회 라운드)`
                              : ` (${profile.funding.roundCount} rounds)`
                            : ''
                        }`
                      : profile.funding.roundCount > 0
                        ? isKo
                          ? `${profile.funding.roundCount}회 투자 라운드`
                          : `${profile.funding.roundCount} recorded rounds`
                        : t.companyProfile.noFundingDisclosed}
                  </span>
                </div>

                {profile.funding.latestRoundDisplay && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-slate-400 shrink-0">
                      {t.companyProfile.latestStage}
                    </span>
                    <span className="text-slate-200 font-mono-tabular text-right">
                      {profile.funding.latestRoundDisplay}
                    </span>
                  </div>
                )}

                {profile.funding.rounds.length > 0 && (
                  <div className="pt-2 border-t border-[#212c42]/70 space-y-1.5">
                    {profile.funding.rounds.slice(0, 5).map((round, rIdx) => (
                      <div
                        key={`${round.typeLabel}-${round.date}-${rIdx}`}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 truncate text-slate-200">
                          <span className="font-medium">{round.typeLabel}</span>
                          {round.phaseLabel && (
                            <span className="text-slate-400">
                              {' '}
                              ({round.phaseLabel})
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 shrink-0 font-mono-tabular text-slate-300">
                          {round.amountDisplay && (
                            <span className="text-white">
                              {round.amountDisplay}
                            </span>
                          )}
                          <span className="text-slate-400">{round.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
