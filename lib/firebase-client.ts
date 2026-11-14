/**
 * ============================================================================
 * FILE: lib/firebase-client.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Client & Isomorphic Firebase Firestore Initialization, Connection Validation,
 * Error Handling (`handleFirestoreError`), and Article Caching Operations.
 *
 * USE CASES:
 * 1. Initializing Firebase App, Auth, and Firestore (`ai-studio-...` database ID)
 *    from `firebase-applet-config.json`.
 * 2. Validating the Firestore connection on startup using `getDocFromServer`.
 * 3. Implementing the mandatory `handleFirestoreError` diagnostic formatter for
 *    all Firestore operations (`get`, `list`, `create`, `update`, `delete`, `write`).
 * 4. Reading and writing cached Context.dev company news search pages in the
 *    `cached_searches` collection and user-bookmarked articles in `saved_articles`.
 * ============================================================================
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { APP_CONFIG } from './config';
import { logFunctionCall } from './logger';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Formats and throws a structured JSON error when any Firestore operation fails,
 * ensuring security rule diagnostics have complete authentication and path context.
 *
 * @param error - The caught error object
 * @param operationType - The Firestore OperationType performed
 * @param path - The collection or document path targeted
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  logFunctionCall('handleFirestoreError', {
    operationType,
    path,
    errorMessage: error instanceof Error ? error.message : String(error),
  });

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

/**
 * Validates the connection to the provisioned Firestore database on boot
 * using `getDocFromServer`.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  connectionTested = true;
  logFunctionCall('testFirestoreConnection', {
    databaseId: firebaseConfig.firestoreDatabaseId,
  });

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on /test/connection is expected with default-deny rules
    // and confirms the server was reached.
    return true;
  }
}

/**
 * Generates a deterministic, URL-safe cache key ID matching `^[a-zA-Z0-9_\-]+$`
 * and `<= 128` characters for a given company news search query.
 *
 * @param params - Search parameters defining the page
 * @returns Sanitized document ID string for `cached_searches/{cacheId}`
 */
export function buildSearchCacheId(params: {
  entityType: string;
  entityValue: string;
  exchange?: string;
  sortBy: string;
  dateFrom?: number;
  dateTo?: number;
  filterCategory?: string;
  filterValue?: string;
  limit: number;
  cursor?: string | null;
}): string {
  logFunctionCall('buildSearchCacheId', { ...params });

  const raw = [
    'v5sentr',
    params.entityType,
    params.entityValue.trim().toLowerCase(),
    params.exchange || 'any',
    params.sortBy,
    params.dateFrom || 0,
    params.dateTo || 0,
    params.filterCategory || 'none',
    params.filterValue || 'all',
    params.limit,
    params.cursor || 'page1',
  ].join('_');

  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return sanitized || 'default_cache_key';
}

export interface CachedSearchRecord {
  cacheKey: string;
  entityType: 'name' | 'ticker' | 'domain' | 'isin';
  entityValue: string;
  sortBy: 'newest' | 'relevance';
  cursorKey: string;
  articlesJson: string;
  nextCursor: string;
  hasMore: boolean;
  articleCount: number;
  requestId: string;
  cachedAtMs: number;
  updatedAt?: unknown;
}

/**
 * Reads a cached Context.dev news search page from Firestore (`cached_searches/{cacheKey}`).
 * Returns null if no cache entry exists or if the cache is older than `cacheTtlMs`
 * (unless `allowStale` is true).
 *
 * @param cacheKey - Deterministic document ID
 * @param allowStale - Whether to return expired cache entries when offline/fallback
 */
