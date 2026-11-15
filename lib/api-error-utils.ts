/**
 * ============================================================================
 * FILE: lib/api-error-utils.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Isomorphic (Client & Server) Upstream Error Normalization, Non-JSON Gateway
 * Guard, and Jittered Exponential Backoff Utilities.
 *
 * USE CASES:
 * 1. Eliminating raw `SyntaxError: Unexpected token 'R', "Rate exceeded." is
 *    not valid JSON` parser crashes when Cloud Run proxies, Gemini gateways,
 *    Context.dev, or Yahoo Finance return HTTP 429 / 502 / 503 plain-text or
 *    HTML bodies instead of JSON.
 * 2. Classifying rate-limit (`429` / `"Rate exceeded"` / `"Too Many Requests"` /
 *    `"RESOURCE_EXHAUSTED"`) and transient gateway hiccups so server services
 *    can retry automatically with jittered backoff and UI components can render
 *    calm, localized recovery notices with automatic countdown retry.
 * 3. Bounding parallel external HTTP fan-out (`mapWithConcurrency`) so bursty
 *    symbol resolution does not trigger upstream rate limiters.
 * ============================================================================
 */

import { APP_CONFIG } from './config';
import { logFunctionCall } from './logger';

export type ApiErrorCode =
  | 'RATE_LIMITED'
  | 'UPSTREAM_TEMPORARY'
  | 'BAD_REQUEST'
  | 'API_ERROR';

export interface NormalizedApiError {
  /** Clean, human-readable localized explanation safe to render directly in UI */
  message: string;
  /** Structured classification code */
  errorCode: ApiErrorCode;
  /** True when the failure stems from an API or proxy rate limit / quota cap */
  isRateLimit: boolean;
  /** True when the failure is temporary and safe to retry automatically */
  isTransient: boolean;
  /** Recommended HTTP status code for Next.js API route responses */
  statusCode: number;
}

export interface SafeFetchJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
  errorMessage: string | null;
  errorCode: ApiErrorCode | null;
  isRateLimit: boolean;
  isTransient: boolean;
}

const RATE_LIMIT_PATTERN =
  /rate[\s_-]*exceeded|rate[\s_-]*limit|too\s+many\s+requests|resource_exhausted|quota\s+exceeded|requests?\s+per\s+minute|\b429\b/i;

const MALFORMED_JSON_PATTERN =
  /unexpected\s+token|is\s+not\s+valid\s+json|json\.parse|unexpected\s+end\s+of\s+json|expected\s+property\s+name\s+or\s+['"}]/i;

const TRANSIENT_GATEWAY_PATTERN =
  /bad\s+gateway|service\s+unavailable|gateway\s+timeout|temporarily\s+unavailable|upstream\s+connect|fetch\s+failed|network\s*error|etimedout|econnreset|socket\s+hang\s+up|aborted|timed?\s*out|\b502\b|\b503\b|\b504\b/i;

/**
 * Extracts a raw string representation from any thrown error value, response
 * payload, or plain string.
 *
 * @param error - Unknown error object or message string
 * @returns Trimmed string message
 */
export function extractRawErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim();
  }
  if (error instanceof Error) {
    return (error.message || '').trim();
  }
  if (error && typeof error === 'object') {
    const rec = error as Record<string, unknown>;
    if (typeof rec.error === 'string') return rec.error.trim();
    if (typeof rec.message === 'string') return rec.message.trim();
  }
  return '';
}

/**
 * Detects whether an error or HTTP status code represents an upstream rate-limit
 * or quota exhaustion event—including cases where a plain-text `"Rate exceeded."`
 * body caused `JSON.parse` to throw a `SyntaxError`.
 *
 * @param errorOrMessage - Thrown error, error string, or response snippet
 * @param status - Optional HTTP status code
 * @returns `true` if rate-limited
 */
export function isRateLimitError(
  errorOrMessage: unknown,
  status?: number
): boolean {
  if (status === 429) {
    return true;
  }
  const raw = extractRawErrorMessage(errorOrMessage);
  if (!raw) return false;
  return RATE_LIMIT_PATTERN.test(raw);
}

/**
 * Detects whether an error or HTTP status represents a transient gateway,
 * network timeout, or non-JSON proxy response that is safe to retry.
 *
 * @param errorOrMessage - Thrown error, error string, or response snippet
 * @param status - Optional HTTP status code
 * @returns `true` if transient
 */
export function isTransientGatewayError(
  errorOrMessage: unknown,
  status?: number
): boolean {
  if (
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }
  const raw = extractRawErrorMessage(errorOrMessage);
  if (!raw) return false;
  return (
    RATE_LIMIT_PATTERN.test(raw) ||
    MALFORMED_JSON_PATTERN.test(raw) ||
    TRANSIENT_GATEWAY_PATTERN.test(raw)
  );
}

