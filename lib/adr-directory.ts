/**
 * ============================================================================
 * FILE: lib/adr-directory.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * American Depositary Receipt (ADR), US-Traded International Equity, and
 * Corporate Brand-Alias Resolution Directory for Contextual Investing.
 *
 * USE CASES:
 * 1. Resolving international operating company names (e.g. `"SK Hynix"`,
 *    `"TSMC"`, `"Foxconn"`, `"Samsung Electronics"`, `"Tokyo Electron"`,
 *    `"Infineon"`, `"SoftBank"`, `"Tencent"`, `"Advantest"`, `"Nintendo"`)
 *    directly to their US-traded ADR or US OTC equity symbols (`SKHY`, `TSM`,
 *    `HNHPF`, `SSNLF`, `TELWY`, `IFNNY`, `SFTBY`, `TCEHY`, `ATEYY`, `NTDOY`).
 * 2. Disambiguating ticker/name collisions where a short international brand
 *    name collides with an unrelated US domestic ticker (e.g. `"CATL"` vs SPAC
 *    `CATL` -> resolves `"CATL"` / `"Contemporary Amperex"` to ADR `CYATY`;
 *    `"Foxconn"` -> resolves to parent Hon Hai `HNHPF`).
 * 3. Mapping ADR/OTC stock symbols back to clean canonical company names so
 *    Context.dev news searches (`POST /v1/news/search`) can seamlessly fall
 *    back from OTC ticker lookup to canonical company-name lookup when needed.
 * 4. Ranking Yahoo Finance US equity search quotes so NYSE/NASDAQ primary ADRs
 *    and Sponsored Level I/II/III ADRs (`*Y`) take precedence over illiquid
 *    foreign-ordinary (`*F`) share classes.
 * 5. Formatting ADR / US-traded foreign depositary tickers with an explicit
 *    `(ADR)` suffix (`ASML (ADR)`, `ARM (ADR)`, `SKHY (ADR)`, `TSM (ADR)`) across
 *    all UI surfaces so investors never confuse them with local home-market listings.
 * ============================================================================
 */

import { logFunctionCall } from './logger';

export interface AdrAliasRecord {
  /** US exchange or US OTC ADR ticker symbol (Yahoo Finance format) */
  symbol: string;
  /** Clean institutional display name */
  canonicalName: string;
  /** Primary sector / industry descriptor */
  sector: string;
  /** True when the security is a US ADR or US OTC foreign equity */
  isAdr: boolean;
}

const PRIMARY_US_EXCHANGES = new Set([
  'NMS',
  'NYQ',
  'NGM',
  'NCM',
  'ASE',
  'PCX',
  'BTS',
  'NYS',
  'NAS',
]);

/**
 * Curated directory of prominent global semiconductor, AI hardware, cloud,
 * industrial, consumer, healthcare, and fintech companies with verified US ADR
 * or US OTC tickers, plus common corporate brand aliases.
 */
