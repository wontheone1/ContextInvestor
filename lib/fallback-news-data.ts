/**
 * ============================================================================
 * FILE: lib/fallback-news-data.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Realistic Institutional Fallback Dataset for Local Demo & Pre-Key Preview.
 *
 * USE CASES:
 * 1. When `CONTEXT_DEV_API_KEY` is not yet configured in `.env.local` in the preview
 *    environment, the API route returns a clear warning flag (`usingFallbackDemoData: true`)
 *    alongside realistic `NewsSearchResponse`-shaped pages so the user can immediately
 *    test the Next/Previous cursor pagination, sorting (`newest` vs `relevance`),
 *    date range filtering, Firestore article caching, and Gemini AI Market Briefings.
 * 2. Providing deterministic multi-page cursor pagination (`cursor_page_2`, `cursor_page_3`)
 *    for unit tests and the CLI verification script (`scripts/verify-context-dev.ts`).
 * ============================================================================
 */

import type { NewsSearchResponse } from 'context.dev/resources/news';
import type { CompanyNewsQueryInput } from './context-dev';
import { logFunctionCall } from './logger';

interface SeedArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  publishedOffsetHours: number;
  type: 'editorial' | 'press_release' | 'regulatory_filing' | 'advisory';
  language: string;
  country: string;
  confidence: number;
  level: 'primary' | 'secondary';
}

const BASE_COMPANY_ARTICLES: Record<string, SeedArticle[]> = {
  NVDA: [
    {
      id: 'art_nvda_001',
      title: 'NVIDIA Expands Blackwell Ultra Rack-Scale Deployments Across Tier-1 Hyperscalers',
      description:
        'NVIDIA announced accelerated production shipments of its next-generation Blackwell Ultra GPU clusters, citing surging enterprise inference demand and sovereign AI infrastructure buildouts.',
      url: 'https://www.reuters.com/technology/nvidia-blackwell-ultra-rack-deployments-2026',
      sourceName: 'Reuters',
      sourceDomain: 'reuters.com',
      publishedOffsetHours: 2,
      type: 'editorial',
      language: 'en',
      country: 'us',
      confidence: 0.98,
      level: 'primary',
    },
    {
      id: 'art_nvda_002',
      title: 'NVIDIA Reports Record Data Center Networking Revenue Driven by Spectrum-X Ethernet',
      description:
        'Quarterly filing highlights 140% year-over-year growth in high-speed AI fabric interconnects as cloud providers scale 100,000-GPU training clusters.',
      url: 'https://nvidianews.nvidia.com/news/spectrum-x-datacenter-milestone',
      sourceName: 'NVIDIA Newsroom',
      sourceDomain: 'nvidianews.nvidia.com',
      publishedOffsetHours: 6,
      type: 'press_release',
      language: 'en',
      country: 'us',
      confidence: 0.99,
      level: 'primary',
    },
    {
      id: 'art_nvda_003',
      title: 'Form 10-Q Quarterly Report: Supply Chain Commitments and Long-Term CoWoS Capacity',
      description:
        'Regulatory filing details multi-year wafer and advanced packaging purchase obligations with foundry partners to support sovereign and enterprise AI backlog.',
      url: 'https://www.sec.gov/edgar/nvidia-10q-filing-analysis',
      sourceName: 'SEC EDGAR Wire',
      sourceDomain: 'sec.gov',
      publishedOffsetHours: 14,
      type: 'regulatory_filing',
      language: 'en',
      country: 'us',
      confidence: 0.96,
      level: 'primary',
    },
    {
      id: 'art_nvda_004',
      title: 'European Sovereign AI Consortium Selects NVIDIA NIM Microservices for Healthcare Models',
      description:
        'A coalition of European research hospitals deployed localized clinical foundation models running on NVIDIA NIM inference containers.',
      url: 'https://www.ft.com/content/european-sovereign-ai-nvidia-healthcare',
      sourceName: 'Financial Times',
      sourceDomain: 'ft.com',
      publishedOffsetHours: 22,
      type: 'editorial',
      language: 'en',
      country: 'gb',
      confidence: 0.91,
      level: 'primary',
    },
    {
      id: 'art_nvda_005',
      title: 'Semiconductor Capital Equipment Index Rallies on High-Bandwidth Memory Packaging Forecast',
      description:
        'Memory suppliers raised full-year HBM3e and HBM4 allocation targets following stronger-than-expected accelerator demand from NVIDIA and custom ASIC designers.',
      url: 'https://www.bloomberg.com/news/articles/hbm-memory-packaging-forecast',
      sourceName: 'Bloomberg',
      sourceDomain: 'bloomberg.com',
      publishedOffsetHours: 31,
      type: 'editorial',
      language: 'en',
      country: 'us',
      confidence: 0.84,
      level: 'secondary',
    },
    {
      id: 'art_nvda_006',
      title: 'NVIDIA Releases TensorRT-LLM Security and Performance Advisory for Enterprise Clusters',
      description:
        'Technical advisory outlines kernel optimizations reducing FP4 speculative decoding latency by 28% on liquid-cooled rack configurations.',
      url: 'https://developer.nvidia.com/advisories/tensorrt-llm-fp4-optimization',
      sourceName: 'NVIDIA Developer',
      sourceDomain: 'developer.nvidia.com',
      publishedOffsetHours: 45,
      type: 'advisory',
      language: 'en',
      country: 'us',
      confidence: 0.97,
      level: 'primary',
    },
    {
      id: 'art_nvda_007',
      title: 'Autonomous Robotics Manufacturers Adopt NVIDIA Isaac GR00T Foundation Models',
      description:
        'Industrial warehouse automation leaders demonstrated real-time sim-to-real bipedal and articulated manipulation powered by NVIDIA Omniverse.',
      url: 'https://techcrunch.com/2026/11/nvidia-isaac-groot-industrial-robotics',
      sourceName: 'TechCrunch',
      sourceDomain: 'techcrunch.com',
      publishedOffsetHours: 58,
      type: 'editorial',
      language: 'en',
      country: 'us',
      confidence: 0.93,
      level: 'primary',
    },
    {
      id: 'art_nvda_008',
      title: 'Global Power Grid Operators Partner with Hyperscalers on AI Data Center Microgrids',
      description:
        'Utility executives point to high-density GPU compute clusters as the primary catalyst for modular nuclear and grid-scale battery storage investments.',
      url: 'https://www.wsj.com/articles/ai-datacenter-power-grid-investments',
      sourceName: 'Wall Street Journal',
      sourceDomain: 'wsj.com',
      publishedOffsetHours: 76,
      type: 'editorial',
      language: 'en',
      country: 'us',
      confidence: 0.79,
      level: 'secondary',
    },
  ],
};

