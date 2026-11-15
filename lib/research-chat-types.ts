/**
 * ============================================================================
 * FILE: lib/research-chat-types.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Client- & Server-Safe Data Contracts and Live Workspace Context Serializer
 * for the Contextual Research Assistant Drawer.
 *
 * USE CASES:
 * 1. Serializing a fresh, structured snapshot of whichever view the investor
 *    is currently inspecting—Single-Company Deep Dive OR Multi-Company Cohort
 *    Comparison—combined with the cross-watchlist news briefing.
 * 2. Generating context-aware starter questions that adapt automatically as
 *    the user switches between public tickers, private unicorns, and cohorts.
 * 3. Sharing strict TypeScript interfaces between the React drawer component
 *    and the server-side `/api/ai/chat` endpoint without bundling server SDKs
 *    into client code.
 * ============================================================================
 */

import { formatTickerWithAdr } from './adr-directory';
import { APP_CONFIG, type CompanyPreset } from './config';
import type { CompanyProfileData } from './company-profile-service';
import type { AIMarketBriefResponse } from './gemini-service';
import type {
  ChartRange,
  CompanyMarketOverviewData,
} from './market-data-service';
import type {
  CohortScreenResponse,
  ComparedCompanyDossier,
  SearchWorkspaceMode,
} from './query-intent';
import type { RelatedCompaniesResponse } from './related-companies-service';
import type { EnrichedNewsArticle } from './translation-service';
import type { WatchlistDigestResponse } from './watchlist-digest-service';
import { logFunctionCall } from './logger';

export interface ResearchChatCitation {
  title: string;
  url: string;
  domain: string;
  sourceType: 'dashboard_news' | 'web_search';
}

export interface ResearchChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contextLabel: string;
  citations?: ResearchChatCitation[];
  createdAt: string;
}

export interface ResearchChatTurnInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatNewsHeadlineItem {
  title: string;
  sourceName: string;
  publishedAt: string | null;
  url: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  rationale: string | null;
}

export interface SingleCompanyChatContext {
  searchedQuery: string;
  companyName: string;
  kind: 'public' | 'private' | 'unknown';
  symbol: string | null;
  sector: string | null;
  industry: string | null;
  activeChartRange: ChartRange;
  priceDisplay: string | null;
  periodChangePctDisplay: string | null;
  metrics: Record<string, string | null>;
  profileSummary: {
    organizationType: string | null;
    headquarters: string | null;
    foundedYear: number | null;
    employees: string | null;
    revenue: string | null;
    industries: string[];
    fundingSummary: string | null;
    description: string | null;
  } | null;
  aiBrief: {
    sentiment: string;
    confidenceScore: number;
    executiveSummary: string;
    keyCatalysts: string[];
    riskFactors: string[];
  } | null;
  relatedEcosystem: Array<{
    category: string;
    peers: string[];
  }>;
  articles: ChatNewsHeadlineItem[];
}

export interface CohortComparedCompanySnapshot {
  id: string;
  name: string;
  ticker: string | null;
  kind: 'public' | 'private';
  sector: string | null;
  valuationOrMarketCap: string | null;
  sharePriceOrStatus: string;
  periodReturnPctDisplay: string | null;
  trailingPE: string | null;
  forwardPE: string | null;
  trailingEps: string | null;
  fiftyTwoWeekRange: string | null;
  revenue: string | null;
  employees: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  newsPosture: string | null;
  bullishPct: number | null;
  topCatalyst: {
    title: string;
    sourceName: string;
    url: string;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  } | null;
}

export interface CohortComparisonChatContext {
  query: string;
  interpretedTheme: string;
  constraintSummary: string | null;
  activeChartRange: ChartRange;
  comparativeSummary: string | null;
  selectedCompanies: CohortComparedCompanySnapshot[];
  otherVerifiedCandidates: Array<{
    name: string;
    ticker: string | null;
    valuationDisplay: string | null;
  }>;
}

export interface WatchlistChatContext {
  followedCompanies: string[];
  executiveSummary: string | null;
  keyThemes: string[];
  topBullish: ChatNewsHeadlineItem[];
  topBearish: ChatNewsHeadlineItem[];
}

