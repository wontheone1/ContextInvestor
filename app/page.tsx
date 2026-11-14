/**
 * ============================================================================
 * FILE: app/page.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Main OpticAlpha Quantitative Investor Dashboard & AI Research Terminal Page.
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Plus } from 'lucide-react';
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
import type { CompanyProfileData } from '@/lib/company-profile-service';
import type {
  ChartRange,
  CompanyMarketOverviewData,
  PriceChartPoint,
} from '@/lib/market-data-service';
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
import { APP_CONFIG, type CompanyPreset } from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';

const FOLLOWED_STORAGE_KEY = 'opticalpha_followed_companies_v1';

/**
 * Infers whether a user-entered string is a US ticker symbol or company name
 * and constructs a `CompanyPreset` for the watchlist strip.
 */
function buildCustomPresetFromInput(
  rawInput: string,
  customLabel?: string,
  customSector?: string
): CompanyPreset {
  const trimmed = rawInput.trim();
  const knownPreset = APP_CONFIG.featuredCompanies.find(
    (c) =>
      c.value.toLowerCase() === trimmed.toLowerCase() ||
      c.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (knownPreset) {
    return knownPreset;
  }

  const isLikelyTicker =
    /^[A-Z]{1,5}(\.[A-Z])?$/.test(trimmed) ||
    (/^[a-zA-Z]{1,5}$/.test(trimmed) &&
      !['stripe', 'openai', 'spacex'].includes(trimmed.toLowerCase()));

  const normalizedValue = isLikelyTicker ? trimmed.toUpperCase() : trimmed;
  return {
    label: customLabel || normalizedValue,
    entityType: isLikelyTicker ? 'ticker' : 'name',
    value: normalizedValue,
    sector:
      customSector || (isLikelyTicker ? 'US Listed Equity' : 'Private / Growth'),
    price: isLikelyTicker ? 'Tracked' : 'Private',
    changePct: 'Following',
    positive: true,
    sparkline: [50, 52, 51, 54, 56, 55, 58, 60],
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

  // Followed Watchlist Companies State
  const [followedCompanies, setFollowedCompanies] = useState<CompanyPreset[]>(
    () => [...APP_CONFIG.featuredCompanies]
  );
  const [isWatchlistCustomized, setIsWatchlistCustomized] =
    useState<boolean>(false);

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

  // Hydrate custom followed companies from localStorage on mount & fetch Watchlist Digest
  useEffect(() => {
    const timer = setTimeout(() => {
      let initialCompanies: CompanyPreset[] = [
        ...APP_CONFIG.featuredCompanies,
      ];
      try {
        const rawSaved = window.localStorage.getItem(FOLLOWED_STORAGE_KEY);
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved) as CompanyPreset[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialCompanies = parsed;
            setFollowedCompanies(parsed);
            setIsWatchlistCustomized(true);
          }
        }
      } catch (e) {
        console.warn('Could not read followed companies from localStorage:', e);
      }

      void fetchWatchlistDigest(initialCompanies, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchWatchlistDigest]);

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
              buildCustomPresetFromInput(f.value, f.label, f.sector)
            );
            setFollowedCompanies(mappedPresets);
            setIsWatchlistCustomized(true);
            try {
              window.localStorage.setItem(
                FOLLOWED_STORAGE_KEY,
                JSON.stringify(mappedPresets)
              );
            } catch {
              // ignore storage quota errors
            }
            void fetchWatchlistDigest(mappedPresets, false);
          }
        } catch (err) {
          console.error('Failed to load user Firestore data:', err);
        }
      } else {
        setSavedArticles([]);
      }
    });
    return () => unsub();
  }, [fetchWatchlistDigest]);

  /**
   * Adds a new company to the user's followed watchlist and refreshes the
   * Watchlist News Summary & Top Movers briefing.
   */
  const handleAddFollowedCompany = async (
    rawInput: string,
    customLabel?: string,
    customSector?: string
  ) => {
    const preset = buildCustomPresetFromInput(
      rawInput,
      customLabel,
      customSector
    );
    const exists = followedCompanies.some(
      (c) => c.value.toLowerCase() === preset.value.toLowerCase()
    );
    if (exists) return;

    const updated = [...followedCompanies, preset].slice(0, 10);
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
          label: preset.label,
          entityType: preset.entityType === 'ticker' ? 'ticker' : 'name',
          value: preset.value,
          sector: preset.sector,
        });
      } catch (err) {
        console.warn('Firestore follow sync skipped:', err);
      }
    }
  };

  /**
   * Removes a company from the user's followed watchlist and updates the
   * Watchlist News Summary & Top Movers briefing.
   */
  const handleRemoveFollowedCompany = async (valueToRemove: string) => {
    if (followedCompanies.length <= 1) return;
    const target = followedCompanies.find(
      (c) => c.value.toLowerCase() === valueToRemove.toLowerCase()
    );
    const updated = followedCompanies.filter(
      (c) => c.value.toLowerCase() !== valueToRemove.toLowerCase()
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
   * Resets the followed watchlist back to the default institutional companies.
   */
  const handleResetDefaultWatchlist = () => {
    const defaults = [...APP_CONFIG.featuredCompanies];
    setFollowedCompanies(defaults);
    setIsWatchlistCustomized(false);
    try {
      window.localStorage.removeItem(FOLLOWED_STORAGE_KEY);
    } catch {
      // ignore
    }
    void fetchWatchlistDigest(defaults, false);
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
   * Updates search controls and immediately triggers a fresh Page 1 lookup
   * when key parameters (`entityType`, `sortBy`, `datePreset`, `limit`, `filterCategory`) change.
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

    const shouldAutoSearch = Object.keys(updated).some((k) =>
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
   * Resets cursor stack to page 1 and runs the search.
   */
  const handleRunSearch = (forceRefresh = false) => {
    setCursorStack([null]);
    setCurrentPageIndex(0);
    setResolvedExchange(null);
    setAiBrief(null);
    setSentimentFilter('all');
    executeSearchForCursor(searchState, null, 0, forceRefresh, null, null);
    void fetchMarketOverview(
      searchState.entityValue,
      searchState.entityType,
      chartRange
    );
    void fetchCompanyProfile(
      searchState.entityValue,
      searchState.entityType,
      undefined,
      forceRefresh
    );
    void fetchRelatedCompanies(searchState.entityValue, forceRefresh);
  };

  /**
   * Pivots the deep-dive company research view when a user clicks a company
   * inside the Watchlist Landing Brief or Watchlist Carousel.
   */
  const handleSelectCompanyFromBrief = (
    companyValue: string,
    entityType: 'name' | 'ticker'
  ) => {
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

  const savedArticleIds = new Set(savedArticles.map((s) => s.articleId));
  const isCurrentCompanyFollowed = followedCompanies.some(
    (c) =>
      c.value.toLowerCase() === searchState.entityValue.trim().toLowerCase() ||
      c.label.toLowerCase() === searchState.entityValue.trim().toLowerCase()
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#091326] text-white">
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
          activeValue={searchState.entityValue}
          activeEntityType={searchState.entityType}
          onSelectPreset={handleSelectPreset}
          onAddCompany={(rawInput) => void handleAddFollowedCompany(rawInput)}
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

        {/* Deep-Dive Company Research Section Divider */}
        <div
          id="company-research"
          className="mb-6 pt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#212c42]"
        >
          <div>
            <p className="text-xs font-medium text-[#49afe9] mb-1">
              Single-Company Deep Dive · Price Chart &amp; Metrics · Supply Chain &amp; Peer Ecosystem
            </p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white text-balance">
              Company Research Terminal:{' '}
              <span className="text-[#49afe9]">{searchState.entityValue}</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isCurrentCompanyFollowed) {
                  void handleRemoveFollowedCompany(
                    searchState.entityValue.trim()
                  );
                } else {
                  const label =
                    marketData?.companyName || searchState.entityValue.trim();
                  const sector = marketData?.sector || undefined;
                  void handleAddFollowedCompany(
                    searchState.entityValue.trim(),
                    label,
                    sector
                  );
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isCurrentCompanyFollowed
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-[#102344] text-[#49afe9] border-[#09a4ff]/40 hover:bg-[#16305c]'
              }`}
            >
              {isCurrentCompanyFollowed ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Following in Watchlist
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Follow {searchState.entityValue} in Watchlist
                </>
              )}
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-tabular">
              <span>Coverage: {searchState.entityValue}</span>
              <span aria-hidden="true">·</span>
              <span>
                Sort: {searchState.sortBy === 'newest' ? 'Newest' : 'Relevance'}
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Company Profile Bar (Context.dev /v1/company/search) */}
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

        {/* Search & Filter Control Bar */}
        <NewsSearchControlBar
          state={searchState}
          onChange={handleUpdateSearchControls}
          onSubmitSearch={handleRunSearch}
          isLoading={isLoadingNews}
        />

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
          <span>OpticAlpha Investor Intelligence</span>
          <span>US Equities &amp; Private Company News Terminal</span>
        </div>
      </footer>
    </div>
  );
}
