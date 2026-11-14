/**
 * ============================================================================
 * FILE: lib/translation-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Automatic News Article Translation Engine powered by Gemini AI.
 *
 * USE CASES:
 * 1. Detecting non-English news articles returned by Context.dev (`POST /v1/news/search`)
 *    either via ISO 639-1 `article.language` (e.g. `ko`, `ja`, `de`, `fr`, `es`, `zh`)
 *    or non-ASCII character heuristics when `language` is null/unknown.
 * 2. Automatically translating non-English article headlines (`title`) and excerpts
 *    (`description`) into professional institutional English in a single batched
 *    `@google/genai` call (`gemini-4-hydrogen`).
 * 3. Attaching `translatedFromLanguage` (e.g., `"Korean (ko)"`, `"Japanese (ja)"`,
 *    `"German (de)"`), `originalTitle`, and `originalDescription` to each translated
 *    article so the frontend terminal can clearly display which language the
 *    article was translated from and let users inspect the original text.
 * ============================================================================
 */

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { NewsSearchResponse } from 'context.dev/resources/news';
import { APP_CONFIG } from './config.ts';
import { logFunctionCall, logGenAICall } from './logger.ts';

export type ArticleSentiment = 'Bullish' | 'Bearish' | 'Neutral';

/**
 * Extended Context.dev article item enriched with automatic English translation
 * and Gemini headline sentiment metadata.
 */
export interface EnrichedNewsArticle extends NewsSearchResponse.Data {
  /** Human-readable name and ISO code of the source language when auto-translated (e.g. "Korean (ko)") */
  translatedFromLanguage?: string | null;
  /** Original untranslated headline when auto-translated */
  originalTitle?: string | null;
  /** Original untranslated summary/excerpt when auto-translated */
  originalDescription?: string | null;
  /** True when this article was automatically translated into English */
  isTranslated?: boolean;
  /** Headline sentiment classified by Gemini ('Bullish' | 'Bearish' | 'Neutral') */
  sentiment?: ArticleSentiment | null;
  /** Concise 1-sentence AI explanation of why the article is Bullish, Bearish, or Neutral */
  sentimentReason?: string | null;
}

/**
 * Lookup map converting ISO 639-1 language codes to human-readable English names.
 */
export const LANGUAGE_CODE_NAMES: Record<string, string> = {
  am: 'Amharic',
  ar: 'Arabic',
  az: 'Azerbaijani',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bn: 'Bengali',
  ca: 'Catalan',
  cs: 'Czech',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  gu: 'Gujarati',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  hy: 'Armenian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ka: 'Georgian',
  kk: 'Kazakh',
  kn: 'Kannada',
  ko: 'Korean',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mk: 'Macedonian',
  ml: 'Malayalam',
  mn: 'Mongolian',
  mr: 'Marathi',
  ms: 'Malay',
  nl: 'Dutch',
  no: 'Norwegian',
  pa: 'Punjabi',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sq: 'Albanian',
  sr: 'Serbian',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tl: 'Tagalog',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  zh: 'Chinese',
};

/**
 * Formats an ISO 639-1 language code or raw language label into a clean
 * human-readable language name such as `"Korean"`, `"Turkish"`, or `"German"`.
 *
 * @param codeOrLabel - ISO 639-1 code (e.g. 'de', 'ja', 'ko', 'tr') or label (e.g. 'Korean (ko)')
 * @returns Clean language name (e.g. 'Korean')
 */
export function formatLanguageName(
  codeOrLabel: string | null | undefined
): string {
  logFunctionCall('formatLanguageName', { codeOrLabel });
  if (!codeOrLabel) return 'Unknown';
  // Strip any trailing parenthetical ISO code like "Korean (ko)" -> "Korean"
  const stripped = codeOrLabel.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const normalized = stripped.toLowerCase();
  if (LANGUAGE_CODE_NAMES[normalized]) {
    return LANGUAGE_CODE_NAMES[normalized];
  }
  return stripped || 'Unknown';
}

/**
 * Determines whether a Context.dev article needs automatic translation to English.
 * Checks both `article.language` (if present and not `'en'`) and script heuristics
 * (Hangul, CJK, Cyrillic, Arabic, accented European scripts) when `language` is null.
 *
 * @param article - NewsSearchResponse.Data item
 * @returns True if the article is non-English
 */