/**
 * Sanitizes and translates any raw exception, plain-text gateway message, or
 * `SyntaxError` into a calm, investor-friendly localized error descriptor.
 * Guarantees raw parser messages like `Unexpected token 'R', "Rate exceeded." is not valid JSON`
 * or raw HTML markup are never shown in the UI.
 *
 * @param error - Caught error or raw message string
 * @param options - Optional HTTP status, UI locale, and custom fallback messages
 * @returns `NormalizedApiError` with clean message, flags, and HTTP status code
 */
export function formatGracefulApiError(
  error: unknown,
  options?: {
    status?: number;
    locale?: 'en' | 'ko';
    fallbackEn?: string;
    fallbackKo?: string;
  }
): NormalizedApiError {
  const locale = options?.locale === 'ko' ? 'ko' : 'en';
  const isKo = locale === 'ko';
  const status = options?.status;
  const raw = extractRawErrorMessage(error);

  const rateLimited = isRateLimitError(raw, status);
  if (rateLimited) {
    return {
      message: isKo
        ? '동시 요청이 집중되어 일시적인 호출 한도에 도달했습니다. 잠시 후 자동으로 다시 불러오거나 지금 다시 시도를 눌러주세요.'
        : 'High request volume reached a temporary rate limit. This section will retry automatically in a moment, or you can retry now.',
      errorCode: 'RATE_LIMITED',
      isRateLimit: true,
      isTransient: true,
      statusCode: 429,
    };
  }

  const malformedJson = MALFORMED_JSON_PATTERN.test(raw);
  const transientGateway = isTransientGatewayError(raw, status);
  const looksLikeHtml = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(
    raw
  );

  if (malformedJson || transientGateway || looksLikeHtml) {
    return {
      message: isKo
        ? '데이터 제공 서버 응답이 일시적으로 지연되었습니다. 잠시 후 자동으로 다시 시도하거나 새로고침해 주세요.'
        : 'The data service returned a temporary busy response. Retrying shortly, or click Retry Now.',
      errorCode: 'UPSTREAM_TEMPORARY',
      isRateLimit: false,
      isTransient: true,
      statusCode: status && status >= 500 && status < 600 ? status : 503,
    };
  }

  const cleaned = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const defaultFallback = isKo
    ? options?.fallbackKo || '요청을 처리하는 중 일시적인 문제가 발생했습니다. 다시 시도해 주세요.'
    : options?.fallbackEn || 'Unable to complete this request right now. Please try again.';

  const safeMessage =
    cleaned && cleaned.length <= 260 ? cleaned : defaultFallback;

  const isClientBadRequest = status === 400 || status === 404 || status === 422;

  return {
    message: safeMessage,
    errorCode: isClientBadRequest ? 'BAD_REQUEST' : 'API_ERROR',
    isRateLimit: false,
    isTransient: false,
    statusCode:
      status && status >= 400 && status < 600 ? status : 500,
  };
}

/**
 * Parses a JSON string without throwing exceptions, optionally stripping
 * leading/trailing Markdown code fences (` ```json ... ``` `) returned by LLMs.
 *
 * @param rawText - Raw text to parse
 * @param stripMarkdownFence - Whether to strip ```json fences before parsing
 * @returns Parsed value or `null` when invalid
 */
export function parseJsonSafely<T>(
  rawText: string,
  stripMarkdownFence = false
): T | null {
  if (!rawText || typeof rawText !== 'string') return null;
  let candidate = rawText.trim();
  if (!candidate) return null;

  if (stripMarkdownFence && candidate.startsWith('```')) {
    candidate = candidate
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

/**
 * Reads an HTTP `Response` body as text first and parses JSON safely so plain-text
 * proxy responses (`"Rate exceeded."`, `"Edge: Too Many Requests"`, HTML `502`)
 * never throw `SyntaxError: Unexpected token ... is not valid JSON`.
 *
 * @param res - Fetch `Response` instance
 * @returns Parsed JSON (or `null` if non-JSON) alongside HTTP status and raw text
 */
export async function readResponseJsonSafely<T>(res: Response): Promise<{
  ok: boolean;
  status: number;
  json: T | null;
  rawText: string;
}> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    rawText = '';
  }

  const parsed = parseJsonSafely<T>(rawText, false);
  return {
    ok: res.ok && parsed !== null,
    status: res.status,
    json: parsed,
    rawText,
  };
}

/**
 * Performs `fetch()` and decodes JSON safely, normalizing HTTP `429`, non-JSON
 * proxy responses (`"Rate exceeded."`), network failures, and `{ ok: false, error }`
 * envelopes into a clean `SafeFetchJsonResult<T>` without throwing `SyntaxError`.
 *
 * @param input - Fetch URL or RequestInfo
 * @param init - Optional RequestInit options
 * @param options - Optional locale and fallback copy for user-facing error messages
 * @returns Structured `SafeFetchJsonResult<T>`
 */
