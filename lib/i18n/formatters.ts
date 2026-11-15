/**
 * ============================================================================
 * FILE: lib/i18n/formatters.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Pure localization & formatting helpers for dates, relative ages, market
 * sentiments, relationship categories, article types, language names, and
 * preset/filter display strings across English ('en') and Korean ('ko').
 *
 * USE CASES:
 * 1. Keeping canonical internal enum values ('Bullish', 'Suppliers & Infra',
 *    'editorial', '1M', etc.) intact in React state and API payloads while
 *    translating their visual display labels seamlessly on render.
 * 2. Formatting timestamps (`2026년 11월 15일` vs `Nov 15, 2026`) and relative
 *    ages (`14분 전` vs `14m ago`) with tabular-numeral friendly output.
 * ============================================================================
 */

import type { AppLocale } from './types';

/**
 * Formats an ISO string or epoch timestamp in the active locale ('en-US' or 'ko-KR').
 */
export function formatLocalizedDateTime(
  isoOrMs: string | number | undefined | null,
  locale: AppLocale,
  mode: 'date' | 'datetime' | 'short' = 'datetime'
): string {
  if (!isoOrMs) return '—';
  const date = new Date(isoOrMs);
  if (Number.isNaN(date.getTime())) return String(isoOrMs);

  const intlLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
  if (mode === 'date') {
    return date.toLocaleDateString(intlLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  if (mode === 'short') {
    return date.toLocaleDateString(intlLocale, {
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleString(intlLocale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a relative age string (e.g., "14m ago" / "14분 전", "3h ago" / "3시간 전").
 */
export function formatLocalizedRelativeAge(
  isoTimestamp: string | number | undefined | null,
  locale: AppLocale
): string {
  if (!isoTimestamp) return '';
  const ts = new Date(isoTimestamp).getTime();
  if (Number.isNaN(ts)) return '';

  const diffMs = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) {
    return locale === 'ko' ? '방금 전' : 'Just now';
  }
  if (mins < 60) {
    return locale === 'ko' ? `${mins}분 전` : `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return locale === 'ko' ? `${hours}시간 전` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return locale === 'ko' ? `${days}일 전` : `${days}d ago`;
}

/**
 * Translates canonical sentiment enum strings ('Bullish', 'Bearish', 'Neutral', 'Mixed')
 * into localized display labels without mutating the underlying filter/state key.
 */
export function translateSentimentLabel(
  sentiment: string | undefined | null,
  locale: AppLocale
): string {
  if (!sentiment) return locale === 'ko' ? '중립' : 'Neutral';
  if (locale === 'en') return sentiment;

  const normalized = sentiment.trim().toLowerCase();
  if (normalized === 'bullish') return '강세';
  if (normalized === 'bearish') return '약세';
  if (normalized === 'neutral') return '중립';
  if (normalized === 'mixed') return '혼조';
  return sentiment;
}

/**
 * Returns a localized tooltip explaining a sentiment classification.
 */
export function translateSentimentTooltip(
  sentiment: string | undefined | null,
  locale: AppLocale
): string {
  const normalized = (sentiment || 'neutral').trim().toLowerCase();
  if (locale === 'ko') {
    if (normalized === 'bullish') return '강세(Bullish): 실적, 수요, 수주 또는 밸류에이션에 긍정적 모멘텀으로 작용하는 시그널';
    if (normalized === 'bearish') return '약세(Bearish): 마진 압박, 규제, 공급 병목 또는 경쟁 심화 등 하방 리스크 시그널';
    if (normalized === 'mixed') return '혼조(Mixed): 긍정적 모멘텀과 단기 리스크 요인이 동시에 혼재된 상태';
    return '중립(Neutral): 방향성 편향이 크지 않은 일반 사실 보도 및 시장 동향';
  }
  if (normalized === 'bullish') return 'Bullish: Positive catalyst supporting demand, earnings, or valuation upside';
  if (normalized === 'bearish') return 'Bearish: Downside risk or headwind affecting margins, growth, or sentiment';
  if (normalized === 'mixed') return 'Mixed: Competing bullish catalysts and bearish headwinds across coverage';
  return 'Neutral: Balanced or informational reporting without strong directional bias';
}

/**
 * Translates canonical supply-chain / ecosystem relationship category keys into Korean or English.
 */
export function translateRelationshipCategory(
  category: string,
  locale: AppLocale
): string {
  if (locale === 'en') return category;
  const map: Record<string, string> = {
    Suppliers: '공급사 및 장비·소재',
    'Suppliers & Infra': '공급망 및 인프라',
    Customers: '주요 고객사',
    'Customers & Adopters': '고객사 및 도입 기업',
    'Peers & Competitors': '동종업계 및 경쟁사',
    'Strategic Partners': '전략적 파트너',
  };
  return map[category] || category;
}

/**
 * Translates relationship group descriptions for tooltips / subtitles.
 */
export function translateRelationshipDescription(
  category: string,
  fallbackDescription: string,
  locale: AppLocale
): string {
  if (locale === 'en') return fallbackDescription;
  const map: Record<string, string> = {
    Suppliers: '핵심 부품, 반도체 파운드리, 장비 및 인프라 공급 기업',
    'Suppliers & Infra': '핵심 부품, 반도체 파운드리, 장비 및 클라우드 인프라 공급 기업',
    Customers: '주요 매출처, OEM 및 엔터프라이즈 구매 고객사',
    'Customers & Adopters': '주요 매출처, 하이퍼스케일러 및 엔터프라이즈 도입 고객사',
    'Peers & Competitors': '동일 섹터 및 핵심 제품군에서 직접 경쟁하는 주요 비교 기업',
    'Strategic Partners': '공동 R&D, 유통, 플랫폼 통합 및 지분 제휴 파트너사',
  };
  return map[category] || fallbackDescription;
}

/**
 * Translates Context.dev article_type values into clean editorial text labels.
 */
export function translateArticleType(
  articleType: string | undefined | null,
  locale: AppLocale
): string {
  if (!articleType) return locale === 'ko' ? '보도·분석' : 'Editorial';
  const key = articleType.trim().toLowerCase();
  if (locale === 'ko') {
    const koMap: Record<string, string> = {
      editorial: '보도·분석',
      press_release: '보도자료',
      regulatory_filing: '공시자료',
      advisory: '권고·공지',
    };
    return koMap[key] || articleType;
  }
  const enMap: Record<string, string> = {
    editorial: 'Editorial',
    press_release: 'Press Release',
    regulatory_filing: 'Regulatory Filing',
    advisory: 'Advisory',
  };
  return enMap[key] || articleType;
}

/**
 * Translates human-readable source language names (e.g. "Korean", "Japanese") into active locale.
 */
export function translateLanguageLabel(
  langName: string | undefined | null,
  locale: AppLocale
): string {
  if (!langName) return '';
  if (locale === 'en') return langName;
  const normalized = langName.trim().toLowerCase();
  const koMap: Record<string, string> = {
    english: '영어',
    en: '영어',
    korean: '한국어',
    ko: '한국어',
    japanese: '일본어',
    ja: '일본어',
    german: '독일어',
    de: '독일어',
    french: '프랑스어',
    fr: '프랑스어',
    spanish: '스페인어',
    es: '스페인어',
    chinese: '중국어',
    zh: '중국어',
  };
  return koMap[normalized] || langName;
}

/**
 * Translates watchlist timeframe range descriptions ('1D' -> '1-Day' / '1일').
 */
export function translateWatchlistRangeDescription(
  range: string,
  locale: AppLocale
): string {
  if (locale === 'ko') {
    const koMap: Record<string, string> = {
      '1D': '1일',
      '5D': '5일',
      '1M': '1개월',
      '6M': '6개월',
      YTD: '연초대비',
      '1Y': '1년',
      '5Y': '5년',
    };
    return koMap[range] || range;
  }
  const enMap: Record<string, string> = {
    '1D': '1-Day',
    '5D': '5-Day',
    '1M': '1-Month',
    '6M': '6-Month',
    YTD: 'Year-to-Date',
    '1Y': '1-Year',
    '5Y': '5-Year',
  };
  return enMap[range] || range;
}

/**
 * Translates static preset strings from `APP_CONFIG` (sample query labels,
 * sector names, starter group titles/descriptions, filter dropdown labels, and
 * private company valuation subtexts) when `locale === 'ko'`.
 */
export function translatePresetMetadata(
  text: string | undefined | null,
  locale: AppLocale
): string {
  if (!text) return '';
  if (locale === 'en') return text;

  const exactMap: Record<string, string> = {
    // Sample cohort query chips
    'AI chip companies > $200B': 'AI 반도체 기업 > $200B',
    'Korea chip & HBM leaders > ₩10조': '한국 반도체 대장주 > ₩10조',
    'Cloud cybersecurity > $50B': '클라우드 보안주 > $50B',
    'Private AI unicorns > $10B': '비상장 AI 유니콘 > $10B',
    // Filter options in APP_CONFIG.filters
    'Editorial Reporting': '일반 보도 및 분석 (Editorial)',
    'Press Releases': '공식 보도자료 (Press Release)',
    'Regulatory Filings': '공시 자료 (Regulatory Filing)',
    Advisories: '투자 권고 및 공지 (Advisory)',
    'English (en)': '영어 (en)',
    'Korean (ko)': '한국어 (ko)',
    'Japanese (ja)': '일본어 (ja)',
    'German (de)': '독일어 (de)',
    'French (fr)': '프랑스어 (fr)',
    'Spanish (es)': '스페인어 (es)',
    'Chinese (zh)': '중국어 (zh)',
    'United States (US)': '미국 (US)',
    'South Korea (KR)': '대한민국 (KR)',
    'United Kingdom (GB)': '영국 (GB)',
    'Germany (DE)': '독일 (DE)',
    'Japan (JP)': '일본 (JP)',
    'Canada (CA)': '캐나다 (CA)',
    'Switzerland (CH)': '스위스 (CH)',
    'Singapore (SG)': '싱가포르 (SG)',
    // Private status & subtext strings
    'Privately Held': '비상장 기업',
    'Private · Unlisted': '비상장 기업',
    'Unlisted · No public share chart': '비상장 · 공개 주가 차트 없음',
    'Foreign-Listed Public Equity · No US ADR': '해외 상장 주식 · 미국 ADR 미상장',
    // Starter theme titles & descriptions
    'AI & Semiconductors': 'AI 및 반도체 핵심주',
    'Compute accelerators, custom silicon, and foundry leaders':
      'AI 가속기, 맞춤형 ASIC 설계 및 첨단 파운드리 선도 기업',
    'Cloud, Platforms & Defense AI': '클라우드 · 빅테크 플랫폼 · 국방 AI',
    'Hyperscalers, consumer ecosystems, and enterprise software':
      '하이퍼스케일 클라우드, 소비자 생태계 및 엔터프라이즈 AI 소프트웨어',
    'Frontier Private Unicorns': '프론티어 비상장 AI·핀테크 유니콘',
    'High-conviction unlisted leaders tracked by valuation & news':
      '추정 기업가치와 실시간 뉴스로 추적하는 핵심 비상장 선도 기업',
    'Korea KOSPI & KOSDAQ Leaders': '한국 KOSPI · KOSDAQ 대표주',
    'HBM memory, automotive mobility, and K-biotech innovators':
      'HBM 메모리, 미래 모빌리티 및 K-바이오 플랫폼 대표 기업',
    'Samsung Electronics': '삼성전자',
    'SK Hynix': 'SK하이닉스',
    'Hyundai Motor': '현대차',
    Alteogen: '알테오젠',
    // Common sectors & hints
    'Semiconductors & AI': '반도체 및 AI',
    'Semiconductors & Consumer Tech': '반도체 · IT 하드웨어',
    'Semiconductors & HBM Memory': '반도체 · HBM 메모리',
    'Automotive & Future Mobility': '자동차 · 미래 모빌리티',
    'Subcutaneous Biologics Platform': '바이오 플랫폼 · 피하주사 제형',
    'Fintech Infrastructure': '핀테크 인프라',
    'Consumer Hardware': '소비자 하드웨어 및 생태계',
    'Cloud & Enterprise AI': '클라우드 및 엔터프라이즈 AI',
    'Defense & Data OS': '국방 및 데이터 OS',
    'Frontier AI Models': '프론티어 AI 모델',
    'AI Accelerators': 'AI 가속기',
    'Custom AI Silicon & Networking': '맞춤형 AI 칩 및 네트워킹',
    'Data Center GPUs & CPUs': '데이터센터 GPU 및 CPU',
    'Leading-Edge Foundry': '초미세 공정 파운드리',
    'AWS Cloud & Commerce': 'AWS 클라우드 및 커머스',
    'AI Safety & Foundation Models': 'AI 안전성 및 파운데이션 모델',
    'Data & AI Lakehouse': '데이터 및 AI 레이크하우스',
    'Public · NASDAQ': '상장 · NASDAQ',
    'Public · NYSE': '상장 · NYSE',
    'Public · KOSPI': '상장 · KOSPI',
    'Public · KOSDAQ': '상장 · KOSDAQ',
    'KOSPI Listed Equity': 'KOSPI 상장 주식',
    'KOSDAQ Listed Equity': 'KOSDAQ 상장 주식',
    'US Listed Equity': '미국 상장 주식',
    'US-Traded ADR Equity': '미국 상장 ADR',
    'ADR · NYSE': 'ADR · NYSE',
    'ADR · NASDAQ': 'ADR · NASDAQ',
    'ADR · US OTC': 'ADR · 미국 OTC',
  };

  if (exactMap[text]) {
    return exactMap[text];
  }

  // Dynamic valuation strings like "Est. $91.5B Valuation" or "Private · Est. $300B"
  const estValMatch = text.match(/^Est\.\s*(\$[0-9.,]+[BMTK]?)\s*Valuation$/i);
  if (estValMatch) {
    return `추정 기업가치 ${estValMatch[1]}`;
  }

  const privateEstMatch = text.match(/^Private\s*·\s*Est\.\s*(\$[0-9.,]+[BMTK]?)$/i);
  if (privateEstMatch) {
    return `비상장 · 추정 ${privateEstMatch[1]}`;
  }

  return text;
}
