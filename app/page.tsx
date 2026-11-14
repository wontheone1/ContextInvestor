/**
 * ============================================================================
 * FILE: app/page.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Main OpticAlpha Quantitative Investor Dashboard & AI Research Terminal Page.
 *
 * USE CASES:
 * 1. Orchestrating the Context.dev Company News Search flow (`POST /v1/news/search`)
 *    identifying companies by Stock Ticker (`ticker`) or Company Name (`name`).
 * 2. Managing selectable publication date ranges (`All Dates`, `24h`, `7d`, `30d`,
 *    `90d`, or custom start/end timestamps), optional category filters, and
 *    selectable sorting standards (`newest` vs `relevance`).
 * 3. Managing deterministic Next / Previous cursor pagination (`cursorStack`)
 *    while keeping `searchBy`, `filterBy`, and `sortBy` locked across page hops.
 * 4. Reading and writing cached search pages to Firebase Firestore
 *    (`/cached_searches/{cacheId}`) and bookmarking articles to `/saved_articles`.
 * 5. Invoking Gemini AI (`/api/ai/brief`) to synthesize institutional market
 *    briefs from the loaded Context.dev news coverage.
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { NewsSearchResponse } from 'context.dev/resources/news';
import { TopNavbar } from '@/components/TopNavbar';
import { WatchlistCarousel } from '@/components/WatchlistCarousel';
import {
  NewsSearchControlBar,
  type NewsSearchControlState,
} from '@/components/NewsSearchControlBar';
import { NewsFeedTable } from '@/components/NewsFeedTable';
import { AIMarketBriefPanel } from '@/components/AIMarketBriefPanel';
import { SdkCacheInspector } from '@/components/SdkCacheInspector';
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
  type SavedArticleRecord,
} from '@/lib/firebase-client';
import type { AIMarketBriefResponse } from '@/lib/gemini-service';
import type { CompanyPreset } from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';

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
  const [activeSection, setActiveSection] = useState<
    'terminal' | 'watchlist' | 'briefing' | 'cache'
  >('terminal');

  // Search Control State
  const [searchState, setSearchState] = useState<NewsSearchControlState>({
    entityType: 'ticker',
    entityValue: 'NVDA',
    exchange: 'NASDAQ',
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

  // Cursor Pagination Stack: index 0 is always `null` (first page)
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // News Results & Diagnostics State
  const [articles, setArticles] = useState<NewsSearchResponse.Data[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true);
  const [lastRequestPayload, setLastRequestPayload] = useState<unknown>(null);
  const [lastCacheKey, setLastCacheKey] = useState<string>('');
  const [cacheStatus, setCacheStatus] = useState<
    'hit' | 'miss' | 'live' | 'idle'
  >('idle');
  const [keyConfigured, setKeyConfigured] = useState<boolean>(false);
  const [apiMode, setApiMode] = useState<string>('initializing');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // AI Market Brief State
  const [aiBrief, setAiBrief] = useState<AIMarketBriefResponse | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Firebase Auth & Saved Watchlist State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedArticles, setSavedArticles] = useState<
    Array<SavedArticleRecord & { docId: string }>
  >([]);

  // Validate Firestore connection and listen to Auth state on mount
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const list = await listUserSavedArticles(user.uid);
          setSavedArticles(list);
        } catch (err) {
          console.error('Failed to load user saved articles:', err);
        }
      } else {
        setSavedArticles([]);
      }
    });
    return () => unsub();
  }, []);

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
      forceRefresh = false
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

      const cacheId = buildSearchCacheId({
        entityType: stateSnapshot.entityType,
        entityValue: stateSnapshot.entityValue,
        exchange:
          stateSnapshot.entityType === 'ticker'
            ? stateSnapshot.exchange
            : undefined,
        sortBy: stateSnapshot.sortBy,
        dateFrom: stateSnapshot.datePreset === 'custom' ? dateFrom : undefined,
        dateTo: stateSnapshot.datePreset === 'custom' ? dateTo : undefined,
        filterCategory: stateSnapshot.filterCategory,
        filterValue: `${stateSnapshot.datePreset}_${filterValue}`,
        limit: stateSnapshot.limit,
        cursor: targetCursor,
      });

      setLastCacheKey(cacheId);

      // 1. Check Firestore cache first unless bypassed
      if (!forceRefresh) {
        try {
          const cached = await getCachedNewsSearch(cacheId);
          if (cached && cached.articlesJson) {
            const parsedArticles = JSON.parse(
              cached.articlesJson
            ) as NewsSearchResponse.Data[];
            setArticles(parsedArticles);
            setNextCursor(cached.nextCursor || null);
            setHasMore(Boolean(cached.hasMore));
            setRequestId(`${cached.requestId} (Firestore Cache)`);
            setCacheStatus('hit');
            setApiMode('firestore_cache_hit');
            setIsLoadingNews(false);
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
        const res = await fetch('/api/news/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: stateSnapshot.entityType,
            entityValue: stateSnapshot.entityValue,
            exchange:
              stateSnapshot.entityType === 'ticker' && stateSnapshot.exchange
                ? stateSnapshot.exchange
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

        const sdkResponse = data.response as NewsSearchResponse;
        setArticles(sdkResponse.data || []);
        setNextCursor(sdkResponse.next_cursor ?? null);
        setHasMore(Boolean(sdkResponse.has_more));
        setRequestId(sdkResponse.request_id || null);
        setLastRequestPayload(data.requestPayload);
        setKeyConfigured(Boolean(data.keyConfigured));
        setApiMode(data.mode || 'live_sdk');
        setWarningMessage(data.warning || null);

        // 3. Cache the page in Firestore (/cached_searches/{cacheId})
        try {
          await saveCachedNewsSearch({
            cacheKey: cacheId,
            entityType: stateSnapshot.entityType,
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
          setCacheStatus('live');
        } catch (cacheWriteErr) {
          console.warn('Firestore cache write warning:', cacheWriteErr);
          setCacheStatus('miss');
        }
      } catch (err) {
        console.error('Error searching company news:', err);
      } finally {
        setIsLoadingNews(false);
      }
    },
    []
  );

  // Trigger initial search on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      void executeSearchForCursor(searchState, null, 0, false);
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
      'entityType',
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
      setAiBrief(null);
      executeSearchForCursor(nextState, null, 0, false);
    }
  };

  /**
   * Resets cursor stack to page 1 and runs the search.
   */
  const handleRunSearch = (forceRefresh = false) => {
    setCursorStack([null]);
    setCurrentPageIndex(0);
    setAiBrief(null);
    executeSearchForCursor(searchState, null, 0, forceRefresh);
  };

  /**
   * Handles selecting a preset equity or entity from the top watchlist carousel.
   */
  const handleSelectPreset = (preset: CompanyPreset) => {
    const nextState: NewsSearchControlState = {
      ...searchState,
      entityType: preset.entityType === 'ticker' ? 'ticker' : 'name',
      entityValue: preset.value,
      exchange: preset.exchange || '',
    };
    setSearchState(nextState);
    setCursorStack([null]);
    setCurrentPageIndex(0);
    setAiBrief(null);
    executeSearchForCursor(nextState, null, 0, false);
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
    executeSearchForCursor(searchState, nextCursor, nextIndex, false);
  };

  /**
   * Navigates back to the Previous Page using the stored cursor in `cursorStack`.
   */
  const handlePreviousPage = () => {
    if (currentPageIndex <= 0) return;
    const prevIndex = currentPageIndex - 1;
    const prevCursor = cursorStack[prevIndex] ?? null;
    setCurrentPageIndex(prevIndex);
    executeSearchForCursor(searchState, prevCursor, prevIndex, false);
  };

  /**
   * Calls the server-side Gemini AI route (`/api/ai/brief`) to synthesize the
   * currently displayed Context.dev news articles.
   */
  const handleGenerateAIBrief = async () => {
    if (articles.length === 0) return;
    setIsGeneratingBrief(true);
    setBriefError(null);

    try {
      const res = await fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyQuery: `${searchState.entityValue} (${searchState.entityType.toUpperCase()})`,
          articles: articles.map((a) => ({
            title: a.title,
            description: a.description,
            sourceName: a.source?.name || a.source?.domain || 'Publisher',
            publishedAt: a.published_at,
            type: a.type,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to synthesize AI brief.');
      }
      setAiBrief(data.brief as AIMarketBriefResponse);
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : 'Error generating AI brief.'
      );
    } finally {
      setIsGeneratingBrief(false);
    }
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
   * Saves an article to the user's Firestore `/saved_articles` collection,
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
        sourceDomain: article.source?.domain || 'context.dev',
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
        {/* Hero Header Banner */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#212c42]">
          <div>
            <p className="text-xs font-medium text-[#49afe9] mb-1 font-mono-tabular">
              Context.dev Official SDK · Firestore Cache · Gemini Quantitative Desk
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              Institutional Company News &amp; AI Market Intelligence
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 font-mono-tabular">
            <span>Endpoint: POST /v1/news/search</span>
            <span aria-hidden="true">·</span>
            <span>
              Entity: {searchState.entityType.toUpperCase()} ({searchState.entityValue})
            </span>
            <span aria-hidden="true">·</span>
            <span>Sort: {searchState.sortBy.toUpperCase()}</span>
          </div>
        </div>

        {/* Featured Institutional Watchlist Strip with Sparklines */}
        <WatchlistCarousel
          activeValue={searchState.entityValue}
          activeEntityType={searchState.entityType}
          onSelectPreset={handleSelectPreset}
        />

        {/* Context.dev Search & Filter Control Bar */}
        <NewsSearchControlBar
          state={searchState}
          onChange={handleUpdateSearchControls}
          onSubmitSearch={handleRunSearch}
          isLoading={isLoadingNews}
          cacheStatus={cacheStatus}
        />

        {/* Primary 12-Column Quantitative Terminal Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Paginated News Feed Table */}
          <div className="lg:col-span-8">
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
              companyLabel={`${searchState.entityValue} (${searchState.entityType.toUpperCase()})`}
              requestId={requestId}
            />
          </div>

          {/* Right 4 Columns: Gemini AI Quantitative Analyst Panel */}
          <div className="lg:col-span-4">
            <AIMarketBriefPanel
              companyLabel={searchState.entityValue}
              brief={aiBrief}
              isLoading={isGeneratingBrief}
              error={briefError}
              onGenerate={handleGenerateAIBrief}
            />
          </div>
        </div>

        {/* Bottom Section: Context.dev SDK Payload Inspector & Saved Firestore Watchlist */}
        <SdkCacheInspector
          lastRequestPayload={lastRequestPayload}
          lastCacheKey={lastCacheKey}
          cacheStatus={cacheStatus}
          keyConfigured={keyConfigured}
          apiMode={apiMode}
          warningMessage={warningMessage}
          savedArticles={savedArticles}
          onRemoveSavedArticle={handleRemoveSavedArticle}
          userEmail={currentUser?.email ?? null}
          onSignIn={() => signInWithGoogle()}
        />
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-[#212c42] py-6 px-6 mt-12">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <span>
            OpticAlpha Investor Intelligence · Powered by Context.dev Official TypeScript SDK
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.context.dev/api-reference/news/search"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Context.dev News Search Docs
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.context.dev/dashboard/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Manage Context.dev API Keys
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
