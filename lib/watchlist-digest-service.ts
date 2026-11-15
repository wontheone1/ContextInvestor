/**
 * ============================================================================
 * FILE: lib/watchlist-digest-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Watchlist Cross-Company News Summary & Top Bullish / Bearish
 * Conviction Mover Engine powered by Context.dev + Gemini AI (`@google/genai`).
 *
 * USE CASES:
 * 1. Aggregating the latest news across all companies in an investor's followed
 *    watchlist in parallel with per-company caching.
 * 2. Synthesizing an executive cross-watchlist news briefing plus a 1-sentence
 *    per-company digest for every followed company.
 * 3. Scoring materiality/conviction (1-100) and ranking the top most Bullish
 *    catalysts and top most Bearish headwinds across any company in the watchlist.
 * ============================================================================
 */

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { NewsSearchResponse } from 'context.dev/resources/news';
import { APP_CONFIG } from './config';
import {
  inferEntitySearchOrder,
  searchCompanyNews,
  validateContextDevApiKey,
} from './context-dev';
import { buildFallbackNewsResponse } from './fallback-news-data';
import {
  formatLanguageName,
  isNonEnglishArticle,
} from './translation-service';
import { logFunctionCall, logGenAICall } from './logger';

export interface WatchlistTargetCompany {
  label: string;
  entityType: 'name' | 'ticker';
  value: string;
  sector?: string;
}

export interface WatchlistCompanyDigest {
  label: string;
  entityType: 'name' | 'ticker';
  value: string;
  sector: string;
  stance: 'Bullish' | 'Bearish' | 'Mixed' | 'Neutral';
  summary: string;
  articleCount: number;
  bullishCount: number;
  bearishCount: number;
}

export interface WatchlistMoverArticle {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceDomain: string;
  articleType: string;
  companyLabel: string;
  companyValue: string;
  companyEntityType: 'name' | 'ticker';
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  convictionScore: number;
  rationale: string;
  isTranslated: boolean;
  translatedFromLanguage: string | null;
}

export interface WatchlistDigestResponse {
  executiveSummary: string;
  keyThemes: string[];
  companyDigests: WatchlistCompanyDigest[];
  topBullish: WatchlistMoverArticle[];
  topBearish: WatchlistMoverArticle[];
  sentimentCounts: {
    bullish: number;
    bearish: number;
    neutral: number;
    totalArticles: number;
  };
  generatedAt: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000;

const companyRawNewsCache = new Map<
  string,
  { articles: NewsSearchResponse.Data[]; expiresAt: number }
>();

const digestCache = new Map<
  string,
  { data: WatchlistDigestResponse; expiresAt: number }
>();

function normalizeSentiment(
  raw: unknown
): 'Bullish' | 'Bearish' | 'Neutral' {
  if (typeof raw !== 'string') return 'Neutral';
  const v = raw.trim().toLowerCase();
  if (v === 'bullish') return 'Bullish';
  if (v === 'bearish') return 'Bearish';
  return 'Neutral';
}

function normalizeStance(
  raw: unknown
): 'Bullish' | 'Bearish' | 'Mixed' | 'Neutral' {
  if (typeof raw !== 'string') return 'Neutral';
  const v = raw.trim().toLowerCase();
  if (v === 'bullish') return 'Bullish';
  if (v === 'bearish') return 'Bearish';
  if (v === 'mixed') return 'Mixed';
  return 'Neutral';
}

async function fetchRecentArticlesForCompany(
  company: WatchlistTargetCompany,
  forceRefresh: boolean
): Promise<NewsSearchResponse.Data[]> {
  const key = `${company.entityType}:${company.value.trim().toLowerCase()}`;
  if (!forceRefresh) {
    const cached = companyRawNewsCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.articles;
    }
  }

  let hasValidKey = false;
  try {
    validateContextDevApiKey();
    hasValidKey = true;
  } catch {
    hasValidKey = false;
  }

  const effectiveType =
    company.entityType === 'ticker' || company.entityType === 'name'
      ? company.entityType
      : inferEntitySearchOrder(company.value)[0];