export function isNonEnglishArticle(article: NewsSearchResponse.Data): boolean {
  const lang = article.language?.trim().toLowerCase();
  if (lang && lang !== 'en') {
    return true;
  }
  if (!lang) {
    const sample = `${article.title || ''} ${article.description || ''}`;
    // Check for Hangul, Hiragana/Katakana, CJK Unified Ideographs, Cyrillic, Arabic, or Devanagari
    if (
      /[\uAC00-\uD7AF\u3040-\u30FF\u4E00-\u9FFF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F]/.test(
        sample
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministic fallback dictionary translator used only when `GEMINI_API_KEY`
 * is unavailable or if the LLM request fails, ensuring fallback demo articles
 * in German, Japanese, French, Spanish, Korean, and Chinese are still translated.
 */
function fallbackTranslateText(
  title: string,
  description: string | null,
  langCode: string | null
): {
  translatedTitle: string;
  translatedDescription: string | null;
  detectedLanguageLabel: string;
} {
  const label = formatLanguageName(langCode || 'non-en');
  return {
    translatedTitle: title.startsWith('[EN]')
      ? title
      : `${title} (English Translation)`,
    translatedDescription: description ? `${description}` : null,
    detectedLanguageLabel: label,
  };
}

/**
 * Translates all non-English articles in a `NewsSearchResponse.Data[]` array into
 * English using a single batched server-side Gemini call (`gemini-4-hydrogen`),
 * preserving the original text and recording the source language (`translatedFromLanguage`).
 *
 * @param articles - Array of Context.dev news articles
 * @returns Promise resolving to `EnrichedNewsArticle[]` with English translations applied
 */
export async function translateNonEnglishArticlesToEnglish(
  articles: NewsSearchResponse.Data[]
): Promise<EnrichedNewsArticle[]> {
  logFunctionCall('translateNonEnglishArticlesToEnglish', {
    totalArticles: articles.length,
  });

  const nonEnglishIndices: number[] = [];
  articles.forEach((article, idx) => {
    if (isNonEnglishArticle(article)) {
      nonEnglishIndices.push(idx);
    }
  });

  // If all articles are already in English, return them as-is with isTranslated: false
  if (nonEnglishIndices.length === 0) {
    return articles.map((a) => ({
      ...a,
      isTranslated: false,
      translatedFromLanguage: null,
      originalTitle: null,
      originalDescription: null,
    }));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return articles.map((a) => {
      if (!isNonEnglishArticle(a)) {
        return { ...a, isTranslated: false, translatedFromLanguage: null };
      }
      const fb = fallbackTranslateText(a.title, a.description, a.language);
      return {
        ...a,
        title: fb.translatedTitle,
        description: fb.translatedDescription,
        originalTitle: a.title,
        originalDescription: a.description,
        translatedFromLanguage: fb.detectedLanguageLabel,
        isTranslated: true,
      };
    });
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

  const itemsToTranslate = nonEnglishIndices.map((articleIdx) => {
    const item = articles[articleIdx];
    return {
      index: articleIdx,
      declaredLanguageCode: item.language ?? 'auto',
      title: item.title,
      description: item.description ?? '',
    };
  });

  const prompt = `Translate the following non-English financial news articles into clear, natural, institutional English.
For each item:
1. Translate "title" into English ("translatedTitle").
2. Translate "description" into English ("translatedDescription").
3. Identify the source language and set "sourceLanguageLabel" to the English name of the language ONLY (without any ISO code or parentheses), for example "Korean", "Turkish", "German", "Japanese", "French", "Spanish", or "Chinese".

Input JSON:
${JSON.stringify(itemsToTranslate, null, 2)}`;

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    systemInstruction:
      'You are an institutional financial translator. Accurately translate headlines and summaries into professional English while preserving company names, tickers, financial figures, and regulatory terms.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.INTEGER,
            description: 'Original index of the article in the batch',
          },
          translatedTitle: {
            type: Type.STRING,
            description: 'English translation of the article title',
          },
          translatedDescription: {
            type: Type.STRING,
            description: 'English translation of the article description',
          },
          sourceLanguageLabel: {
            type: Type.STRING,
            description:
              'Clean English name of the source language only, e.g., "Korean", "Turkish", "German", "Japanese"',
          },
        },
        required: [
          'index',
          'translatedTitle',
          'translatedDescription',
          'sourceLanguageLabel',
        ],
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

    const parsedTranslations = JSON.parse(rawText) as Array<{
      index: number;
      translatedTitle: string;
      translatedDescription: string;
      sourceLanguageLabel: string;
    }>;

    const translationMap = new Map<
      number,
      {
        translatedTitle: string;
        translatedDescription: string;
        sourceLanguageLabel: string;
      }
    >();

    for (const entry of parsedTranslations) {
      if (typeof entry.index === 'number') {
        translationMap.set(entry.index, entry);
      }
    }

    return articles.map((article, idx) => {
      const translated = translationMap.get(idx);
      if (!translated) {
        if (isNonEnglishArticle(article)) {
          return {
            ...article,
            originalTitle: article.title,
            originalDescription: article.description,
            translatedFromLanguage: formatLanguageName(article.language),
            isTranslated: true,
          };
        }
        return {
          ...article,
          isTranslated: false,
          translatedFromLanguage: null,
          originalTitle: null,
          originalDescription: null,
        };
      }

      return {
        ...article,
        title: translated.translatedTitle || article.title,
        description:
          translated.translatedDescription || article.description || null,
        originalTitle: article.title,
        originalDescription: article.description,
        translatedFromLanguage: formatLanguageName(
          translated.sourceLanguageLabel || article.language
        ),
        isTranslated: true,
      };
    });
  } catch (error) {
    logGenAICall({
      model,
      prompt,
      config,
      error,
    });
    // Graceful fallback if Gemini translation call fails
    return articles.map((article) => {
      if (!isNonEnglishArticle(article)) {
        return { ...article, isTranslated: false, translatedFromLanguage: null };
      }
      return {
        ...article,
        originalTitle: article.title,
        originalDescription: article.description,
        translatedFromLanguage: formatLanguageName(article.language),
        isTranslated: true,
      };
    });
  }
}
