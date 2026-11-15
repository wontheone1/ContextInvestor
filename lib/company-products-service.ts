/**
 * ============================================================================
 * FILE: lib/company-products-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Company Products, Revenue Segments & Target Customer Intelligence
 * Service powered by Context.dev `POST /v1/web/answers` (`client.web.answers`
 * in `fast` mode with cited official URLs) and resilient Google Search-grounded
 * fallback + bilingual (`EN` | `한국어`) localization.
 *
 * USE CASES:
 * 1. Answering "What products and services does this company sell, how are its
 *    operating revenue segments structured, and who are its target customers?"
 *    inside Single-Company Research (`01. Price & Fundamentals` view).
 * 2. Hydrating side-by-side product lines, revenue segments, and customer
 *    segments across up to 4 selected public equities, ADRs, Korea Exchange
 *    (`KOSPI` / `KOSDAQ`) stocks, and private unicorns in the Cohort Matrix.
 * 3. Grounding every portfolio breakdown with clickable official product,
 *    solutions, and investor relations URLs (`sources[]`), backed by a 30-minute
 *    server-side TTL cache and automatic Korean (`한국어`) localization.
 * ============================================================================
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  lookupCompanyNameForAdrTicker,
  stripAdrSuffix,
} from './adr-directory';
import { parseJsonSafely, withTransientRetry } from './api-error-utils';
import { getCompanyProfileBySearch } from './company-profile-service';
import {
  buildSourceCitation,
  type CompanyProductLineItem,
  type CompanyProductsData,
  type CompanyProductsSourceCitation,
  type CompanyRevenueSegmentItem,
} from './company-products-types';
import { APP_CONFIG } from './config';
import {
  createContextDevClient,
  validateContextDevApiKey,
} from './context-dev';
import {
  lookupHangulPrivateAlias,
  lookupKrxDirectoryEntry,
  resolveDynamicKrxAutocomplete,
} from './krx-directory';
import { logFunctionCall, logGenAICall } from './logger';

/**
 * Curated canonical corporate domains & names for high-frequency US equities,
 * international ADRs, and private unicorns to focus `client.web.answers` on
 * official product & investor relations pages immediately without extra hops.
 */
const KNOWN_COMPANY_IDENTITY_MAP: Record<
  string,
  { name: string; domain: string; ticker: string | null; kind: 'public' | 'private' }