const ADR_AND_BRAND_ALIASES: Array<{
  aliases: string[];
  record: AdrAliasRecord;
}> = [
  {
    aliases: ['sk hynix', 'skhynix', 'hynix', 'sk hynix inc', 'skhy'],
    record: {
      symbol: 'SKHY',
      canonicalName: 'SK Hynix',
      sector: 'Semiconductors & HBM Memory',
      isAdr: true,
    },
  },
  {
    aliases: [
      'tsmc',
      'taiwan semiconductor',
      'taiwan semiconductor manufacturing',
      'tsm',
    ],
    record: {
      symbol: 'TSM',
      canonicalName: 'TSMC',
      sector: 'Semiconductor Foundry',
      isAdr: true,
    },
  },
  {
    aliases: ['asml', 'asml holding'],
    record: {
      symbol: 'ASML',
      canonicalName: 'ASML Holding',
      sector: 'Semiconductor Lithography',
      isAdr: true,
    },
  },
  {
    aliases: ['arm', 'arm holdings'],
    record: {
      symbol: 'ARM',
      canonicalName: 'Arm Holdings',
      sector: 'Semiconductor IP & Architecture',
      isAdr: true,
    },
  },
  {
    aliases: [
      'samsung electronics',
      'samsung',
      'samsung elec',
      'ssnlf',
    ],
    record: {
      symbol: 'SSNLF',
      canonicalName: 'Samsung Electronics',
      sector: 'Semiconductors & Consumer Tech',
      isAdr: true,
    },
  },
  {
    aliases: [
      'foxconn',
      'hon hai',
      'hon hai precision',
      'hon hai precision industry',
      'hnhpf',
    ],
    record: {
      symbol: 'HNHPF',
      canonicalName: 'Foxconn (Hon Hai)',
      sector: 'AI Server & Electronics Manufacturing',
      isAdr: true,
    },
  },
  {
    aliases: ['tokyo electron', 'tokyo electron ltd', 'telwy', 'toelf'],
    record: {
      symbol: 'TELWY',
      canonicalName: 'Tokyo Electron',
      sector: 'Semiconductor Equipment',
      isAdr: true,
    },
  },
  {
    aliases: ['advantest', 'advantest corp', 'advantest corporation', 'ateyy'],
    record: {
      symbol: 'ATEYY',
      canonicalName: 'Advantest',
      sector: 'Semiconductor Test Equipment',
      isAdr: true,
    },
  },
  {
    aliases: ['infineon', 'infineon technologies', 'ifnny'],
    record: {
      symbol: 'IFNNY',
      canonicalName: 'Infineon Technologies',
      sector: 'Power & Automotive Semiconductors',
      isAdr: true,
    },
  },
  {
    aliases: ['renesas', 'renesas electronics', 'rnecy'],
    record: {
      symbol: 'RNECY',
      canonicalName: 'Renesas Electronics',
      sector: 'Embedded & Automotive Semiconductors',
      isAdr: true,
    },
  },
  {
    aliases: ['murata', 'murata manufacturing', 'mraay'],
    record: {
      symbol: 'MRAAY',
      canonicalName: 'Murata Manufacturing',
      sector: 'Electronic Components',
      isAdr: true,
    },
  },
  {
    aliases: ['lasertec', 'lasertec corp', 'lsrcy'],
    record: {
      symbol: 'LSRCY',
      canonicalName: 'Lasertec',
      sector: 'EUV Mask Inspection Equipment',
      isAdr: true,
    },
  },
  {
    aliases: ['disco corp', 'disco corporation', 'dscsy'],
    record: {
      symbol: 'DSCSY',
      canonicalName: 'DISCO Corporation',
      sector: 'Precision Wafer Dicing & Grinding',
      isAdr: true,
    },
  },
  {
    aliases: ['hoya', 'hoya corp', 'hoya corporation', 'hocpy'],
    record: {
      symbol: 'HOCPY',
      canonicalName: 'HOYA Corporation',
      sector: 'EUV Blanks & Optical Glass',
      isAdr: true,
    },
  },
  {
    aliases: ['shin etsu', 'shin-etsu', 'shin-etsu chemical', 'shecy'],
    record: {
      symbol: 'SHECY',
      canonicalName: 'Shin-Etsu Chemical',
      sector: 'Silicon Wafers & Photoresists',
      isAdr: true,
    },
  },
  {
    aliases: ['sumco', 'sumco corp', 'suopy'],
    record: {
      symbol: 'SUOPY',
      canonicalName: 'SUMCO Corporation',
      sector: 'Silicon Wafers',
      isAdr: true,
    },
  },
  {
    aliases: ['keyence', 'keyence corp', 'kyccf'],
    record: {
      symbol: 'KYCCF',
      canonicalName: 'Keyence',
      sector: 'Factory Automation & Sensors',
      isAdr: true,
    },
  },
  {
    aliases: ['lg display', 'lpl'],
    record: {
      symbol: 'LPL',
      canonicalName: 'LG Display',
      sector: 'OLED & Display Panels',
      isAdr: true,
    },
  },
  {
    aliases: ['ase technology', 'ase group', 'asx'],
    record: {
      symbol: 'ASX',
      canonicalName: 'ASE Technology',
      sector: 'Semiconductor Packaging & OSAT',
      isAdr: true,
    },
  },
  {
    aliases: ['united microelectronics', 'umc'],
    record: {
      symbol: 'UMC',
      canonicalName: 'United Microelectronics (UMC)',
      sector: 'Semiconductor Foundry',
      isAdr: true,
    },
  },
  {
    aliases: ['stmicroelectronics', 'stmicro', 'stm'],
    record: {
      symbol: 'STM',
      canonicalName: 'STMicroelectronics',
      sector: 'Semiconductors',
      isAdr: true,
    },
  },
  {
    aliases: ['nxp', 'nxp semiconductors', 'nxpi'],
    record: {
      symbol: 'NXPI',
      canonicalName: 'NXP Semiconductors',
      sector: 'Automotive & Industrial Chips',
      isAdr: false,
    },
  },
  {
    aliases: ['softbank', 'softbank group', 'sftby'],
    record: {
      symbol: 'SFTBY',
      canonicalName: 'SoftBank Group',
      sector: 'AI & Technology Holdings',
      isAdr: true,
    },
  },
  {
    aliases: ['tencent', 'tencent holdings', 'tcehy'],
    record: {
      symbol: 'TCEHY',
      canonicalName: 'Tencent Holdings',
      sector: 'Internet, Gaming & Cloud AI',
      isAdr: true,
    },
  },
  {
    aliases: ['alibaba', 'alibaba group', 'baba'],
    record: {
      symbol: 'BABA',
      canonicalName: 'Alibaba Group',
      sector: 'Cloud Computing & E-Commerce',
      isAdr: true,
    },
  },
  {
    aliases: ['byd company', 'byd auto', 'byd co', 'byddy'],
    record: {
      symbol: 'BYDDY',
      canonicalName: 'BYD Company',
      sector: 'Electric Vehicles & Batteries',
      isAdr: true,
    },
  },
  {
    aliases: [
      'catl',
      'contemporary amperex',
      'contemporary amperex technology',
      'cyaty',
    ],
    record: {
      symbol: 'CYATY',
      canonicalName: 'CATL',
      sector: 'EV & Grid Battery Systems',
      isAdr: true,
    },
  },
  {
    aliases: ['xiaomi', 'xiaomi corp', 'xiaomi corporation', 'xiacy'],
    record: {
      symbol: 'XIACY',
      canonicalName: 'Xiaomi',
      sector: 'Smartphones, IoT & EVs',
      isAdr: true,
    },
  },
  {
    aliases: ['nintendo', 'nintendo co', 'ntdoy'],
    record: {
      symbol: 'NTDOY',
      canonicalName: 'Nintendo',
      sector: 'Interactive Gaming',
      isAdr: true,
    },
  },
  {
    aliases: ['sony', 'sony group'],
    record: {
      symbol: 'SONY',
      canonicalName: 'Sony Group',
      sector: 'Image Sensors, Gaming & Media',
      isAdr: true,
    },
  },
  {
    aliases: ['sap', 'sap se'],
    record: {
      symbol: 'SAP',
      canonicalName: 'SAP',
      sector: 'Enterprise Cloud ERP',
      isAdr: true,
    },
  },
  {
    aliases: ['siemens', 'siemens ag', 'siegy'],
    record: {
      symbol: 'SIEGY',
      canonicalName: 'Siemens',
      sector: 'Industrial Automation & Grid',
      isAdr: true,
    },
  },
  {
    aliases: ['schneider electric', 'sbgsy'],
    record: {
      symbol: 'SBGSY',
      canonicalName: 'Schneider Electric',
      sector: 'Data Center Power & Grid',
      isAdr: true,
    },
  },
  {
    aliases: ['hitachi', 'hitachi ltd', 'hthiy'],
    record: {
      symbol: 'HTHIY',
      canonicalName: 'Hitachi',
      sector: 'Grid Transformers & Digital Systems',
      isAdr: true,
    },
  },
  {
    aliases: ['novo nordisk', 'nvo'],
    record: {
      symbol: 'NVO',
      canonicalName: 'Novo Nordisk',
      sector: 'Biopharmaceuticals',
      isAdr: true,
    },
  },
  {
    aliases: ['roche', 'roche holding', 'rhhby'],
    record: {
      symbol: 'RHHBY',
      canonicalName: 'Roche Holding',
      sector: 'Pharmaceuticals & Diagnostics',
      isAdr: true,
    },
  },
  {
    aliases: ['lvmh', 'lvmuy'],
    record: {
      symbol: 'LVMUY',
      canonicalName: 'LVMH',
      sector: 'Global Luxury Goods',
      isAdr: true,
    },
  },
  {
    aliases: ['airbus', 'airbus se', 'eadsy'],
    record: {
      symbol: 'EADSY',
      canonicalName: 'Airbus',
      sector: 'Aerospace & Defense',
      isAdr: true,
    },
  },
  {
    aliases: ['bae systems', 'baesy'],
    record: {
      symbol: 'BAESY',
      canonicalName: 'BAE Systems',
      sector: 'Defense & Aerospace',
      isAdr: true,
    },
  },
  {
    aliases: ['rheinmetall', 'rnmby'],
    record: {
      symbol: 'RNMBY',
      canonicalName: 'Rheinmetall',
      sector: 'Defense Systems',
      isAdr: true,
    },
  },
  {
    aliases: ['google', 'alphabet', 'alphabet inc'],
    record: {
      symbol: 'GOOGL',
      canonicalName: 'Alphabet (Google)',
      sector: 'Search, Cloud & Frontier AI',
      isAdr: false,
    },
  },
  {
    aliases: ['aws', 'amazon web services'],
    record: {
      symbol: 'AMZN',
      canonicalName: 'Amazon',
      sector: 'Cloud Infrastructure & E-Commerce',
      isAdr: false,
    },
  },
];

