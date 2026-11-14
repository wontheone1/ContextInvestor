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
      title: '엔비디아, 차세대 블랙웰 울트라 AI 가속기 아시아 데이터센터 공급 확대 발표',
      description:
        '엔비디아는 한국 및 아시아 주요 클라우드 사업자들과 차세대 고성능 AI 데이터센터 인프라 구축을 위한 블랙웰 울트라 GPU 대량 공급 계약을 체결했다고 밝혔다.',
      url: 'https://www.hankyung.com/it/nvidia-blackwell-asia-datacenter-2026',
      sourceName: 'Korea Economic Daily',
      sourceDomain: 'hankyung.com',
      publishedOffsetHours: 10,
      type: 'editorial',
      language: 'ko',
      country: 'kr',
      confidence: 0.96,
      level: 'primary',
    },
    {
      id: 'art_nvda_004',
      title: 'Europäisches Souveränes KI-Konsortium wählt NVIDIA NIM-Microservices für klinische Sprachmodelle',
      description:
        'Eine Koalition europäischer Forschungszentren und Universitätskliniken hat lokalisierte medizinische Basismodelle auf Basis von NVIDIA NIM-Inferenzcontainern in Betrieb genommen.',
      url: 'https://www.handelsblatt.com/technik/ki-konsortium-nvidia-nim',
      sourceName: 'Handelsblatt',
      sourceDomain: 'handelsblatt.com',
      publishedOffsetHours: 18,
      type: 'editorial',
      language: 'de',
      country: 'de',
      confidence: 0.93,
      level: 'primary',
    },
    {
      id: 'art_nvda_005',
      title: '半導体製造装置指数が上昇、NVIDIA向け次世代HBM4メモリパッケージング需要が牽引',
      description:
        '主要メモリサプライヤーは、NVIDIAおよびハイパースケーラーからのAIアクセラレータ需要の急増を受け、通期のHBM3eおよびHBM4生産割り当て目標を引き上げた。',
      url: 'https://www.nikkei.com/article/nvidia-hbm4-semiconductor-demand',
      sourceName: 'Nikkei Shimbun',
      sourceDomain: 'nikkei.com',
      publishedOffsetHours: 28,
      type: 'editorial',
      language: 'ja',
      country: 'jp',
      confidence: 0.89,
      level: 'secondary',
    },
    {
      id: 'art_nvda_006',
      title: 'Form 10-Q Quarterly Report: Supply Chain Commitments and Long-Term CoWoS Capacity',
      description:
        'Regulatory filing details multi-year wafer and advanced packaging purchase obligations with foundry partners to support sovereign and enterprise AI backlog.',
      url: 'https://www.sec.gov/edgar/nvidia-10q-filing-analysis',
      sourceName: 'SEC EDGAR Wire',
      sourceDomain: 'sec.gov',
      publishedOffsetHours: 36,
      type: 'regulatory_filing',
      language: 'en',
      country: 'us',
      confidence: 0.96,
      level: 'primary',
    },
    {
      id: 'art_nvda_007',
      title: 'NVIDIA Releases TensorRT-LLM Security and Performance Advisory for Enterprise Clusters',
      description:
        'Technical advisory outlines kernel optimizations reducing FP4 speculative decoding latency by 28% on liquid-cooled rack configurations.',
      url: 'https://developer.nvidia.com/advisories/tensorrt-llm-fp4-optimization',
      sourceName: 'NVIDIA Developer',
      sourceDomain: 'developer.nvidia.com',
      publishedOffsetHours: 48,
      type: 'advisory',
      language: 'en',
      country: 'us',
      confidence: 0.97,
      level: 'primary',
    },
    {
      id: 'art_nvda_008',
      title: 'Autonomous Robotics Manufacturers Adopt NVIDIA Isaac GR00T Foundation Models',
      description:
        'Industrial warehouse automation leaders demonstrated real-time sim-to-real bipedal and articulated manipulation powered by NVIDIA Omniverse.',
      url: 'https://techcrunch.com/2026/11/nvidia-isaac-groot-industrial-robotics',
      sourceName: 'TechCrunch',
      sourceDomain: 'techcrunch.com',
      publishedOffsetHours: 64,
      type: 'editorial',
      language: 'en',
      country: 'us',
      confidence: 0.93,
      level: 'primary',
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
        title: `${normalizedTarget}, 글로벌 기관 투자자 및 엔터프라이즈 핀테크 인프라 파트너십 확대`,
        description: `${normalizedTarget}가 아시아 및 글로벌 금융 시장에서 실시간 결제 및 AI 기반 리스크 분석 플랫폼 도입을 가속화하고 있다고 발표했다.`,
        url: `https://www.mk.co.kr/news/world/${encodeURIComponent(normalizedTarget.toLowerCase())}-global-expansion`,
        sourceName: 'Maeil Business Newspaper',
        sourceDomain: 'mk.co.kr',
        publishedOffsetHours: 8,
        type: 'editorial',
        language: 'ko',
        country: 'kr',
        confidence: 0.95,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_003`,
        title: `${normalizedTarget} Releases Official Product & Financial Operations Press Statement`,
        description: `Company leadership detailed product velocity milestones, margin expansion initiatives, and multi-region compliance certifications for institutional clients.`,
        url: `https://www.prnewswire.com/news/${encodeURIComponent(normalizedTarget.toLowerCase())}-operations-statement`,
        sourceName: 'PR Newswire',
        sourceDomain: 'prnewswire.com',
        publishedOffsetHours: 14,
        type: 'press_release',
        language: 'en',
        country: 'us',
        confidence: 0.99,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_004`,
        title: `Europäische Finanzaufsicht prüft Cloud- und KI-Infrastrukturstandards mit Fokus auf ${normalizedTarget}`,
        description: `Ein europäisches Bankenkonsortium bewertet die operative Ausfallsicherheit und Latenz-SLAs führender globaler Technologieanbieter wie ${normalizedTarget}.`,
        url: `https://www.handelsblatt.com/finanzen/${encodeURIComponent(normalizedTarget.toLowerCase())}-eu-standards`,
        sourceName: 'Handelsblatt',
        sourceDomain: 'handelsblatt.com',
        publishedOffsetHours: 24,
        type: 'editorial',
        language: 'de',
        country: 'de',
        confidence: 0.91,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_005`,
        title: `Regulatory Disclosure: ${normalizedTarget} Cross-Border Governance & Capital Filing`,
        description: `Updated disclosure outlines capital allocation framework, cybersecurity resilience audits, and international licensing expansions.`,
        url: `https://www.sec.gov/Archives/edgar/data/${encodeURIComponent(normalizedTarget.toLowerCase())}`,
        sourceName: 'SEC Filing Desk',
        sourceDomain: 'sec.gov',
        publishedOffsetHours: 36,
        type: 'regulatory_filing',
        language: 'en',
        country: 'us',
        confidence: 0.95,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_006`,
        title: `${normalizedTarget}のアジア太平洋地域における機関投資家向け導入が加速`,
        description: `シンガポールおよび東京の主要金融機関が、${normalizedTarget}の次世代データ統合および決済インフラの採用を拡大している。`,
        url: `https://www.nikkei.com/markets/${encodeURIComponent(normalizedTarget.toLowerCase())}-apac-adoption`,
        sourceName: 'Nikkei Asia',
        sourceDomain: 'nikkei.com',
        publishedOffsetHours: 52,
        type: 'editorial',
        language: 'ja',
        country: 'jp',
        confidence: 0.89,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_007`,
        title: `${normalizedTarget} Publishes Architecture & Security Performance Advisory`,
        description: `Engineering bulletin details zero-downtime migration protocols, key rotation cryptography, and real-time webhook observability.`,
        url: `https://techcrunch.com/2026/11/${encodeURIComponent(normalizedTarget.toLowerCase())}-architecture-advisory`,
        sourceName: 'TechCrunch',
        sourceDomain: 'techcrunch.com',
        publishedOffsetHours: 72,
        type: 'advisory',
        language: 'en',
        country: 'us',
        confidence: 0.94,
        level: 'primary',
      },
      {
        id: `art_${upperKey.toLowerCase().replace(/[^a-z0-9]/g, '')}_008`,
        title: `Quantitative Sector Review: How ${normalizedTarget} Compares on Free Cash Flow Conversion`,
        description: `Deep-dive comparative valuation across top-decile technology and financial infrastructure leaders.`,
        url: `https://www.wsj.com/finance/${encodeURIComponent(normalizedTarget.toLowerCase())}-fcf-conversion`,
        sourceName: 'Wall Street Journal',
        sourceDomain: 'wsj.com',
        publishedOffsetHours: 96,
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