> = {
  NVDA: { name: 'NVIDIA Corporation', domain: 'nvidia.com', ticker: 'NVDA', kind: 'public' },
  NVIDIA: { name: 'NVIDIA Corporation', domain: 'nvidia.com', ticker: 'NVDA', kind: 'public' },
  AAPL: { name: 'Apple Inc.', domain: 'apple.com', ticker: 'AAPL', kind: 'public' },
  APPLE: { name: 'Apple Inc.', domain: 'apple.com', ticker: 'AAPL', kind: 'public' },
  MSFT: { name: 'Microsoft Corporation', domain: 'microsoft.com', ticker: 'MSFT', kind: 'public' },
  MICROSOFT: { name: 'Microsoft Corporation', domain: 'microsoft.com', ticker: 'MSFT', kind: 'public' },
  PLTR: { name: 'Palantir Technologies', domain: 'palantir.com', ticker: 'PLTR', kind: 'public' },
  PALANTIR: { name: 'Palantir Technologies', domain: 'palantir.com', ticker: 'PLTR', kind: 'public' },
  AMZN: { name: 'Amazon.com, Inc.', domain: 'amazon.com', ticker: 'AMZN', kind: 'public' },
  AMAZON: { name: 'Amazon.com, Inc.', domain: 'amazon.com', ticker: 'AMZN', kind: 'public' },
  GOOGL: { name: 'Alphabet Inc. (Google)', domain: 'abc.xyz', ticker: 'GOOGL', kind: 'public' },
  GOOG: { name: 'Alphabet Inc. (Google)', domain: 'google.com', ticker: 'GOOG', kind: 'public' },
  GOOGLE: { name: 'Alphabet Inc. (Google)', domain: 'google.com', ticker: 'GOOGL', kind: 'public' },
  META: { name: 'Meta Platforms, Inc.', domain: 'meta.com', ticker: 'META', kind: 'public' },
  TSLA: { name: 'Tesla, Inc.', domain: 'tesla.com', ticker: 'TSLA', kind: 'public' },
  TESLA: { name: 'Tesla, Inc.', domain: 'tesla.com', ticker: 'TSLA', kind: 'public' },
  AMD: { name: 'Advanced Micro Devices, Inc.', domain: 'amd.com', ticker: 'AMD', kind: 'public' },
  AVGO: { name: 'Broadcom Inc.', domain: 'broadcom.com', ticker: 'AVGO', kind: 'public' },
  BROADCOM: { name: 'Broadcom Inc.', domain: 'broadcom.com', ticker: 'AVGO', kind: 'public' },
  TSM: { name: 'TSMC (Taiwan Semiconductor)', domain: 'tsmc.com', ticker: 'TSM', kind: 'public' },
  TSMC: { name: 'TSMC (Taiwan Semiconductor)', domain: 'tsmc.com', ticker: 'TSM', kind: 'public' },
  ASML: { name: 'ASML Holding N.V.', domain: 'asml.com', ticker: 'ASML', kind: 'public' },
  ARM: { name: 'Arm Holdings plc', domain: 'arm.com', ticker: 'ARM', kind: 'public' },
  SKHY: { name: 'SK Hynix Inc.', domain: 'skhynix.com', ticker: 'SKHY', kind: 'public' },
  SSNLF: { name: 'Samsung Electronics Co., Ltd.', domain: 'samsung.com', ticker: 'SSNLF', kind: 'public' },
  ORCL: { name: 'Oracle Corporation', domain: 'oracle.com', ticker: 'ORCL', kind: 'public' },
  CRM: { name: 'Salesforce, Inc.', domain: 'salesforce.com', ticker: 'CRM', kind: 'public' },
  CRWD: { name: 'CrowdStrike Holdings, Inc.', domain: 'crowdstrike.com', ticker: 'CRWD', kind: 'public' },
  PANW: { name: 'Palo Alto Networks, Inc.', domain: 'paloaltonetworks.com', ticker: 'PANW', kind: 'public' },
  SNOW: { name: 'Snowflake Inc.', domain: 'snowflake.com', ticker: 'SNOW', kind: 'public' },
  NET: { name: 'Cloudflare, Inc.', domain: 'cloudflare.com', ticker: 'NET', kind: 'public' },
  NFLX: { name: 'Netflix, Inc.', domain: 'netflix.com', ticker: 'NFLX', kind: 'public' },
  INTC: { name: 'Intel Corporation', domain: 'intel.com', ticker: 'INTC', kind: 'public' },
  SMCI: { name: 'Super Micro Computer, Inc.', domain: 'supermicro.com', ticker: 'SMCI', kind: 'public' },
  STRIPE: { name: 'Stripe', domain: 'stripe.com', ticker: null, kind: 'private' },
  OPENAI: { name: 'OpenAI', domain: 'openai.com', ticker: null, kind: 'private' },
  ANTHROPIC: { name: 'Anthropic', domain: 'anthropic.com', ticker: null, kind: 'private' },
  DATABRICKS: { name: 'Databricks', domain: 'databricks.com', ticker: null, kind: 'private' },
  SPACEX: { name: 'SpaceX', domain: 'spacex.com', ticker: null, kind: 'private' },
  ANDURIL: { name: 'Anduril Industries', domain: 'anduril.com', ticker: null, kind: 'private' },
  XAI: { name: 'xAI', domain: 'x.ai', ticker: null, kind: 'private' },
};

/**
 * Example answer object passed to `client.web.answers({ json_format })`.
 * Per Context.dev SDK documentation (`web.d.ts` line 1743):
 * "`json_format` is an example answer object, NOT JSON Schema; unknowns may be null."
 */
const WEB_ANSWERS_EXAMPLE_FORMAT: Record<string, unknown> = {
  company_name: 'Official Company Name',
  official_domain: 'company.com',
  business_model_summary:
    'Concise 1-2 sentence executive summary explaining what commercial products and services the company sells and how it generates revenue.',
  primary_customer_segments: [
    'Enterprise IT & Cloud Buyers',
    'Developers & SMBs',
  ],
  revenue_segments: [
    {
      segment_name: 'Primary Operating Division or Revenue Segment',
      share_or_scale_note: 'Approximate % of revenue or commercial role (or "Private — share undisclosed")',
      key_offerings: 'Flagship monetized hardware, software, or service offerings in this segment',
    },
  ],
  product_lines: [
    {
      name: 'Official Product or Service Line Name',
      category: 'Commercial Category',
      description: 'Concise factual summary of what this product or service does for customers.',
      target_customers: 'Primary buyer persona or customer group',
      flagship_url: 'https://www.company.com/products/flagship',
    },
  ],
};

