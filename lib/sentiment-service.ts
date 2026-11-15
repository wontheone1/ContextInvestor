/**
 * ============================================================================
 * FILE: lib/sentiment-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Lightweight Server-Side Headline Sentiment Classifier powered by Gemini AI.
 *
 * USE CASES:
 * 1. Analyzing each news article's headline (`title`) in a single low-latency
 *    batched `@google/genai` call using `gemini-3.1-flash-lite` with
 *    `ThinkingLevel.MINIMAL`.
 * 2. Classifying each article as `'Bullish'`, `'Bearish'`, or `'Neutral'` from an
 *    institutional equity investor's perspective.
 * 3. Attaching `sentiment` to each `EnrichedNewsArticle` for table rendering
 *    and client-side sentiment filtering.
 * ============================================================================
 */

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { APP_CONFIG } from './config.ts';
import { logFunctionCall, logGenAICall } from './logger.ts';
import type {
  ArticleSentiment,
  EnrichedNewsArticle,
} from './translation-service.ts';

function normalizeSentiment(value: unknown): ArticleSentiment {
  if (typeof value !== 'string') return 'Neutral';
  const v = value.trim().toLowerCase();
  if (v === 'bullish') return 'Bullish';
  if (v === 'bearish') return 'Bearish';
  return 'Neutral';
}

/**
 * Classifies headlines for an array of `EnrichedNewsArticle` items using a single
 * lightweight Gemini (`gemini-3.1-flash-lite`) call.
 *
 * @param articles - Array of news articles to classify
 * @returns Promise resolving to enriched articles with `sentiment` populated, plus optional error info
 */
export async function analyzeHeadlineSentiments(
  articles: EnrichedNewsArticle[],
  locale: 'en' | 'ko' = 'en'
): Promise<{
  articles: EnrichedNewsArticle[];
  sentimentError: string | null;
}> {
  const isKo = locale === 'ko';
  logFunctionCall('analyzeHeadlineSentiments', {
    articleCount: articles.length,
    locale,
  });

  if (articles.length === 0) {
    return { articles, sentimentError: null };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      articles: articles.map((a) => ({ ...a, sentiment: a.sentiment ?? null })),
      sentimentError:
        'GEMINI_API_KEY is not configured in Settings > Secrets for headline sentiment analysis.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const model = APP_CONFIG.gemini.sentimentModel;
  const headlinesPayload = articles.map((article, idx) => ({
    index: idx,
    headline: article.title,
    excerpt: article.description ? article.description.slice(0, 180) : '',
  }));

  const prompt = `Classify the investor market sentiment of each news article below strictly as "Bullish", "Bearish", or "Neutral", and provide a concise 1-sentence reason (${
    isKo
      ? 'written in natural, institutional Korean (한국어)'
      : 'max 18 words in English'
  }) explaining why.

Articles:
${JSON.stringify(headlinesPayload, null, 2)}`;

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MINIMAL,
    },
    systemInstruction: `You are an institutional financial news analyst. For each article, return sentiment (strictly "Bullish", "Bearish", or "Neutral" in English) and a crisp 1-sentence reason explaining the specific positive catalyst, negative risk/headwind, or neutral context for investors.${
      isKo
        ? ' Write the `reason` field in natural, institutional Korean (한국어), while keeping `sentiment` strictly in English ("Bullish", "Bearish", or "Neutral").'
        : ''
    }`,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.INTEGER,
            description: 'Zero-based index matching the input article list',
          },
          sentiment: {
            type: Type.STRING,
            description: 'Exactly one of: Bullish, Bearish, Neutral',
          },
          reason: {
            type: Type.STRING,
            description: isKo
              ? 'Concise 1-sentence explanation in Korean (한국어) of why the article is Bullish, Bearish, or Neutral'
              : 'Concise 1-sentence explanation (<= 18 words) of why the article is Bullish, Bearish, or Neutral',
          },
        },
        required: ['index', 'sentiment', 'reason'],
      },
    },
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const rawText = (response.text ?? '[]').trim();
    logGenAICall({
      model,
      prompt,
      config,
      output: rawText,
    });

    const parsed = JSON.parse(rawText) as Array<{
      index: number;
      sentiment: string;
      reason?: string;
    }>;

    const sentimentMap = new Map<
      number,
      { sentiment: ArticleSentiment; reason: string | null }
    >();
    for (const item of parsed) {
      if (typeof item.index === 'number') {
        const cleanReason =
          typeof item.reason === 'string' && item.reason.trim()
            ? item.reason.trim()
            : null;
        sentimentMap.set(item.index, {
          sentiment: normalizeSentiment(item.sentiment),
          reason: cleanReason,
        });
      }
    }

    const enriched = articles.map((article, idx) => {
      const entry = sentimentMap.get(idx);
      return {
        ...article,
        sentiment: entry?.sentiment ?? 'Neutral',
        sentimentReason: entry?.reason ?? null,
      };
    });

    return {
      articles: enriched,
      sentimentError: null,
    };
  } catch (error) {
    logGenAICall({
      model,
      prompt,
      config,
      error,
    });
    const message =
      error instanceof Error
        ? error.message
        : 'Headline sentiment analysis failed.';
    return {
      articles: articles.map((a) => ({
        ...a,
        sentiment: a.sentiment ?? null,
        sentimentReason: a.sentimentReason ?? null,
      })),
      sentimentError: message,
    };
  }
}
