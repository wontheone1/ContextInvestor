/**
 * ============================================================================
 * FILE: lib/krx-directory.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Korea Exchange (KOSPI `.KS` & KOSDAQ `.KQ`) Equity Directory, Locale-Aware
 * Dual-Listing Resolver, Pure KRW (`₩`, `조`/`억`) Formatter, and Naver Finance
 * Fundamental Fallback Service for Contextual Investing.
 *
 * USE CASES:
 * 1. Resolving Korean domestic stock names (`삼성전자`, `SK하이닉스`, `현대차`,
 *    `알테오젠`, `한미반도체`, `에코프로비엠`), English names (`Hyundai Motor`,
 *    `Alteogen`, `NAVER`, `Kakao`, `Celltrion`), 6-digit KRX stock codes
 *    (`005930`, `000660`, `196170`), and explicit `.KS`/`.KQ` tickers.
 * 2. Enforcing confirmed dual-listing language priority:
 *    - When `locale === 'ko'`, dual-listed Korean issuers (`삼성전자`, `SK하이닉스`,
 *      `POSCO홀딩스`, `KB금융`, `신한지주`, `LG디스플레이`, `한국전력`, `SK텔레콤`, `KT`,
 *      `우리금융지주`) resolve to their primary KRX home listing (`.KS`).
 *    - When `locale === 'en'`, those dual-listed names resolve to their US ADR
 *      (`SSNLF`, `SKHY`, `PKX`, `KB`, `SHG`, `LPL`, `KEP`, `SKM`, `KT`, `WF`).
 *    - Explicit tickers/codes (`005930`, `005930.KS`, `SKHY`, `SSNLF`) and
 *      non-ADR Korean equities (`현대차` `005380.KS`, `알테오젠` `196170.KQ`)
 *      always resolve directly to that listing regardless of UI language.
 * 3. Dynamically resolving any of the 2,600+ KOSPI & KOSDAQ equities not in the
 *    curated fast-path table via Naver Stock Autocomplete (`ac.stock.naver.com`).
 * 4. Formatting all `KRW` monetary figures in pure Korean Won (`₩` integer share
 *    prices with zero decimal clutter, and `조`/`억` institutional units for
 *    Market Cap, Enterprise Value, and Total Revenue).
 * 5. Providing a live Naver Finance (`m.stock.naver.com/api/stock/{code}/integration`)
 *    fundamental fallback when Yahoo `quoteSummary` omits KRX multiples.
 * ============================================================================
 */

import { stripAdrSuffix } from './adr-directory';
import { APP_CONFIG } from './config';
import { logFunctionCall } from './logger';

export type KrxMarket = 'KOSPI' | 'KOSDAQ';

export interface KrxDirectoryEntry {
  /** 6-digit KRX stock code (e.g. '005930') */
  code: string;
  /** Yahoo Finance symbol with market suffix (e.g. '005930.KS' or '196170.KQ') */
  symbol: string;
  /** Exchange board ('KOSPI' or 'KOSDAQ') */
  market: KrxMarket;
  /** Canonical Korean display name */
  koName: string;
  /** Canonical English institutional name (used for English UI & Context.dev news lookup) */
  enName: string;
  /** Primary corporate domain for Context.dev entity & logo enrichment */
  domain?: string;
  /** English sector label */
  sector: string;
  /** Korean sector label */
  koSector: string;
  /** US ADR / OTC symbol if and only if an active US depositary listing exists */
  usAdrSymbol?: string | null;
  /** Korean & English search aliases */
  aliases: string[];
}

export interface ResolvedLocaleEquity {
  symbol: string;
  displayName: string;
  enName: string;
  koName?: string;
  sector: string;
  domain?: string;
  isKrx: boolean;
  krxMarket?: KrxMarket;
  isAdr: boolean;
}

export interface NaverKrxFundamentalsFallback {
  stockNameKo: string | null;
  marketCap: string | null;
  trailingPE: string | null;
  forwardPE: string | null;
  priceToBook: string | null;
  trailingEps: string | null;
  dividendYield: string | null;
  targetMeanPrice: string | null;
  volume: string | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
}

const NAVER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://m.stock.naver.com/',
};

/**
 * Curated institutional directory of flagship KOSPI & KOSDAQ leaders across
 * semiconductors, HBM equipment, EV batteries, biopharma, defense, shipbuilding,
 * internet platforms, financials, robotics, and entertainment.
 */
