/**
 * ============================================================================
 * FILE: components/LanguageProvider.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Client-side React Context provider managing the active UI language (`en` | `ko`)
 * across Contextual Investing, with automatic `localStorage` persistence and
 * `<html lang="...">` synchronization.
 *
 * USE CASES:
 * 1. Providing instant, zero-reload switching between English ('en') and Korean ('ko')
 *    across all 5 views, drawers, headers, and charts via `useLanguage()`.
 * 2. Persisting the user's preferred language in `localStorage` under
 *    `APP_CONFIG.i18n.storageKey` and syncing `document.documentElement.lang`.
 * ============================================================================
 */

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { APP_CONFIG } from '@/lib/config';
import { logFunctionCall } from '@/lib/logger';
import { EN_TRANSLATIONS } from '@/lib/i18n/en';
import { KO_TRANSLATIONS } from '@/lib/i18n/ko';
import type { AppLocale, UiTranslations } from '@/lib/i18n/types';

export interface LanguageContextValue {
  locale: AppLocale;
  setLocale: (nextLocale: AppLocale) => void;
  toggleLocale: () => void;
  t: UiTranslations;
}

const LOCALE_CHANGE_EVENT = 'contextual-investing-locale-change';

const LanguageContext = createContext<LanguageContextValue>({
  locale: APP_CONFIG.i18n.defaultLocale,
  setLocale: () => undefined,
  toggleLocale: () => undefined,
  t: EN_TRANSLATIONS,
});

/**
 * Subscribes to same-tab custom locale events and cross-tab `storage` updates.
 */
function subscribeToLocaleStore(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  };
}

/**
 * Reads the persisted UI locale from `localStorage` on the client.
 */
function getClientLocaleSnapshot(): AppLocale {
  try {
    const saved = window.localStorage.getItem(APP_CONFIG.i18n.storageKey);
    if (saved === 'en' || saved === 'ko') {
      return saved;
    }
  } catch {
    // Ignore storage read restrictions in sandboxed contexts
  }
  return APP_CONFIG.i18n.defaultLocale;
}

/**
 * Returns the deterministic default locale during SSR / pre-hydration.
 */
function getServerLocaleSnapshot(): AppLocale {
  return APP_CONFIG.i18n.defaultLocale;
}

/**
 * Provides `locale`, `setLocale`, `toggleLocale`, and the active `t` dictionary
 * to the entire Contextual Investing component tree.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocaleStore,
    getClientLocaleSnapshot,
    getServerLocaleSnapshot
  );

  // Synchronize `<html lang="...">` with the active locale
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  /**
   * Updates the active UI locale, persists it to localStorage, and notifies subscribers.
   */
  const setLocale = useCallback((nextLocale: AppLocale) => {
    logFunctionCall('LanguageProvider.setLocale', { nextLocale });
    try {
      window.localStorage.setItem(APP_CONFIG.i18n.storageKey, nextLocale);
      document.documentElement.lang = nextLocale;
      window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  /**
   * Toggles between English ('en') and Korean ('ko').
   */
  const toggleLocale = useCallback(() => {
    const current = getClientLocaleSnapshot();
    const next: AppLocale = current === 'en' ? 'ko' : 'en';
    logFunctionCall('LanguageProvider.toggleLocale', {
      from: current,
      to: next,
    });
    try {
      window.localStorage.setItem(APP_CONFIG.i18n.storageKey, next);
      document.documentElement.lang = next;
      window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const t = useMemo<UiTranslations>(() => {
    return locale === 'ko' ? KO_TRANSLATIONS : EN_TRANSLATIONS;
  }, [locale]);

  const contextValue = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook returning `{ locale, setLocale, toggleLocale, t }` from `LanguageProvider`.
 */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
