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
  articles: MarketBriefArticleInput[]
): Promise<AIMarketBriefResponse> {
  logFunctionCall('generateCompanyMarketBrief', {
    companyQuery,
    articleCount: articles.length,
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

  const prompt = `Analyze the following recent news coverage for "${companyQuery}" retrieved via Context.dev and produce a rigorous institutional investor intelligence brief.\n\nNews Articles:\n${formattedDigest}`;

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    systemInstruction:
      'You are a senior quantitative equity analyst at an institutional investment desk. Synthesize news flow into concise, factual, high-signal briefings without hype. Keep executiveSummary under 80 words, provide 3 concrete keyCatalysts, and 2 concrete riskFactors.',
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
          description: 'Concise 2-3 sentence synthesis of the current news cycle for this company',
        },
        keyCatalysts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 3 positive or material operational catalysts identified in the articles',
        },
        riskFactors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 2 regulatory, competitive, or execution risks highlighted in the coverage',
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

    const parsed = JSON.parse(rawText);
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
        parsed.executiveSummary ||
        `Recent news flow for ${companyQuery} reflects active institutional coverage across ${articles.length} articles.`,
      keyCatalysts: Array.isArray(parsed.keyCatalysts)
        ? parsed.keyCatalysts.slice(0, 3)
        : [],
      riskFactors: Array.isArray(parsed.riskFactors)
        ? parsed.riskFactors.slice(0, 2)
        : [],
      sectorImpact:
        parsed.sectorImpact ||
        'Monitoring cross-sector read-through from primary coverage.',
      modelUsed: model,
      generatedAt: new Date().toISOString(),
    };
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