export const KRX_CURATED_DIRECTORY: KrxDirectoryEntry[] = [
  {
    code: '005930',
    symbol: '005930.KS',
    market: 'KOSPI',
    koName: '삼성전자',
    enName: 'Samsung Electronics',
    domain: 'samsung.com',
    sector: 'Semiconductors & Consumer Tech',
    koSector: '반도체 · IT 하드웨어',
    usAdrSymbol: 'SSNLF',
    aliases: ['삼성전자', '삼전', 'samsung electronics', 'samsung', 'sec'],
  },
  {
    code: '000660',
    symbol: '000660.KS',
    market: 'KOSPI',
    koName: 'SK하이닉스',
    enName: 'SK Hynix',
    domain: 'skhynix.com',
    sector: 'Semiconductors & HBM Memory',
    koSector: '반도체 · HBM 메모리',
    usAdrSymbol: 'SKHY',
    aliases: ['sk하이닉스', '하이닉스', '에스케이하이닉스', 'sk hynix', 'skhynix', 'hynix'],
  },
  {
    code: '373220',
    symbol: '373220.KS',
    market: 'KOSPI',
    koName: 'LG에너지솔루션',
    enName: 'LG Energy Solution',
    domain: 'lgensol.com',
    sector: 'EV & Grid Battery Systems',
    koSector: '2차전지 · 에너지저장장치',
    aliases: ['lg에너지솔루션', '엘지에너지솔루션', '엔솔', 'lg엔솔', 'lg energy solution', 'lges'],
  },
  {
    code: '207940',
    symbol: '207940.KS',
    market: 'KOSPI',
    koName: '삼성바이오로직스',
    enName: 'Samsung Biologics',
    domain: 'samsungbiologics.com',
    sector: 'Biologics CDMO',
    koSector: '바이오 · CDMO',
    aliases: ['삼성바이오로직스', '삼바', '삼성바이오', 'samsung biologics'],
  },
  {
    code: '005380',
    symbol: '005380.KS',
    market: 'KOSPI',
    koName: '현대차',
    enName: 'Hyundai Motor',
    domain: 'hyundai.com',
    sector: 'Automotive & Future Mobility',
    koSector: '자동차 · 미래 모빌리티',
    aliases: ['현대차', '현대자동차', 'hyundai motor', 'hyundai motors', 'hyundai'],
  },
  {
    code: '000270',
    symbol: '000270.KS',
    market: 'KOSPI',
    koName: '기아',
    enName: 'Kia Corporation',
    domain: 'kia.com',
    sector: 'Automotive & EVs',
    koSector: '자동차 · 전동화 모빌리티',
    aliases: ['기아', '기아차', '기아자동차', 'kia', 'kia corp', 'kia motors'],
  },
  {
    code: '068270',
    symbol: '068270.KS',
    market: 'KOSPI',
    koName: '셀트리온',
    enName: 'Celltrion',
    domain: 'celltrion.com',
    sector: 'Biopharmaceuticals & Biosimilars',
    koSector: '바이오의약품 · 바이오시밀러',
    aliases: ['셀트리온', 'celltrion'],
  },
  {
    code: '105560',
    symbol: '105560.KS',
    market: 'KOSPI',
    koName: 'KB금융',
    enName: 'KB Financial Group',
    domain: 'kbfg.com',
    sector: 'Banking & Financial Services',
    koSector: '금융지주 · 은행',
    usAdrSymbol: 'KB',
    aliases: ['kb금융', 'kb금융지주', '케이비금융', 'kb financial', 'kb financial group'],
  },
  {
    code: '055550',
    symbol: '055550.KS',
    market: 'KOSPI',
    koName: '신한지주',
    enName: 'Shinhan Financial Group',
    domain: 'shinhangroup.com',
    sector: 'Banking & Financial Services',
    koSector: '금융지주 · 은행',
    usAdrSymbol: 'SHG',
    aliases: ['신한지주', '신한금융', '신한금융지주', 'shinhan financial', 'shinhan'],
  },
  {
    code: '005490',
    symbol: '005490.KS',
    market: 'KOSPI',
    koName: 'POSCO홀딩스',
    enName: 'POSCO Holdings',
    domain: 'posco-inc.com',
    sector: 'Steel & Battery Materials',
    koSector: '철강 · 이차전지 소재',
    usAdrSymbol: 'PKX',
    aliases: ['posco홀딩스', '포스코홀딩스', '포스코', 'posco', 'posco holdings'],
  },
  {
    code: '035420',
    symbol: '035420.KS',
    market: 'KOSPI',
    koName: 'NAVER',
    enName: 'NAVER Corp',
    domain: 'navercorp.com',
    sector: 'Internet Search, Cloud & AI',
    koSector: '인터넷 플랫폼 · AI 클라우드',
    aliases: ['naver', '네이버', 'naver corp'],
  },
  {
    code: '035720',
    symbol: '035720.KS',
    market: 'KOSPI',
    koName: '카카오',
    enName: 'Kakao Corp',
    domain: 'kakaocorp.com',
    sector: 'Mobile Platform, Fintech & AI',
    koSector: '모바일 플랫폼 · AI',
    aliases: ['카카오', 'kakao', 'kakao corp'],
  },
  {
    code: '012450',
    symbol: '012450.KS',
    market: 'KOSPI',
    koName: '한화에어로스페이스',
    enName: 'Hanwha Aerospace',
    domain: 'hanwhaaerospace.com',
    sector: 'Aerospace & Defense Systems',
    koSector: '방산 · 우주항공',
    aliases: ['한화에어로스페이스', '한화에어로', 'hanwha aerospace'],
  },
  {
    code: '267260',
    symbol: '267260.KS',
    market: 'KOSPI',
    koName: 'HD현대일렉트릭',
    enName: 'HD Hyundai Electric',
    domain: 'hd-hyundaielectric.com',
    sector: 'Power Grid Transformers & Equipment',
    koSector: '전력기기 · 초고압변압기',
    aliases: ['hd현대일렉트릭', '현대일렉트릭', 'hd hyundai electric', 'hyundai electric'],
  },
  {
    code: '042700',
    symbol: '042700.KS',
    market: 'KOSPI',
    koName: '한미반도체',
    enName: 'HANMI Semiconductor',
    domain: 'hanmisemi.com',
    sector: 'HBM TC Bonder & Chip Equipment',
    koSector: '반도체 장비 · HBM TC본더',
    aliases: ['한미반도체', 'hanmi semiconductor', 'hanmi semi'],
  },
  {
    code: '259960',
    symbol: '259960.KS',
    market: 'KOSPI',
    koName: '크래프톤',
    enName: 'KRAFTON',
    domain: 'krafton.com',
    sector: 'Interactive Gaming & Entertainment',
    koSector: '게임 · 인터랙티브 엔터테인먼트',
    aliases: ['크래프톤', 'krafton'],
  },
  {
    code: '034020',
    symbol: '034020.KS',
    market: 'KOSPI',
    koName: '두산에너빌리티',
    enName: 'Doosan Enerbility',
    domain: 'doosanenerbility.com',
    sector: 'SMR Nuclear & Gas Turbines',
    koSector: '원전 · SMR · 가스터빈',
    aliases: ['두산에너빌리티', '두산중공업', 'doosan enerbility'],
  },
  {
    code: '003230',
    symbol: '003230.KS',
    market: 'KOSPI',
    koName: '삼양식품',
    enName: 'Samyang Foods',
    domain: 'samyangfoods.com',
    sector: 'Global Consumer Food & Beverage',
    koSector: '음식료 · 글로벌 K-푸드',
    aliases: ['삼양식품', 'samyang foods'],
  },
  {
    code: '138040',
    symbol: '138040.KS',
    market: 'KOSPI',
    koName: '메리츠금융지주',
    enName: 'Meritz Financial Group',
    domain: 'meritzgroup.com',
    sector: 'Financial Services & Insurance',
    koSector: '금융지주 · 증권 · 보험',
    aliases: ['메리츠금융지주', '메리츠금융', 'meritz financial', 'meritz'],
  },
  {
    code: '086790',
    symbol: '086790.KS',
    market: 'KOSPI',
    koName: '하나금융지주',
    enName: 'Hana Financial Group',
    domain: 'hanafn.com',
    sector: 'Banking & Financial Services',
    koSector: '금융지주 · 은행',
    aliases: ['하나금융지주', '하나금융', 'hana financial', 'hana financial group'],
  },
  {
    code: '316140',
    symbol: '316140.KS',
    market: 'KOSPI',
    koName: '우리금융지주',
    enName: 'Woori Financial Group',
    domain: 'woorifg.com',
    sector: 'Banking & Financial Services',
    koSector: '금융지주 · 은행',
    usAdrSymbol: 'WF',
    aliases: ['우리금융지주', '우리금융', 'woori financial', 'woori financial group'],
  },
  {
    code: '066570',
    symbol: '066570.KS',
    market: 'KOSPI',
    koName: 'LG전자',
    enName: 'LG Electronics',
    domain: 'lge.com',
    sector: 'Smart Appliances, HVAC & Auto Tech',
    koSector: '가전 · 전장 · 공조(HVAC)',
    aliases: ['lg전자', '엘지전자', 'lg electronics', 'lge'],
  },
  {
    code: '051910',
    symbol: '051910.KS',
    market: 'KOSPI',
    koName: 'LG화학',
    enName: 'LG Chem',
    domain: 'lgchem.com',
    sector: 'Battery Cathodes & Specialty Chemicals',
    koSector: '화학 · 양극재 · 첨단소재',
    aliases: ['lg화학', '엘지화학', 'lg chem'],
  },
  {
    code: '006400',
    symbol: '006400.KS',
    market: 'KOSPI',
    koName: '삼성SDI',
    enName: 'Samsung SDI',
    domain: 'samsungsdi.com',
    sector: 'EV Batteries & Electronic Materials',
    koSector: '2차전지 · 전자재료',
    aliases: ['삼성sdi', '삼성에스디아이', 'samsung sdi'],
  },
  {
    code: '034220',
    symbol: '034220.KS',
    market: 'KOSPI',
    koName: 'LG디스플레이',
    enName: 'LG Display',
    domain: 'lgdisplay.com',
    sector: 'OLED & Display Panels',
    koSector: 'OLED · 디스플레이 패널',
    usAdrSymbol: 'LPL',
    aliases: ['lg디스플레이', '엘지디스플레이', 'lg display'],
  },
  {
    code: '015760',
    symbol: '015760.KS',
    market: 'KOSPI',
    koName: '한국전력',
    enName: 'Korea Electric Power (KEPCO)',
    domain: 'kepco.co.kr',
    sector: 'Electric Power Utility & Grid',
    koSector: '전력 · 유틸리티',
    usAdrSymbol: 'KEP',
    aliases: ['한국전력', '한전', '한국전력공사', 'korea electric power', 'kepco'],
  },
  {
    code: '017670',
    symbol: '017670.KS',
    market: 'KOSPI',
    koName: 'SK텔레콤',
    enName: 'SK Telecom',
    domain: 'sktelecom.com',
    sector: 'Telecom & AI Data Centers',
    koSector: '통신 · AI 데이터센터',
    usAdrSymbol: 'SKM',
    aliases: ['sk텔레콤', '에스케이텔레콤', 'skt', 'sk telecom'],
  },
  {
    code: '030200',
    symbol: '030200.KS',
    market: 'KOSPI',
    koName: 'KT',
    enName: 'KT Corporation',
    domain: 'kt.com',
    sector: 'Telecom, Cloud & Enterprise AI',
    koSector: '통신 · 클라우드 · 엔터프라이즈 AI',
    usAdrSymbol: 'KT',
    aliases: ['kt', '케이티', 'kt corp', 'kt corporation'],
  },
  {
    code: '352820',
    symbol: '352820.KS',
    market: 'KOSPI',
    koName: '하이브',
    enName: 'HYBE',
    domain: 'hybecorp.com',
    sector: 'Global Music & Fan Platforms',
    koSector: '엔터테인먼트 · 글로벌 뮤직',
    aliases: ['하이브', 'hybe'],
  },
  {
    code: '009540',
    symbol: '009540.KS',
    market: 'KOSPI',
    koName: 'HD한국조선해양',
    enName: 'HD Korea Shipbuilding & Offshore',
    domain: 'ksoe.co.kr',
    sector: 'LNG Carriers & Naval Shipbuilding',
    koSector: '조선 · 해양플랜트',
    aliases: ['hd한국조선해양', '한국조선해양', 'hd korea shipbuilding'],
  },
  {
    code: '329180',
    symbol: '329180.KS',
    market: 'KOSPI',
    koName: 'HD현대중공업',
    enName: 'HD Hyundai Heavy Industries',
    domain: 'hhi.co.kr',
    sector: 'Shipbuilding & Marine Engines',
    koSector: '조선 · 선박엔진 · 특수선',
    aliases: ['hd현대중공업', '현대중공업', 'hd hyundai heavy industries'],
  },
  {
    code: '042660',
    symbol: '042660.KS',
    market: 'KOSPI',
    koName: '한화오션',
    enName: 'Hanwha Ocean',
    domain: 'hanwhaocean.com',
    sector: 'Naval Defense & LNG Shipbuilding',
    koSector: '조선 · 해양방산',
    aliases: ['한화오션', '대우조선해양', 'hanwha ocean'],
  },
  {
    code: '064350',
    symbol: '064350.KS',
    market: 'KOSPI',
    koName: '현대로템',
    enName: 'Hyundai Rotem',
    domain: 'hyundai-rotem.co.kr',
    sector: 'Defense Vehicles & High-Speed Rail',
    koSector: '방산 지상무기 · 철도',
    aliases: ['현대로템', 'hyundai rotem'],
  },
  {
    code: '079550',
    symbol: '079550.KS',
    market: 'KOSPI',
    koName: 'LIG넥스원',
    enName: 'LIG Nex1',
    domain: 'lignex1.com',
    sector: 'Guided Missiles & Defense Electronics',
    koSector: '방산 정밀유도무기 · 레이더',
    aliases: ['lig넥스원', '엘아이지넥스원', 'lig nex1'],
  },
  {
    code: '007660',
    symbol: '007660.KS',
    market: 'KOSPI',
    koName: '이수페타시스',
    enName: 'ISU Petasys',
    domain: 'petasys.com',
    sector: 'AI Accelerator Multi-Layer PCBs',
    koSector: 'AI 가속기 초다층 기판(MLB)',
    aliases: ['이수페타시스', 'isu petasys'],
  },
  {
    code: '009150',
    symbol: '009150.KS',
    market: 'KOSPI',
    koName: '삼성전기',
    enName: 'Samsung Electro-Mechanics',
    domain: 'samsungsem.com',
    sector: 'MLCC & AI Package Substrates',
    koSector: '전자부품 · MLCC · 반도체기판',
    aliases: ['삼성전기', 'samsung electro-mechanics', 'semco'],
  },
  {
    code: '010120',
    symbol: '010120.KS',
    market: 'KOSPI',
    koName: 'LS일렉트릭',
    enName: 'LS ELECTRIC',
    domain: 'ls-electric.com',
    sector: 'Data Center Power Distribution & Grid',
    koSector: '전력배전 · 데이터센터 전력기기',
    aliases: ['ls일렉트릭', 'ls산전', 'ls electric'],
  },
  {
    code: '010130',
    symbol: '010130.KS',
    market: 'KOSPI',
    koName: '고려아연',
    enName: 'Korea Zinc',
    domain: 'koreazinc.co.kr',
    sector: 'Strategic Metals & Smelting',
    koSector: '비철금속 · 전략광물 제련',
    aliases: ['고려아연', 'korea zinc'],
  },
  // --- KOSDAQ Flagship Leaders (.KQ) ---
  {
    code: '196170',
    symbol: '196170.KQ',
    market: 'KOSDAQ',
    koName: '알테오젠',
    enName: 'Alteogen',
    domain: 'alteogen.com',
    sector: 'Subcutaneous Biologics Platform',
    koSector: '바이오 플랫폼 · 피하주사(SC) 제형',
    aliases: ['알테오젠', 'alteogen'],
  },
  {
    code: '247540',
    symbol: '247540.KQ',
    market: 'KOSDAQ',
    koName: '에코프로비엠',
    enName: 'EcoPro BM',
    domain: 'ecoprobm.co.kr',
    sector: 'High-Nickel EV Cathode Materials',
    koSector: '2차전지 양극재 소재',
    aliases: ['에코프로비엠', 'ecopro bm', 'ecoprobm'],
  },
  {
    code: '086520',
    symbol: '086520.KQ',
    market: 'KOSDAQ',
    koName: '에코프로',
    enName: 'EcoPro',
    domain: 'ecopro.co.kr',
    sector: 'Battery Materials & Eco Holdings',
    koSector: '2차전지 소재 지주',
    aliases: ['에코프로', 'ecopro'],
  },
  {
    code: '028300',
    symbol: '028300.KQ',
    market: 'KOSDAQ',
    koName: 'HLB',
    enName: 'HLB Inc',
    domain: 'hlb-group.com',
    sector: 'Oncology Biopharmaceuticals',
    koSector: '항암 신약 · 바이오',
    aliases: ['hlb', '에이치엘비'],
  },
  {
    code: '141080',
    symbol: '141080.KQ',
    market: 'KOSDAQ',
    koName: '리가켐바이오',
    enName: 'LigaChem Biosciences',
    domain: 'ligachembio.com',
    sector: 'ADC Oncology Therapeutics',
    koSector: '항체약물접합체(ADC) 신약',
    aliases: ['리가켐바이오', '레고켐바이오', 'ligachem', 'ligachem biosciences'],
  },
  {
    code: '145020',
    symbol: '145020.KQ',
    market: 'KOSDAQ',
    koName: '휴젤',
    enName: 'Hugel',
    domain: 'hugel.co.kr',
    sector: 'Medical Aesthetics & Botulinum Toxin',
    koSector: '메디컬 에스테틱 · 보툴리눔 톡신',
    aliases: ['휴젤', 'hugel'],
  },
  {
    code: '214150',
    symbol: '214150.KQ',
    market: 'KOSDAQ',
    koName: '클래시스',
    enName: 'Classys',
    domain: 'classys.com',
    sector: 'Energy-Based Medical Aesthetic Devices',
    koSector: '미용의료기기',
    aliases: ['클래시스', 'classys'],
  },
  {
    code: '214450',
    symbol: '214450.KQ',
    market: 'KOSDAQ',
    koName: '파마리서치',
    enName: 'PharmaResearch',
    domain: 'pharmaresearch.co.kr',
    sector: 'Regenerative Biopharma & Aesthetics',
    koSector: '재생의학 · 에스테틱(리쥬란)',
    aliases: ['파마리서치', 'pharmaresearch'],
  },
  {
    code: '277810',
    symbol: '277810.KQ',
    market: 'KOSDAQ',
    koName: '레인보우로보틱스',
    enName: 'Rainbow Robotics',
    domain: 'rainbow-robotics.com',
    sector: 'Humanoid & Collaborative Robotics',
    koSector: '로보틱스 · 휴머노이드 · 협동로봇',
    aliases: ['레인보우로보틱스', 'rainbow robotics'],
  },
  {
    code: '058470',
    symbol: '058470.KQ',
    market: 'KOSDAQ',
    koName: '리노공업',
    enName: 'LEENO Industrial',
    domain: 'leeno.com',
    sector: 'Semiconductor IC Test Sockets & Pins',
    koSector: '반도체 테스트 소켓 · 리노핀',
    aliases: ['리노공업', 'leeno', 'leeno industrial'],
  },
  {
    code: '039030',
    symbol: '039030.KQ',
    market: 'KOSDAQ',
    koName: '이오테크닉스',
    enName: 'EO Technics',
    domain: 'eotechnics.com',
    sector: 'Semiconductor Laser Processing Equipment',
    koSector: '반도체 레이저 공정 장비',
    aliases: ['이오테크닉스', 'eo technics', 'eotechnics'],
  },
  {
    code: '089030',
    symbol: '089030.KQ',
    market: 'KOSDAQ',
    koName: '테크윙',
    enName: 'Techwing',
    domain: 'techwing.co.kr',
    sector: 'HBM Cube Prober & Memory Test Handlers',
    koSector: '반도체 테스트 핸들러 · HBM 큐브프로버',
    aliases: ['테크윙', 'techwing'],
  },
  {
    code: '140860',
    symbol: '140860.KQ',
    market: 'KOSDAQ',
    koName: '파크시스템스',
    enName: 'Park Systems',
    domain: 'parksystems.com',
    sector: 'Atomic Force Microscopy (AFM) Metrology',
    koSector: '반도체 원자현미경(AFM) 계측장비',
    aliases: ['파크시스템스', 'park systems'],
  },
  {
    code: '036930',
    symbol: '036930.KQ',
    market: 'KOSDAQ',
    koName: '주성엔지니어링',
    enName: 'Jusung Engineering',
    domain: 'jusung.com',
    sector: 'ALD Semiconductor Deposition Equipment',
    koSector: '반도체 원자층증착(ALD) 장비',
    aliases: ['주성엔지니어링', 'jusung engineering'],
  },
  {
    code: '035900',
    symbol: '035900.KQ',
    market: 'KOSDAQ',
    koName: 'JYP Ent.',
    enName: 'JYP Entertainment',
    domain: 'jype.com',
    sector: 'Global Music & Artist IP',
    koSector: '엔터테인먼트 · K-POP IP',
    aliases: ['jyp ent', 'jyp', '제이와이피', 'jyp엔터테인먼트', 'jyp entertainment'],
  },
  {
    code: '263750',
    symbol: '263750.KQ',
    market: 'KOSDAQ',
    koName: '펄어비스',
    enName: 'Pearl Abyss',
    domain: 'pearlabyss.com',
    sector: 'AAA PC & Console Gaming',
    koSector: '게임 · 콘솔/PC 대작 IP',
    aliases: ['펄어비스', 'pearl abyss'],
  },
  {
    code: '257720',
    symbol: '257720.KQ',
    market: 'KOSDAQ',
    koName: '실리콘투',
    enName: 'Silicon2',
    domain: 'siliconii.com',
    sector: 'Global K-Beauty Cross-Border Distribution',
    koSector: '글로벌 K-뷰티 유통 플랫폼',
    aliases: ['실리콘투', 'silicon2'],
  },
];

