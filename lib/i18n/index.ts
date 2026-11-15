/**
 * ============================================================================
 * FILE: lib/i18n/index.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Public barrel module exporting Contextual Investing's bilingual ('en' | 'ko')
 * types, dictionaries, formatters, and pitch deck slide localizers.
 *
 * USE CASES:
 * 1. Single clean import path (`@/lib/i18n`) for UI components and server routes.
 * 2. Resolving a `UiTranslations` dictionary synchronously via `getTranslations`.
 * ============================================================================
 */

import { EN_TRANSLATIONS } from './en';
import { KO_TRANSLATIONS } from './ko';
import type { AppLocale, UiTranslations } from './types';

export * from './types';
export * from './en';
export * from './ko';
export * from './formatters';
export * from './pitch-slides-ko';

/**
 * Returns the complete `UiTranslations` dictionary for the requested `locale`.
 */
export function getTranslations(locale: AppLocale): UiTranslations {
  return locale === 'ko' ? KO_TRANSLATIONS : EN_TRANSLATIONS;
}