export async function getCachedNewsSearch(
  cacheKey: string,
  allowStale = false
): Promise<CachedSearchRecord | null> {
  logFunctionCall('getCachedNewsSearch', { cacheKey, allowStale });
  const path = `${APP_CONFIG.firestore.collections.cachedSearches}/${cacheKey}`;

  try {
    const snap = await getDoc(
      doc(db, APP_CONFIG.firestore.collections.cachedSearches, cacheKey)
    );
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as CachedSearchRecord;
    const ageMs = Date.now() - (data.cachedAtMs || 0);
    if (!allowStale && ageMs > APP_CONFIG.firestore.cacheTtlMs) {
      return null;
    }
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Writes or updates a Context.dev news search response in Firestore (`cached_searches/{cacheKey}`).
 * Enforces blueprint volumetric constraints before writing.
 *
 * @param record - CachedSearchRecord payload
 */
export async function saveCachedNewsSearch(
  record: Omit<CachedSearchRecord, 'updatedAt'>
): Promise<void> {
  logFunctionCall('saveCachedNewsSearch', {
    cacheKey: record.cacheKey,
    entityType: record.entityType,
    entityValue: record.entityValue,
    articleCount: record.articleCount,
  });

  const safeCacheKey = record.cacheKey
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  const path = `${APP_CONFIG.firestore.collections.cachedSearches}/${safeCacheKey}`;

  const payload = {
    cacheKey: safeCacheKey,
    entityType: record.entityType,
    entityValue: record.entityValue.slice(0, 120),
    sortBy: record.sortBy,
    cursorKey: (record.cursorKey || 'page1').slice(0, 256),
    articlesJson: record.articlesJson.slice(0, 450000),
    nextCursor: (record.nextCursor || '').slice(0, 512),
    hasMore: Boolean(record.hasMore),
    articleCount: Math.max(0, Math.min(100, Number(record.articleCount) || 0)),
    requestId: (record.requestId || 'cached').slice(0, 128),
    cachedAtMs: Number(record.cachedAtMs) || Date.now(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(
      doc(db, APP_CONFIG.firestore.collections.cachedSearches, safeCacheKey),
      payload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface SavedArticleRecord {
  articleId: string;
  userId: string;
  title: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  publishedAt: string;
  articleType: string;
  companyTag: string;
  description: string;
  createdAt?: Timestamp;
}

/**
 * Signs in the user with Google Popup authentication so they can bookmark
 * articles to their personal Firestore watchlist.
 */
export async function signInWithGoogle() {
  logFunctionCall('signInWithGoogle', {});
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutUser() {
  logFunctionCall('signOutUser', {});
  return firebaseSignOut(auth);
}

/**
 * Saves an article to the authenticated user's `saved_articles` collection in Firestore.
 *
 * @param article - Article metadata to bookmark
 */
export async function saveArticleForUser(
  article: Omit<SavedArticleRecord, 'createdAt'>
): Promise<string> {
  logFunctionCall('saveArticleForUser', {
    articleId: article.articleId,
    companyTag: article.companyTag,
  });

  if (!auth.currentUser) {
    throw new Error('User must be signed in to bookmark articles.');
  }

  const docId = `${auth.currentUser.uid}_${article.articleId}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  const path = `${APP_CONFIG.firestore.collections.savedArticles}/${docId}`;

  const payload = {
    articleId: article.articleId.slice(0, 128),
    userId: auth.currentUser.uid,
    title: article.title.slice(0, 500),
    url: article.url.slice(0, 2000),
    sourceName: (article.sourceName || 'Unknown Source').slice(0, 200),
    sourceDomain: (article.sourceDomain || 'unknown').slice(0, 200),
    publishedAt: (article.publishedAt || new Date().toISOString()).slice(0, 64),
    articleType: (article.articleType || 'editorial').slice(0, 64),
    companyTag: (article.companyTag || 'General').slice(0, 120),
    description: (article.description || '').slice(0, 2000),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(
      doc(db, APP_CONFIG.firestore.collections.savedArticles, docId),
      payload
    );
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Removes a bookmarked article from the authenticated user's `saved_articles` collection.
 *
 * @param docId - Document ID in `saved_articles`
 */
export async function removeSavedArticle(docId: string): Promise<void> {
  logFunctionCall('removeSavedArticle', { docId });
  const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `${APP_CONFIG.firestore.collections.savedArticles}/${safeId}`;

  try {
    await deleteDoc(
      doc(db, APP_CONFIG.firestore.collections.savedArticles, safeId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Lists all bookmarked articles belonging to the currently signed-in user.
 *
 * @param uid - Authenticated user's UID
 */
export async function listUserSavedArticles(
  uid: string
): Promise<Array<SavedArticleRecord & { docId: string }>> {
  logFunctionCall('listUserSavedArticles', { uid });
  const path = APP_CONFIG.firestore.collections.savedArticles;

  try {
    const q = query(
      collection(db, APP_CONFIG.firestore.collections.savedArticles),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      firestoreLimit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as SavedArticleRecord),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface FollowedCompanyRecord {
  companyKey: string;
  userId: string;
  label: string;
  entityType: 'name' | 'ticker';
  value: string;
  sector: string;
  createdAt?: Timestamp;
}

/**
 * Generates a deterministic, URL-safe company follow key matching `^[a-zA-Z0-9_\-]+$`
 * and `<= 64` characters.
 */
export function buildCompanyFollowKey(
  entityType: 'name' | 'ticker',
  value: string
): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${entityType}_${sanitized || 'company'}`;
}

/**
 * Adds a company to the authenticated user's `followed_companies` collection in Firestore.
 */
export async function followCompanyForUser(company: {
  label: string;
  entityType: 'name' | 'ticker';
  value: string;
  sector?: string;
}): Promise<string> {
  logFunctionCall('followCompanyForUser', { ...company });

  if (!auth.currentUser) {
    throw new Error('User must be signed in to sync followed companies.');
  }

  const companyKey = buildCompanyFollowKey(company.entityType, company.value);
  const docId = `${auth.currentUser.uid}_${companyKey}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  const path = `${APP_CONFIG.firestore.collections.followedCompanies}/${docId}`;

  const payload = {
    companyKey,
    userId: auth.currentUser.uid,
    label: (company.label.trim() || company.value.trim()).slice(0, 120),
    entityType: company.entityType,
    value: company.value.trim().slice(0, 120),
    sector: (company.sector?.trim() || 'Tracked Company').slice(0, 120),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(
      doc(db, APP_CONFIG.firestore.collections.followedCompanies, docId),
      payload
    );
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Removes a company from the authenticated user's `followed_companies` collection in Firestore.
 */
export async function unfollowCompanyForUser(
  entityType: 'name' | 'ticker',
  value: string
): Promise<void> {
  logFunctionCall('unfollowCompanyForUser', { entityType, value });

  if (!auth.currentUser) {
    throw new Error('User must be signed in to unfollow companies in Firestore.');
  }

  const companyKey = buildCompanyFollowKey(entityType, value);
  const docId = `${auth.currentUser.uid}_${companyKey}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  const path = `${APP_CONFIG.firestore.collections.followedCompanies}/${docId}`;

  try {
    await deleteDoc(
      doc(db, APP_CONFIG.firestore.collections.followedCompanies, docId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Lists all companies followed by the currently signed-in user in Firestore.
 */
export async function listUserFollowedCompanies(
  uid: string
): Promise<Array<FollowedCompanyRecord & { docId: string }>> {
  logFunctionCall('listUserFollowedCompanies', { uid });
  const path = APP_CONFIG.firestore.collections.followedCompanies;

  try {
    const q = query(
      collection(db, APP_CONFIG.firestore.collections.followedCompanies),
      where('userId', '==', uid),
      orderBy('createdAt', 'asc'),
      firestoreLimit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      docId: d.id,
      ...(d.data() as FollowedCompanyRecord),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
