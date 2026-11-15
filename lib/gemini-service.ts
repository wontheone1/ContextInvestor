/**
 * ============================================================================
 * FILE: lib/gemini-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Gemini AI Quantitative News Synthesis & Sentiment Engine.
 *
 * USE CASES:
 * 1. Analyzing cached or live Context.dev company news articles on the server
 *    using the `@google/genai` SDK (`gemini-4-hydrogen`).
 * 2. Producing structured institutional market briefings: Executive Summary,
 *    Sentiment Signal (Bullish / Neutral / Bearish), Key Catalysts, Risk Vectors,
 *    and Quantitative Takeaways.
 * 3. Automatically logging all GenAI calls (model, prompt, config, and output)
 *    with inlineData stripped via `logGenAICall`.
 * ============================================================================
 */

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  isTransientGatewayError,
  parseJsonSafely,
  withTransientRetry,
} from './api-error-utils';
import { APP_CONFIG } from './config';
import { logFunctionCall, logGenAICall } from './logger';

export interface MarketBriefArticleInput {
  title: string;
  description: string | null;
  sourceName: string;
  publishedAt: string | null;
  type: string;
}

export interface AIMarketBriefResponse {
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  confidenceScore: number;
  executiveSummary: string;
  keyCatalysts: string[];
  riskFactors: string[];
  sectorImpact: string;
  modelUsed: string;
  generatedAt: string;
}

/**
 * Creates a server-side GoogleGenAI instance with required AI Studio telemetry headers.
 *
 * @returns Initialized GoogleGenAI SDK client
 */
function getGenAIClient(): GoogleGenAI {
  logFunctionCall('getGenAIClient', {
    model: APP_CONFIG.gemini.defaultModel,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check Settings > Secrets in AI Studio.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });
}

/**
 * Generates a structured institutional investor briefing from a list of company
 * news articles retrieved via Context.dev.
 *
 * @param companyQuery - The company name or ticker being analyzed
 * @param articles - Array of article headlines and excerpts
 * @returns Structured AIMarketBriefResponse
 */
export async function generateCompanyMarketBrief(
  companyQuery: string,
  articles: MarketBriefArticleInput[],
  locale: 'en' | 'ko' = 'en'
): Promise<AIMarketBriefResponse> {
  const isKo = locale === 'ko';
  logFunctionCall('generateCompanyMarketBrief', {
    companyQuery,
    articleCount: articles.length,
    locale,
  });

  const ai = getGenAIClient();
  const model = APP_CONFIG.gemini.defaultModel;

  const formattedDigest = articles
    .slice(0, 12)
    .map(
      (a, idx) =>
        `[${idx + 1}] (${a.type.toUpperCase()}) ${a.title} — Source: ${a.sourceName} (${a.publishedAt ?? 'Recent'})\nExcerpt: ${a.description ?? 'No excerpt provided.'}`
    )
    .join('\n\n');

  const languageDirective = isKo
    ? '\n\nIMPORTANT LANGUAGE RULE: Write "executiveSummary", every item in "keyCatalysts", every item in "riskFactors", and "sectorImpact" in natural, concise institutional Korean (한국어). However, "sentiment" MUST remain strictly one of the English enum strings: "Bullish", "Neutral", or "Bearish".'
    : '';

  const prompt = `Analyze the following recent news coverage for "${companyQuery}" and produce an institutional investor briefing with balanced positive catalysts (bullish drivers), negative risks/headwinds (bearish factors), and an overall assessment.${languageDirective}\n\nNews Articles:\n${formattedDigest}`;

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    systemInstruction:
      'You are a senior quantitative equity analyst at an institutional investment desk. Synthesize news flow into concise, factual, high-signal briefings without hype. Provide 3 concrete keyCatalysts (positive drivers/tailwinds), 3 concrete riskFactors (negative risks/headwinds), and an executiveSummary (2-3 sentence overall assessment weighing catalysts against risks).',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        sentiment: {
          type: Type.STRING,
          description: 'Overall institutional news sentiment: Bullish, Neutral, or Bearish',
        },
        confidenceScore: {
          type: Type.INTEGER,
          description: 'Signal conviction from 1 to 100 based on article consistency and source authority',
        },
        executiveSummary: {
          type: Type.STRING,
          description: 'Concise 2-3 sentence overall assessment weighing positive catalysts against downside risks',
        },
        keyCatalysts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 3 positive catalysts or bullish operational drivers identified in the coverage',
        },
        riskFactors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 3 negative headwinds, regulatory, competitive, or execution risks highlighted in the coverage',
        },
        sectorImpact: {
          type: Type.STRING,
          description: 'One-sentence assessment of how this news affects the broader sector',
        },
      },
      required: [
        'sentiment',
        'confidenceScore',
        'executiveSummary',
        'keyCatalysts',
        'riskFactors',
        'sectorImpact',
      ],
    },
  };

  let activeModelUsed: string = model;

  try {
    let response;
    try {
      response = await withTransientRetry(
        () =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config,
          }),
        { label: 'generateCompanyMarketBrief.primary' }
      );
    } catch (primaryErr) {
      if (!isTransientGatewayError(primaryErr)) {
        throw primaryErr;
      }
      activeModelUsed = APP_CONFIG.gemini.sentimentModel;
      response = await withTransientRetry(
        () =>
          ai.models.generateContent({
            model: activeModelUsed,
            contents: prompt,
            config: {
              ...config,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL,
              },
            },
          }),
        { maxRetries: 1, label: 'generateCompanyMarketBrief.fallback' }
      );
    }

    const rawText = (response.text ?? '{}').trim();
    logGenAICall({
      model: activeModelUsed,
      prompt,
      config,
      output: rawText,
    });

    const parsed = parseJsonSafely<Record<string, unknown>>(rawText, true);
    if (!parsed) {
      throw new Error('Upstream returned non-JSON response for AI market brief.');
    }
    const sentimentValue =
      parsed.sentiment === 'Bullish' ||
      parsed.sentiment === 'Bearish' ||
      parsed.sentiment === 'Neutral'
        ? parsed.sentiment
        : 'Neutral';

    return {
      sentiment: sentimentValue,
      confidenceScore:
        typeof parsed.confidenceScore === 'number'
          ? Math.min(100, Math.max(1, Math.round(parsed.confidenceScore)))
          : 75,
      executiveSummary:
        (typeof parsed.executiveSummary === 'string' && parsed.executiveSummary) ||
        (isKo
          ? `${companyQuery} 관련 최신 기사 ${articles.length}건을 기반으로 한 종합 분석입니다.`
          : `Recent news flow for ${companyQuery} reflects active institutional coverage across ${articles.length} articles.`),
      keyCatalysts: Array.isArray(parsed.keyCatalysts)
        ? (parsed.keyCatalysts as string[]).slice(0, 3)
        : [],
      riskFactors: Array.isArray(parsed.riskFactors)
        ? (parsed.riskFactors as string[]).slice(0, 3)
        : [],
      sectorImpact:
        (typeof parsed.sectorImpact === 'string' && parsed.sectorImpact) ||
        (isKo
          ? '주요 보도에 따른 섹터 및 밸류체인 파급 효과를 모니터링 중입니다.'
          : 'Monitoring cross-sector read-through from primary coverage.'),
      modelUsed: activeModelUsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logGenAICall({
      model: activeModelUsed,
      prompt,
      config,
      error,
    });
    throw error;
  }
}