interface RawExtractedProductsShape {
  company_name?: string | null;
  official_domain?: string | null;
  business_model_summary?: string | null;
  primary_customer_segments?: Array<string | null> | null;
  revenue_segments?: Array<{
    segment_name?: string | null;
    share_or_scale_note?: string | null;
    key_offerings?: string | null;
  } | null> | null;
  product_lines?: Array<{
    name?: string | null;
    category?: string | null;
    description?: string | null;
    target_customers?: string | null;
    flagship_url?: string | null;
  } | null> | null;
}

interface ResolvedPortfolioTarget {
  canonicalKey: string;
  englishName: string;
  displayName: string;
  ticker: string | null;
  domain: string | null;
  kind: 'public' | 'private';
}

const productsPortfolioCache = new Map<
  string,
  { data: CompanyProductsData | null; expiresAt: number }
>();

/**
 * Resolves a user search query (US ticker, ADR, Korean stock name/6-digit code,
 * Hangul alias, or private company name) into a canonical target identity and
 * official corporate domain for `client.web.answers`.
 *
 * @param params - Query, entityType, optional domain/companyNameHint, and locale
 * @returns `ResolvedPortfolioTarget`
 */
async function resolvePortfolioTarget(params: {
  query: string;
  entityType?: string;
  domainHint?: string;
  companyNameHint?: string;
  locale: 'en' | 'ko';
}): Promise<ResolvedPortfolioTarget> {
  logFunctionCall('resolvePortfolioTarget', { ...params });

  const trimmed = stripAdrSuffix(params.query.trim());
  const cleanDomainHint = params.domainHint
    ? params.domainHint.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
    : null;

  // 1. Hangul private unicorn alias (e.g., `오픈AI` -> `OpenAI`)
  const hangulPrivate = lookupHangulPrivateAlias(trimmed);
  if (hangulPrivate) {
    const known = KNOWN_COMPANY_IDENTITY_MAP[hangulPrivate.toUpperCase()];
    return {
      canonicalKey: `private:${hangulPrivate.toLowerCase()}`,
      englishName: known?.name || hangulPrivate,
      displayName: known?.name || hangulPrivate,
      ticker: null,
      domain: cleanDomainHint || known?.domain || null,
      kind: 'private',
    };
  }

  // 2. Curated Korea Exchange (KOSPI / KOSDAQ) directory lookup
  const krxEntry =
    lookupKrxDirectoryEntry(trimmed) ||
    (params.companyNameHint ? lookupKrxDirectoryEntry(params.companyNameHint) : null);

  if (krxEntry) {
    const explicitUsAdr =
      Boolean(krxEntry.usAdrSymbol) &&
      trimmed.toUpperCase() === krxEntry.usAdrSymbol?.toUpperCase();
    const useAdrForEnglishName =
      params.locale === 'en' &&
      Boolean(krxEntry.usAdrSymbol) &&
      !/^\d{6}(\.(KS|KQ))?$/i.test(trimmed) &&
      !/[가-힣]/.test(trimmed);

    const resolvedTicker =
      explicitUsAdr || useAdrForEnglishName
        ? (krxEntry.usAdrSymbol as string)
        : krxEntry.symbol;

    return {
      canonicalKey: `krx:${krxEntry.code}`,
      englishName: krxEntry.enName,
      displayName: params.locale === 'ko' ? krxEntry.koName : krxEntry.enName,
      ticker: resolvedTicker,
      domain: cleanDomainHint || krxEntry.domain || null,
      kind: 'public',
    };
  }

  // 3. Dynamic 6-digit KRX code or Hangul stock name via Naver Stock Autocomplete
  if (/^[0-9A-Z]{6}(\.(KS|KQ))?$/i.test(trimmed) || /[가-힣]/.test(trimmed)) {
    const dyn = await resolveDynamicKrxAutocomplete(trimmed, params.locale);
    if (dyn) {
      return {
        canonicalKey: `krx:${dyn.symbol.toLowerCase()}`,
        englishName: dyn.enName,
        displayName: params.locale === 'ko' ? dyn.koName || dyn.displayName : dyn.enName,
        ticker: dyn.symbol,
        domain: cleanDomainHint || dyn.domain || null,
        kind: 'public',
      };
    }
  }

  // 4. Known US Equity / ADR / Private Unicorn fast map
  const upperKey = trimmed.toUpperCase();
  const knownDirect = KNOWN_COMPANY_IDENTITY_MAP[upperKey];
  if (knownDirect) {
    return {
      canonicalKey: knownDirect.ticker
        ? `ticker:${knownDirect.ticker.toLowerCase()}`
        : `private:${knownDirect.name.toLowerCase()}`,
      englishName: knownDirect.name,
      displayName: knownDirect.name,
      ticker: knownDirect.ticker,
      domain: cleanDomainHint || knownDirect.domain,
      kind: knownDirect.kind,
    };
  }

  // 5. ADR ticker directory lookup
  const adrCompanyName = lookupCompanyNameForAdrTicker(upperKey);
  if (adrCompanyName) {
    return {
      canonicalKey: `ticker:${upperKey.toLowerCase()}`,
      englishName: adrCompanyName,
      displayName: adrCompanyName,
      ticker: upperKey,
      domain: cleanDomainHint,
      kind: 'public',
    };
  }

  // 6. Enrich with Company Profile (`POST /v1/company/search` cache) to discover official domain & name
  const looksLikeTicker = /^[A-Za-z]{1,5}([.-][A-Za-z]{1,2})?$/.test(trimmed);
  const profileMatch = await getCompanyProfileBySearch({
    query: trimmed,
    entityType: params.entityType || (looksLikeTicker ? 'ticker' : 'auto'),
    companyNameHint: params.companyNameHint,
  }).catch(() => null);

  const resolvedDomain = cleanDomainHint || profileMatch?.domain || null;
  const resolvedName =
    params.companyNameHint?.trim() ||
    profileMatch?.name ||
    trimmed;
  const isPrivateFromProfile =
    profileMatch !== null &&
    profileMatch.stockSymbols.length === 0 &&
    /private/i.test(profileMatch.organizationTypeLabel) &&
    !looksLikeTicker;

  return {
    canonicalKey: looksLikeTicker
      ? `ticker:${upperKey.toLowerCase()}`
      : `entity:${resolvedName.trim().toLowerCase()}`,
    englishName: resolvedName,
    displayName: resolvedName,
    ticker: looksLikeTicker
      ? upperKey
      : profileMatch?.stockSymbols?.[0] || null,
    domain: resolvedDomain,
    kind: isPrivateFromProfile ? 'private' : 'public',
  };
}