/**
 * Synthesizes a realistic multi-page `NewsSearchResponse` for any company name or ticker
 * when running in local demo mode or when `CONTEXT_DEV_API_KEY` is not yet set.
 *
 * @param input - CompanyNewsQueryInput parameters
 * @returns Realistic `NewsSearchResponse` with working cursor pagination
 */
export function buildFallbackNewsResponse(
  input: CompanyNewsQueryInput
): NewsSearchResponse {
  logFunctionCall('buildFallbackNewsResponse', { ...input });

  const now = Date.now();
  const normalizedTarget = input.entityValue.trim();
  const upperKey = normalizedTarget.toUpperCase();

  const baseTemplates: SeedArticle[] =
    BASE_COMPANY_ARTICLES[upperKey] ??
    [
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_001`,
        title: `${normalizedTarget} Expands Institutional AI & Enterprise Platform Capabilities`,
        description: `${normalizedTarget} announced new enterprise infrastructure partnerships and expanded cross-border settlement and analytics volume across global markets.`,
        url: `https://www.reuters.com/markets/companies/${encodeURIComponent(normalizedTarget.toLowerCase())}-enterprise-update`,
        sourceName: 'Reuters',
        sourceDomain: 'reuters.com',
        publishedOffsetHours: 3,
        type: 'editorial',
        language: 'en',
        country: 'us',
        confidence: 0.97,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_002`,
        title: `${normalizedTarget} Releases Official Product & Financial Operations Press Statement`,
        description: `Company leadership detailed product velocity milestones, margin expansion initiatives, and multi-region compliance certifications for institutional clients.`,
        url: `https://www.prnewswire.com/news/${encodeURIComponent(normalizedTarget.toLowerCase())}-operations-statement`,
        sourceName: 'PR Newswire',
        sourceDomain: 'prnewswire.com',
        publishedOffsetHours: 9,
        type: 'press_release',
        language: 'en',
        country: 'us',
        confidence: 0.99,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_003`,
        title: `Regulatory Disclosure: ${normalizedTarget} Cross-Border Governance & Capital Filing`,
        description: `Updated disclosure outlines capital allocation framework, cybersecurity resilience audits, and international licensing expansions.`,
        url: `https://www.sec.gov/Archives/edgar/data/${encodeURIComponent(normalizedTarget.toLowerCase())}`,
        sourceName: 'SEC Filing Desk',
        sourceDomain: 'sec.gov',
        publishedOffsetHours: 18,
        type: 'regulatory_filing',
        language: 'en',
        country: 'us',
        confidence: 0.95,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_004`,
        title: `Institutional Analysts Weigh In on ${normalizedTarget} Market Share Trajectory`,
        description: `Research desks highlight customer retention metrics, API throughput growth, and competitive positioning in the 2026 enterprise cycle.`,
        url: `https://www.bloomberg.com/news/${encodeURIComponent(normalizedTarget.toLowerCase())}-market-analysis`,
        sourceName: 'Bloomberg',
        sourceDomain: 'bloomberg.com',
        publishedOffsetHours: 29,
        type: 'editorial',
        language: 'en',
        country: 'us',
        confidence: 0.91,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_005`,
        title: `European Financial Regulators Review Cloud & Fintech Resiliency Standards Featuring ${normalizedTarget}`,
        description: `Industry consortium benchmarks operational uptime and latency SLAs across leading global infrastructure vendors.`,
        url: `https://www.ft.com/content/${encodeURIComponent(normalizedTarget.toLowerCase())}-europe-standards`,
        sourceName: 'Financial Times',
        sourceDomain: 'ft.com',
        publishedOffsetHours: 42,
        type: 'editorial',
        language: 'en',
        country: 'gb',
        confidence: 0.85,
        level: 'secondary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_006`,
        title: `${normalizedTarget} Publishes Architecture & Security Performance Advisory`,
        description: `Engineering bulletin details zero-downtime migration protocols, key rotation cryptography, and real-time webhook observability.`,
        url: `https://techcrunch.com/2026/11/${encodeURIComponent(normalizedTarget.toLowerCase())}-architecture-advisory`,
        sourceName: 'TechCrunch',
        sourceDomain: 'techcrunch.com',
        publishedOffsetHours: 64,
        type: 'advisory',
        language: 'en',
        country: 'us',
        confidence: 0.94,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_007`,
        title: `Asia-Pacific Institutional Adoption Accelerates for ${normalizedTarget} Partner Ecosystem`,
        description: `Regional banks and sovereign wealth allocators expand integration footprints across Singapore and Tokyo hubs.`,
        url: `https://www.nikkei.com/markets/${encodeURIComponent(normalizedTarget.toLowerCase())}-apac-adoption`,
        sourceName: 'Nikkei Asia',
        sourceDomain: 'nikkei.com',
        publishedOffsetHours: 88,
        type: 'editorial',
        language: 'en',
        country: 'jp',
        confidence: 0.89,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_008`,
        title: `Quantitative Sector Review: How ${normalizedTarget} Compares on Free Cash Flow Conversion`,
        description: `Deep-dive comparative valuation across top-decile technology and financial infrastructure leaders.`,
        url: `https://www.wsj.com/finance/${encodeURIComponent(normalizedTarget.toLowerCase())}-fcf-conversion`,
        sourceName: 'Wall Street Journal',
        sourceDomain: 'wsj.com',
        publishedOffsetHours: 115,
        type: 'editorial',
        language: 'en',
        country: 'us',
        confidence: 0.87,
        level: 'secondary',
      },
    ];

  // Apply optional filters
  let filtered = baseTemplates.filter((item) => {
    const pubMs = now - item.publishedOffsetHours * 3600 * 1000;
    if (input.dateFrom !== undefined && pubMs < input.dateFrom) return false;
    if (input.dateTo !== undefined && pubMs > input.dateTo) return false;

    if (
      input.filterCategory === 'articleType' &&
      input.articleTypes &&
      input.articleTypes.length > 0
    ) {
      if (!input.articleTypes.includes(item.type)) return false;
    }
    if (
      input.filterCategory === 'articleLanguage' &&
      input.articleLanguages &&
      input.articleLanguages.length > 0
    ) {
      if (!input.articleLanguages.includes(item.language as never)) return false;
    }
    if (
      input.filterCategory === 'sourceCountry' &&
      input.sourceCountries &&
      input.sourceCountries.length > 0
    ) {
      if (!input.sourceCountries.includes(item.country as never)) return false;
    }
    if (
      input.filterCategory === 'sourceDomain' &&
      input.sourceDomains &&
      input.sourceDomains.length > 0
    ) {
      const domains = input.sourceDomains.map((d) => d.toLowerCase());
      if (!domains.some((d) => item.sourceDomain.toLowerCase().includes(d))) {
        return false;
      }
    }
    return true;
  });

  // Sort by newest or relevance
  if (input.sortBy === 'relevance') {
    filtered = [...filtered].sort((a, b) => b.confidence - a.confidence);
  } else {
    filtered = [...filtered].sort(
      (a, b) => a.publishedOffsetHours - b.publishedOffsetHours
    );
  }

  // Cursor pagination calculation
  const limit = Math.max(1, Math.min(25, input.limit ?? 4));
  let offset = 0;
  if (input.cursor && input.cursor.startsWith('cursor_offset_')) {
    const parsed = parseInt(input.cursor.replace('cursor_offset_', ''), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  const pageSlice = filtered.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const hasMore = nextOffset < filtered.length;
  const nextCursor = hasMore ? `cursor_offset_${nextOffset}` : null;

  const data: NewsSearchResponse.Data[] = pageSlice.map((item, idx) => {
    const pubDate = new Date(
      now - item.publishedOffsetHours * 3600 * 1000
    ).toISOString();
    return {
      id: `${item.id}_${offset + idx}`,
      authors: ['Institutional Desk', 'Market Intelligence Wire'],
      description: item.description,
      image_url: null,
      language: item.language,
      match: {
        confidence: item.confidence,
        level: item.level,
      },
      published_at: pubDate,
      source: {
        direct: true,
        domain: item.sourceDomain,
        name: item.sourceName,
      },
      story_id: `story_${item.id}`,
      title: item.title,
      type: item.type,
      url: item.url,
    };
  });

  return {
    data,
    has_more: hasMore,
    meta: {
      count: data.length,
    },
    next_cursor: nextCursor,
    request_id: `req_ctx_${Date.now().toString(36)}`,
    key_metadata: {
      credits_consumed: 1,
      credits_remaining: 999,
    },
  };
}