export interface WorkspaceResearchContextPayload {
  workspaceMode: SearchWorkspaceMode;
  contextShortLabel: string;
  contextSummaryLine: string;
  singleCompany: SingleCompanyChatContext | null;
  cohortComparison: CohortComparisonChatContext | null;
  watchlist: WatchlistChatContext | null;
}

export interface ResearchChatReplyPayload {
  content: string;
  citations: ResearchChatCitation[];
  modelUsed: string;
  generatedAt: string;
}

/**
 * Extracts a clean hostname from a URL string for compact source attribution.
 *
 * @param rawUrl - Full article or web grounding URL
 * @returns Clean domain string without leading `www.`
 */
export function extractCleanDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return 'source';
  }
}

/**
 * Serializes the live Contextual Investing dashboard state into a compact,
 * structured `WorkspaceResearchContextPayload` sent alongside each chat message.
 *
 * @param params - Active React state across Single-Company, Cohort Comparison, and Watchlist views
 * @returns Structured `WorkspaceResearchContextPayload`
 */
export function buildWorkspaceResearchContext(params: {
  workspaceMode: SearchWorkspaceMode;
  searchedQuery: string;
  marketData: CompanyMarketOverviewData | null;
  chartRange: ChartRange;
  companyProfile: CompanyProfileData | null;
  aiBrief: AIMarketBriefResponse | null;
  relatedData: RelatedCompaniesResponse | null;
  articles: EnrichedNewsArticle[];
  cohortQuery: string;
  cohortScreen: CohortScreenResponse | null;
  selectedCohortIds: string[];
  cohortDossiersById: Record<string, ComparedCompanyDossier>;
  cohortRange: ChartRange;
  comparativeSummary: string | null;
  followedCompanies: CompanyPreset[];
  watchlistDigest: WatchlistDigestResponse | null;
  locale?: 'en' | 'ko';
}): WorkspaceResearchContextPayload {
  const isKo = params.locale === 'ko';
  logFunctionCall('buildWorkspaceResearchContext', {
    workspaceMode: params.workspaceMode,
    searchedQuery: params.searchedQuery,
    selectedCohortCount: params.selectedCohortIds.length,
    locale: params.locale || 'en',
  });

  // 1. Build Watchlist Context (always included per user preference)
  const watchlist: WatchlistChatContext = {
    followedCompanies: params.followedCompanies.map((c) =>
      c.entityType === 'ticker'
        ? `${c.label} (${formatTickerWithAdr(c.value, c.label, c.isAdr)})`
        : c.label
    ),
    executiveSummary: params.watchlistDigest?.executiveSummary ?? null,
    keyThemes: params.watchlistDigest?.keyThemes ?? [],
    topBullish: (params.watchlistDigest?.topBullish ?? [])
      .slice(0, 3)
      .map((m) => ({
        title: `[${m.companyValue}] ${m.title}`,
        sourceName: m.sourceName || m.sourceDomain || 'News Wire',
        publishedAt: m.publishedAt || null,
        url: m.url,
        sentiment: 'Bullish',
        rationale: m.rationale || null,
      })),
    topBearish: (params.watchlistDigest?.topBearish ?? [])
      .slice(0, 3)
      .map((m) => ({
        title: `[${m.companyValue}] ${m.title}`,
        sourceName: m.sourceName || m.sourceDomain || 'News Wire',
        publishedAt: m.publishedAt || null,
        url: m.url,
        sentiment: 'Bearish',
        rationale: m.rationale || null,
      })),
  };

  // 2. Cohort Comparison Mode Snapshot
  if (params.workspaceMode === 'cohort' && params.cohortScreen) {
    const screen = params.cohortScreen;
    const selectedSet = new Set(params.selectedCohortIds);

    const selectedCompanies: CohortComparedCompanySnapshot[] =
      params.selectedCohortIds
        .map((id) => screen.candidates.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((cand) => {
          const dossier = params.cohortDossiersById[cand.id];
          const m = dossier?.market ?? screen.initialMarketById[cand.id] ?? null;
          const p = dossier?.profile ?? null;
          const n = dossier?.newsPulse ?? null;

          let periodReturnPctDisplay: string | null = null;
          if (m?.kind === 'public') {
            const pts = (m.points || []).filter(
              (pt) => typeof pt.close === 'number' && pt.close > 0
            );
            if (pts.length >= 2) {
              const pct =
                ((pts[pts.length - 1].close - pts[0].close) / pts[0].close) *
                100;
              periodReturnPctDisplay = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% (${params.cohortRange})`;
            } else {
              periodReturnPctDisplay = `${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}%`;
            }
          }

          return {
            id: cand.id,
            name: cand.name,
            ticker: cand.ticker
              ? formatTickerWithAdr(cand.ticker, cand.name, cand.isAdr)
              : null,
            kind: cand.kind,
            sector: cand.sector,
            valuationOrMarketCap:
              m?.kind === 'public'
                ? m.metrics.marketCap || cand.valuationDisplay
                : m?.kind === 'private'
                  ? m.latestValuation || cand.valuationDisplay
                  : cand.valuationDisplay,
            sharePriceOrStatus:
              m?.kind === 'public'
                ? `$${m.price.toFixed(2)} ${m.currency || 'USD'}`
                : 'Privately Held',
            periodReturnPctDisplay,
            trailingPE: m?.kind === 'public' ? m.metrics.trailingPE : null,
            forwardPE: m?.kind === 'public' ? m.metrics.forwardPE : null,
            trailingEps: m?.kind === 'public' ? m.metrics.trailingEps : null,
            fiftyTwoWeekRange:
              m?.kind === 'public' &&
              m.metrics.fiftyTwoWeekLow !== null &&
              m.metrics.fiftyTwoWeekHigh !== null
                ? `$${m.metrics.fiftyTwoWeekLow.toFixed(2)} – $${m.metrics.fiftyTwoWeekHigh.toFixed(2)}`
                : null,
            revenue:
              (m?.kind === 'public' ? m.metrics.totalRevenue : null) ||
              p?.revenueDisplay ||
              (m?.kind === 'private' ? m.estimatedRevenue : null),
            employees: p?.employeesDisplay ?? null,
            headquarters:
              p?.headquartersShort ||
              (m?.kind === 'private' ? m.headquarters : null),
            foundedYear: p?.foundedYear ?? null,
            newsPosture: n?.netPosture ?? null,
            bullishPct: n ? n.bullishPct : null,
            topCatalyst: n?.topCatalyst
              ? {
                  title: n.topCatalyst.title,
                  sourceName: n.topCatalyst.sourceName,
                  url: n.topCatalyst.url,
                  sentiment: n.topCatalyst.sentiment,
                }
              : null,
          };
        });

    const otherVerifiedCandidates = screen.candidates
      .filter((c) => !selectedSet.has(c.id))
      .map((c) => ({
        name: c.name,
        ticker: c.ticker
          ? formatTickerWithAdr(c.ticker, c.name, c.isAdr)
          : null,
        valuationDisplay: c.valuationDisplay,
      }));

    const selectedNames = selectedCompanies.map((c) => c.ticker || c.name);
    const shortLabel =
      selectedNames.length > 0
        ? `${isKo ? '코호트' : 'Cohort'}: ${selectedNames.join(', ')}`
        : `${isKo ? '코호트' : 'Cohort'}: ${screen.interpretedTheme}`;

    const summaryLine = [
      shortLabel,
      isKo ? `${params.cohortRange} 차트` : `${params.cohortRange} Chart`,
      isKo
        ? `관심종목 (${params.followedCompanies.length})`
        : `Watchlist (${params.followedCompanies.length})`,
    ].join(' · ');

    return {
      workspaceMode: 'cohort',
      contextShortLabel: shortLabel,
      contextSummaryLine: summaryLine,
      singleCompany: null,
      cohortComparison: {
        query: params.cohortQuery || screen.query,
        interpretedTheme: screen.interpretedTheme,
        constraintSummary: screen.constraintSummary,
        activeChartRange: params.cohortRange,
        comparativeSummary: params.comparativeSummary,
        selectedCompanies,
        otherVerifiedCandidates,
      },
      watchlist,
    };
  }

  // 3. Single-Company Deep Dive Mode Snapshot
  const m = params.marketData;
  const p = params.companyProfile;
  const displaySymbol =
    m?.kind === 'public'
      ? formatTickerWithAdr(m.symbol, m.companyName, m.isAdr)
      : null;
  const displayName =
    m?.companyName || p?.name || params.searchedQuery.trim() || 'Active Company';

  const metricsMap: Record<string, string | null> = {};
  if (m?.kind === 'public') {
    metricsMap.marketCap = m.metrics.marketCap;
    metricsMap.enterpriseValue = m.metrics.enterpriseValue;
    metricsMap.trailingPE = m.metrics.trailingPE;
    metricsMap.forwardPE = m.metrics.forwardPE;
    metricsMap.priceToBook = m.metrics.priceToBook;
    metricsMap.trailingEps = m.metrics.trailingEps;
    metricsMap.totalRevenue = m.metrics.totalRevenue;
    metricsMap.revenueGrowth = m.metrics.revenueGrowth;
    metricsMap.profitMargins = m.metrics.profitMargins;
    metricsMap.operatingMargins = m.metrics.operatingMargins;
    metricsMap.returnOnEquity = m.metrics.returnOnEquity;
    metricsMap.dividendYield = m.metrics.dividendYield;
    metricsMap.beta = m.metrics.beta;
    metricsMap.volume = m.metrics.volume;
    metricsMap.fiftyTwoWeekRange =
      m.metrics.fiftyTwoWeekLow !== null && m.metrics.fiftyTwoWeekHigh !== null
        ? `$${m.metrics.fiftyTwoWeekLow.toFixed(2)} – $${m.metrics.fiftyTwoWeekHigh.toFixed(2)}`
        : null;
  } else if (m?.kind === 'private') {
    metricsMap.latestValuation = m.latestValuation;
    metricsMap.totalFunding = m.totalFunding;
    metricsMap.lastRound = m.lastRound;
    metricsMap.estimatedRevenue = m.estimatedRevenue;
    metricsMap.ceo = m.ceo;
  }

  const singleCompany: SingleCompanyChatContext = {
    searchedQuery: params.searchedQuery.trim(),
    companyName: displayName,
    kind: m?.kind ?? 'unknown',
    symbol: displaySymbol,
    sector: m?.sector ?? null,
    industry: m?.kind === 'public' ? m.industry : null,
    activeChartRange: params.chartRange,
    priceDisplay:
      m?.kind === 'public'
        ? `$${m.price.toFixed(2)} ${m.currency || 'USD'}`
        : m?.kind === 'private'
          ? `Private · ${m.latestValuation || 'Unlisted'}`
          : null,
    periodChangePctDisplay:
      m?.kind === 'public'
        ? `${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}% (${params.chartRange})`
        : null,
    metrics: metricsMap,
    profileSummary: p
      ? {
          organizationType: p.organizationTypeLabel,
          headquarters: p.headquartersShort,
          foundedYear: p.foundedYear,
          employees: p.employeesDisplay,
          revenue: p.revenueDisplay,
          industries: p.industries.slice(0, 5),
          fundingSummary: p.funding.totalUsdDisplay
            ? `${p.funding.totalUsdDisplay} across ${p.funding.roundCount} rounds${
                p.funding.latestRoundDisplay
                  ? ` (Latest: ${p.funding.latestRoundDisplay})`
                  : ''
              }`
            : null,
          description: p.description,
        }
      : null,
    aiBrief: params.aiBrief
      ? {
          sentiment: params.aiBrief.sentiment,
          confidenceScore: params.aiBrief.confidenceScore,
          executiveSummary: params.aiBrief.executiveSummary,
          keyCatalysts: params.aiBrief.keyCatalysts,
          riskFactors: params.aiBrief.riskFactors,
        }
      : null,
    relatedEcosystem: (params.relatedData?.groups ?? []).map((g) => ({
      category: g.category,
      peers: g.companies
        .slice(0, 5)
        .map((c) =>
          c.ticker
            ? `${c.name} (${formatTickerWithAdr(c.ticker, c.name, c.isAdr)})`
            : c.name
        ),
    })),
    articles: params.articles
      .slice(0, APP_CONFIG.researchChat.maxContextArticles)
      .map((a) => ({
        title: a.title,
        sourceName: a.source?.name || a.source?.domain || 'Publisher',
        publishedAt: a.published_at || null,
        url: a.url,
        sentiment: a.sentiment || 'Neutral',
        rationale: a.sentimentReason || null,
      })),
  };

  const primaryTag = displaySymbol
    ? `${displaySymbol}`
    : displayName;
  const priceSnippet =
    m?.kind === 'public'
      ? `$${m.price.toFixed(2)}`
      : m?.kind === 'private' && m.latestValuation
        ? m.latestValuation
        : null;

  const summaryParts = [
    primaryTag,
    ...(priceSnippet ? [priceSnippet] : []),
    isKo
      ? `뉴스 ${singleCompany.articles.length}건`
      : `${singleCompany.articles.length} News ${
          singleCompany.articles.length === 1 ? 'Article' : 'Articles'
        }`,
    isKo
      ? `관심종목 (${params.followedCompanies.length})`
      : `Watchlist (${params.followedCompanies.length})`,
  ];

  return {
    workspaceMode: 'single',
    contextShortLabel: displaySymbol
      ? `${displayName} (${displaySymbol})`
      : displayName,
    contextSummaryLine: summaryParts.join(' · '),
    singleCompany,
    cohortComparison: null,
    watchlist,
  };
}

/**
 * Generates 3 concise, context-aware starter prompts tailored to the active
 * Single-Company or Cohort Comparison view in English ('en') or Korean ('ko').
 *
 * @param context - Active `WorkspaceResearchContextPayload`
 * @param locale - Optional UI locale ('en' | 'ko')
 * @returns Array of 3 starter prompt strings
 */
export function buildDynamicStarterPrompts(
  context: WorkspaceResearchContextPayload,
  locale: 'en' | 'ko' = 'en'
): string[] {
  const isKo = locale === 'ko';

  if (context.workspaceMode === 'cohort' && context.cohortComparison) {
    const names = context.cohortComparison.selectedCompanies.map(
      (c) => c.ticker || c.name
    );
    const label =
      names.length >= 2
        ? names.join(', ')
        : isKo
          ? '선택된 기업들'
          : 'these companies';
    if (isKo) {
      return [
        `${label}의 밸류에이션 배수와 최근 ${context.cohortComparison.activeChartRange} 수익률을 비교해 줘`,
        `${label} 중 현재 가장 강력한 강세 모멘텀을 가진 기업과 하방 리스크가 낮은 곳은 어디야?`,
        `이 ${context.cohortComparison.interpretedTheme} 기업군이 내 관심종목에 미치는 파급 효과를 분석해 줘`,
      ];
    }
    return [
      `Compare valuation multiples vs. recent ${context.cohortComparison.activeChartRange} return across ${label}`,
      `Which company in ${label} has the strongest bullish catalyst and lowest downside risk right now?`,
      `How does this ${context.cohortComparison.interpretedTheme} cohort impact my followed watchlist?`,
    ];
  }

  const sc = context.singleCompany;
  const target =
    sc?.symbol || sc?.companyName || (isKo ? '이 기업' : 'this company');
  if (sc?.kind === 'private') {
    if (isKo) {
      return [
        `${target}의 최근 기업가치 및 투자 유치 규모를 상장 경쟁사들과 비교해 줘`,
        `${target}의 최신 뉴스에서 핵심 강세 모멘텀과 리스크 요인을 요약해 줘`,
        `${target}의 최근 행보가 내 관심종목 기업들에 주는 시사점은 무엇이야?`,
      ];
    }
    return [
      `How does ${target}'s latest valuation and funding scale compare to public peers?`,
      `Summarize the key bullish catalysts and risks in ${target}'s recent news`,
      `What read-through does ${target} have for the rest of my watchlist?`,
    ];
  }

  if (isKo) {
    return [
      `${target}의 현재 PER 및 밸류에이션이 최근 뉴스 모멘텀으로 정당화될 수 있을까?`,
      `지금 시점에서 ${target}의 가장 큰 약세 리스크(Bear Case)는 무엇이야?`,
      `${target}의 최신 이슈가 주요 공급망, 경쟁사 및 내 관심종목에 어떤 영향을 미치나?`,
    ];
  }

  return [
    `Is ${target}'s current P/E and valuation supported by its recent news catalysts?`,
    `What is the single biggest bear-case risk for ${target} right now?`,
    `How do ${target}'s latest developments affect its suppliers, peers, and my watchlist?`,
  ];
}
