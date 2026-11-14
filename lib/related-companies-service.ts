/**
 * ============================================================================
 * FILE: lib/related-companies-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Related Companies & Supply-Chain Ecosystem Graph Generator
 * powered by Gemini AI (`@google/genai`).
 *
 * USE CASES:
 * 1. Identifying high-signal related companies when a user searches a target
 *    company (US-listed equity or private leader).
 * 2. Grouping related companies across institutional relationship categories
 *    (`Suppliers`, `Customers`, `Peers & Competitors`, `Strategic Partners`)
 *    where a single company can belong to multiple relationship groups
 *    simultaneously (e.g., both a Customer and a Competitor).
 * 3. Resolving US-exchange tickers where applicable while falling back to
 *    company names for privately held or non-US-listed entities.
 * ============================================================================
 */

import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { APP_CONFIG } from './config';
import { logFunctionCall, logGenAICall } from './logger';

export type RelationshipCategory =
  | 'Suppliers'
  | 'Customers'
  | 'Peers & Competitors'
  | 'Strategic Partners';

export const RELATIONSHIP_CATEGORIES: Array<{
  category: RelationshipCategory;
  shortLabel: string;
  description: string;
}> = [
  {
    category: 'Suppliers',
    shortLabel: 'Supplier',
    description: 'Upstream component, foundry, hardware, and infrastructure vendors.',
  },
  {
    category: 'Customers',
    shortLabel: 'Customer',
    description: 'Major enterprise buyers, OEMs, and downstream revenue accounts.',
  },
  {
    category: 'Peers & Competitors',
    shortLabel: 'Peer',
    description: 'Direct industry peers and market-share competitors.',
  },
  {
    category: 'Strategic Partners',
    shortLabel: 'Partner',
    description: 'Co-engineering alliances, distribution, and ecosystem partners.',
  },
];

export interface RelatedCompanyItem {
  /** Unique normalized identifier for cross-group highlighting */
  key: string;
  /** Clean display name of the company (e.g. "Microsoft", "TSMC", "OpenAI") */
  name: string;
  /** US stock ticker if listed on a US exchange (e.g. "MSFT", "TSM"), otherwise null */
  ticker: string | null;
  /** Search mode to use when clicked ('ticker' for US-listed, 'name' for private/non-US) */
  entityType: 'ticker' | 'name';
  /** Query string to populate in search ('MSFT' or 'OpenAI') */
  searchQuery: string;
  /** One or more relationship categories this company belongs to */
  relationships: RelationshipCategory[];
  /** Concise 1-sentence explanation of how this company relates to the searched company */
  rationale: string;
}

export interface RelatedCompanyGroup {
  category: RelationshipCategory;
  shortLabel: string;
  description: string;
  companies: RelatedCompanyItem[];
}

export interface RelatedCompaniesResponse {
  query: string;
  resolvedCompanyName: string;
  companies: RelatedCompanyItem[];
  groups: RelatedCompanyGroup[];
  generatedAt: string;
}

const relatedCache = new Map<
  string,
  { data: RelatedCompaniesResponse; expiresAt: number }
>();

/**
 * Maps raw LLM relationship labels to canonical `RelationshipCategory` values.
 */
function normalizeRelationshipCategory(
  raw: string
): RelationshipCategory | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (/supplier|vendor|foundry|upstream|component|manufacturer/.test(v)) {
    return 'Suppliers';
  }
  if (/customer|client|buyer|oem|downstream/.test(v)) {
    return 'Customers';
  }
  if (/peer|competitor|rival|alternative/.test(v)) {
    return 'Peers & Competitors';
  }
  if (/partner|alliance|ecosystem|joint|investor|channel|integrator/.test(v)) {
    return 'Strategic Partners';
  }
  return null;
}

/**
 * Validates that a ticker is a clean US-exchange symbol (e.g. "MSFT", "TSM", "BRK.B")
 * and rejects foreign-exchange suffixes (e.g. "005930.KS", "2330.TW", "SAP.DE") or placeholders.
 */
function sanitizeUsTicker(rawTicker: unknown): string | null {
  if (typeof rawTicker !== 'string') return null;
  const cleaned = rawTicker.trim().toUpperCase();
  if (
    !cleaned ||
    cleaned === 'NONE' ||
    cleaned === 'NULL' ||
    cleaned === 'N/A' ||
    cleaned === 'PRIVATE'
  ) {
    return null;
  }
  // Standard US equity symbols: 1-5 letters, optional .A / .B share class
  if (!/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(cleaned)) {
    return null;
  }
  const suffix = cleaned.split('.')[1];
  const foreignSuffixes = new Set([
    'KS',
    'KQ',
    'TW',
    'HK',
    'TO',
    'DE',
    'PA',
    'AS',
    'SW',
    'LN',
    'AX',
    'SS',
    'SZ',
  ]);
  if (suffix && foreignSuffixes.has(suffix)) {
    return null;
  }
  return cleaned;
}

/**
 * Generates related company search suggestions grouped by relationship
 * (`Suppliers`, `Customers`, `Peers & Competitors`, `Strategic Partners`),
 * supporting multi-relationship membership per company.
 */