/**
 * Hangul search aliases for major US-listed & ADR stocks so Korean users typing
 * `"엔비디아"`, `"테슬라"`, `"쿠팡"`, `"TSMC"` in Hangul resolve instantaneously.
 */
const HANGUL_GLOBAL_PUBLIC_ALIASES: Array<{
  aliases: string[];
  symbol: string;
  enName: string;
  koName: string;
  sector: string;
  koSector: string;
  isAdr: boolean;
}> = [
  {
    aliases: ['엔비디아'],
    symbol: 'NVDA',
    enName: 'NVIDIA Corp',
    koName: '엔비디아 (NVIDIA)',
    sector: 'Semiconductors & AI',
    koSector: 'AI 가속기 · 반도체',
    isAdr: false,
  },
  {
    aliases: ['애플'],
    symbol: 'AAPL',
    enName: 'Apple Inc',
    koName: '애플 (Apple)',
    sector: 'Consumer Hardware & Ecosystem',
    koSector: '컨슈머 하드웨어 · 생태계',
    isAdr: false,
  },
  {
    aliases: ['마이크로소프트', '마소'],
    symbol: 'MSFT',
    enName: 'Microsoft',
    koName: '마이크로소프트 (Microsoft)',
    sector: 'Cloud & Enterprise AI',
    koSector: '클라우드 · 엔터프라이즈 AI',
    isAdr: false,
  },
  {
    aliases: ['테슬라'],
    symbol: 'TSLA',
    enName: 'Tesla',
    koName: '테슬라 (Tesla)',
    sector: 'EVs, Autonomy & Energy',
    koSector: '전기차 · 자율주행 · 로보틱스',
    isAdr: false,
  },
  {
    aliases: ['구글', '알파벳'],
    symbol: 'GOOGL',
    enName: 'Alphabet (Google)',
    koName: '알파벳 (Google)',
    sector: 'Search, Cloud & Frontier AI',
    koSector: '검색 · 클라우드 · 프론티어 AI',
    isAdr: false,
  },
  {
    aliases: ['아마존'],
    symbol: 'AMZN',
    enName: 'Amazon',
    koName: '아마존 (Amazon)',
    sector: 'AWS Cloud & Commerce',
    koSector: 'AWS 클라우드 · 이커머스',
    isAdr: false,
  },
  {
    aliases: ['메타', '페이스북'],
    symbol: 'META',
    enName: 'Meta Platforms',
    koName: '메타 (Meta)',
    sector: 'Social Platforms & Open AI',
    koSector: '소셜 플랫폼 · AI',
    isAdr: false,
  },
  {
    aliases: ['브로드컴'],
    symbol: 'AVGO',
    enName: 'Broadcom',
    koName: '브로드컴 (Broadcom)',
    sector: 'Custom AI Silicon & Networking',
    koSector: '맞춤형 AI 칩(ASIC) · 네트워킹',
    isAdr: false,
  },
  {
    aliases: ['에이엠디'],
    symbol: 'AMD',
    enName: 'AMD',
    koName: 'AMD',
    sector: 'Data Center GPUs & CPUs',
    koSector: '데이터센터 GPU · CPU',
    isAdr: false,
  },
  {
    aliases: ['팔란티어'],
    symbol: 'PLTR',
    enName: 'Palantir',
    koName: '팔란티어 (Palantir)',
    sector: 'Defense & Data OS',
    koSector: '국방 · 엔터프라이즈 AI OS',
    isAdr: false,
  },
  {
    aliases: ['쿠팡'],
    symbol: 'CPNG',
    enName: 'Coupang',
    koName: '쿠팡 (Coupang)',
    sector: 'E-Commerce & Logistics',
    koSector: '이커머스 · 풀필먼트 물류',
    isAdr: false,
  },
  {
    aliases: ['마이크론', '마이크론테크놀로지'],
    symbol: 'MU',
    enName: 'Micron Technology',
    koName: '마이크론 (Micron)',
    sector: 'DRAM, NAND & HBM Memory',
    koSector: '메모리 반도체 · HBM',
    isAdr: false,
  },
  {
    aliases: ['인텔'],
    symbol: 'INTC',
    enName: 'Intel Corp',
    koName: '인텔 (Intel)',
    sector: 'CPUs & Semiconductor Foundry',
    koSector: 'CPU · 파운드리',
    isAdr: false,
  },
  {
    aliases: ['퀄컴'],
    symbol: 'QCOM',
    enName: 'Qualcomm',
    koName: '퀄컴 (Qualcomm)',
    sector: 'Mobile & Edge AI Semiconductors',
    koSector: '모바일 · 온디바이스 AI 칩',
    isAdr: false,
  },
  {
    aliases: ['넷플릭스'],
    symbol: 'NFLX',
    enName: 'Netflix',
    koName: '넷플릭스 (Netflix)',
    sector: 'Global Streaming Media',
    koSector: '글로벌 스트리밍 미디어',
    isAdr: false,
  },
  {
    aliases: ['일라이릴리'],
    symbol: 'LLY',
    enName: 'Eli Lilly',
    koName: '일라이 릴리 (Eli Lilly)',
    sector: 'Biopharmaceuticals & GLP-1',
    koSector: '제약 · 비만치료제(GLP-1)',
    isAdr: false,
  },
  {
    aliases: ['아이온큐'],
    symbol: 'IONQ',
    enName: 'IonQ',
    koName: '아이온큐 (IonQ)',
    sector: 'Quantum Computing',
    koSector: '양자컴퓨팅',
    isAdr: false,
  },
  {
    aliases: ['대만반도체', '티에스엠씨'],
    symbol: 'TSM',
    enName: 'TSMC',
    koName: 'TSMC',
    sector: 'Semiconductor Foundry',
    koSector: '반도체 파운드리',
    isAdr: true,
  },
  {
    aliases: ['에이에스엠엘'],
    symbol: 'ASML',
    enName: 'ASML Holding',
    koName: 'ASML',
    sector: 'Semiconductor Lithography',
    koSector: '반도체 노광장비(EUV)',
    isAdr: true,
  },
  {
    aliases: ['암홀딩스'],
    symbol: 'ARM',
    enName: 'Arm Holdings',
    koName: 'Arm 홀딩스',
    sector: 'Semiconductor IP & Architecture',
    koSector: '반도체 설계 IP',
    isAdr: true,
  },
  {
    aliases: ['도쿄일렉트론'],
    symbol: 'TELWY',
    enName: 'Tokyo Electron',
    koName: '도쿄일렉트론',
    sector: 'Semiconductor Equipment',
    koSector: '반도체 전공정 장비',
    isAdr: true,
  },
  {
    aliases: ['소프트뱅크'],
    symbol: 'SFTBY',
    enName: 'SoftBank Group',
    koName: '소프트뱅크 그룹',
    sector: 'AI & Technology Holdings',
    koSector: 'AI · 테크 투자지주',
    isAdr: true,
  },
];