/**
 * Deduplicates and normalizes external source URLs from `sources[]` and per-product
 * `flagship_url` links into clean `CompanyProductsSourceCitation` entries.
 *
 * @param rawSources - Primary `sources` array returned by Context.dev or Google Search grounding
 * @param productLines - Normalized product lines that may carry official `flagshipUrl` links
 * @returns Deduplicated array of up to 8 `CompanyProductsSourceCitation` objects
 */
function normalizeSourceCitations(
  rawSources: string[],
  productLines: CompanyProductLineItem[],
  fallbackDomain?: string | null
): CompanyProductsSourceCitation[] {
  const seenUrls = new Set<string>();
  const citations: CompanyProductsSourceCitation[] = [];

  const candidates = [
    ...rawSources,
    ...productLines
      .map((p) => p.flagshipUrl)
      .filter((u): u is string => Boolean(u)),
  ];

  for (const rawUrl of candidates) {
    const built = buildSourceCitation(rawUrl);
    if (!built) continue;
    const dedupeKey = built.url.replace(/\/+$/, '').toLowerCase();
    if (seenUrls.has(dedupeKey)) continue;
    seenUrls.add(dedupeKey);
    citations.push(built);
    if (citations.length >= 8) break;
  }

  if (citations.length === 0 && fallbackDomain) {
    const rootBuilt = buildSourceCitation(`https://${fallbackDomain}`);
    if (rootBuilt) {
      citations.push(rootBuilt);
    }
  }

  return citations;
}

/**
 * Normalizes raw JSON output from `client.web.answers` or grounded Gemini synthesis
 * into a clean, validated `CompanyProductsData` structure.
 *
 * @param raw - Raw extracted JSON object
 * @param sources - Array of source URL strings
 * @param target - Resolved company identity & domain metadata
 * @param originalQuery - Original search query string
 * @param sourceEngine - Retrieval engine identifier
 * @param locale - Target UI locale ('en' | 'ko')
 * @returns Normalized `CompanyProductsData` or null when insufficient data was extracted
 */