export async function safeFetchJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    locale?: 'en' | 'ko';
    fallbackEn?: string;
    fallbackKo?: string;
  }
): Promise<SafeFetchJsonResult<T>> {
  const locale = options?.locale === 'ko' ? 'ko' : 'en';

  try {
    const res = await fetch(input, init);
    const { json, rawText, status } = await readResponseJsonSafely<T>(res);

    if (res.ok && json !== null) {
      const envelope = json as unknown as Record<string, unknown>;
      if (envelope.ok === false) {
        const rawErr =
          typeof envelope.error === 'string' && envelope.error.trim()
            ? envelope.error.trim()
            : rawText || 'Request failed';
        const normalized = formatGracefulApiError(rawErr, {
          status,
          locale,
          fallbackEn: options?.fallbackEn,
          fallbackKo: options?.fallbackKo,
        });
        return {
          ok: false,
          status,
          data: json,
          rawText,
          errorMessage: normalized.message,
          errorCode: normalized.errorCode,
          isRateLimit:
            normalized.isRateLimit || envelope.errorCode === 'RATE_LIMITED',
          isTransient: normalized.isTransient,
        };
      }

      return {
        ok: true,
        status,
        data: json,
        rawText,
        errorMessage: null,
        errorCode: null,
        isRateLimit: false,
        isTransient: false,
      };
    }

    // Non-OK status OR unexpected non-JSON body (e.g. plain-text "Rate exceeded.")
    const envelopeError =
      json &&
      typeof json === 'object' &&
      typeof (json as unknown as Record<string, unknown>).error === 'string'
        ? String((json as unknown as Record<string, unknown>).error)
        : '';

    const sourceError =
      envelopeError ||
      rawText.slice(0, 280) ||
      `HTTP ${status}`;

    const normalized = formatGracefulApiError(sourceError, {
      status: json === null && res.ok ? 502 : status,
      locale,
      fallbackEn: options?.fallbackEn,
      fallbackKo: options?.fallbackKo,
    });

    return {
      ok: false,
      status,
      data: json,
      rawText,
      errorMessage: normalized.message,
      errorCode: normalized.errorCode,
      isRateLimit: normalized.isRateLimit,
      isTransient: normalized.isTransient,
    };
  } catch (networkErr) {
    const normalized = formatGracefulApiError(networkErr, {
      locale,
      fallbackEn: options?.fallbackEn,
      fallbackKo: options?.fallbackKo,
    });
    return {
      ok: false,
      status: 0,
      data: null,
      rawText: '',
      errorMessage: normalized.message,
      errorCode: normalized.errorCode,
      isRateLimit: normalized.isRateLimit,
      isTransient: normalized.isTransient,
    };
  }
}

/**
 * Sleeps for a specified duration in milliseconds.
 *
 * @param ms - Delay in milliseconds
 */
function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with jittered exponential backoff whenever a
 * rate-limit (`429` / `"Rate exceeded."`) or transient gateway error occurs.
 *
 * @param operation - Async callback to execute
 * @param options - Optional retry bounds and telemetry label
 * @returns Resolved value of `operation`
 */
export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    label?: string;
  }
): Promise<T> {
  const maxRetries =
    options?.maxRetries ?? APP_CONFIG.resilience.maxTransientRetries;
  const baseDelayMs =
    options?.baseDelayMs ?? APP_CONFIG.resilience.baseRetryDelayMs;
  const maxDelayMs =
    options?.maxDelayMs ?? APP_CONFIG.resilience.maxRetryDelayMs;
  const label = options?.label || 'transientOperation';

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < maxRetries && isTransientGatewayError(error);

      if (!shouldRetry) {
        throw error;
      }

      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 240);
      const waitTime = expDelay + jitter;

      logFunctionCall('withTransientRetry.backoff', {
        label,
        attempt: attempt + 1,
        maxRetries,
        waitTimeMs: waitTime,
        isRateLimit: isRateLimitError(error),
        reason: extractRawErrorMessage(error).slice(0, 140),
      });

      await delayMs(waitTime);
    }
  }

  throw lastError;
}

/**
 * Maps over an array with a strict concurrency cap so parallel upstream calls
 * (such as Yahoo Finance symbol verification for 8-10 related companies) do not
 * trip rate limiters simultaneously.
 *
 * @param items - Input array
 * @param concurrency - Maximum simultaneous in-flight promises
 * @param mapper - Async item mapper
 * @returns Ordered array of mapped results
 */
export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TOutput>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = cursor++;
      if (currentIndex >= items.length) {
        break;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: safeConcurrency }, () => worker())
  );

  return results;
}