/**
 * Hangul aliases for prominent privately held companies (e.g. 오픈AI -> OpenAI).
 */
const HANGUL_PRIVATE_ALIASES: Record<string, string> = {
  오픈ai: 'OpenAI',
  오픈에이아이: 'OpenAI',
  스트라이프: 'Stripe',
  앤스로픽: 'Anthropic',
  앤트로픽: 'Anthropic',
  스페이스x: 'SpaceX',
  스페이스엑스: 'SpaceX',
  데이터브릭스: 'Databricks',
  퍼플렉시티: 'Perplexity AI',
  안두릴: 'Anduril Industries',
  엑스ai: 'xAI',
  딥시크: 'DeepSeek',
  피그마: 'Figma',
  디스코드: 'Discord',
};

const CODE_TO_ENTRY = new Map<string, KrxDirectoryEntry>();
const SYMBOL_TO_ENTRY = new Map<string, KrxDirectoryEntry>();
const ADR_TO_ENTRY = new Map<string, KrxDirectoryEntry>();
const ALIAS_TO_ENTRY = new Map<string, KrxDirectoryEntry>();
const HANGUL_PUBLIC_MAP = new Map<
  string,
  (typeof HANGUL_GLOBAL_PUBLIC_ALIASES)[number]
>();

const naverAutocompleteCache = new Map<
  string,
  { entry: ResolvedLocaleEquity | null; expiresAt: number }