function normalizeRawProductsPayload(
  raw: RawExtractedProductsShape | null | undefined,
  sources: string[],
  target: ResolvedPortfolioTarget,
  originalQuery: string,
  sourceEngine: 'context_dev_web_answers' | 'gemini_grounded_fallback',
  locale: 'en' | 'ko'
): CompanyProductsData | null {
  if (!raw || typeof raw !== 'object') return null;

  const productLines: CompanyProductLineItem[] = (
    Array.isArray(raw.product_lines) ? raw.product_lines : []
  )
    .filter((item): item is NonNullable<typeof item> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const category =
        typeof item.category === 'string' && item.category.trim()
          ? item.category.trim()
          : locale === 'ko'
            ? '핵심 제품 · 서비스'
            : 'Core Product';
      const description =
        typeof item.description === 'string' ? item.description.trim() : '';
      const targetCustomers =
        typeof item.target_customers === 'string' && item.target_customers.trim()
          ? item.target_customers.trim()
          : null;
      const flagshipCitation = buildSourceCitation(item.flagship_url);
      return {
        name,
        category,
        description,
        targetCustomers,
        flagshipUrl: flagshipCitation ? flagshipCitation.url : null,
      };
    })
    .filter((p) => Boolean(p.name) && Boolean(p.description))
    .slice(0, 8);

  if (productLines.length === 0) {
    return null;
  }

  const revenueSegments: CompanyRevenueSegmentItem[] = (
    Array.isArray(raw.revenue_segments) ? raw.revenue_segments : []
  )
    .filter((seg): seg is NonNullable<typeof seg> => Boolean(seg && typeof seg === 'object'))
    .map((seg) => {
      const segmentName =
        typeof seg.segment_name === 'string' ? seg.segment_name.trim() : '';
      const shareOrScaleNote =
        typeof seg.share_or_scale_note === 'string' && seg.share_or_scale_note.trim()
          ? seg.share_or_scale_note.trim()
          : null;
      const keyOfferings =
        typeof seg.key_offerings === 'string' ? seg.key_offerings.trim() : '';
      return {
        segmentName,
        shareOrScaleNote,
        keyOfferings,
      };
    })
    .filter((seg) => Boolean(seg.segmentName) && Boolean(seg.keyOfferings))
    .slice(0, 6);

  const primaryCustomerSegments = (
    Array.isArray(raw.primary_customer_segments)
      ? raw.primary_customer_segments
      : []
  )
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .slice(0, 6);

  const businessModelSummary =
    typeof raw.business_model_summary === 'string' &&
    raw.business_model_summary.trim()
      ? raw.business_model_summary.trim()
      : locale === 'ko'
        ? `${target.displayName}의 핵심 상용 제품 및 수익 사업 부문 포트폴리오입니다.`
        : `Commercial product lines and operating revenue segments for ${target.displayName}.`;

  const extractedDomain =
    typeof raw.official_domain === 'string' && raw.official_domain.trim()
      ? raw.official_domain
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0]
      : null;

  const finalDomain =
    target.domain ||
    (extractedDomain && extractedDomain !== 'company.com' ? extractedDomain : null);

  const normalizedSources = normalizeSourceCitations(
    sources,
    productLines,
    finalDomain
  );

  return {
    query: originalQuery,
    companyName:
      locale === 'ko'
        ? target.displayName
        : (typeof raw.company_name === 'string' &&
          raw.company_name.trim() &&
          raw.company_name.trim() !== 'Official Company Name'
            ? raw.company_name.trim()
            : target.displayName),
    ticker: target.ticker,
    domain: finalDomain,
    kind: target.kind,
    businessModelSummary,
    primaryCustomerSegments,
    revenueSegments,
    productLines,
    sources: normalizedSources,
    sourceEngine,
    locale,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Localizes an English `CompanyProductsData` dossier into institutional Korean (`한국어`)
 * when `locale === 'ko'` and Context.dev `web.answers` returned English prose,
 * preserving official product brand names (`CUDA`, `H200`, `HBM3E`, `Stripe Billing`)
 * and all external citation URLs intact.
 *
 * @param dossier - Normalized `CompanyProductsData`
 * @param koreanCompanyName - Preferred Korean company display name
 * @returns Localized `CompanyProductsData` in Korean
 */
async function ensureKoreanPortfolioLocalization(
  dossier: CompanyProductsData,
  koreanCompanyName: string
): Promise<CompanyProductsData> {
  const sampleText = [
    dossier.businessModelSummary,
    dossier.productLines[0]?.description || '',
  ].join(' ');

  if (/[가-힣]/.test(sampleText)) {
    return {
      ...dossier,
      companyName: koreanCompanyName || dossier.companyName,
      locale: 'ko',
    };
  }

  logFunctionCall('ensureKoreanPortfolioLocalization', {
    companyName: dossier.companyName,
    productCount: dossier.productLines.length,
  });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    return dossier;
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const model = APP_CONFIG.gemini.sentimentModel;
  const payloadToTranslate = {
    businessModelSummary: dossier.businessModelSummary,
    primaryCustomerSegments: dossier.primaryCustomerSegments,
    revenueSegments: dossier.revenueSegments.map((s) => ({
      segmentName: s.segmentName,
      shareOrScaleNote: s.shareOrScaleNote || '',
      keyOfferings: s.keyOfferings,
    })),
    productLines: dossier.productLines.map((p) => ({
      name: p.name,
      category: p.category,
      description: p.description,
      targetCustomers: p.targetCustomers || '',
    })),
  };

  const prompt = `Translate the following institutional company product & revenue segment dossier for "${koreanCompanyName}" into natural, concise Korean financial research terminology (한국어).
Keep official English/global product brand names and trademarks intact (e.g., CUDA, Blackwell, HBM3E, GeForce, Azure, Stripe Billing, Foundry, iPhone), while translating descriptions, categories, customer segments, and revenue share notes cleanly into Korean.

Input JSON:
${JSON.stringify(payloadToTranslate)}`;

  const config = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        businessModelSummary: { type: Type.STRING },
        primaryCustomerSegments: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        revenueSegments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              segmentName: { type: Type.STRING },
              shareOrScaleNote: { type: Type.STRING },
              keyOfferings: { type: Type.STRING },
            },
            required: ['segmentName', 'shareOrScaleNote', 'keyOfferings'],
          },
        },
        productLines: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              description: { type: Type.STRING },
              targetCustomers: { type: Type.STRING },
            },
            required: ['name', 'category', 'description', 'targetCustomers'],
          },
        },
      },
      required: [
        'businessModelSummary',
        'primaryCustomerSegments',
        'revenueSegments',
        'productLines',
      ],
    },
  };

  try {
    const res = await withTransientRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config,
        }),
      { maxRetries: 1, label: 'ensureKoreanPortfolioLocalization' }
    );
    const rawText = (res.text ?? '').trim();
    logGenAICall({ model, prompt, config, output: rawText });

    const parsed = parseJsonSafely<typeof payloadToTranslate>(rawText, true);
    if (!parsed) {
      return dossier;
    }
    return {
      ...dossier,
      companyName: koreanCompanyName || dossier.companyName,
      businessModelSummary:
        parsed.businessModelSummary?.trim() || dossier.businessModelSummary,
      primaryCustomerSegments:
        Array.isArray(parsed.primaryCustomerSegments) &&
        parsed.primaryCustomerSegments.length > 0
          ? parsed.primaryCustomerSegments.map((s) => s.trim()).filter(Boolean)
          : dossier.primaryCustomerSegments,
      revenueSegments: dossier.revenueSegments.map((orig, idx) => {
        const tr = parsed.revenueSegments?.[idx];
        if (!tr) return orig;
        return {
          segmentName: tr.segmentName?.trim() || orig.segmentName,
          shareOrScaleNote:
            tr.shareOrScaleNote?.trim() || orig.shareOrScaleNote,
          keyOfferings: tr.keyOfferings?.trim() || orig.keyOfferings,
        };
      }),
      productLines: dossier.productLines.map((orig, idx) => {
        const tr = parsed.productLines?.[idx];
        if (!tr) return orig;
        return {
          ...orig,
          name: tr.name?.trim() || orig.name,
          category: tr.category?.trim() || orig.category,
          description: tr.description?.trim() || orig.description,
          targetCustomers: tr.targetCustomers?.trim() || orig.targetCustomers,
        };
      }),
      locale: 'ko',
    };
  } catch (error) {
    logGenAICall({ model, prompt, config, error });
    return dossier;
  }
}