/**
 * Additional NYSE / NASDAQ listed American Depositary Receipts (ADRs) & NY Registry
 * shares of foreign-domiciled issuers that also maintain primary home-country listings.
 */
const KNOWN_ADR_SYMBOLS = new Set<string>([
  'AZN',
  'BNTX',
  'SE',
  'TM',
  'HMC',
  'HSBC',
  'SHEL',
  'BP',
  'RIO',
  'BHP',
  'VALE',
  'PDD',
  'JD',
  'BIDU',
  'NTES',
  'NIO',
  'XPEV',
  'LI',
  'INFY',
  'WIT',
  'HDB',
  'IBN',
  'NOK',
  'ERIC',
  'SNY',
  'GSK',
  'NVS',
  'TTE',
  'UL',
  'DEO',
  'BUD',
  'MUFG',
  'SMFG',
  'TAK',
  'ARGX',
  'GMAB',
  'TEVA',
  'RELX',
  'NGG',
  'VOD',
  'ING',
  'PHG',
  'SAN',
  'BBVA',
  'BCS',
  'ITUB',
  'PBR',
  'ABEV',
  'KB',
  'SHG',
  'PKX',
  'KEP',
  'CHT',
]);

const ALIAS_LOOKUP_MAP = new Map<string, AdrAliasRecord>();
const SYMBOL_TO_ADR_RECORD = new Map<string, AdrAliasRecord>();