  if (hasValidKey) {
    try {
      const { response } = await searchCompanyNews({
        entityType: effectiveType,
        entityValue: company.value.trim(),
        sortBy: 'newest',
        limit: 4,
      });
      let articles = response.data || [];

      if (
        articles.length === 0 &&
        effectiveType === 'ticker' &&
        company.label.trim() &&
        company.label.trim().toLowerCase() !==
          company.value.trim().toLowerCase()
      ) {
        const fallbackNameSearch = await searchCompanyNews({
          entityType: 'name',
          entityValue: company.label.trim(),
          sortBy: 'newest',
          limit: 4,
        });
        articles = fallbackNameSearch.response.data || [];
      }

      companyRawNewsCache.set(key, {
        articles,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return articles;
    } catch (err) {
      logFunctionCall('fetchRecentArticlesForCompany:sdk_fallback', {
        company: company.value,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const fb = buildFallbackNewsResponse({
    entityType: effectiveType,
    entityValue: company.value.trim(),
    sortBy: 'newest',
    limit: 4,
  });
  const articles = fb.data || [];
  companyRawNewsCache.set(key, {
    articles,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return articles;
}

/**
 * Aggregates news across all followed companies, synthesizes a cross-watchlist
 * summary and per-company digests, and ranks the top most bullish and bearish
 * articles across any company in the watchlist.
 */
export async function generateWatchlistDigest(
  rawCompanies: WatchlistTargetCompany[],
  forceRefresh = false
): Promise<WatchlistDigestResponse> {
  const seenKeys = new Set<string>();
  const companies: WatchlistTargetCompany[] = [];

  for (const item of rawCompanies) {
    const val = (item.value || '').trim();
    if (!val) continue;
    const eType: 'name' | 'ticker' =
      item.entityType === 'ticker' ? 'ticker' : 'name';
    const dedupeKey = `${eType}:${val.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    companies.push({
      label: (item.label || val).trim(),
      entityType: eType,
      value: val,
      sector: (item.sector || 'Tracked Company').trim(),
    });
    if (companies.length >= 10) break;
  }

  logFunctionCall('generateWatchlistDigest', {
    companyCount: companies.length,
    companies: companies.map((c) => c.value),
    forceRefresh,
  });

  if (companies.length === 0) {
    return {
      executiveSummary:
        'Follow one or more companies to generate your personalized cross-watchlist news briefing and top bullish/bearish movers.',
      keyThemes: [],
      companyDigests: [],
      topBullish: [],
      topBearish: [],
      sentimentCounts: {
        bullish: 0,
        bearish: 0,
        neutral: 0,
        totalArticles: 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  const digestCacheKey = companies
    .map((c) => `${c.entityType}:${c.value.toLowerCase()}`)
    .join('|');

  if (!forceRefresh) {
    const cached = digestCache.get(digestCacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  // 1. Fetch recent news for every followed company in parallel
  const perCompanyFetched = await Promise.all(
    companies.map(async (company) => {
      const articles = await fetchRecentArticlesForCompany(
        company,
        forceRefresh
      );
      return { company, articles };
    })
  );

  interface CandidateEntry {
    company: WatchlistTargetCompany;
    article: NewsSearchResponse.Data;
    needsTranslation: boolean;
  }

  const candidatePool: CandidateEntry[] = [];
  const seenCompanyArticleKeys = new Set<string>();

  // Interleave articles round-robin across companies so every followed company is represented fairly
  const maxPerCompany = 4;
  for (let slot = 0; slot < maxPerCompany; slot++) {
    for (const bucket of perCompanyFetched) {
      const art = bucket.articles[slot];
      if (!art) continue;
      const articleKey = (art.url || art.id || art.title).trim().toLowerCase();
      const dedupeKey = `${bucket.company.value.toLowerCase()}::${articleKey}`;
      if (seenCompanyArticleKeys.has(dedupeKey)) continue;
      seenCompanyArticleKeys.add(dedupeKey);
      candidatePool.push({
        company: bucket.company,
        article: art,
        needsTranslation: isNonEnglishArticle(art),
      });
      if (candidatePool.length >= 28) break;
    }
    if (candidatePool.length >= 28) break;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check Settings > Secrets in AI Studio.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const model = APP_CONFIG.gemini.defaultModel;

  const companiesInput = companies.map((c) => ({
    companyValue: c.value,
    companyLabel: c.label,
    sector: c.sector || 'Tracked Company',
  }));

  const articlesInput = candidatePool.map((entry, idx) => ({
    index: idx,
    companyValue: entry.company.value,
    companyLabel: entry.company.label,
    language: entry.article.language || 'en',
    needsTranslation: entry.needsTranslation,
    source:
      entry.article.source?.name ||
      entry.article.source?.domain ||
      'News Wire',
    publishedAt: entry.article.published_at || '',
    title: entry.article.title,
    excerpt: entry.article.description
      ? entry.article.description.slice(0, 200)
      : '',
  }));

  const prompt = `You are preparing the opening landing briefing for an institutional investor tracking these followed companies:
${JSON.stringify(companiesInput, null, 2)}

Recent News Articles Across Followed Companies:
${JSON.stringify(articlesInput, null, 2)}

Instructions:
1. "executiveSummary": Write a sharp, cohesive 2 to 3 sentence cross-watchlist summary covering both the key positive catalysts and key risks across ALL followed companies. Write in English.
2. "keyThemes": Return 3 to 4 concise cross-watchlist themes (3 to 6 words each, e.g. "Hyperscaler AI Capex Momentum", "Regulatory & Margin Scrutiny").
3. "companySummaries": Return one entry for EVERY followed company in the list above (matching "companyValue" exactly):
   - "stance": "Bullish", "Bearish", "Mixed", or "Neutral" based on its recent coverage.
   - "summary": 1 crisp English sentence (max 22 words) summarizing the latest news for that company.
4. "articleEvaluations": Return one entry for EVERY article in Recent News Articles (matching "index"):
   - "sentiment": Strictly "Bullish", "Bearish", or "Neutral" for the tagged company ("companyLabel" / "companyValue").
     * Classify as "Bullish" whenever the article highlights product launches, new features, AI/cloud expansion, partnerships, customer wins, valuation/price upside, analyst upgrades, institutional buying, or strategic growth initiatives for that company.
     * Classify as "Bearish" whenever the article highlights regulatory scrutiny, lawsuits, export controls, security vulnerabilities, competitive threats, executive departures, or valuation/margin headwinds for that company.
     * Ensure you identify at least 3 to 5 "Bullish" articles and at least 3 to 5 "Bearish" articles across the pool so the investor can compare the strongest upside catalysts and strongest downside risks across their watchlist.
   - "convictionScore": Integer from 1 to 100 measuring how strongly bullish or strongly bearish this specific news is for the company (85-98 = major catalyst or risk; 65-84 = moderate catalyst or risk; 1-64 = minor).
   - "rationale": 1 crisp English sentence (max 18 words) explaining WHY this article is bullish, bearish, or neutral for the company.
   - "englishTitle": If "needsTranslation" is true (or title is non-English), provide a natural English translation of "title"; otherwise return "".
   - "englishDescription": If "needsTranslation" is true (or excerpt is non-English), provide a natural English translation of "excerpt"; otherwise return "".
   - "sourceLanguageLabel": If translated from non-English, return the clean English language name only (e.g. "Korean", "Japanese", "German"); otherwise return "".`;

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    systemInstruction:
      'You are a Managing Director of Institutional Equity Research synthesizing a multi-company watchlist daily briefing. Be factual, balanced, crisp, and grounded strictly in the provided articles.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        executiveSummary: {
          type: Type.STRING,
          description:
            '2-3 sentence executive synthesis of news across all followed companies',
        },
        keyThemes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3-4 concise cross-watchlist themes (3-6 words each)',
        },
        companySummaries: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              companyValue: {
                type: Type.STRING,
                description: 'Exact companyValue from input',
              },
              stance: {
                type: Type.STRING,
                description: 'One of: Bullish, Bearish, Mixed, Neutral',
              },
              summary: {
                type: Type.STRING,
                description:
                  '1-sentence English digest (<= 22 words) of this company’s news',
              },
            },
            required: ['companyValue', 'stance', 'summary'],
          },
        },
        articleEvaluations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              sentiment: {
                type: Type.STRING,
                description: 'Strictly Bullish, Bearish, or Neutral',
              },
              convictionScore: {
                type: Type.INTEGER,
                description: 'Materiality/conviction score from 1 to 100',
              },
              rationale: {
                type: Type.STRING,
                description:
                  '1-sentence explanation (<= 18 words) of why it is Bullish, Bearish, or Neutral',
              },
              englishTitle: { type: Type.STRING },
              englishDescription: { type: Type.STRING },
              sourceLanguageLabel: { type: Type.STRING },
            },
            required: [
              'index',
              'sentiment',
              'convictionScore',
              'rationale',
              'englishTitle',
              'englishDescription',
              'sourceLanguageLabel',
            ],
          },
        },
      },
      required: [
        'executiveSummary',
        'keyThemes',
        'companySummaries',
        'articleEvaluations',
      ],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const rawText = (response.text ?? '{}').trim();
    logGenAICall({
      model,
      prompt,
      config,
      output: rawText,
    });

    const parsed = JSON.parse(rawText) as {
      executiveSummary?: string;
      keyThemes?: string[];
      companySummaries?: Array<{
        companyValue?: string;
        stance?: string;
        summary?: string;
      }>;
      articleEvaluations?: Array<{
        index?: number;
        sentiment?: string;
        convictionScore?: number;
        rationale?: string;
        englishTitle?: string;
        englishDescription?: string;
        sourceLanguageLabel?: string;
      }>;
    };

    const evalByIndex = new Map<
      number,
      NonNullable<typeof parsed.articleEvaluations>[number]
    >();
    for (const ev of parsed.articleEvaluations ?? []) {
      if (typeof ev.index === 'number') {
        evalByIndex.set(ev.index, ev);
      }
    }

    const evaluatedArticles: WatchlistMoverArticle[] = candidatePool.map(
      (entry, idx) => {
        const ev = evalByIndex.get(idx);
        const sentiment = normalizeSentiment(ev?.sentiment);
        const rawScore =
          typeof ev?.convictionScore === 'number' ? ev.convictionScore : 60;
        const convictionScore = Math.max(1, Math.min(99, Math.round(rawScore)));

        const englishTitle =
          typeof ev?.englishTitle === 'string' && ev.englishTitle.trim()
            ? ev.englishTitle.trim()
            : '';
        const englishDescription =
          typeof ev?.englishDescription === 'string' &&
          ev.englishDescription.trim()
            ? ev.englishDescription.trim()
            : '';
        const isTranslated = Boolean(englishTitle) || entry.needsTranslation;
        const translatedFromLanguage = isTranslated
          ? formatLanguageName(
              ev?.sourceLanguageLabel || entry.article.language || 'non-en'
            )
          : null;

        return {
          id: entry.article.id || `wl_${idx}`,
          title: englishTitle || entry.article.title,
          description:
            englishDescription || entry.article.description || null,
          url: entry.article.url,
          publishedAt:
            entry.article.published_at || new Date().toISOString(),
          sourceName:
            entry.article.source?.name ||
            entry.article.source?.domain ||
            'News Source',
          sourceDomain: entry.article.source?.domain || 'news',
          articleType: entry.article.type || 'editorial',
          companyLabel: entry.company.label,
          companyValue: entry.company.value,
          companyEntityType: entry.company.entityType,
          sentiment,
          convictionScore,
          rationale:
            typeof ev?.rationale === 'string' && ev.rationale.trim()
              ? ev.rationale.trim()
              : `${sentiment} coverage impacting ${entry.company.label}.`,
          isTranslated,
          translatedFromLanguage,
        };
      }
    );

    const summaryByVal = new Map<
      string,
      { stance: 'Bullish' | 'Bearish' | 'Mixed' | 'Neutral'; summary: string }
    >();
    for (const cs of parsed.companySummaries ?? []) {
      if (typeof cs.companyValue === 'string' && cs.companyValue.trim()) {
        summaryByVal.set(cs.companyValue.trim().toLowerCase(), {
          stance: normalizeStance(cs.stance),
          summary:
            typeof cs.summary === 'string' && cs.summary.trim()
              ? cs.summary.trim()
              : 'Monitoring recent institutional coverage.',
        });
      }
    }

    const companyDigests: WatchlistCompanyDigest[] = companies.map((c) => {
      const compLower = c.value.toLowerCase();
      const compArticles = evaluatedArticles.filter(
        (a) => a.companyValue.toLowerCase() === compLower
      );
      const bullishCount = compArticles.filter(
        (a) => a.sentiment === 'Bullish'
      ).length;
      const bearishCount = compArticles.filter(
        (a) => a.sentiment === 'Bearish'
      ).length;
      const matched = summaryByVal.get(compLower);

      const fallbackStance: WatchlistCompanyDigest['stance'] =
        bullishCount > 0 && bearishCount > 0
          ? 'Mixed'
          : bullishCount > bearishCount
            ? 'Bullish'
            : bearishCount > bullishCount
              ? 'Bearish'
              : 'Neutral';

      return {
        label: c.label,
        entityType: c.entityType,
        value: c.value,
        sector: c.sector || 'Tracked Company',
        stance: matched?.stance ?? fallbackStance,
        summary:
          matched?.summary ||
          compArticles[0]?.title ||
          `Tracking latest news developments for ${c.label}.`,
        articleCount: compArticles.length,
        bullishCount,
        bearishCount,
      };
    });

    const sortByConvictionThenNewest = (
      a: WatchlistMoverArticle,
      b: WatchlistMoverArticle
    ) => {
      if (b.convictionScore !== a.convictionScore) {
        return b.convictionScore - a.convictionScore;
      }
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    };

    const dedupeByUrl = (items: WatchlistMoverArticle[]) => {
      const seen = new Set<string>();
      const out: WatchlistMoverArticle[] = [];
      for (const item of items) {
        const k = (item.url || item.id || item.title).toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(item);
      }
      return out;
    };

    const topBullish = dedupeByUrl(
      evaluatedArticles
        .filter((a) => a.sentiment === 'Bullish')
        .sort(sortByConvictionThenNewest)
    ).slice(0, 5);

    const topBearish = dedupeByUrl(
      evaluatedArticles
        .filter((a) => a.sentiment === 'Bearish')
        .sort(sortByConvictionThenNewest)
    ).slice(0, 5);

    const sentimentCounts = {
      bullish: evaluatedArticles.filter((a) => a.sentiment === 'Bullish')
        .length,
      bearish: evaluatedArticles.filter((a) => a.sentiment === 'Bearish')
        .length,
      neutral: evaluatedArticles.filter((a) => a.sentiment === 'Neutral')
        .length,
      totalArticles: evaluatedArticles.length,
    };

    const result: WatchlistDigestResponse = {
      executiveSummary:
        typeof parsed.executiveSummary === 'string' &&
        parsed.executiveSummary.trim()
          ? parsed.executiveSummary.trim()
          : `Synthesized ${evaluatedArticles.length} recent articles across ${companies.length} followed companies.`,
      keyThemes: Array.isArray(parsed.keyThemes)
        ? parsed.keyThemes
            .map((t) => String(t).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [],
      companyDigests,
      topBullish,
      topBearish,
      sentimentCounts,
      generatedAt: new Date().toISOString(),
    };

    digestCache.set(digestCacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  } catch (error) {
    logGenAICall({
      model,
      prompt,
      config,
      error,
    });
    throw error;
  }
}