>();
const naverFundamentalsCache = new Map<
  string,
  { data: NaverKrxFundamentalsFallback | null; expiresAt: number }
>();

/**
 * Normalizes Korean/English company identifiers while preserving Hangul syllables
 * and alphanumeric characters.
 *
 * @param raw - Raw company name or stock code
 * @returns Normalized lookup key
 */
export function normalizeKrxKey(raw: string): string {
  return stripAdrSuffix(raw)
    .replace(/^\$/, '')
    .toLowerCase()
    .replace(/\b(inc|incorporated|corp|corporation|ltd|limited|plc|co|company)\b/g, ' ')
    .replace(/\(주\)|주식회사/g, ' ')
    .replace(/[^a-z0-9가-힣]/g, '')
    .trim();
}

for (const entry of KRX_CURATED_DIRECTORY) {
  CODE_TO_ENTRY.set(entry.code.toUpperCase(), entry);
  SYMBOL_TO_ENTRY.set(entry.symbol.toUpperCase(), entry);
  if (entry.usAdrSymbol) {
    ADR_TO_ENTRY.set(entry.usAdrSymbol.toUpperCase(), entry);
  }
  const allKeys = [
    entry.koName,
    entry.enName,
    entry.code,
    entry.symbol,
    ...entry.aliases,
  ];
  for (const k of allKeys) {
    const norm = normalizeKrxKey(k);
    if (norm) {
      ALIAS_TO_ENTRY.set(norm, entry);
    }
  }
}