for (const entry of ADR_AND_BRAND_ALIASES) {
  SYMBOL_TO_ADR_RECORD.set(entry.record.symbol.toUpperCase(), entry.record);
  for (const rawAlias of entry.aliases) {
    const key = normalizeAliasKey(rawAlias);
    if (key) {
      ALIAS_LOOKUP_MAP.set(key, entry.record);
    }
  }
}

/**
 * Normalizes a company name or ticker alias into a lowercase alphanumeric key
 * stripped of corporate suffixes and punctuation.
 *
 * @param raw - Input company name or symbol
 * @returns Normalized lookup key
 */
function normalizeAliasKey(raw: string): string {
  return raw
    .trim()
    .replace(/^\$/, '')
    .toLowerCase()
    .replace(
      /\b(inc|incorporated|corp|corporation|ltd|limited|plc|llc|lp|co|company|ag|se|nv|sa|adr)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Looks up a known US ADR, US OTC international equity, or brand alias.
 *
 * @param query - Raw company name or ticker string
 * @returns Matching `AdrAliasRecord` or `null`
 */
export function lookupAdrOrBrandAlias(query: string): AdrAliasRecord | null {
  const key = normalizeAliasKey(query);
  if (!key) return null;
  const hit = ALIAS_LOOKUP_MAP.get(key) ?? null;
  if (hit) {
    logFunctionCall('lookupAdrOrBrandAlias:hit', {
      query,
      resolvedSymbol: hit.symbol,
      canonicalName: hit.canonicalName,
    });
  }
  return hit;
}

/**
 * Strips any trailing `(ADR)` display suffix from a user-entered or formatted
 * ticker/query string so underlying API lookups always receive clean symbols.
 *
 * @param raw - Raw ticker or search string (e.g. `"ASML (ADR)"` or `"SKHY"`)
 * @returns Clean string without trailing `(ADR)`
 */
export function stripAdrSuffix(raw: string): string {
  return raw.replace(/\s*\(\s*ADR\s*\)\s*$/i, '').trim();
}

/**
 * Determines whether a US-traded stock symbol represents an American Depositary
 * Receipt (ADR) or US OTC foreign equity of an international company so UI
 * surfaces can append `(ADR)` after the ticker.
 *
 * @param symbol - US/ADR stock symbol (e.g. `"ASML"`, `"ARM"`, `"SKHY"`, `"NVDA"`)
 * @param companyNameHint - Optional company name or security title hint
 * @param explicitIsAdr - Optional pre-computed boolean flag from server payload
 * @returns `true` if the ticker is an ADR / US-traded foreign equity
 */
export function isAdrTicker(
  symbol?: string | null,
  companyNameHint?: string | null,
  explicitIsAdr?: boolean
): boolean {
  if (explicitIsAdr === true) {
    return true;
  }
  if (!symbol) {
    return false;
  }

  const upper = stripAdrSuffix(symbol)
    .replace(/^\$/, '')
    .trim()
    .toUpperCase();
  if (!upper) {
    return false;
  }

  const curated = SYMBOL_TO_ADR_RECORD.get(upper);
  if (curated) {
    return curated.isAdr;
  }

  if (KNOWN_ADR_SYMBOLS.has(upper)) {
    return true;
  }

  // Standard 5-letter FINRA US ADR (`*Y`) or US OTC foreign ordinary (`*F`) symbol
  if (/^[A-Z]{4}[YF]$/.test(upper)) {
    return true;
  }

  if (
    companyNameHint &&
    /\b(ADR|ADS|American Depositary|NY Registry)\b/i.test(companyNameHint)
  ) {
    return true;
  }

  return false;
}

/**
 * Formats a stock ticker for UI display, appending ` (ADR)` immediately after
 * ADR / US-traded foreign equity symbols (e.g. `ASML (ADR)`, `ARM (ADR)`,
 * `SKHY (ADR)`) while keeping domestic US stocks (`NVDA`, `MSFT`) unchanged.
 *
 * @param symbol - Raw stock ticker symbol
 * @param companyNameHint - Optional company name or security title hint
 * @param explicitIsAdr - Optional pre-computed ADR boolean flag
 * @returns Display-formatted ticker string
 */
export function formatTickerWithAdr(
  symbol?: string | null,
  companyNameHint?: string | null,
  explicitIsAdr?: boolean
): string {
  if (!symbol) {
    return '';
  }
  const cleaned = stripAdrSuffix(symbol).trim();
  if (!cleaned) {
    return '';
  }
  return isAdrTicker(cleaned, companyNameHint, explicitIsAdr)
    ? `${cleaned} (ADR)`
    : cleaned;
}

/**
 * Resolves an ADR or US OTC symbol back to a clean operating company name so
 * news endpoints that index international issuers by name rather than OTC ticker
 * still return full institutional article coverage.
 *
 * @param symbol - Stock symbol (e.g. `SKHY`, `SSNLF`, `HNHPF`, `TELWY`)
 * @returns Canonical company name or `null` if not in the ADR directory
 */
export function lookupCompanyNameForAdrTicker(symbol: string): string | null {
  const upper = stripAdrSuffix(symbol).toUpperCase();
  const record = SYMBOL_TO_ADR_RECORD.get(upper);
  if (!record || !record.isAdr) {
    return null;
  }
  return record.canonicalName;
}

/**
 * Ranks Yahoo Finance US equity & ADR quote candidates so primary exchange
 * listings (`NASDAQ`, `NYSE`) appear first, Sponsored ADRs (`*Y` on `OQX`/`PNK`
 * or quotes explicitly labeled `ADR`) appear second, and foreign ordinary
 * OTC shares (`*F`) appear last.
 *
 * @param quotes - Filtered US/ADR equity quotes from Yahoo `v1/finance/search`
 * @returns Sorted copy of `quotes`
 */
export function rankUsAndAdrEquityQuotes<T extends Record<string, unknown>>(
  quotes: T[]
): T[] {
  const scoreQuote = (q: T): number => {
    const exch = String(q.exchange ?? '').toUpperCase();
    const sym = String(q.symbol ?? '').toUpperCase();
    const name = `${String(q.shortname ?? '')} ${String(q.longname ?? '')}`;

    if (PRIMARY_US_EXCHANGES.has(exch)) {
      return 100;
    }
    if (exch === 'OQX' || exch === 'OBB') {
      return sym.length === 5 && sym.endsWith('Y') ? 85 : 75;
    }
    if (sym.length === 5 && sym.endsWith('Y')) {
      return 70;
    }
    if (/\bADR\b/i.test(name)) {
      return 68;
    }
    if (sym.length === 5 && sym.endsWith('F')) {
      return 45;
    }
    return 55;
  };

  return [...quotes].sort((a, b) => scoreQuote(b) - scoreQuote(a));
}
