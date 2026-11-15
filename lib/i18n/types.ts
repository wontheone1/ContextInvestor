/**
 * ============================================================================
 * FILE: lib/i18n/types.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Defines the strongly-typed internationalization (i18n) schema for Contextual
 * Investing, supporting seamless switching between English ('en') and Korean ('ko').
 *
 * USE CASES:
 * 1. Compile-time verification ensuring every UI string across all 5 views
 *    (Research & Compare, Daily Brief, Watchlist, Saved Library, Pitch Deck),
 *    modals/drawers, and navigation bars exists in both English and Korean.
 * 2. Typed locale propagation (`AppLocale`) across React Context, localStorage,
 *    and server-side Gemini AI synthesis routes (`/api/ai/chat`, `/api/ai/brief`,
 *    `/api/news/watchlist-digest`).
 * ============================================================================
 */

export type AppLocale = 'en' | 'ko';

export interface UiTranslations {
  nav: {
    research: string;
    dailyBrief: string;
    watchlist: string;
    saved: string;
    pitchDeck: string;
    signInWithGoogle: string;
    signOutPrefix: string;
  };
  toolbar: {
    researchTitle: string;
    dailyBriefTitle: string;
    watchlistTitle: string;
    savedTitle: string;
    pitchDeckTitle: string;
    askResearchAssistant: string;
    languageLabel: string;
  };
  common: {
    follow: string;
    plusFollow: string;
    following: string;
    unfollow: string;
    loading: string;
    refresh: string;
    retry: string;
    save: string;
    saved: string;
    SavedBadge: string;
    remove: string;
    close: string;
    Expand: string;
    Collapse: string;
    source: string;
    sources: string;
    all: string;
    publicEquity: string;
    privateCompany: string;
    unlisted: string;
    adrSuffix: string;
    foreignNoAdr: string;
  };
  followingBar: {
    followingPrefix: string;
    manageWatchlist: string;
    unfollowTooltipPrefix: string;
  };
  searchBar: {
    searchLabel: string;
    singleModeBadge: string;
    cohortModeBadge: string;
    placeholder: string;
    searchButton: string;
    searchingButton: string;
    switchToCohort: string;
    switchToSingle: string;
    trySamplePrompts: string;
    quickCompanies: string;
    filtersButton: string;
    hideFiltersButton: string;
    activeFiltersSuffix: string;
    searchByLabel: string;
    searchByAuto: string;
    searchByTicker: string;
    searchByName: string;
    dateWindowLabel: string;
    dateAll: string;
    date24h: string;
    date7d: string;
    date30d: string;
    date90d: string;
    dateCustom: string;
    fromDateLabel: string;
    toDateLabel: string;
    sortByLabel: string;
    sortNewest: string;
    sortRelevance: string;
    articleTypeLabel: string;
    languageFilterLabel: string;
    countryFilterLabel: string;
    publisherDomainLabel: string;
    publisherDomainPlaceholder: string;
    applyFilters: string;
    resetFilters: string;
  };
  singleResearch: {
    activeTargetKicker: string;
    subTabOverview: string;
    subTabBullBearNews: string;
    subTabEcosystem: string;
    followTickerPrefix: string;
  };
  marketOverview: {
    loadingChart: string;
    unavailableTitle: string;
    privateCompanyBadge: string;
    unlistedNoChart: string;
    closeLabel: string;
    highLowLabel: string;
    volLabel: string;
    todayReturn: string;
    rangeReturnSuffix: string;
    dayRange: string;
    week52Range: string;
    keyInvestmentMetrics: string;
    marketCap: string;
    marketCapTooltip: string;
    peRatioTtm: string;
    peRatioTooltip: string;
    forwardPe: string;
    forwardPeTooltip: string;
    epsTtm: string;
    epsTooltip: string;
    volumeVsAvg: string;
    volumeTooltip: string;
    avgLabel: string;
    dividendAndBeta: string;
    dividendBetaTooltip: string;
    yieldLabel: string;
    betaLabel: string;
    privateMetricsHeader: string;
    estValuation: string;
    estValuationTooltip: string;
    fundingStage: string;
    fundingStageTooltip: string;
    sectorCategory: string;
    headquartersFounded: string;
    privateDataDisclaimer: string;
  };
  companyProfile: {
    loadingProfile: string;
    showProfile: string;
    hideProfile: string;
    corporateDossier: string;
    website: string;
    headquartersAndScale: string;
    headquarters: string;
    employees: string;
    founded: string;
    organizationType: string;
    industriesAndRevenue: string;
    industries: string;
    estAnnualRevenue: string;
    stockSymbols: string;
    fundingAndRoundHistory: string;
    totalFundingRaised: string;
    latestStage: string;
    recentRounds: string;
    noFundingDisclosed: string;
  };
  companyProducts: {
    headerTitle: string;
    headerSubtitle: string;
    loadingPortfolio: string;
    monetizationLabel: string;
    targetCustomersLabel: string;
    revenueSegmentsHeader: string;
    colSegmentName: string;
    colKeyOfferings: string;
    colShareScale: string;
    productLinesHeader: string;
    allCategories: string;
    targetBuyersPrefix: string;
    officialPageLink: string;
    officialSourcesPrefix: string;
    emptyPortfolio: string;
  };
  relatedCompanies: {
    headerTitle: string;
    headerSubtitlePrefix: string;
    loadingEcosystem: string;
    allGroups: string;
    followTopPrefix: string;
    followGroupPrefix: string;
    followingAllInView: string;
    alsoInPrefix: string;
    pivotTooltipPrefix: string;
    emptyGroup: string;
  };
  aiBrief: {
    headerTitle: string;
    headerSubtitle: string;
    refreshAnalysis: string;
    synthesizing: string;
    overallVerdict: string;
    signalConviction: string;
    positiveCatalysts: string;
    bullCaseTag: string;
    risksAndHeadwinds: string;
    bearCaseTag: string;
    sectorAndPeerImpact: string;
    emptyStatePrompt: string;
    generateBriefCta: string;
  };
  newsFeed: {
    headerTitle: string;
    pageLabel: string;
    articlesLoadedSuffix: string;
    synthesizeAiBrief: string;
    synthesizingBrief: string;
    previousPage: string;
    nextPage: string;
    sentimentFilterLabel: string;
    allHeadlines: string;
    autoTranslatedFromPrefix: string;
    viewOriginal: string;
    hideOriginal: string;
    readSource: string;
    aiSentimentRationale: string;
    emptyFeedTitle: string;
    emptyFeedSubtitle: string;
    loadingFeed: string;
  };
  cohortWorkspace: {
    loadingTitle: string;
    loadingSubtitle: string;
    errorTitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    interpretedQueryKicker: string;
    verifiedMatchesSuffix: string;
    comparingCountPrefix: string;
    ofFourSelected: string;
    followSelected: string;
    followingSelected: string;
    addPeerPlaceholder: string;
    addPeerButton: string;
    addingPeerButton: string;
    matchedCandidatesHeader: string;
    clickToToggleCompare: string;
    selectedForCompare: string;
    compareToggle: string;
    deepDiveAction: string;
    relativeChartHeader: string;
    relativeChartHoverHint: string;
    privateChartFootnote: string;
    matrixHeader: string;
    dimensionColumn: string;
    dimValuationMarket: string;
    rowListingStatus: string;
    rowCurrentPriceVal: string;
    rowMarketCapVal: string;
    rowPeriodReturn: string;
    rowPeEps: string;
    dimProfileScale: string;
    rowSectorIndustry: string;
    rowHeadquarters: string;
    rowEmployeesFounded: string;
    rowRevenueFunding: string;
    dimProductsPortfolio: string;
    rowCoreProducts: string;
    rowRevenueSegments: string;
    rowTargetCustomers: string;
    dimNewsSentiment: string;
    rowHeadlinePosture: string;
    rowTopCatalystHeadline: string;
    rowActions: string;
    openDeepDive: string;
  };
  dailyBrief: {
    sectionKicker: string;
    pageTitle: string;
    pageSubtitle: string;
    manageWatchlistBtn: string;
    headerTitle: string;
    companiesTrackedSuffix: string;
    refreshBrief: string;
    synthesizingBrief: string;
    executiveTakeaway: string;
    keyCrossThemes: string;
    companyPostureHeader: string;
    showPostureStrip: string;
    hidePostureStrip: string;
    filterBothSides: string;
    filterUpside: string;
    filterRisks: string;
    topBullishCatalysts: string;
    topBearishRisks: string;
    convictionSuffix: string;
    whyBullish: string;
    whyBearish: string;
    inspectCompany: string;
    noBullishItems: string;
    noBearishItems: string;
    emptyWatchlistPrompt: string;
  };
  watchlist: {
    sectionKicker: string;
    pageTitle: string;
    pageSubtitle: string;
    openDailyBriefBtn: string;
    carouselHeader: string;
    followedCountSuffix: string;
    returnWindowLabel: string;
    followInputPlaceholder: string;
    followAddButton: string;
    verifyingButton: string;
    resetDefaults: string;
    privateUnlistedSubtext: string;
    clickToResearchTooltip: string;
    starterThemesKicker: string;
    starterThemesTitle: string;
    starterThemesSubtitle: string;
    followAllThemeBtn: string;
    allThemeFollowedBtn: string;
  };
  savedLibrary: {
    sectionKicker: string;
    pageTitle: string;
    pageSubtitle: string;
    headerTitle: string;
    savedCountSuffix: string;
    signInPromptTitle: string;
    signInPromptBody: string;
    emptySavedTitle: string;
    emptySavedBody: string;
    savedOnPrefix: string;
    removeBookmarkTooltip: string;
  };
  researchDrawer: {
    edgeTabLabel: string;
    drawerTitle: string;
    drawerSubtitle: string;
    clearChat: string;
    activeContextLabel: string;
    starterPromptsLabel: string;
    composerPlaceholder: string;
    sendHint: string;
    thinkingStatus: string;
    sourcesCitedLabel: string;
    sendButton: string;
  };
  pitchDeck: {
    kicker: string;
    deckTitle: string;
    slideCounterPrefix: string;
    downloadPptx: string;
    exportingPptx: string;
    printPdf: string;
    fullScreen: string;
    exitFullScreen: string;
    prevSlide: string;
    nextSlide: string;
    everydayAnalogyBadge: string;
    keyTakeawaysHeader: string;
    plainEnglishGuideHeader: string;
    showSpeakerScript: string;
    hideSpeakerScript: string;
    speakerNotesLabel: string;
    liveScreenshotBadge: string;
  };
  footer: {
    tagline: string;
    poweredBy: string;
    languageTogglePrefix: string;
  };
}