for (const item of HANGUL_GLOBAL_PUBLIC_ALIASES) {
  for (const alias of item.aliases) {
    const norm = normalizeKrxKey(alias);
    if (norm) {
      HANGUL_PUBLIC_MAP.set(norm, item);
    }
  }
}

/**
 * Checks whether a ticker symbol is a Korea Exchange (`.KS` or `.KQ`) symbol.
 *
 * @param symbol - Stock symbol string
 * @returns `true` if formatted as `XXXXXX.KS` or `XXXXXX.KQ`
 */
export function isKrxSymbol(symbol?: string | null): boolean {
  if (!symbol) return false;
  const cleaned = stripAdrSuffix(symbol).trim().toUpperCase();
  return /^[0-9A-Z]{6}\.(KS|KQ)$/.test(cleaned);
}

/**
 * Returns `'KOSPI'` for `.KS`, `'KOSDAQ'` for `.KQ`, or `null` otherwise.
 *
 * @param symbol - Stock symbol string
 * @returns `KrxMarket` or `null`
 */
export function getKrxMarketFromSymbol(
  symbol?: string | null
): KrxMarket | null {
  if (!symbol) return null;
  const cleaned = stripAdrSuffix(symbol).trim().toUpperCase();
  if (/^[0-9A-Z]{6}\.KS$/.test(cleaned)) return 'KOSPI';
  if (/^[0-9A-Z]{6}\.KQ$/.test(cleaned)) return 'KOSDAQ';
  return null;
}

/**
 * Normalizes an equity ticker symbol for Yahoo Finance while strictly preserving
 * `.KS` and `.KQ` suffixes on Korea Exchange stocks (and converting US share-class
 * dots like `BRK.B` into `BRK-B`).
 *
 * @param raw - Raw ticker input
 * @returns Yahoo Finance compatible ticker symbol
 */
export function normalizeEquitySymbol(raw: string): string {
  const cleaned = stripAdrSuffix(raw).replace(/^\$/, '').trim().toUpperCase();
  if (/^[0-9A-Z]{6}\.(KS|KQ)$/.test(cleaned)) {
    return cleaned;
  }
  if (/^\d{6}$/.test(cleaned)) {
    const curated = CODE_TO_ENTRY.get(cleaned);
    if (curated) {
      return curated.symbol;
    }
    return `${cleaned}.KS`;
  }
  return cleaned.replace(/\./g, '-');
}

/**
 * Looks up curated KRX metadata by `.KS`/`.KQ` symbol or 6-digit KRX code.
 *
 * @param symbolOrCode - KRX ticker (`005930.KS`) or 6-digit code (`005930`)
 * @returns Matching `KrxDirectoryEntry` or `null`
 */
export function lookupKrxBySymbolOrCode(
  symbolOrCode?: string | null
): KrxDirectoryEntry | null {
  if (!symbolOrCode) return null;
  const cleaned = stripAdrSuffix(symbolOrCode).trim().toUpperCase();
  return SYMBOL_TO_ENTRY.get(cleaned) ?? CODE_TO_ENTRY.get(cleaned) ?? null;
}

/**
 * Looks up curated KRX metadata by Korean/English name, alias, code, or `.KS`/`.KQ` symbol.
 *
 * @param query - Raw query string
 * @returns Matching `KrxDirectoryEntry` or `null`
 */
export function lookupKrxDirectoryEntry(
  query?: string | null
): KrxDirectoryEntry | null {
  if (!query) return null;
  const direct = lookupKrxBySymbolOrCode(query);
  if (direct) return direct;
  const norm = normalizeKrxKey(query);
  if (!norm) return null;
  return ALIAS_TO_ENTRY.get(norm) ?? null;
}

/**
 * Resolves a Hangul private company alias (e.g. `"오픈AI"` -> `"OpenAI"`, `"스트라이프"` -> `"Stripe"`).
 *
 * @param query - Raw user query
 * @returns Canonical English private company name or `null`
 */
export function lookupHangulPrivateAlias(query?: string | null): string | null {
  if (!query) return null;
  const norm = normalizeKrxKey(query);
  return HANGUL_PRIVATE_ALIASES[norm] ?? null;
}

/**
 * Queries Naver Stock Autocomplete (`ac.stock.naver.com`) to dynamically resolve
 * any of the 2,600+ KOSPI & KOSDAQ stocks not in the curated fast-path list.
 *
 * @param rawQuery - User-entered Hangul company name or 6-digit KRX code
 * @param locale - Active UI locale (`'en'` | `'ko'`)
 * @returns `ResolvedLocaleEquity` or `null`
 */
