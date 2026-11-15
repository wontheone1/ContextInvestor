/**
 * ============================================================================
 * FILE: lib/company-products-types.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Client- & Server-Safe Data Contracts and Formatting Helpers for Company
 * Products, Revenue Segments & Target Customer Intelligence.
 *
 * USE CASES:
 * 1. Sharing strict TypeScript interfaces (`CompanyProductsData`,
 *    `CompanyProductLineItem`, `CompanyRevenueSegmentItem`,
 *    `CompanyProductsSourceCitation`) across Next.js server routes, Context.dev
 *    `web.answers` extraction services, Single-Company Research UI panels,
 *    Cohort Comparison Matrix columns, and the `⌘K` Research Assistant context
 *    serializer without importing server-only SDKs into browser bundles.
 * 2. Formatting external citation URLs from Context.dev `sources[]` into clean,
 *    compact institutional source labels (`nvidia.com/data-center`, `stripe.com/billing`).
 * 3. Extracting distinct product categories for zero-latency client-side
 *    filtering inside `CompanyProductsPanel`.
 * ============================================================================
 */

import { logFunctionCall } from './logger';

/**
 * Single commercial product, platform, or service line offered by a company.
 */
export interface CompanyProductLineItem {
  /** Official product, platform, or service line name (e.g., `CUDA & AI Enterprise`, `HBM3E`) */
  name: string;
  /** Concise commercial category label (e.g., `AI Compute Hardware`, `Payment Infrastructure`) */
  category: string;
  /** Factual 1-2 sentence explanation of what the offering does */
  description: string;
  /** Primary buyer personas or customer types for this product line */
  targetCustomers: string | null;
  /** Verified official product/solutions URL if available */
  flagshipUrl: string | null;
}

/**
 * Operating division or monetization segment reported or operated by a company.
 */
export interface CompanyRevenueSegmentItem {
  /** Operating segment or revenue division name (e.g., `Data Center`, `Device Solutions (DS)`) */
  segmentName: string;
  /** Approximate revenue share or scale note (e.g., `~88% of revenue`, `Core enterprise engine`, `Undisclosed (Private)`) */
  shareOrScaleNote: string | null;
  /** Key monetized products and services inside this operating segment */
  keyOfferings: string;
}

/**
 * Verified source URL read or cited during product portfolio extraction.
 */
export interface CompanyProductsSourceCitation {
  /** Full https:// URL */
  url: string;
  /** Compact hostname + optional top path segment for scannable display */
  displayLabel: string;
  /** Clean hostname without leading `www.` */
  domain: string;
}

/**
 * Normalized company products, revenue segments, and customer portfolio dossier.
 */
export interface CompanyProductsData {
  /** Original search query */
  query: string;
  /** Canonical company display name */
  companyName: string;
  /** Normalized stock ticker (`NVDA`, `005930.KS`, `SKHY`) when publicly listed */
  ticker: string | null;
  /** Official corporate domain (`nvidia.com`, `samsung.com`, `stripe.com`) when known */
  domain: string | null;
  /** Publicly traded vs. privately held classification */
  kind: 'public' | 'private';
  /** Concise 1-2 sentence executive summary of how the company monetizes */
  businessModelSummary: string;
  /** Primary enterprise, developer, or consumer customer groups */
  primaryCustomerSegments: string[];
  /** Operating revenue segments / divisions breakdown */
  revenueSegments: CompanyRevenueSegmentItem[];
  /** Core commercial products, platforms, and service lines */
  productLines: CompanyProductLineItem[];
  /** Verified official and institutional web URLs read for the dossier */
  sources: CompanyProductsSourceCitation[];
  /** Retrieval engine attribution */
  sourceEngine: 'context_dev_web_answers' | 'gemini_grounded_fallback';
  /** Active UI locale used to synthesize or localize the dossier */
  locale: 'en' | 'ko';
  /** ISO timestamp when fetched */
  fetchedAt: string;
}

/**
 * Formats a raw `https://` URL into a clean `CompanyProductsSourceCitation`
 * with a scannable `domain/first-path` label.
 *
 * @param rawUrl - Candidate external URL string
 * @returns Normalized `CompanyProductsSourceCitation` or null if invalid
 */
export function buildSourceCitation(
  rawUrl: string | null | undefined
): CompanyProductsSourceCitation | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    const domain = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (!domain || !domain.includes('.')) return null;
    if (
      /^images?\./i.test(domain) ||
      /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?)(\?|$)/i.test(parsed.pathname)
    ) {
      return null;
    }

    const segments = parsed.pathname
      .split('/')
      .map((s) => s.trim())
      .filter(
        (s) =>
          Boolean(s) &&
          !/^(en|en-us|en-gb|ko|kr|ko-kr|global|us|index\.html?)$/i.test(s)
      );

    const topPath = segments[0] ? `/${segments[0].slice(0, 22)}` : '';
    return {
      url: parsed.toString(),
      domain,
      displayLabel: `${domain}${topPath}`,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts distinct non-empty product categories from `productLines` in display order
 * for client-side category filtering.
 *
 * @param productLines - Array of normalized product line items
 * @returns Ordered array of unique category labels
 */
export function getDistinctProductCategories(
  productLines: CompanyProductLineItem[]
): string[] {
  logFunctionCall('getDistinctProductCategories', {
    productCount: productLines.length,
  });

  const seen = new Set<string>();
  const categories: string[] = [];
  for (const item of productLines) {
    const cat = (item.category || '').trim();
    if (!cat) continue;
    const key = cat.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      categories.push(cat);
    }
  }
  return categories;
}