/**
 * Resilient Google Search-grounded Gemini fallback (`gemini-4-hydrogen`,
 * `ThinkingLevel.LOW`, `tools: [{ googleSearch: {} }]`) returning the identical
 * `CompanyProductsData` structure and verified web `groundingChunks` citations
 * whenever `CONTEXT_DEV_API_KEY` is unavailable or `web.answers` returns empty lines.
 *
 * @param target - Resolved company target metadata
 * @param originalQuery - Original search query
 * @param locale - Target UI locale ('en' | 'ko')
 * @returns Normalized `CompanyProductsData` or null
 */
async function fetchGroundedFallbackProducts(
  target: ResolvedPortfolioTarget,
  originalQuery: string,
  locale: 'en' | 'ko'
): Promise<CompanyProductsData | null> {
  logFunctionCall('fetchGroundedFallbackProducts', {
    companyName: target.englishName,
    ticker: target.ticker,
    domain: target.domain,
    locale,
  });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const model = APP_CONFIG.gemini.defaultModel;
  const companyDescriptor = [
    target.englishName,
    target.ticker ? `Ticker: ${target.ticker}` : 'Privately Held',
    target.domain ? `Official Website: ${target.domain}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const langInstruction =
    locale === 'ko'
      ? 'Write all descriptions, segment names, share notes, and customer labels in crisp institutional Korean (한국어), while keeping official product brand names (e.g. CUDA, HBM3E, GeForce, Stripe Billing) accurate.'
      : 'Write all descriptions, segment names, share notes, and customer labels in crisp institutional English.';

  const privateNote =
    target.kind === 'private'
      ? 'Because this company is privately held, do NOT invent exact revenue percentages unless publicly disclosed; use factual scale notes such as "Core monetization engine" or "Private — segment share undisclosed".'
      : 'For public operating segments, include approximate latest fiscal revenue share (e.g. "~88% of revenue" or KRW 조/억 scale for Korean equities) when known from filings.';

  const prompt = `Research the commercial products and services sold by ${companyDescriptor}, its operating revenue segments, and its primary target customer groups using official product pages and investor relations disclosures.
${privateNote}
${langInstruction}

Return ONLY a valid JSON object (no markdown code fences) matching this exact structure:
{
  "company_name": "${target.displayName.replace(/"/g, '\\"')}",
  "official_domain": "${target.domain || 'company.com'}",
  "business_model_summary": "1-2 sentence executive summary of how the company monetizes",
  "primary_customer_segments": ["Segment 1", "Segment 2", "Segment 3"],
  "revenue_segments": [
    {
      "segment_name": "Operating division or revenue stream name",
      "share_or_scale_note": "Approx % of revenue or commercial role",
      "key_offerings": "Key monetized products/services in this segment"
    }
  ],
  "product_lines": [
    {
      "name": "Product or service line name",
      "category": "Category label",
      "description": "Concise 1-2 sentence factual summary of what it does",
      "target_customers": "Primary buyers",
      "flagship_url": "Full https:// official product page URL if known, or null"
    }
  ]
}
Include 2 to 5 revenue segments and 4 to 6 core product/service lines.`;

  const config = {
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    tools: [{ googleSearch: {} }],
  };

  try {
    const response = await withTransientRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config,
        }),
      { label: 'fetchGroundedFallbackProducts' }
    );

    const rawText = (response.text ?? '').trim();
    logGenAICall({ model, prompt, config, output: rawText });

    const groundingUrls: string[] = [];
    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const chunk of chunks) {
      const uri = chunk?.web?.uri;
      if (typeof uri === 'string' && uri.startsWith('http')) {
        groundingUrls.push(uri);
      }
    }
    if (target.domain) {
      groundingUrls.unshift(`https://${target.domain}`);
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = parseJsonSafely<RawExtractedProductsShape>(jsonMatch[0], true);
    if (!parsed) return null;
    return normalizeRawProductsPayload(
      parsed,
      groundingUrls,
      target,
      originalQuery,
      'gemini_grounded_fallback',
      locale
    );
  } catch (error) {
    logGenAICall({ model, prompt, config, error });
    return null;
  }
}