export async function resolveDynamicKrxAutocomplete(
  rawQuery: string,
  locale: 'en' | 'ko' = 'ko'
): Promise<ResolvedLocaleEquity | null> {
  const cleaned = stripAdrSuffix(rawQuery).trim();
  if (!cleaned) return null;

  const isSixDigitCode = /^\d{6}$/.test(cleaned);
  const hasHangul = /[가-힣]/.test(cleaned);
  if (!isSixDigitCode && !hasHangul) {
    return null;
  }

  const cacheKey = `${cleaned.toLowerCase()}::${locale}`;
  const cached = naverAutocompleteCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.entry;
  }

  try {
    const url = `${APP_CONFIG.krx.naverAutocompleteUrl}?q=${encodeURIComponent(
      cleaned
    )}&target=stock`;
    const res = await fetch(url, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as {
      items?: Array<{
        code?: string;
        name?: string;
        typeCode?: string;
        nationCode?: string;
      }>;
    };

    const items = (json.items ?? []).filter(
      (it) =>
        it.nationCode === 'KOR' &&
        (it.typeCode === 'KOSPI' || it.typeCode === 'KOSDAQ') &&
        typeof it.code === 'string' &&
        /^[0-9A-Z]{6}$/i.test(it.code)
    );

    const normQuery = normalizeKrxKey(cleaned);
    const matched = items.find((it) => {
      if (isSixDigitCode) {
        return String(it.code).toUpperCase() === cleaned.toUpperCase();
      }
      const normCand = normalizeKrxKey(String(it.name ?? ''));
      return (
        normCand === normQuery ||
        (normQuery.length >= 2 && normCand.startsWith(normQuery))
      );
    });

    if (!matched || !matched.code || !matched.name) {
      naverAutocompleteCache.set(cacheKey, {
        entry: null,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      return null;
    }

    const market: KrxMarket =
      matched.typeCode === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI';
    const suffix = market === 'KOSDAQ' ? 'KQ' : 'KS';
    const symbol = `${matched.code.toUpperCase()}.${suffix}`;

    const entry: ResolvedLocaleEquity = {
      symbol,
      displayName: matched.name.trim(),
      enName: matched.name.trim(),
      koName: matched.name.trim(),
      sector:
        locale === 'ko'
          ? `${market} 상장 기업`
          : `${market} Listed Equity`,
      isKrx: true,
      krxMarket: market,
      isAdr: false,
    };

    logFunctionCall('resolveDynamicKrxAutocomplete:hit', {
      rawQuery,
      symbol,
      name: matched.name,
      market,
    });

    naverAutocompleteCache.set(cacheKey, {
      entry,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    return entry;
  } catch {
    return null;
  }
}

/**
 * Resolves a company name, stock code, or ticker according to the user's confirmed
 * locale-aware dual-listing rules:
 * - Explicit `.KS`/`.KQ` symbols, 6-digit KRX codes, or `(KOSPI)`/`(KOSDAQ)` tags
 *   always resolve to the KRX listing.
 * - Explicit `(ADR)` tags or unambiguous ADR symbols (`SSNLF`, `SKHY`, `PKX`, `SHG`,
 *   `LPL`, `KEP`, `SKM`, `WF`) always resolve to the US ADR.
 * - Dual-listed Korean company names (`삼성전자`/`Samsung Electronics`, `SK하이닉스`/
 *   `SK Hynix`, etc.) resolve to KRX `.KS` when `locale === 'ko'`, and to their US
 *   ADR when `locale === 'en'`.
 * - Non-ADR Korean equities (`현대차`/`Hyundai Motor`, `알테오젠`/`Alteogen`, etc.)
 *   always resolve to KRX `.KS`/`.KQ` in both `ko` and `en`.
 *
 * @param rawQuery - User-entered search string or ticker
 * @param locale - Active UI language (`'en'` | `'ko'`)
 * @returns `ResolvedLocaleEquity` or `null` if not a KRX / Hangul-aliased equity
 */
export async function resolveEquityQueryWithLocale(
  rawQuery: string,
  locale: 'en' | 'ko' = 'en'
): Promise<ResolvedLocaleEquity | null> {
  const rawTrimmed = rawQuery.trim();
  if (!rawTrimmed) return null;

  const forceAdr = /\(\s*ADR\s*\)\s*$/i.test(rawTrimmed);
  const forceKrx = /\(\s*(?:KOSPI|KOSDAQ)\s*\)\s*$/i.test(rawTrimmed);
  const cleaned = stripAdrSuffix(rawTrimmed).replace(/^\$/, '').trim();
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();

  // 1. Explicit .KS / .KQ symbol (e.g. 005930.KS, 196170.KQ)
  if (/^[0-9A-Z]{6}\.(KS|KQ)$/.test(upper)) {
    const market: KrxMarket = upper.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI';
    const curated = SYMBOL_TO_ENTRY.get(upper);
    if (curated) {
      return {
        symbol: curated.symbol,
        displayName: locale === 'ko' ? curated.koName : curated.enName,
        enName: curated.enName,
        koName: curated.koName,
        sector: locale === 'ko' ? curated.koSector : curated.sector,
        domain: curated.domain,
        isKrx: true,
        krxMarket: curated.market,
        isAdr: false,
      };
    }
    const codeOnly = upper.slice(0, 6);
    const dynamicHit = await resolveDynamicKrxAutocomplete(codeOnly, locale);
    return {
      symbol: upper,
      displayName: dynamicHit?.displayName || upper,
      enName: dynamicHit?.enName || upper,
      koName: dynamicHit?.koName,
      sector:
        locale === 'ko'
          ? `${market} 상장 주식`
          : `${market} Listed Equity`,
      isKrx: true,
      krxMarket: market,
      isAdr: false,
    };
  }

  // 2. Explicit 6-digit KRX stock code (e.g. 005930, 000660, 196170)
  if (/^\d{6}$/.test(upper)) {
    const curated = CODE_TO_ENTRY.get(upper);
    if (curated) {
      return {
        symbol: curated.symbol,
        displayName: locale === 'ko' ? curated.koName : curated.enName,
        enName: curated.enName,
        koName: curated.koName,
        sector: locale === 'ko' ? curated.koSector : curated.sector,
        domain: curated.domain,
        isKrx: true,
        krxMarket: curated.market,
        isAdr: false,
      };
    }
    const dynamicCodeHit = await resolveDynamicKrxAutocomplete(upper, locale);
    if (dynamicCodeHit) {
      return dynamicCodeHit;
    }
  }

  // 3. Explicit unambiguous US ADR ticker (e.g. SKHY, SSNLF, PKX, SHG, LPL, KEP, SKM, WF)
  // Note: 'KT' and 'KB' overlap with Korean brand names when locale === 'ko' unless forceAdr is set
  const adrEntry = ADR_TO_ENTRY.get(upper);
  if (
    adrEntry &&
    adrEntry.usAdrSymbol &&
    (forceAdr ||
      locale === 'en' ||
      (upper !== 'KT' && upper !== 'KB'))
  ) {
    return {
      symbol: adrEntry.usAdrSymbol,
      displayName: adrEntry.enName,
      enName: adrEntry.enName,
      koName: adrEntry.koName,
      sector: locale === 'ko' ? adrEntry.koSector : adrEntry.sector,
      domain: adrEntry.domain,
      isKrx: false,
      isAdr: true,
    };
  }

  // 4. Curated KRX directory name / alias match (handles both dual-listed & KRX-only)
  const norm = normalizeKrxKey(cleaned);
  const curatedHit = ALIAS_TO_ENTRY.get(norm);
  if (curatedHit) {
    const useAdr =
      Boolean(curatedHit.usAdrSymbol) &&
      !forceKrx &&
      (forceAdr || locale === 'en');

    if (useAdr && curatedHit.usAdrSymbol) {
      logFunctionCall('resolveEquityQueryWithLocale:dualListedAdr', {
        rawQuery,
        locale,
        resolvedSymbol: curatedHit.usAdrSymbol,
      });
      return {
        symbol: curatedHit.usAdrSymbol,
        displayName: curatedHit.enName,
        enName: curatedHit.enName,
        koName: curatedHit.koName,
        sector: curatedHit.sector,
        domain: curatedHit.domain,
        isKrx: false,
        isAdr: true,
      };
    }

    logFunctionCall('resolveEquityQueryWithLocale:krxPrimary', {
      rawQuery,
      locale,
      resolvedSymbol: curatedHit.symbol,
    });
    return {
      symbol: curatedHit.symbol,
      displayName: locale === 'ko' ? curatedHit.koName : curatedHit.enName,
      enName: curatedHit.enName,
      koName: curatedHit.koName,
      sector: locale === 'ko' ? curatedHit.koSector : curatedHit.sector,
      domain: curatedHit.domain,
      isKrx: true,
      krxMarket: curatedHit.market,
      isAdr: false,
    };
  }

  // 5. Hangul global US / ADR public stock alias (e.g. 엔비디아 -> NVDA, 쿠팡 -> CPNG)
  const hangulGlobal = HANGUL_PUBLIC_MAP.get(norm);
  if (hangulGlobal) {
    return {
      symbol: hangulGlobal.symbol,
      displayName: locale === 'ko' ? hangulGlobal.koName : hangulGlobal.enName,
      enName: hangulGlobal.enName,
      koName: hangulGlobal.koName,
      sector: locale === 'ko' ? hangulGlobal.koSector : hangulGlobal.sector,
      isKrx: false,
      isAdr: hangulGlobal.isAdr,
    };
  }

  // 6. Dynamic Naver Stock Autocomplete for all other Hangul KOSPI / KOSDAQ stocks
  return resolveDynamicKrxAutocomplete(cleaned, locale);
}

/**
 * Formats a large `KRW` monetary figure (such as Market Cap, Enterprise Value,
 * or Total Revenue) strictly in pure Korean Won `조` ($10^{12}$) and `억` ($10^8$)
 * units without USD conversion clutter.
 *
 * @param rawKrw - Raw numeric amount in KRW
 * @returns Pure KRW formatted string (e.g. `"₩336.8조"`, `"₩4,820억"`) or `null`
 */
export function formatKrwCompact(
  rawKrw: number | null | undefined
): string | null {
  if (
    typeof rawKrw !== 'number' ||
    !Number.isFinite(rawKrw) ||
    rawKrw === 0
  ) {
    return null;
  }

  const sign = rawKrw < 0 ? '-' : '';
  const abs = Math.abs(rawKrw);

  if (abs >= 1e12) {
    const jo = abs / 1e12;
    const formattedJo =
      jo >= 100
        ? jo.toFixed(1)
        : jo.toFixed(2).replace(/\.?0+$/, '');
    return `${sign}₩${formattedJo}조`;
  }

  if (abs >= 1e8) {
    const eok = Math.round(abs / 1e8);
    return `${sign}₩${eok.toLocaleString('en-US')}억`;
  }

  if (abs >= 1e4) {
    const man = Math.round(abs / 1e4);
    return `${sign}₩${man.toLocaleString('en-US')}만`;
  }

  return `${sign}₩${Math.round(abs).toLocaleString('en-US')}`;
}

/**
 * Formats a per-share price, EPS, or analyst target price according to currency:
 * - `KRW`: integer `₩` with comma separators and zero decimals (`₩56,400`)
 * - `USD` (or default): `$` with 2 decimals (`$138.60`)
 *
 * @param value - Numeric share price or per-share figure
 * @param currency - ISO currency code (`'KRW'` | `'USD'`)
 * @returns Currency-formatted share price string
 */
export function formatSharePriceByCurrency(
  value: number | null | undefined,
  currency?: string | null
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if ((currency || '').toUpperCase() === 'KRW') {
    return `${sign}₩${Math.round(abs).toLocaleString('en-US')}`;
  }

  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parses a Naver Finance Korean market-cap string (e.g. `"336조 8,123억"` or `"4,820억"`)
 * into a clean `₩` compact unit (`"₩336.8조"` or `"₩4,820억"`).
 *
 * @param rawText - Raw Naver `marketValue` string
 * @returns Clean `₩` compact string or `null`
 */
export function parseNaverKrwMarketValue(
  rawText?: string | null
): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.replace(/,/g, '').trim();
  if (!cleaned) return null;

  const joMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*조/);
  const eokMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*억/);

  if (joMatch || eokMatch) {
    const jo = joMatch ? Number(joMatch[1]) : 0;
    const eok = eokMatch ? Number(eokMatch[1]) : 0;
    const rawKrw = jo * 1e12 + eok * 1e8;
    return formatKrwCompact(rawKrw);
  }

  const numeric = Number(cleaned.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(numeric) && numeric > 0) {
    return formatKrwCompact(numeric);
  }
  return null;
}

/**
 * Fetches live KRX fundamental metrics (`Market Cap`, `PER`, `Forward PER`, `PBR`,
 * `EPS`, `Dividend Yield`, `52W High/Low`, and `Analyst Target Price`) from Naver
 * Finance mobile stock integration endpoint as a resilient fallback when Yahoo
 * `quoteSummary` omits Korean equity fundamentals.
 *
 * @param symbolOrCode - KRX symbol (`005930.KS`, `196170.KQ`) or 6-digit code
 * @returns `NaverKrxFundamentalsFallback` or `null`
 */
export async function fetchNaverKrxFundamentalsFallback(
  symbolOrCode: string
): Promise<NaverKrxFundamentalsFallback | null> {
  const codeMatch = stripAdrSuffix(symbolOrCode)
    .trim()
    .toUpperCase()
    .match(/^([0-9A-Z]{6})(?:\.(?:KS|KQ))?$/);
  if (!codeMatch) return null;

  const code = codeMatch[1];
  const cached = naverFundamentalsCache.get(code);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const url = `${APP_CONFIG.krx.naverIntegrationBaseUrl}/${encodeURIComponent(
      code
    )}/integration`;
    const res = await fetch(url, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as {
      stockName?: string;
      totalInfos?: Array<{ code?: string; value?: string }>;
      consensusInfo?: { priceTargetMean?: string | number | null };
    };

    const infoMap = new Map<string, string>();
    for (const item of json.totalInfos ?? []) {
      if (item.code && typeof item.value === 'string' && item.value.trim()) {
        infoMap.set(item.code, item.value.trim());
      }
    }

    const parseCleanNumber = (raw?: string | null): number | null => {
      if (!raw) return null;
      const cleanedNum = raw.replace(/,/g, '').replace(/[^0-9.-]/g, '');
      if (!cleanedNum || cleanedNum === '-') return null;
      const num = Number(cleanedNum);
      return Number.isFinite(num) ? num : null;
    };

    const parseMultiple = (raw?: string | null): string | null => {
      const n = parseCleanNumber(raw);
      return n !== null && n > 0 ? n.toFixed(2) : null;
    };

    const epsNum =
      parseCleanNumber(infoMap.get('eps')) ??
      parseCleanNumber(infoMap.get('cnsEps'));
    const targetRaw =
      json.consensusInfo?.priceTargetMean !== undefined &&
      json.consensusInfo?.priceTargetMean !== null
        ? String(json.consensusInfo.priceTargetMean)
        : null;
    const targetNum = parseCleanNumber(targetRaw);
    const divNum = parseCleanNumber(infoMap.get('dividendYieldRatio'));
    const volNum = parseCleanNumber(infoMap.get('accumulatedTradingVolume'));

    const formatCompactVol = (v: number | null): string | null => {
      if (v === null || v <= 0) return null;
      if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
      if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
      return String(Math.round(v));
    };

    const fallbackData: NaverKrxFundamentalsFallback = {
      stockNameKo:
        typeof json.stockName === 'string' && json.stockName.trim()
          ? json.stockName.trim()
          : null,
      marketCap: parseNaverKrwMarketValue(infoMap.get('marketValue')),
      trailingPE: parseMultiple(infoMap.get('per')),
      forwardPE: parseMultiple(infoMap.get('cnsPer')),
      priceToBook: parseMultiple(infoMap.get('pbr')),
      trailingEps:
        epsNum !== null ? formatSharePriceByCurrency(epsNum, 'KRW') : null,
      dividendYield: divNum !== null && divNum > 0 ? `${divNum.toFixed(2)}%` : null,
      targetMeanPrice:
        targetNum !== null && targetNum > 0
          ? formatSharePriceByCurrency(targetNum, 'KRW')
          : null,
      volume: formatCompactVol(volNum),
      fiftyTwoWeekLow: parseCleanNumber(infoMap.get('low52wPrice')),
      fiftyTwoWeekHigh: parseCleanNumber(infoMap.get('high52wPrice')),
    };

    logFunctionCall('fetchNaverKrxFundamentalsFallback:success', {
      code,
      marketCap: fallbackData.marketCap,
      trailingPE: fallbackData.trailingPE,
      priceToBook: fallbackData.priceToBook,
    });

    naverFundamentalsCache.set(code, {
      data: fallbackData,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return fallbackData;
  } catch {
    return null;
  }
}