export async function getRelatedCompanies(
  companyQuery: string,
  forceRefresh = false
): Promise<RelatedCompaniesResponse> {
  const trimmedQuery = companyQuery.trim();
  const cacheKey = trimmedQuery.toLowerCase();

  logFunctionCall('getRelatedCompanies', {
    companyQuery: trimmedQuery,
    forceRefresh,
  });

  if (!forceRefresh) {
    const cached = relatedCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
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

  const prompt = `For the searched company or US stock ticker "${trimmedQuery}", suggest 8 to 10 high-signal related companies that an institutional equity analyst should research next.

Requirements:
1. Classify each related company into ONE OR MORE of these exact relationship categories:
   - "Suppliers" (upstream component, foundry, chip, cloud, or infrastructure suppliers to "${trimmedQuery}")
   - "Customers" (major enterprise customers, OEMs, or buyers of "${trimmedQuery}" products/services)
   - "Peers & Competitors" (direct industry peers or product competitors)
   - "Strategic Partners" (co-engineering, distribution, licensing, or major ecosystem partners)
2. A company CAN AND SHOULD belong to multiple relationship categories whenever factually true (for example, a hyperscaler that is both one of "${trimmedQuery}"'s largest "Customers" AND one of its "Peers & Competitors" or "Strategic Partners"). Include at least 2-3 multi-relationship companies if accurate.
3. Cover at least 3 of the 4 relationship categories with real, well-known companies. Do NOT include "${trimmedQuery}" itself.
4. For "usTicker": provide ONLY a valid US stock exchange ticker (including US-listed ADRs like TSM, ASML, ARM, SONY, SAP, SHOP) if the company trades on a US exchange. If the company is privately held (e.g. OpenAI, Stripe, Anthropic, Databricks, SpaceX) OR only trades on non-US exchanges (e.g. SK Hynix, Samsung Electronics, Foxconn), set "usTicker" to "".
5. Keep "rationale" to 1 crisp factual sentence (max 16 words) explaining all selected relationships.`;

  const config = {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    systemInstruction:
      'You are an institutional equity supply-chain and competitive-landscape analyst. Output accurate, factual corporate relationships without speculation or filler.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        resolvedCompanyName: {
          type: Type.STRING,
          description: 'Full canonical name of the searched company',
        },
        relatedCompanies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Concise company name (e.g. "Microsoft", "TSMC", "OpenAI")',
              },
              usTicker: {
                type: Type.STRING,
                description:
                  'US exchange stock ticker (e.g. "MSFT", "TSM") or empty string "" if private / non-US-listed',
              },
              relationships: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'One or more of: "Suppliers", "Customers", "Peers & Competitors", "Strategic Partners"',
              },
              rationale: {
                type: Type.STRING,
                description:
                  'Concise 1-sentence explanation (<= 16 words) of the relationship(s)',
              },
            },
            required: ['name', 'usTicker', 'relationships', 'rationale'],
          },
        },
      },
      required: ['resolvedCompanyName', 'relatedCompanies'],
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
      resolvedCompanyName?: string;
      relatedCompanies?: Array<{
        name?: string;
        usTicker?: string;
        relationships?: string[];
        rationale?: string;
      }>;
    };

    const resolvedName =
      typeof parsed.resolvedCompanyName === 'string' &&
      parsed.resolvedCompanyName.trim()
        ? parsed.resolvedCompanyName.trim()
        : trimmedQuery;

    const queryLower = trimmedQuery.toLowerCase();
    const resolvedLower = resolvedName.toLowerCase();

    const mergedByKey = new Map<string, RelatedCompanyItem>();

    for (const rawItem of parsed.relatedCompanies ?? []) {
      const name = typeof rawItem.name === 'string' ? rawItem.name.trim() : '';
      if (!name) continue;

      const ticker = sanitizeUsTicker(rawItem.usTicker);

      // Exclude self-references
      if (
        name.toLowerCase() === queryLower ||
        name.toLowerCase() === resolvedLower ||
        (ticker && ticker.toLowerCase() === queryLower)
      ) {
        continue;
      }

      const normalizedRels: RelationshipCategory[] = [];
      for (const r of Array.isArray(rawItem.relationships)
        ? rawItem.relationships
        : []) {
        const mapped = normalizeRelationshipCategory(String(r));
        if (mapped && !normalizedRels.includes(mapped)) {
          normalizedRels.push(mapped);
        }
      }
      if (normalizedRels.length === 0) {
        normalizedRels.push('Peers & Competitors');
      }

      const key = (ticker || name).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!key) continue;

      const rationale =
        typeof rawItem.rationale === 'string' && rawItem.rationale.trim()
          ? rawItem.rationale.trim()
          : `Related to ${resolvedName} across ${normalizedRels.join(' & ')}.`;

      const existing = mergedByKey.get(key);
      if (existing) {
        for (const rel of normalizedRels) {
          if (!existing.relationships.includes(rel)) {
            existing.relationships.push(rel);
          }
        }
      } else {
        mergedByKey.set(key, {
          key,
          name,
          ticker,
          entityType: ticker ? 'ticker' : 'name',
          searchQuery: ticker || name,
          relationships: normalizedRels,
          rationale,
        });
      }
    }

    const companies = Array.from(mergedByKey.values());

    // Build deterministic relationship groups (a company with multiple relationships appears in each matching group)
    const groups: RelatedCompanyGroup[] = RELATIONSHIP_CATEGORIES.map((meta) => ({
      category: meta.category,
      shortLabel: meta.shortLabel,
      description: meta.description,
      companies: companies.filter((c) => c.relationships.includes(meta.category)),
    })).filter((g) => g.companies.length > 0);

    const result: RelatedCompaniesResponse = {
      query: trimmedQuery,
      resolvedCompanyName: resolvedName,
      companies,
      groups,
      generatedAt: new Date().toISOString(),
    };

    relatedCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 60 * 60 * 1000,
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