/**
 * Fetches and normalizes a company's commercial product lines, operating revenue
 * segments, and target customers using Context.dev `POST /v1/web/answers`
 * (`client.web.answers` in `fast` mode with example-object `json_format` and
 * cited official `sources[]`), backed by a 30-minute server cache, Korean
 * localization, and Google Search-grounded fallback.
 *
 * @param params - Search query, optional entityType, domainHint, companyNameHint, locale, and forceRefresh
 * @returns Normalized `CompanyProductsData` or null
 */
export async function getCompanyProductsPortfolio(params: {
  query: string;
  entityType?: string;
  domainHint?: string;
  companyNameHint?: string;
  locale?: 'en' | 'ko';
  forceRefresh?: boolean;
}): Promise<CompanyProductsData | null> {
  const locale: 'en' | 'ko' = params.locale === 'ko' ? 'ko' : 'en';
  logFunctionCall('getCompanyProductsPortfolio', {
    ...params,
    locale,
  });

  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) {
    return null;
  }

  const target = await resolvePortfolioTarget({
    query: trimmedQuery,
    entityType: params.entityType,
    domainHint: params.domainHint,
    companyNameHint: params.companyNameHint,
    locale,
  });

  const cacheKey = `${locale}::${target.canonicalKey}`;
  if (!params.forceRefresh) {
    const cached = productsPortfolioCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  let hasContextKey = false;
  try {
    validateContextDevApiKey();
    hasContextKey = true;
  } catch {
    hasContextKey = false;
  }

  if (hasContextKey) {
    try {
      const client = createContextDevClient();
      const domainClause = target.domain
        ? ` Focus primarily on official product, solutions, and investor relations pages on ${target.domain}.`
        : ' Prioritize the company’s official website product/solutions pages and investor relations disclosures.';
      const tickerClause = target.ticker ? ` (Ticker: ${target.ticker})` : ' (Privately Held)';
      const privateClause =
        target.kind === 'private'
          ? ' Because this company is privately held, do not fabricate exact revenue share percentages if undisclosed; state "Private — share undisclosed" or its commercial role.'
          : ' Include approximate revenue share percentages or scale notes for each operating revenue segment when reported.';
      const langClause =
        locale === 'ko'
          ? ' Write all summaries, segment notes, descriptions, and customer segments in Korean (한국어), keeping official product brand names accurate.'
          : '';

      const task =
        `Identify the core commercial products and services sold by ${target.englishName}${tickerClause}, ` +
        `its operating revenue segments / business divisions, and its primary target customer groups.${domainClause}${privateClause}${langClause} ` +
        `Provide 2 to 5 revenue segments and 4 to 7 flagship product or service lines with official product URLs where available.`;

      logFunctionCall('contextDev.web.answers:request', {
        endpoint: APP_CONFIG.contextDev.webAnswersEndpoint,
        mode: APP_CONFIG.contextDev.webAnswersMode,
        companyName: target.englishName,
        domain: target.domain,
        locale,
        timeoutMs: APP_CONFIG.contextDev.webAnswersTimeoutMs,
      });

      const sdkResponse = await withTransientRetry(
        () =>
          client.web.answers({
            task,
            mode: APP_CONFIG.contextDev.webAnswersMode,
            json_format: WEB_ANSWERS_EXAMPLE_FORMAT,
            timeoutOpts: {
              milliseconds: APP_CONFIG.contextDev.webAnswersTimeoutMs,
              behavior: 'return-partial',
            },
          }),
        { maxRetries: 1, label: 'contextDev.web.answers' }
      );

      const rawSources = Array.isArray(sdkResponse?.sources)
        ? sdkResponse.sources
        : [];

      logFunctionCall('contextDev.web.answers:response', {
        requestId: sdkResponse?.request_id ?? null,
        partial: Boolean(sdkResponse?.partial),
        sourceCount: rawSources.length,
        hasJsonContent: Boolean(sdkResponse?.json_content),
      });

      const normalized = normalizeRawProductsPayload(
        sdkResponse?.json_content as RawExtractedProductsShape,
        rawSources,
        target,
        trimmedQuery,
        'context_dev_web_answers',
        locale
      );

      if (normalized && normalized.productLines.length >= 2) {
        const finalDossier =
          locale === 'ko'
            ? await ensureKoreanPortfolioLocalization(
                normalized,
                target.displayName
              )
            : normalized;

        productsPortfolioCache.set(cacheKey, {
          data: finalDossier,
          expiresAt: Date.now() + APP_CONFIG.contextDev.companyProductsCacheTtlMs,
        });
        return finalDossier;
      }
    } catch (sdkError) {
      logFunctionCall('contextDev.web.answers:error', {
        companyName: target.englishName,
        error: sdkError instanceof Error ? sdkError.message : String(sdkError),
      });
    }
  }

  const fallbackDossier = await fetchGroundedFallbackProducts(
    target,
    trimmedQuery,
    locale
  );

  if (fallbackDossier) {
    productsPortfolioCache.set(cacheKey, {
      data: fallbackDossier,
      expiresAt: Date.now() + APP_CONFIG.contextDev.companyProductsCacheTtlMs,
    });
  }

  return fallbackDossier;
}
