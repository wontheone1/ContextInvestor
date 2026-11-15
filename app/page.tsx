/**
 * ============================================================================
 * FILE: app/page.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Main Contextual Investing Quantitative Investor Dashboard & AI Research Terminal Page.
 *
 * USE CASES:
 * 1. Opening immediately with the **Watchlist News Summary & Top Conviction
 *    Signals** (`WatchlistLandingBrief`) covering all companies the investor is
 *    following (`NVDA`, `Stripe`, `AAPL`, `MSFT`, `PLTR`, `OpenAI` by default,
 *    or any custom followed companies) and ranking the top most Bullish and
 *    Bearish news stories across the entire watchlist.
 * 2. Allowing investors to follow/unfollow any US ticker or private company
 *    from the watchlist strip or active company research header, persisted in
 *    `localStorage` and synchronized with Firestore (`/followed_companies`).
 * 3. Orchestrating the Context.dev Company News Search flow (`POST /v1/news/search`)
 *    identifying companies by Stock Ticker (`ticker`), Company Name (`name`), or
 *    smart auto-detection (`auto`).
 * 4. Displaying live US equity price charts & key investment metrics
 *    (`/api/market/overview`), related companies grouped by relationship
 *    (`/api/ai/related`), side-by-side Bull vs. Bear AI synthesis (`/api/ai/brief`),
 *    and per-article sentiment rationale.
 * ============================================================================
 */

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { AlertCircle, Check, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { NewsSearchResponse } from 'context.dev/resources/news';
import type { EnrichedNewsArticle } from '@/lib/translation-service';
import { TopNavbar, type NavSectionId } from '@/components/TopNavbar';
import { WatchlistCarousel } from '@/components/WatchlistCarousel';
import { WatchlistLandingBrief } from '@/components/WatchlistLandingBrief';
import {
  NewsSearchControlBar,
  type NewsSearchControlState,
} from '@/components/NewsSearchControlBar';
import {
  NewsFeedTable,
  type SentimentFilterOption,
} from '@/components/NewsFeedTable';
import { AIMarketBriefPanel } from '@/components/AIMarketBriefPanel';
import { SdkCacheInspector } from '@/components/SdkCacheInspector';
import { CompanyMarketOverview } from '@/components/CompanyMarketOverview';
import { RelatedCompaniesPanel } from '@/components/RelatedCompaniesPanel';
import { CollapsibleCompanyProfile } from '@/components/CollapsibleCompanyProfile';
import { CohortComparisonWorkspace } from '@/components/CohortComparisonWorkspace';
import { ContextualResearchDrawer } from '@/components/ContextualResearchDrawer';
import type { CompanyProfileData } from '@/lib/company-profile-service';
import type {
  ChartRange,
  CompanyMarketOverviewData,
  PriceChartPoint,
} from '@/lib/market-data-service';
import {
  detectSearchQueryIntent,
  parseCompactUsdString,
  type CohortCompareRequestItem,
  type CohortCompareResponse,
  type CohortScreenResponse,
  type ComparedCompanyDossier,
  type ScreenedCandidateItem,
  type SearchWorkspaceMode,
} from '@/lib/query-intent';
import {
  buildWorkspaceResearchContext,
  type ResearchChatMessage,
  type ResearchChatReplyPayload,
  type ResearchChatTurnInput,
} from '@/lib/research-chat-types';
import type {
  RelatedCompaniesResponse,
  RelatedCompanyItem,
} from '@/lib/related-companies-service';
import type {
  WatchlistDigestResponse,
  WatchlistMoverArticle,
} from '@/lib/watchlist-digest-service';
import {
  auth,
  testFirestoreConnection,
  buildSearchCacheId,
  getCachedNewsSearch,
  saveCachedNewsSearch,
  signInWithGoogle,
  signOutUser,
  saveArticleForUser,
  removeSavedArticle,
  listUserSavedArticles,
  followCompanyForUser,
  unfollowCompanyForUser,
  listUserFollowedCompanies,
  type SavedArticleRecord,
} from '@/lib/firebase-client';
import type { AIMarketBriefResponse } from '@/lib/gemini-service';
import {
  APP_CONFIG,
  type CompanyPreset,
  type WatchlistSparklineRange,
} from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';

const FOLLOWED_STORAGE_KEY = 'contextual_investing_followed_companies_v1';

/**
 * Constructs a provisional `CompanyPreset` skeleton (with NO fabricated sparklines)
 * from a stored Firestore record prior to live server quote & existence hydration.
 */
function buildProvisionalPresetFromStoredRecord(
  rawValue: string,
  entityType: 'name' | 'ticker',
  customLabel?: string,
  customSector?: string
): CompanyPreset {
  const trimmed = rawValue.trim();
  const knownPreset = APP_CONFIG.featuredCompanies.find(
    (c) =>
      c.value.toLowerCase() === trimmed.toLowerCase() ||
      c.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (knownPreset) {
    return knownPreset;
  }

  const isTicker = entityType === 'ticker';
  const normalizedValue = isTicker ? trimmed.toUpperCase() : trimmed;
  return {
    label: customLabel || normalizedValue,
    entityType,
    value: normalizedValue,
    kind: isTicker ? 'public' : 'private',
    sector:
      customSector || (isTicker ? 'US Listed Equity' : 'Privately Held'),
    price: isTicker ? 'Loading...' : 'Privately Held',
    changePct: isTicker ? '...' : 'Verifying...',
    timeframe: APP_CONFIG.watchlist.defaultSparklineRange,
    positive: true,
    sparkline: [],
  };
}

/**
 * Computes the epoch millisecond `dateFrom` and `dateTo` bounds for the selected
 * date range preset or custom date inputs.
 */
function resolveDateBounds(state: NewsSearchControlState): {
  dateFrom?: number;
  dateTo?: number;
} {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (state.datePreset) {
    case '24h':
      return { dateFrom: now - dayMs, dateTo: now };
    case '7d':
      return { dateFrom: now - 7 * dayMs, dateTo: now };
    case '30d':
      return { dateFrom: now - 30 * dayMs, dateTo: now };
    case '90d':
      return { dateFrom: now - 90 * dayMs, dateTo: now };
    case 'custom': {
      const fromMs = state.customDateFrom
        ? new Date(`${state.customDateFrom}T00:00:00Z`).getTime()
        : undefined;
      const toMs = state.customDateTo
        ? new Date(`${state.customDateTo}T23:59:59Z`).getTime()
        : undefined;
      return {
        dateFrom: fromMs && !Number.isNaN(fromMs) ? fromMs : undefined,
        dateTo: toMs && !Number.isNaN(toMs) ? toMs : undefined,
      };
    }
    case 'all':
    default:
      return {};
  }
}

/**
 * Main Investor Dashboard Page Component.
 */
export default function InvestorDashboardPage() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('pulse');

  // Followed Watchlist Companies, Sparkline Timeframe & Verification State
  const [followedCompanies, setFollowedCompanies] = useState<CompanyPreset[]>(
    () => [...APP_CONFIG.featuredCompanies]
  );
  const [isWatchlistCustomized, setIsWatchlistCustomized] =
    useState<boolean>(false);
  const [watchlistRange, setWatchlistRange] = useState<WatchlistSparklineRange>(
    APP_CONFIG.watchlist.defaultSparklineRange
  );
  const [isHydratingWatchlistQuotes, setIsHydratingWatchlistQuotes] =
    useState<boolean>(false);
  const [isVerifyingFollow, setIsVerifyingFollow] = useState<boolean>(false);
  const [followValidationError, setFollowValidationError] = useState<
    string | null
  >(null);
  const watchlistQuotesSeqRef = useRef<number>(0);

  // Watchlist Cross-Company Landing Brief & Top Bullish/Bearish Movers State
  const [watchlistDigest, setWatchlistDigest] =
    useState<WatchlistDigestResponse | null>(null);
  const [isLoadingWatchlistDigest, setIsLoadingWatchlistDigest] =
    useState<boolean>(true);
  const [watchlistDigestError, setWatchlistDigestError] = useState<
    string | null
  >(null);
  const watchlistDigestReqSeqRef = useRef<number>(0);

  // Search Control State
  const [searchState, setSearchState] = useState<NewsSearchControlState>({
    entityType: 'ticker',
    entityValue: 'NVDA',
    sortBy: 'newest',
    limit: 4,
    datePreset: 'all',
    customDateFrom: '2026-01-01',
    customDateTo: '2026-11-14',
    filterCategory: 'none',
    selectedArticleType: 'editorial',
    selectedLanguage: 'en',
    selectedCountry: 'us',
    sourceDomainInput: 'reuters.com',
  });

  // Internal resolved entity & exchange locks used to keep cursor pagination consistent
  const [resolvedEntityType, setResolvedEntityType] = useState<
    'name' | 'ticker'
  >('ticker');
  const [resolvedExchange, setResolvedExchange] = useState<string | null>(null);

  // Cursor Pagination Stack: index 0 is always `null` (first page)
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // News Results State
  const [articles, setArticles] = useState<EnrichedNewsArticle[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true);

  // Market Price Chart & Key Investment Metrics State
  const [marketData, setMarketData] =
    useState<CompanyMarketOverviewData | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('1M');
  const [isLoadingMarket, setIsLoadingMarket] = useState<boolean>(true);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  // AI Market Brief & Headline Sentiment State
  const [aiBrief, setAiBrief] = useState<AIMarketBriefResponse | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] =
    useState<SentimentFilterOption>('all');
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] =
    useState<boolean>(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);
  const briefCacheRef = useRef<Map<string, AIMarketBriefResponse>>(new Map());
  const briefReqSeqRef = useRef<number>(0);

  // Related Companies Ecosystem Suggestions State
  const [relatedData, setRelatedData] =
    useState<RelatedCompaniesResponse | null>(null);
  const [isLoadingRelated, setIsLoadingRelated] = useState<boolean>(true);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const relatedCacheRef = useRef<Map<string, RelatedCompaniesResponse>>(
    new Map()
  );
  const relatedReqSeqRef = useRef<number>(0);

  // Collapsible Company Profile (Context.dev /v1/company/search) State
  const [companyProfile, setCompanyProfile] =
    useState<CompanyProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileCacheRef = useRef<Map<string, CompanyProfileData | null>>(
    new Map()
  );
  const profileReqSeqRef = useRef<number>(0);

  // Natural-Language Cohort Screening & Multi-Company Comparison State
  const [workspaceMode, setWorkspaceMode] =
    useState<SearchWorkspaceMode>('single');
  const [activeCohortQuery, setActiveCohortQuery] = useState<string>('');
  const [cohortScreen, setCohortScreen] =
    useState<CohortScreenResponse | null>(null);
  const [isScreeningCohort, setIsScreeningCohort] = useState<boolean>(false);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [cohortRange, setCohortRange] = useState<ChartRange>('1M');
  const [cohortDossiersById, setCohortDossiersById] = useState<
    Record<string, ComparedCompanyDossier>
  >({});
  const [comparativeSummary, setComparativeSummary] = useState<string | null>(
    null
  );
  const [isHydratingComparison, setIsHydratingComparison] =
    useState<boolean>(false);
  const [isAddingCustomCompare, setIsAddingCustomCompare] =
    useState<boolean>(false);
  const [customCompareError, setCustomCompareError] = useState<string | null>(
    null
  );
  const cohortScreenSeqRef = useRef<number>(0);
  const cohortCompareSeqRef = useRef<number>(0);

  // Contextual Research Assistant Drawer State (Continuous Session)
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ResearchChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedChatQuestion, setLastFailedChatQuestion] = useState<
    string | null
  >(null);

  // Firebase Auth & Saved Watchlist State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedArticles, setSavedArticles] = useState<
    Array<SavedArticleRecord & { docId: string }>
  >([]);

  /**
   * Fetches the cross-watchlist news summary and top bullish/bearish movers
   * for the user's followed companies.
   */
  const fetchWatchlistDigest = useCallback(
    async (companiesToTrack: CompanyPreset[], forceRefresh = false) => {
      const seq = ++watchlistDigestReqSeqRef.current;
      setIsLoadingWatchlistDigest(true);
      setWatchlistDigestError(null);

      try {
        const res = await fetch('/api/news/watchlist-digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companies: companiesToTrack.map((c) => ({
              label: c.label,
              value: c.value,
              entityType: c.entityType === 'ticker' ? 'ticker' : 'name',
              sector: c.sector,
            })),
            forceRefresh,
          }),
        });
        const data = await res.json();
        if (seq !== watchlistDigestReqSeqRef.current) return;
        if (!res.ok || !data.ok || !data.digest) {
          throw new Error(
            data.error || 'Failed to synthesize watchlist news briefing.'
          );
        }
        setWatchlistDigest(data.digest as WatchlistDigestResponse);
      } catch (err) {
        if (seq !== watchlistDigestReqSeqRef.current) return;
        setWatchlistDigestError(
          err instanceof Error
            ? err.message
            : 'Unable to load watchlist news summary.'
        );
      } finally {
        if (seq === watchlistDigestReqSeqRef.current) {
          setIsLoadingWatchlistDigest(false);
        }
      }
    },
    []
  );

  /**
   * Hydrates live public stock prices, period `%` returns, and real historical
   * sparklines for `targetRange`, strips fake sparklines from private companies,
   * and prunes any previously stored non-existent company entries.
   */
  const hydrateFollowedWatchlistQuotes = useCallback(
    async (
      itemsToHydrate: CompanyPreset[],
      targetRange: WatchlistSparklineRange,
      persistToLocalStorage: boolean,
      refreshDigestOnPrune = false
    ) => {
      const seq = ++watchlistQuotesSeqRef.current;
      setIsHydratingWatchlistQuotes(true);

      try {
        const res = await fetch('/api/market/watchlist-quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'hydrate',
            companies: itemsToHydrate,
            range: targetRange,
          }),
        });
        const json = await res.json();
        if (seq !== watchlistQuotesSeqRef.current) return;
        if (!res.ok || !json.ok || !Array.isArray(json.companies)) {
          return;
        }

        const hydratedCompanies = json.companies as CompanyPreset[];
        const invalidValues = Array.isArray(json.invalidValues)
          ? (json.invalidValues as string[])
          : [];

        setFollowedCompanies(hydratedCompanies);

        if (persistToLocalStorage || invalidValues.length > 0) {
          try {
            window.localStorage.setItem(
              FOLLOWED_STORAGE_KEY,
              JSON.stringify(hydratedCompanies)
            );
          } catch {
            // ignore storage quota errors
          }
        }

        if (invalidValues.length > 0) {
          if (auth.currentUser) {
            for (const badVal of invalidValues) {
              const matchedOld = itemsToHydrate.find(
                (it) => it.value.toLowerCase() === badVal.toLowerCase()
              );
              if (matchedOld) {
                unfollowCompanyForUser(
                  matchedOld.entityType === 'ticker' ? 'ticker' : 'name',
                  matchedOld.value
                ).catch(() => undefined);
              }
            }
          }
          if (refreshDigestOnPrune) {
            void fetchWatchlistDigest(hydratedCompanies, false);
          }
        }
      } catch (err) {
        console.warn('Watchlist live quote hydration warning:', err);
      } finally {
        if (seq === watchlistQuotesSeqRef.current) {
          setIsHydratingWatchlistQuotes(false);
        }
      }
    },
    [fetchWatchlistDigest]
  );

  // Hydrate custom followed companies from localStorage on mount, fetch live quotes & Watchlist Digest
  useEffect(() => {
    const timer = setTimeout(() => {
      let initialCompanies: CompanyPreset[] = [
        ...APP_CONFIG.featuredCompanies,
      ];
      let customized = false;
      try {
        const rawSaved = window.localStorage.getItem(FOLLOWED_STORAGE_KEY);
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved) as CompanyPreset[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Sanitize any legacy fake private sparklines immediately before network hydration
            initialCompanies = parsed.map((p) =>
              p.entityType !== 'ticker' || p.kind === 'private'
                ? { ...p, kind: 'private', sparkline: [] }
                : p
            );
            customized = true;
            setFollowedCompanies(initialCompanies);
            setIsWatchlistCustomized(true);
          }
        }
      } catch (e) {
        console.warn('Could not read followed companies from localStorage:', e);
      }

      void fetchWatchlistDigest(initialCompanies, false);
      void hydrateFollowedWatchlistQuotes(
        initialCompanies,
        APP_CONFIG.watchlist.defaultSparklineRange,
        customized,
        true
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchWatchlistDigest, hydrateFollowedWatchlistQuotes]);

  // Validate Firestore connection and listen to Auth state on mount
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const [savedList, remoteFollowed] = await Promise.all([
            listUserSavedArticles(user.uid),
            listUserFollowedCompanies(user.uid).catch(() => []),
          ]);
          setSavedArticles(savedList);

          if (remoteFollowed.length > 0) {
            const mappedPresets = remoteFollowed.map((f) =>
              buildProvisionalPresetFromStoredRecord(
                f.value,
                f.entityType,
                f.label,
                f.sector
              )
            );
            setFollowedCompanies(mappedPresets);
            setIsWatchlistCustomized(true);
            void fetchWatchlistDigest(mappedPresets, false);
            void hydrateFollowedWatchlistQuotes(
              mappedPresets,
              APP_CONFIG.watchlist.defaultSparklineRange,
              true,
              true
            );
          }
        } catch (err) {
          console.error('Failed to load user Firestore data:', err);
        }
      } else {
        setSavedArticles([]);
      }
    });
    return () => unsub();
  }, [fetchWatchlistDigest, hydrateFollowedWatchlistQuotes]);

  /**
   * Switches the sparkline & `%` return timeframe (`1D`, `5D`, `1M`, `6M`, `1Y`)
   * across `"Companies You Are Following"` and hydrates real historical closes.
   */
  const handleWatchlistRangeChange = (nextRange: WatchlistSparklineRange) => {
    setWatchlistRange(nextRange);
    void hydrateFollowedWatchlistQuotes(
      followedCompanies,
      nextRange,
      isWatchlistCustomized,
      false
    );
  };

  /**
   * Verifies that a user-entered ticker or company name is a genuinely existing
   * company (`POST /api/market/watchlist-quotes` `action: "validate"`) before
   * adding it to `followedCompanies`, `localStorage`, and Firestore.
   *
   * @returns `true` if verified and added (or already followed), `false` if invalid
   */
  const handleAddFollowedCompany = async (
    rawInput: string,
    customLabel?: string,
    customSector?: string
  ): Promise<boolean> => {
    const trimmed = rawInput.trim();
    if (!trimmed) return false;

    const alreadyDirect = followedCompanies.some(
      (c) =>
        c.value.toLowerCase() === trimmed.toLowerCase() ||
        c.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyDirect) {
      setFollowValidationError(null);
      return true;
    }

    setIsVerifyingFollow(true);
    setFollowValidationError(null);

    try {
      const res = await fetch('/api/market/watchlist-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          query: trimmed,
          range: watchlistRange,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok || !json.valid || !json.preset) {
        setFollowValidationError(
          json.error ||
            `Could not find a verified public ticker or real company matching "${trimmed}".`
        );
        return false;
      }

      const verifiedPreset = json.preset as CompanyPreset;
      const finalPreset: CompanyPreset = {
        ...verifiedPreset,
        sector:
          verifiedPreset.sector && verifiedPreset.sector !== 'US Listed Equity'
            ? verifiedPreset.sector
            : customSector || verifiedPreset.sector,
        label: verifiedPreset.label || customLabel || verifiedPreset.value,
      };

      const alreadyCanonical = followedCompanies.some(
        (c) =>
          c.value.toLowerCase() === finalPreset.value.toLowerCase() ||
          c.label.toLowerCase() === finalPreset.label.toLowerCase()
      );
      if (alreadyCanonical) {
        setFollowValidationError(null);
        return true;
      }

      const updated = [...followedCompanies, finalPreset].slice(
        0,
        APP_CONFIG.watchlist.maxFollowedCompanies
      );
      setFollowedCompanies(updated);
      setIsWatchlistCustomized(true);
      try {
        window.localStorage.setItem(
          FOLLOWED_STORAGE_KEY,
          JSON.stringify(updated)
        );
      } catch {
        // ignore localStorage write errors
      }

      void fetchWatchlistDigest(updated, false);

      if (currentUser) {
        try {
          await followCompanyForUser({
            label: finalPreset.label,
            entityType:
              finalPreset.entityType === 'ticker' ? 'ticker' : 'name',
            value: finalPreset.value,
            sector: finalPreset.sector,
          });
        } catch (err) {
          console.warn('Firestore follow sync skipped:', err);
        }
      }

      return true;
    } catch (err) {
      setFollowValidationError(
        err instanceof Error
          ? err.message
          : `Unable to verify "${trimmed}". Please try again.`
      );
      return false;
    } finally {
      setIsVerifyingFollow(false);
    }
  };

  /**
   * Removes a company from the user's followed watchlist and updates the
   * Watchlist News Summary & Top Movers briefing.
   */
  const handleRemoveFollowedCompany = async (valueToRemove: string) => {
    if (followedCompanies.length <= 1) return;
    const target = followedCompanies.find(
      (c) =>
        c.value.toLowerCase() === valueToRemove.toLowerCase() ||
        c.label.toLowerCase() === valueToRemove.toLowerCase()
    );
    const updated = followedCompanies.filter(
      (c) =>
        c.value.toLowerCase() !== valueToRemove.toLowerCase() &&
        c.label.toLowerCase() !== valueToRemove.toLowerCase()
    );
    setFollowedCompanies(updated);
    setIsWatchlistCustomized(true);
    try {
      window.localStorage.setItem(
        FOLLOWED_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch {
      // ignore localStorage write errors
    }

    void fetchWatchlistDigest(updated, false);

    if (currentUser && target) {
      try {
        await unfollowCompanyForUser(
          target.entityType === 'ticker' ? 'ticker' : 'name',
          target.value
        );
      } catch (err) {
        console.warn('Firestore unfollow sync skipped:', err);
      }
    }
  };

  /**
   * Resets the followed watchlist back to the default institutional companies
   * and hydrates live quotes for the active `watchlistRange`.
   */
  const handleResetDefaultWatchlist = () => {
    const defaults = [...APP_CONFIG.featuredCompanies];
    setFollowedCompanies(defaults);
    setIsWatchlistCustomized(false);
    setFollowValidationError(null);
    try {
      window.localStorage.removeItem(FOLLOWED_STORAGE_KEY);
    } catch {
      // ignore
    }
    void fetchWatchlistDigest(defaults, false);
    void hydrateFollowedWatchlistQuotes(defaults, watchlistRange, false, false);
  };

  /**
   * Hydrates missing headline sentiments and reasons on cached articles via POST /api/ai/sentiment.
   */
  const enrichMissingSentiments = useCallback(
    async (loadedArticles: EnrichedNewsArticle[]) => {
      const missing = loadedArticles.filter(
        (a) => !a.sentiment || !a.sentimentReason
      );
      if (missing.length === 0) {
        setSentimentError(null);
        return;
      }

      setIsAnalyzingSentiment(true);
      setSentimentError(null);
      try {
        const res = await fetch('/api/ai/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articles: missing.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Headline sentiment analysis failed.');
        }

        const sentimentsMap = (data.sentiments || {}) as Record<
          string,
          'Bullish' | 'Bearish' | 'Neutral'
        >;
        const reasonsMap = (data.reasons || {}) as Record<string, string>;
        setArticles((prev) =>
          prev.map((a) => ({
            ...a,
            sentiment: a.sentiment || sentimentsMap[a.id] || 'Neutral',
            sentimentReason: a.sentimentReason || reasonsMap[a.id] || null,
          }))
        );
      } catch (err) {
        setSentimentError(
          err instanceof Error
            ? err.message
            : 'Failed to analyze headline sentiment.'
        );
      } finally {
        setIsAnalyzingSentiment(false);
      }
    },
    []
  );

  /**
   * Synthesizes side-by-side Positive Catalysts, Risks & Headwinds, and Overall Assessment
   * for the currently searched company from loaded articles.
   */
  const generateBriefForArticles = useCallback(
    async (
      companyQuery: string,
      targetArticles: EnrichedNewsArticle[],
      forceRegenerate = false
    ) => {
      if (targetArticles.length === 0) {
        setAiBrief(null);
        return;
      }

      const cacheKey = `${companyQuery.trim().toLowerCase()}::${targetArticles
        .slice(0, 4)
        .map((a) => a.id)
        .join(',')}`;

      if (!forceRegenerate) {
        const cached = briefCacheRef.current.get(cacheKey);
        if (cached) {
          setBriefError(null);
          setAiBrief(cached);
          return;
        }
      }

      const seq = ++briefReqSeqRef.current;
      setIsGeneratingBrief(true);
      setBriefError(null);

      try {
        const res = await fetch('/api/ai/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyQuery,
            articles: targetArticles.map((a) => ({
              title: a.title,
              description: a.description,
              sourceName: a.source?.name || a.source?.domain || 'Publisher',
              publishedAt: a.published_at,
              type: a.type,
            })),
          }),
        });
        const data = await res.json();
        if (seq !== briefReqSeqRef.current) return;
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to synthesize AI brief.');
        }
        const brief = data.brief as AIMarketBriefResponse;
        briefCacheRef.current.set(cacheKey, brief);
        setAiBrief(brief);
      } catch (err) {
        if (seq !== briefReqSeqRef.current) return;
        setBriefError(
          err instanceof Error ? err.message : 'Error generating AI brief.'
        );
      } finally {
        if (seq === briefReqSeqRef.current) {
          setIsGeneratingBrief(false);
        }
      }
    },
    []
  );

  /**
   * Loads price chart history and key investment metrics for the searched company.
   */
  const fetchMarketOverview = useCallback(
    async (
      query: string,
      entityType: 'auto' | 'name' | 'ticker',
      range: ChartRange
    ) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setIsLoadingMarket(true);
      setMarketError(null);
      try {
        const params = new URLSearchParams({
          query: trimmed,
          entityType,
          range,
        });
        const res = await fetch(`/api/market/overview?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.ok || !data.overview) {
          throw new Error(data.error || 'Failed to load company market metrics.');
        }
        setMarketData(data.overview as CompanyMarketOverviewData);
      } catch (err) {
        setMarketError(
          err instanceof Error
            ? err.message
            : 'Unable to retrieve market data.'
        );
      } finally {
        setIsLoadingMarket(false);
      }
    },
    []
  );

  /**
   * Loads related company search suggestions grouped by relationship
   * (`Suppliers`, `Customers`, `Peers & Competitors`, `Strategic Partners`).
   */
  const fetchRelatedCompanies = useCallback(
    async (query: string, forceRefresh = false) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      const cacheKey = trimmed.toLowerCase();
      if (!forceRefresh) {
        const cached = relatedCacheRef.current.get(cacheKey);
        if (cached) {
          setRelatedError(null);
          setRelatedData(cached);
          setIsLoadingRelated(false);
          return;
        }
      }

      const seq = ++relatedReqSeqRef.current;
      setIsLoadingRelated(true);
      setRelatedError(null);

      try {
        const params = new URLSearchParams({ query: trimmed });
        if (forceRefresh) {
          params.set('refresh', '1');
        }
        const res = await fetch(`/api/ai/related?${params.toString()}`);
        const json = await res.json();
        if (seq !== relatedReqSeqRef.current) return;
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(
            json.error || 'Failed to load related company suggestions.'
          );
        }
        const payload = json.data as RelatedCompaniesResponse;
        relatedCacheRef.current.set(cacheKey, payload);
        setRelatedData(payload);
      } catch (err) {
        if (seq !== relatedReqSeqRef.current) return;
        setRelatedError(
          err instanceof Error
            ? err.message
            : 'Unable to retrieve related companies.'
        );
      } finally {
        if (seq === relatedReqSeqRef.current) {
          setIsLoadingRelated(false);
        }
      }
    },
    []
  );

  /**
   * Loads the top-match corporate profile (firmographics, website/socials,
   * industries, and funding history) via GET /api/company/profile.
   */
  const fetchCompanyProfile = useCallback(
    async (
      query: string,
      entityType: 'auto' | 'name' | 'ticker',
      companyNameHint?: string,
      forceRefresh = false
    ) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      const cacheKey = `${entityType}::${trimmed.toLowerCase()}`;
      if (!forceRefresh && profileCacheRef.current.has(cacheKey)) {
        setProfileError(null);
        setCompanyProfile(profileCacheRef.current.get(cacheKey) ?? null);
        setIsLoadingProfile(false);
        return;
      }

      const seq = ++profileReqSeqRef.current;
      setIsLoadingProfile(true);
      setProfileError(null);

      try {
        const params = new URLSearchParams({
          query: trimmed,
          entityType,
        });
        if (companyNameHint && companyNameHint.trim()) {
          params.set('companyNameHint', companyNameHint.trim());
        }
        if (forceRefresh) {
          params.set('refresh', '1');
        }

        const res = await fetch(`/api/company/profile?${params.toString()}`);
        const json = await res.json();
        if (seq !== profileReqSeqRef.current) return;
        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'Failed to load company profile.');
        }

        const resolvedProfile = (json.profile as CompanyProfileData) ?? null;
        profileCacheRef.current.set(cacheKey, resolvedProfile);
        setCompanyProfile(resolvedProfile);
      } catch (err) {
        if (seq !== profileReqSeqRef.current) return;
        setProfileError(
          err instanceof Error
            ? err.message
            : 'Unable to retrieve company profile.'
        );
      } finally {
        if (seq === profileReqSeqRef.current) {
          setIsLoadingProfile(false);
        }
      }
    },
    []
  );

  /**
   * Fast chart-only refresh when switching timeframe tabs (1D, 5D, 1M, 6M, YTD, 1Y, 5Y).
   */
  const handleChartRangeChange = async (nextRange: ChartRange) => {
    setChartRange(nextRange);
    if (!marketData || marketData.kind !== 'public') {
      return;
    }

    setIsLoadingChart(true);
    try {
      const params = new URLSearchParams({
        symbol: marketData.symbol,
        range: nextRange,
        chartOnly: '1',
      });
      const res = await fetch(`/api/market/overview?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.points)) {
        setMarketData((prev) => {
          if (!prev || prev.kind !== 'public') return prev;
          return {
            ...prev,
            range: nextRange,
            price: typeof data.price === 'number' ? data.price : prev.price,
            previousClose:
              typeof data.previousClose === 'number'
                ? data.previousClose
                : prev.previousClose,
            change: typeof data.change === 'number' ? data.change : prev.change,
            changePercent:
              typeof data.changePercent === 'number'
                ? data.changePercent
                : prev.changePercent,
            points: data.points as PriceChartPoint[],
          };
        });
      }
    } catch (err) {
      console.warn('Chart range refresh error:', err);
    } finally {
      setIsLoadingChart(false);
    }
  };

  /**
   * Executes a company news search for a specific page cursor, checking the
   * Firestore `cached_searches` collection first (unless `forceRefresh` is true),
   * and persisting fresh responses back to Firestore.
   */
  const executeSearchForCursor = useCallback(
    async (
      stateSnapshot: NewsSearchControlState,
      targetCursor: string | null,
      pageIdx: number,
      forceRefresh = false,
      activeExchange: string | null = null,
      lockedEntityType: 'name' | 'ticker' | null = null
    ) => {
      logFunctionCall('InvestorDashboardPage.executeSearchForCursor', {
        entityType: stateSnapshot.entityType,
        entityValue: stateSnapshot.entityValue,
        sortBy: stateSnapshot.sortBy,
        targetCursor,
        pageIdx,
        forceRefresh,
      });

      setIsLoadingNews(true);
      const { dateFrom, dateTo } = resolveDateBounds(stateSnapshot);

      const filterValue =
        stateSnapshot.filterCategory === 'articleType'
          ? stateSnapshot.selectedArticleType
          : stateSnapshot.filterCategory === 'articleLanguage'
            ? stateSnapshot.selectedLanguage
            : stateSnapshot.filterCategory === 'sourceCountry'
              ? stateSnapshot.selectedCountry
              : stateSnapshot.filterCategory === 'sourceDomain'
                ? stateSnapshot.sourceDomainInput
                : 'all';

      const requestEntityType =
        targetCursor && lockedEntityType
          ? lockedEntityType
          : stateSnapshot.entityType;

      const cacheId = buildSearchCacheId({
        entityType: requestEntityType,
        entityValue: stateSnapshot.entityValue,
        exchange:
          requestEntityType === 'ticker'
            ? activeExchange || 'us_all'
            : requestEntityType === 'auto'
              ? activeExchange || 'auto'
              : undefined,
        sortBy: stateSnapshot.sortBy,
        dateFrom: stateSnapshot.datePreset === 'custom' ? dateFrom : undefined,
        dateTo: stateSnapshot.datePreset === 'custom' ? dateTo : undefined,
        filterCategory: stateSnapshot.filterCategory,
        filterValue: `${stateSnapshot.datePreset}_${filterValue}`,
        limit: stateSnapshot.limit,
        cursor: targetCursor,
      });

      // 1. Check Firestore cache first unless bypassed
      if (!forceRefresh) {
        try {
          const cached = await getCachedNewsSearch(cacheId);
          if (cached && cached.articlesJson) {
            const parsedArticles = JSON.parse(
              cached.articlesJson
            ) as EnrichedNewsArticle[];
            setArticles(parsedArticles);
            setNextCursor(cached.nextCursor || null);
            setHasMore(Boolean(cached.hasMore));
            if (cached.entityType === 'name' || cached.entityType === 'ticker') {
              setResolvedEntityType(cached.entityType);
            }
            setIsLoadingNews(false);
            void enrichMissingSentiments(parsedArticles);
            if (pageIdx === 0) {
              void generateBriefForArticles(
                stateSnapshot.entityValue,
                parsedArticles,
                forceRefresh
              );
            }
            return;
          }
        } catch (cacheReadErr) {
          console.warn(
            'Firestore cache lookup skipped or unavailable:',
            cacheReadErr
          );
        }
      }

      // 2. Fetch from Server API Route (/api/news/search -> Context.dev SDK)
      try {
        setSentimentError(null);
        const res = await fetch('/api/news/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: requestEntityType,
            entityValue: stateSnapshot.entityValue,
            exchange:
              requestEntityType !== 'name' && activeExchange
                ? activeExchange
                : undefined,
            dateFrom,
            dateTo,
            filterCategory: stateSnapshot.filterCategory,
            articleTypes:
              stateSnapshot.filterCategory === 'articleType'
                ? [stateSnapshot.selectedArticleType]
                : undefined,
            articleLanguages:
              stateSnapshot.filterCategory === 'articleLanguage'
                ? [stateSnapshot.selectedLanguage]
                : undefined,
            sourceCountries:
              stateSnapshot.filterCategory === 'sourceCountry'
                ? [stateSnapshot.selectedCountry]
                : undefined,
            sourceDomains:
              stateSnapshot.filterCategory === 'sourceDomain' &&
              stateSnapshot.sourceDomainInput.trim()
                ? [stateSnapshot.sourceDomainInput.trim()]
                : undefined,
            sortBy: stateSnapshot.sortBy,
            limit: stateSnapshot.limit,
            cursor: targetCursor,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to search company news.');
        }

        const effectiveResolvedType: 'name' | 'ticker' =
          data.resolvedEntityType === 'ticker' ? 'ticker' : 'name';

        if (!targetCursor) {
          setResolvedEntityType(effectiveResolvedType);
          setResolvedExchange(data.resolvedExchange || null);
        }

        const sdkResponse = data.response as NewsSearchResponse;
        const enrichedArticles = (sdkResponse.data || []) as EnrichedNewsArticle[];
        setArticles(enrichedArticles);
        setNextCursor(sdkResponse.next_cursor ?? null);
        setHasMore(Boolean(sdkResponse.has_more));
        setSentimentError(data.sentimentError || null);

        if (pageIdx === 0) {
          void generateBriefForArticles(
            stateSnapshot.entityValue,
            enrichedArticles,
            forceRefresh
          );
        }

        // 3. Cache the page in Firestore (/cached_searches/{cacheId})
        try {
          await saveCachedNewsSearch({
            cacheKey: cacheId,
            entityType: effectiveResolvedType,
            entityValue: stateSnapshot.entityValue,
            sortBy: stateSnapshot.sortBy,
            cursorKey: targetCursor || 'page1',
            articlesJson: JSON.stringify(sdkResponse.data || []),
            nextCursor: sdkResponse.next_cursor || '',
            hasMore: Boolean(sdkResponse.has_more),
            articleCount: (sdkResponse.data || []).length,
            requestId: sdkResponse.request_id || 'ctx_req',
            cachedAtMs: Date.now(),
          });
        } catch (cacheWriteErr) {
          console.warn('Firestore cache write warning:', cacheWriteErr);
        }
      } catch (err) {
        console.error('Error searching company news:', err);
      } finally {
        setIsLoadingNews(false);
      }
    },
    [enrichMissingSentiments, generateBriefForArticles]
  );

  // Trigger initial search, market overview, company profile, and related companies on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void executeSearchForCursor(searchState, null, 0, false);
      void fetchMarketOverview(
        searchState.entityValue,
        searchState.entityType,
        chartRange
      );
      void fetchCompanyProfile(
        searchState.entityValue,
        searchState.entityType,
        undefined,
        false
      );
      void fetchRelatedCompanies(searchState.entityValue, false);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Hydrates side-by-side dossiers (market series, Context.dev profile, news pulse,
   * and executive AI comparative takeaway) for the selected cohort companies.
   */
  const hydrateSelectedCohort = useCallback(
    async (
      candidatesList: ScreenedCandidateItem[],
      targetSelectedIds: string[],
      range: ChartRange,
      theme: string,
      chartOnly = false
    ) => {
      const byId = new Map<string, ScreenedCandidateItem>();
      for (const c of candidatesList) {
        byId.set(c.id, c);
      }

      const items: CohortCompareRequestItem[] = targetSelectedIds
        .map((id) => byId.get(id))
        .filter((c): c is ScreenedCandidateItem => Boolean(c))
        .slice(0, APP_CONFIG.cohortScreener.maxCompareColumns)
        .map((c) => ({
          id: c.id,
          searchQuery: c.searchQuery,
          name: c.name,
          entityType: c.entityType,
          kind: c.kind,
        }));

      if (items.length === 0) {
        if (!chartOnly) {
          setComparativeSummary(null);
        }
        return;
      }

      const seq = ++cohortCompareSeqRef.current;
      setIsHydratingComparison(true);

      try {
        const res = await fetch('/api/screener/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            range,
            theme,
            chartOnly,
          }),
        });
        const json = await res.json();
        if (seq !== cohortCompareSeqRef.current) return;
        if (!res.ok || !json.ok || !json.comparison) {
          throw new Error(
            json.error || 'Failed to hydrate side-by-side company comparison.'
          );
        }

        const comparison = json.comparison as CohortCompareResponse;
        setCohortDossiersById((prev) => {
          const next = { ...prev };
          for (const [id, dossier] of Object.entries(
            comparison.dossiersById || {}
          )) {
            const existing = prev[id];
            next[id] = chartOnly
              ? {
                  id,
                  market: dossier.market ?? existing?.market ?? null,
                  profile: existing?.profile ?? null,
                  newsPulse: existing?.newsPulse ?? null,
                }
              : {
                  id,
                  market: dossier.market ?? existing?.market ?? null,
                  profile: dossier.profile ?? existing?.profile ?? null,
                  newsPulse: dossier.newsPulse ?? existing?.newsPulse ?? null,
                };
          }
          return next;
        });

        if (!chartOnly) {
          setComparativeSummary(comparison.comparativeSummary ?? null);
        }
      } catch (err) {
        console.warn('Cohort comparison hydration warning:', err);
      } finally {
        if (seq === cohortCompareSeqRef.current) {
          setIsHydratingComparison(false);
        }
      }
    },
    []
  );

  /**
   * Executes a natural-language cohort screen (`POST /api/screener/query`),
   * pre-selects the top 3 verified matches, seeds initial market data immediately,
   * and triggers full comparison dossier hydration.
   */
  const runCohortScreen = useCallback(
    async (rawQuery: string, forceRefresh = false) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) return;

      logFunctionCall('InvestorDashboardPage.runCohortScreen', {
        query: trimmed,
        forceRefresh,
      });

      const seq = ++cohortScreenSeqRef.current;
      setWorkspaceMode('cohort');
      setActiveCohortQuery(trimmed);
      setIsScreeningCohort(true);
      setCohortError(null);
      setCustomCompareError(null);
      if (forceRefresh) {
        setComparativeSummary(null);
      }

      try {
        const res = await fetch('/api/screener/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            range: cohortRange,
            forceRefresh,
          }),
        });
        const json = await res.json();
        if (seq !== cohortScreenSeqRef.current) return;
        if (!res.ok || !json.ok || !json.result) {
          throw new Error(
            json.error || 'Failed to screen matching companies.'
          );
        }

        const result = json.result as CohortScreenResponse;
        setCohortScreen(result);
        setSelectedCohortIds(result.preselectedIds);

        // Immediately seed initial market & chart series so chart + multiples render right away
        const seededDossiers: Record<string, ComparedCompanyDossier> = {};
        for (const [id, mkt] of Object.entries(
          result.initialMarketById || {}
        )) {
          seededDossiers[id] = {
            id,
            market: mkt,
            profile: null,
            newsPulse: null,
          };
        }
        setCohortDossiersById(seededDossiers);
        setComparativeSummary(null);

        void hydrateSelectedCohort(
          result.candidates,
          result.preselectedIds,
          cohortRange,
          result.interpretedTheme,
          false
        );
      } catch (err) {
        if (seq !== cohortScreenSeqRef.current) return;
        setCohortError(
          err instanceof Error
            ? err.message
            : 'Unable to complete natural-language cohort screen.'
        );
      } finally {
        if (seq === cohortScreenSeqRef.current) {
          setIsScreeningCohort(false);
        }
      }
    },
    [cohortRange, hydrateSelectedCohort]
  );

  /**
   * Toggles a candidate checkbox in the Cohort Comparison Workspace (up to 4 max).
   */
  const handleToggleCohortCandidate = (id: string) => {
    if (!cohortScreen) return;
    const isAlreadySelected = selectedCohortIds.includes(id);
    let nextSelected: string[];

    if (isAlreadySelected) {
      nextSelected = selectedCohortIds.filter((x) => x !== id);
    } else {
      if (
        selectedCohortIds.length >=
        APP_CONFIG.cohortScreener.maxCompareColumns
      ) {
        return;
      }
      nextSelected = [...selectedCohortIds, id];
    }

    setSelectedCohortIds(nextSelected);
    void hydrateSelectedCohort(
      cohortScreen.candidates,
      nextSelected,
      cohortRange,
      cohortScreen.interpretedTheme,
      false
    );
  };

  /**
   * Switches timeframe (`1D`..`5Y`) on the Normalized Multi-Stock `%` Price Chart Overlay.
   */
  const handleCohortRangeChange = (nextRange: ChartRange) => {
    setCohortRange(nextRange);
    if (!cohortScreen || selectedCohortIds.length === 0) return;
    void hydrateSelectedCohort(
      cohortScreen.candidates,
      selectedCohortIds,
      nextRange,
      cohortScreen.interpretedTheme,
      true
    );
  };

  /**
   * Appends any custom public ticker or private unicorn into the active Cohort Comparison.
   */
  const handleAddCustomCompareCompany = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed || !cohortScreen) return;

    setIsAddingCustomCompare(true);
    setCustomCompareError(null);

    try {
      // Verify that the custom comparison input corresponds to a real company/ticker first
      const verifyRes = await fetch('/api/market/watchlist-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          query: trimmed,
          range: '1M',
        }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.valid || !verifyJson.preset) {
        throw new Error(
          verifyJson.error ||
            `Could not find a verified company or ticker matching "${trimmed}".`
        );
      }

      const verifiedPreset = verifyJson.preset as CompanyPreset;
      const params = new URLSearchParams({
        query: verifiedPreset.value,
        entityType: verifiedPreset.entityType === 'ticker' ? 'ticker' : 'name',
        range: cohortRange,
      });
      const res = await fetch(`/api/market/overview?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok || !json.overview) {
        throw new Error(
          json.error || `Could not resolve "${trimmed}" for comparison.`
        );
      }

      const overview = json.overview as CompanyMarketOverviewData;
      const ticker = overview.kind === 'public' ? overview.symbol : null;
      const name = overview.companyName || trimmed;
      const id =
        overview.kind === 'public' && ticker
          ? `ticker:${ticker.toLowerCase()}`
          : `name:${name.toLowerCase()}`;

      const valDisplay =
        overview.kind === 'public'
          ? overview.metrics.marketCap
          : overview.latestValuation || overview.totalFunding;
      const valUsd = parseCompactUsdString(valDisplay);

      let passesThreshold = true;
      if (cohortScreen.minThresholdUsd !== null) {
        passesThreshold =
          valUsd !== null ? valUsd >= cohortScreen.minThresholdUsd : false;
      }
      if (passesThreshold && cohortScreen.maxThresholdUsd !== null) {
        passesThreshold =
          valUsd !== null ? valUsd <= cohortScreen.maxThresholdUsd : false;
      }

      const newCandidate: ScreenedCandidateItem = {
        id,
        name,
        ticker,
        searchQuery: ticker || name,
        entityType: ticker ? 'ticker' : 'name',
        kind: overview.kind,
        sector: overview.sector,
        valuationUsd: valUsd,
        valuationDisplay: valDisplay || 'Unlisted',
        passesThreshold,
        matchReason: 'Custom peer added for side-by-side comparison.',
      };

      const existsInCandidates = cohortScreen.candidates.some(
        (c) => c.id === id
      );
      const updatedCandidates = existsInCandidates
        ? cohortScreen.candidates
        : [...cohortScreen.candidates, newCandidate];

      const maxCols = APP_CONFIG.cohortScreener.maxCompareColumns;
      let nextSelected = selectedCohortIds.includes(id)
        ? selectedCohortIds
        : [...selectedCohortIds, id];

      if (nextSelected.length > maxCols) {
        nextSelected = [
          ...selectedCohortIds.slice(0, maxCols - 1),
          id,
        ];
      }

      const updatedScreen: CohortScreenResponse = {
        ...cohortScreen,
        candidates: updatedCandidates,
        initialMarketById: {
          ...cohortScreen.initialMarketById,
          [id]: overview,
        },
      };

      setCohortScreen(updatedScreen);
      setSelectedCohortIds(nextSelected);
      setCohortDossiersById((prev) => ({
        ...prev,
        [id]: {
          id,
          market: overview,
          profile: prev[id]?.profile ?? null,
          newsPulse: prev[id]?.newsPulse ?? null,
        },
      }));

      void hydrateSelectedCohort(
        updatedCandidates,
        nextSelected,
        cohortRange,
        updatedScreen.interpretedTheme,
        false
      );
    } catch (err) {
      setCustomCompareError(
        err instanceof Error
          ? err.message
          : 'Unable to add company to comparison.'
      );
    } finally {
      setIsAddingCustomCompare(false);
    }
  };

  /**
   * Updates search controls and immediately triggers a fresh Page 1 lookup
   * when key single-company parameters (`sortBy`, `datePreset`, `limit`, `filterCategory`) change.
   */
  const handleUpdateSearchControls = (
    updated: Partial<NewsSearchControlState>
  ) => {
    const nextState = { ...searchState, ...updated };
    setSearchState(nextState);

    const immediateTriggerKeys: Array<keyof NewsSearchControlState> = [
      'sortBy',
      'datePreset',
      'limit',
      'filterCategory',
      'selectedArticleType',
      'selectedLanguage',
      'selectedCountry',
    ];

    const shouldAutoSearch =
      workspaceMode === 'single' &&
      Object.keys(updated).some((k) =>
        immediateTriggerKeys.includes(k as keyof NewsSearchControlState)
      );

    if (shouldAutoSearch) {
      setCursorStack([null]);
      setCurrentPageIndex(0);
      setResolvedExchange(null);
      setAiBrief(null);
      executeSearchForCursor(nextState, null, 0, false, null, null);
    }
  };

  /**
   * Executes a single-company deep dive for a given search state snapshot.
   */
  const runSingleCompanySearch = (
    targetState: NewsSearchControlState,
    forceRefresh = false
  ) => {
    setWorkspaceMode('single');
    setCursorStack([null]);
    setCurrentPageIndex(0);
    setResolvedExchange(null);
    setAiBrief(null);
    setSentimentFilter('all');
    executeSearchForCursor(targetState, null, 0, forceRefresh, null, null);
    void fetchMarketOverview(
      targetState.entityValue,
      targetState.entityType,
      chartRange
    );
    void fetchCompanyProfile(
      targetState.entityValue,
      targetState.entityType,
      undefined,
      forceRefresh
    );
    void fetchRelatedCompanies(targetState.entityValue, forceRefresh);
  };

  /**
   * Auto-detects whether the user entered a natural-language screening query
   * vs. a single company/ticker and routes accordingly.
   */
  const handleRunSearch = (forceRefresh = false) => {
    const intent = detectSearchQueryIntent(searchState.entityValue);
    if (intent === 'cohort') {
      void runCohortScreen(searchState.entityValue, forceRefresh);
      return;
    }
    runSingleCompanySearch(searchState, forceRefresh);
  };

  /**
   * Runs one of the clickable sample natural-language cohort screening queries.
   */
  const handleRunSampleNaturalQuery = (sampleQuery: string) => {
    setSearchState((prev) => ({
      ...prev,
      entityType: 'auto',
      entityValue: sampleQuery,
    }));
    void runCohortScreen(sampleQuery, false);
    const researchEl = document.getElementById('company-research');
    if (researchEl) {
      researchEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /**
   * Explicit user override to switch between Single-Company and Cohort Comparison modes.
   */
  const handleForceWorkspaceMode = (nextMode: SearchWorkspaceMode) => {
    const trimmed = searchState.entityValue.trim();
    if (!trimmed) {
      setWorkspaceMode(nextMode);
      return;
    }
    if (nextMode === 'cohort') {
      void runCohortScreen(trimmed, false);
    } else {
      const fallbackTarget =
        detectSearchQueryIntent(trimmed) === 'cohort' &&
        cohortScreen?.candidates[0]
          ? {
              ...searchState,
              entityType: cohortScreen.candidates[0].entityType,
              entityValue: cohortScreen.candidates[0].searchQuery,
            }
          : searchState;
      setSearchState(fallbackTarget);
      runSingleCompanySearch(fallbackTarget, false);
    }
  };

  /**
   * Pivots the deep-dive company research view when a user clicks a company
   * inside the Watchlist Landing Brief, Watchlist Carousel, or Cohort Comparison Matrix.
   */
  const handleSelectCompanyFromBrief = (
    companyValue: string,
    entityType: 'name' | 'ticker'
  ) => {
    setWorkspaceMode('single');
    const nextState: NewsSearchControlState = {
      ...searchState,
      entityType,
      entityValue: companyValue,
    };
    setSearchState(nextState);
    setCursorStack([null]);
    setCurrentPageIndex(0);
    setResolvedEntityType(entityType);
    setResolvedExchange(null);
    setAiBrief(null);
    setSentimentFilter('all');
    executeSearchForCursor(nextState, null, 0, false, null, null);
    void fetchMarketOverview(companyValue, entityType, chartRange);
    void fetchCompanyProfile(companyValue, entityType, undefined, false);
    void fetchRelatedCompanies(companyValue, false);

    const researchEl = document.getElementById('company-research');
    if (researchEl) {
      researchEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  /**
   * Handles selecting a preset equity or entity from the top watchlist carousel.
   */
  const handleSelectPreset = (preset: CompanyPreset) => {
    const presetType = preset.entityType === 'ticker' ? 'ticker' : 'name';
    handleSelectCompanyFromBrief(preset.value, presetType);
  };

  /**
   * Handles clicking a suggested related company across any relationship group,
   * pivoting search coverage across news, price chart, AI brief, and ecosystem.
   */
  const handleSelectRelatedCompany = (company: RelatedCompanyItem) => {
    setWorkspaceMode('single');
    const nextState: NewsSearchControlState = {
      ...searchState,
      entityType: company.entityType,
      entityValue: company.searchQuery,
    };
    setSearchState(nextState);
    setCursorStack([null]);
    setCurrentPageIndex(0);
    setResolvedEntityType(company.entityType);
    setResolvedExchange(null);
    setAiBrief(null);
    setSentimentFilter('all');
    executeSearchForCursor(nextState, null, 0, false, null, null);
    void fetchMarketOverview(
      company.searchQuery,
      company.entityType,
      chartRange
    );
    void fetchCompanyProfile(
      company.searchQuery,
      company.entityType,
      company.name,
      false
    );
    void fetchRelatedCompanies(company.searchQuery, false);
  };

  /**
   * Advances to the Next Page using `next_cursor` while keeping `searchBy`, `filterBy`,
   * and `sortBy` locked.
   */
  const handleNextPage = () => {
    if (!hasMore || !nextCursor) return;
    const nextIndex = currentPageIndex + 1;
    const updatedStack = [...cursorStack.slice(0, nextIndex), nextCursor];
    setCursorStack(updatedStack);
    setCurrentPageIndex(nextIndex);
    executeSearchForCursor(
      searchState,
      nextCursor,
      nextIndex,
      false,
      resolvedExchange,
      resolvedEntityType
    );
  };

  /**
   * Navigates back to the Previous Page using the stored cursor in `cursorStack`.
   */
  const handlePreviousPage = () => {
    if (currentPageIndex <= 0) return;
    const prevIndex = currentPageIndex - 1;
    const prevCursor = cursorStack[prevIndex] ?? null;
    setCurrentPageIndex(prevIndex);
    executeSearchForCursor(
      searchState,
      prevCursor,
      prevIndex,
      false,
      resolvedExchange,
      resolvedEntityType
    );
  };

  /**
   * Manually refreshes the AI Investment Assessment (Catalysts, Risks & Overall Verdict).
   */
  const handleGenerateAIBrief = async () => {
    await generateBriefForArticles(searchState.entityValue, articles, true);
  };

  /**
   * Handles Google Sign-In / Sign-Out toggle from the top navbar.
   */
  const handleAuthAction = async () => {
    try {
      if (currentUser) {
        await signOutUser();
      } else {
        await signInWithGoogle();
      }
    } catch (err) {
      console.error('Authentication action error:', err);
    }
  };

  /**
   * Saves an article from the NewsFeedTable to the user's Firestore `/saved_articles` collection,
   * prompting Google Sign-In if not yet authenticated.
   */
  const handleBookmarkArticle = async (article: NewsSearchResponse.Data) => {
    try {
      let activeUser = currentUser;
      if (!activeUser) {
        const cred = await signInWithGoogle();
        activeUser = cred.user;
      }
      if (!activeUser) return;

      await saveArticleForUser({
        articleId: article.id,
        userId: activeUser.uid,
        title: article.title,
        url: article.url,
        sourceName: article.source?.name || 'News Source',
        sourceDomain: article.source?.domain || 'News Wire',
        publishedAt: article.published_at || new Date().toISOString(),
        articleType: article.type,
        companyTag: searchState.entityValue.toUpperCase(),
        description: article.description || '',
      });

      const updatedList = await listUserSavedArticles(activeUser.uid);
      setSavedArticles(updatedList);
    } catch (err) {
      console.error('Failed to save article to Firestore:', err);
    }
  };

  /**
   * Saves a top Bullish/Bearish mover article from the WatchlistLandingBrief
   * to the user's Firestore `/saved_articles` collection.
   */
  const handleBookmarkMoverArticle = async (mover: WatchlistMoverArticle) => {
    try {
      let activeUser = currentUser;
      if (!activeUser) {
        const cred = await signInWithGoogle();
        activeUser = cred.user;
      }
      if (!activeUser) return;

      await saveArticleForUser({
        articleId: mover.id,
        userId: activeUser.uid,
        title: mover.title,
        url: mover.url,
        sourceName: mover.sourceName || 'News Source',
        sourceDomain: mover.sourceDomain || 'News Wire',
        publishedAt: mover.publishedAt || new Date().toISOString(),
        articleType: mover.articleType || 'editorial',
        companyTag: mover.companyValue.toUpperCase(),
        description: mover.description || mover.rationale || '',
      });

      const updatedList = await listUserSavedArticles(activeUser.uid);
      setSavedArticles(updatedList);
    } catch (err) {
      console.error('Failed to save watchlist mover article:', err);
    }
  };

  /**
   * Removes a bookmarked article from Firestore `/saved_articles`.
   */
  const handleRemoveSavedArticle = async (docId: string) => {
    if (!currentUser) return;
    try {
      await removeSavedArticle(docId);
      const updatedList = await listUserSavedArticles(currentUser.uid);
      setSavedArticles(updatedList);
    } catch (err) {
      console.error('Failed to delete saved article:', err);
    }
  };

  // Bind Cmd/Ctrl + K keyboard shortcut to toggle the Research Assistant Drawer
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  // Build fresh live workspace context snapshot for the Research Assistant Drawer
  const activeResearchContext = useMemo(
    () =>
      buildWorkspaceResearchContext({
        workspaceMode,
        searchedQuery: searchState.entityValue,
        marketData,
        chartRange,
        companyProfile,
        aiBrief,
        relatedData,
        articles,
        cohortQuery: activeCohortQuery || searchState.entityValue,
        cohortScreen,
        selectedCohortIds,
        cohortDossiersById,
        cohortRange,
        comparativeSummary,
        followedCompanies,
        watchlistDigest,
      }),
    [
      workspaceMode,
      searchState.entityValue,
      marketData,
      chartRange,
      companyProfile,
      aiBrief,
      relatedData,
      articles,
      activeCohortQuery,
      cohortScreen,
      selectedCohortIds,
      cohortDossiersById,
      cohortRange,
      comparativeSummary,
      followedCompanies,
      watchlistDigest,
    ]
  );

  /**
   * Sends a question to `POST /api/ai/chat` along with the active workspace
   * context snapshot and bounded multi-turn conversation history.
   */
  const handleSendResearchChatMessage = async (
    question: string,
    isRetry = false
  ) => {
    const trimmed = question.trim();
    if (!trimmed || isSendingChat) return;

    logFunctionCall('InvestorDashboardPage.handleSendResearchChatMessage', {
      workspaceMode,
      contextShortLabel: activeResearchContext.contextShortLabel,
      isRetry,
    });

    const userMsg: ResearchChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      contextLabel: activeResearchContext.contextShortLabel,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = isRetry ? chatMessages : [...chatMessages, userMsg];
    if (!isRetry) {
      setChatMessages(nextMessages);
    }

    setIsSendingChat(true);
    setChatError(null);

    const historyTurns: ResearchChatTurnInput[] = nextMessages
      .slice(-APP_CONFIG.researchChat.maxHistoryMessages)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyTurns,
          context: activeResearchContext,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.reply) {
        throw new Error(
          json.error || 'Failed to generate Research Assistant response.'
        );
      }

      const reply = json.reply as ResearchChatReplyPayload;
      const assistantMsg: ResearchChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply.content,
        contextLabel: activeResearchContext.contextShortLabel,
        citations: reply.citations,
        createdAt: reply.generatedAt || new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
      setLastFailedChatQuestion(null);
    } catch (err) {
      setLastFailedChatQuestion(trimmed);
      setChatError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Research Assistant. Please retry.'
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  /**
   * Retries the most recent failed Research Assistant question without duplicating the user turn.
   */
  const handleRetryLastChatQuestion = async () => {
    const fallbackLastUser =
      lastFailedChatQuestion ||
      [...chatMessages].reverse().find((m) => m.role === 'user')?.content ||
      null;
    if (!fallbackLastUser) return;
    await handleSendResearchChatMessage(fallbackLastUser, true);
  };

  /**
   * Clears the continuous Research Assistant conversation thread.
   */
  const handleClearResearchChat = () => {
    setChatMessages([]);
    setChatError(null);
    setLastFailedChatQuestion(null);
  };

  const savedArticleIds = new Set(savedArticles.map((s) => s.articleId));
  const followedValuesLower = new Set<string>(
    followedCompanies.flatMap((c) => [
      c.value.trim().toLowerCase(),
      c.label.trim().toLowerCase(),
    ])
  );
  const isCurrentCompanyFollowed = followedCompanies.some(
    (c) =>
      c.value.toLowerCase() === searchState.entityValue.trim().toLowerCase() ||
      c.label.toLowerCase() === searchState.entityValue.trim().toLowerCase()
  );

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#091326] text-white ${
        isChatOpen ? 'xl:pr-[440px]' : ''
      }`}
    >
      {/* 3-Zone Top Bar */}
      <TopNavbar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        userEmail={currentUser?.email ?? null}
        onAuthAction={handleAuthAction}
      />

      {/* Main 1440px Quantitative Workspace Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8">
        {/* Followed Companies Watchlist Strip with Follow / Unfollow Controls */}
        <WatchlistCarousel
          companies={followedCompanies}
          activeValue={workspaceMode === 'single' ? searchState.entityValue : ''}
          activeEntityType={searchState.entityType}
          sparklineRange={watchlistRange}
          onSparklineRangeChange={handleWatchlistRangeChange}
          isHydratingQuotes={isHydratingWatchlistQuotes}
          onSelectPreset={handleSelectPreset}
          onAddCompany={(rawInput) => handleAddFollowedCompany(rawInput)}
          isAddingCompany={isVerifyingFollow}
          followError={followValidationError}
          onClearFollowError={() => setFollowValidationError(null)}
          onRemoveCompany={(val) => void handleRemoveFollowedCompany(val)}
          onResetDefaults={handleResetDefaultWatchlist}
          isCustomized={isWatchlistCustomized}
        />

        {/* LANDING DASHBOARD HERO: Watchlist Cross-Company News Summary & Top Bullish/Bearish Signals */}
        <WatchlistLandingBrief
          digest={watchlistDigest}
          followedCount={followedCompanies.length}
          isLoading={isLoadingWatchlistDigest}
          error={watchlistDigestError}
          onRefresh={() => void fetchWatchlistDigest(followedCompanies, true)}
          onSelectCompany={handleSelectCompanyFromBrief}
          onBookmarkArticle={handleBookmarkMoverArticle}
          savedArticleIds={savedArticleIds}
        />

        {/* Research & Screening Section Divider */}
        <div
          id="company-research"
          className="mb-6 pt-4 flex flex-col gap-3 pb-5 border-b border-[#212c42]"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#49afe9] mb-1">
                {workspaceMode === 'cohort'
                  ? 'Natural-Language Cohort Screening · Normalized % Chart · Side-by-Side Comparison'
                  : 'Single-Company Deep Dive · Price Chart & Metrics · Supply Chain & Peer Ecosystem'}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white text-balance">
                {workspaceMode === 'cohort' ? (
                  <>
                    Cohort Comparison Desk:{' '}
                    <span className="text-[#49afe9]">
                      {activeCohortQuery || searchState.entityValue}
                    </span>
                  </>
                ) : (
                  <>
                    Company Research Terminal:{' '}
                    <span className="text-[#49afe9]">
                      {searchState.entityValue}
                    </span>
                  </>
                )}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {workspaceMode === 'single' && (
                <>
                  <button
                    type="button"
                    disabled={isVerifyingFollow}
                    onClick={() => {
                      if (isCurrentCompanyFollowed) {
                        void handleRemoveFollowedCompany(
                          searchState.entityValue.trim()
                        );
                      } else {
                        const label =
                          marketData?.companyName ||
                          searchState.entityValue.trim();
                        const sector = marketData?.sector || undefined;
                        void handleAddFollowedCompany(
                          searchState.entityValue.trim(),
                          label,
                          sector
                        );
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
                      isCurrentCompanyFollowed
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-[#102344] text-[#49afe9] border-[#09a4ff]/40 hover:bg-[#16305c]'
                    }`}
                  >
                    {isCurrentCompanyFollowed ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Following in Watchlist</span>
                      </>
                    ) : isVerifyingFollow ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Company...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          Follow {searchState.entityValue} in Watchlist
                        </span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-tabular">
                    <span>Coverage: {searchState.entityValue}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Sort:{' '}
                      {searchState.sortBy === 'newest' ? 'Newest' : 'Relevance'}
                    </span>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  logFunctionCall('InvestorDashboardPage.toggleResearchChat', {
                    nextOpen: !isChatOpen,
                  });
                  setIsChatOpen((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isChatOpen
                    ? 'bg-[#09a4ff] text-white border-[#09a4ff]'
                    : 'bg-[#0d1b33] text-white border-[#09a4ff]/50 hover:bg-[#102344]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {isChatOpen
                    ? 'Hide Research Assistant'
                    : chatMessages.length > 0
                      ? `Ask Research Assistant (${Math.ceil(chatMessages.length / 2)})`
                      : 'Ask Research Assistant'}
                </span>
              </button>
            </div>
          </div>

          {followValidationError && workspaceMode === 'single' && (
            <div
              role="alert"
              className="px-3.5 py-2 rounded-lg bg-rose-950/35 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{followValidationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFollowValidationError(null)}
                aria-label="Dismiss follow validation message"
                className="p-0.5 text-rose-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Company Profile Bar (shown in Single-Company mode) */}
        {workspaceMode === 'single' && (
          <CollapsibleCompanyProfile
            searchedQuery={searchState.entityValue}
            profile={companyProfile}
            isLoading={isLoadingProfile}
            error={profileError}
            onRetry={() =>
              void fetchCompanyProfile(
                searchState.entityValue,
                searchState.entityType,
                marketData?.companyName,
                true
              )
            }
          />
        )}

        {/* Unified Company & Natural-Language Screening Search Bar */}
        <NewsSearchControlBar
          state={searchState}
          onChange={handleUpdateSearchControls}
          onSubmitSearch={handleRunSearch}
          isLoading={isLoadingNews}
          workspaceMode={workspaceMode}
          isScreeningCohort={isScreeningCohort}
          onRunSampleNaturalQuery={handleRunSampleNaturalQuery}
          onForceWorkspaceMode={handleForceWorkspaceMode}
        />

        {workspaceMode === 'cohort' ? (
          <CohortComparisonWorkspace
            query={activeCohortQuery || searchState.entityValue}
            screenResult={cohortScreen}
            isScreening={isScreeningCohort}
            screenError={cohortError}
            selectedIds={selectedCohortIds}
            onToggleCandidate={handleToggleCohortCandidate}
            onAddCustomCompany={handleAddCustomCompareCompany}
            isAddingCustom={isAddingCustomCompare}
            customAddError={customCompareError}
            dossiersById={cohortDossiersById}
            comparativeSummary={comparativeSummary}
            isHydratingComparison={isHydratingComparison}
            activeRange={cohortRange}
            onRangeChange={handleCohortRangeChange}
            onRefreshScreen={() =>
              void runCohortScreen(
                activeCohortQuery || searchState.entityValue,
                true
              )
            }
            onSwitchToSingleMode={() => handleForceWorkspaceMode('single')}
            onOpenDeepDive={handleSelectCompanyFromBrief}
            followedValuesLower={followedValuesLower}
            onToggleFollowCompany={(value, label, sector) => {
              const isFollowed =
                followedValuesLower.has(value.trim().toLowerCase()) ||
                followedValuesLower.has(label.trim().toLowerCase());
              if (isFollowed) {
                void handleRemoveFollowedCompany(value.trim());
              } else {
                void handleAddFollowedCompany(
                  value.trim(),
                  label,
                  sector || undefined
                );
              }
            }}
            onRunSampleQuery={handleRunSampleNaturalQuery}
          />
        ) : (
          <>
            {/* Related Companies Ecosystem Grouped by Relationship */}
            <RelatedCompaniesPanel
              searchedQuery={searchState.entityValue}
              data={relatedData}
              isLoading={isLoadingRelated}
              error={relatedError}
              onSelectCompany={handleSelectRelatedCompany}
              onRefresh={() =>
                void fetchRelatedCompanies(searchState.entityValue, true)
              }
            />

            {/* Searched Company Price Chart & Key Investment Metrics */}
            <CompanyMarketOverview
              data={marketData}
              isLoading={isLoadingMarket}
              isLoadingChart={isLoadingChart}
              error={marketError}
              activeRange={chartRange}
              onRangeChange={handleChartRangeChange}
              onRetry={() =>
                void fetchMarketOverview(
                  searchState.entityValue,
                  searchState.entityType,
                  chartRange
                )
              }
              searchedQuery={searchState.entityValue}
            />

            {/* Side-by-Side Catalysts vs. Risks & Overall AI Assessment */}
            <AIMarketBriefPanel
              companyLabel={searchState.entityValue}
              brief={aiBrief}
              isLoading={isGeneratingBrief}
              error={briefError}
              onGenerate={handleGenerateAIBrief}
            />

            {/* Full-Width Paginated News Feed Table */}
            <div id="terminal">
              <NewsFeedTable
                articles={articles}
                isLoading={isLoadingNews}
                currentPageIndex={currentPageIndex}
                hasPreviousPage={currentPageIndex > 0}
                hasNextPage={hasMore && Boolean(nextCursor)}
                onPreviousPage={handlePreviousPage}
                onNextPage={handleNextPage}
                onBookmarkArticle={handleBookmarkArticle}
                savedArticleIds={savedArticleIds}
                onGenerateAIBrief={handleGenerateAIBrief}
                isGeneratingBrief={isGeneratingBrief}
                companyLabel={searchState.entityValue}
                sentimentFilter={sentimentFilter}
                onSentimentFilterChange={setSentimentFilter}
                isAnalyzingSentiment={isAnalyzingSentiment}
                sentimentError={sentimentError}
              />
            </div>
          </>
        )}

        {/* Bottom Section: Saved Articles Watchlist */}
        <SdkCacheInspector
          savedArticles={savedArticles}
          onRemoveSavedArticle={handleRemoveSavedArticle}
          userEmail={currentUser?.email ?? null}
          onSignIn={() => signInWithGoogle()}
        />
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-[#212c42] py-6 px-6 mt-12">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <span>Contextual Investing</span>
          <span>US Equities &amp; Private Company News Terminal</span>
        </div>
      </footer>

      {/* Collapsible Right-Side Contextual Research Assistant Drawer */}
      <ContextualResearchDrawer
        isOpen={isChatOpen}
        onOpen={() => setIsChatOpen(true)}
        onClose={() => setIsChatOpen(false)}
        context={activeResearchContext}
        messages={chatMessages}
        isSending={isSendingChat}
        error={chatError}
        onSendMessage={(q) => handleSendResearchChatMessage(q, false)}
        onRetryLastQuestion={handleRetryLastChatQuestion}
        onClearChat={handleClearResearchChat}
      />
    </div>
  );
}
