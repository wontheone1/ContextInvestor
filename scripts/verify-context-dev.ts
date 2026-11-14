/**
 * ============================================================================
 * FILE: scripts/verify-context-dev.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Local Verification & Unit Test Suite for the Context.dev SDK Integration.
 *
 * USE CASES:
 * 1. Verifying that `validateContextDevApiKey` enforces `CONTEXT_DEV_API_KEY`
 *    presence and rejects empty or placeholder keys.
 * 2. Verifying that `buildCompanyNewsSearchParams` constructs valid
 *    `POST /v1/news/search` payloads for both Company Name (`type: 'name'`) and
 *    Stock Ticker (`type: 'ticker'`), including selectable date ranges (`from`/`to`),
 *    category filters, sorting (`newest` vs `relevance`), `limit`, and `cursor`.
 * 3. Proving that `searchCompanyNews` invokes the official `context.dev` SDK's
 *    `client.news.search` method against `https://api.context.dev/v1/news/search`
 *    with `Authorization: Bearer <CONTEXT_DEV_API_KEY>` using a mocked fetch
 *    transport so the live API is NEVER hit during automated tests.
 * ============================================================================
 */

import assert from 'node:assert/strict';
import {
  validateContextDevApiKey,
  buildCompanyNewsSearchParams,
  searchCompanyNews,
} from '../lib/context-dev.ts';

/**
 * Runs all deterministic verification checks for the Context.dev SDK integration.
 */
async function runVerificationSuite(): Promise<void> {
  console.info('============================================================');
  console.info('Running Context.dev SDK Integration Verification Suite...');
  console.info('============================================================');

  // 1. Test API key validation
  console.info('\n[Test 1] Validating CONTEXT_DEV_API_KEY guard...');
  assert.throws(
    () => validateContextDevApiKey(''),
    /Missing CONTEXT_DEV_API_KEY/,
    'Should throw when API key is empty'
  );
  assert.throws(
    () => validateContextDevApiKey('MY_CONTEXT_DEV_API_KEY'),
    /Missing CONTEXT_DEV_API_KEY/,
    'Should throw when API key is placeholder'
  );
  const validKey = validateContextDevApiKey('ctx_test_secret_key_12345');
  assert.equal(validKey, 'ctx_test_secret_key_12345');
  console.info('✓ Test 1 Passed: API key validation enforces non-empty key.');

  // 2. Test entity search by Company Name + Date Range + Sort + Cursor
  console.info(
    '\n[Test 2] Building POST /v1/news/search payload by Company Name...'
  );
  const nameParams = buildCompanyNewsSearchParams({
    entityType: 'name',
    entityValue: 'Stripe',
    dateFrom: 1700000000000,
    dateTo: 1790000000000,
    filterCategory: 'articleType',
    articleTypes: ['press_release', 'editorial'],
    sortBy: 'newest',
    limit: 10,
    cursor: 'cursor_page_2',
  });

  assert.deepEqual(nameParams, {
    searchBy: {
      type: 'entity',
      entity: {
        type: 'name',
        name: 'Stripe',
      },
    },
    filterBy: {
      date: {
        from: 1700000000000,
        to: 1790000000000,
      },
      articleType: ['press_release', 'editorial'],
    },
    sortBy: {
      type: 'newest',
    },
    limit: 10,
    cursor: 'cursor_page_2',
  });
  console.info(
    '✓ Test 2 Passed: Company Name searchBy, filterBy, sortBy, limit, and cursor match spec.'
  );

  // 3. Test entity search by Stock Ticker + Relevance Sort
  console.info(
    '\n[Test 3] Building POST /v1/news/search payload by Stock Ticker...'
  );
  const tickerParams = buildCompanyNewsSearchParams({
    entityType: 'ticker',
    entityValue: 'nvda',
    exchange: 'NASDAQ',
    sortBy: 'relevance',
    limit: 5,
  });

  assert.deepEqual(tickerParams, {
    searchBy: {
      type: 'entity',
      entity: {
        type: 'ticker',
        ticker: 'NVDA',
        exchange: 'NASDAQ',
      },
    },
    sortBy: {
      type: 'relevance',
    },
    limit: 5,
  });
  console.info(
    '✓ Test 3 Passed: Stock Ticker searchBy with exchange and relevance sort matches spec.'
  );

  // 4. Test Official Context.dev SDK `client.news.search` invocation via Mock Fetch (zero live API hits)
  console.info(
    '\n[Test 4] Verifying Official Context.dev SDK client.news.search HTTP transport (mocked)...'
  );
  let capturedUrl = '';
  let capturedMethod = '';
  let capturedAuthHeader = '';
  let capturedBody: unknown = null;

  const mockFetch: typeof globalThis.fetch = async (input, init) => {
    capturedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    capturedMethod = init?.method ?? 'GET';

    const headers = new Headers(init?.headers);
    capturedAuthHeader = headers.get('authorization') ?? '';
    capturedBody = init?.body ? JSON.parse(String(init.body)) : null;

    const mockApiResponse = {
      data: [
        {
          id: 'art_stripe_01',
          authors: ['Jane Doe'],
          description: 'Stripe expands global stablecoin and AI agent billing.',
          image_url: null,
          language: 'en',
          match: { confidence: 0.99, level: 'primary' },
          published_at: '2026-11-14T00:00:00Z',
          source: {
            direct: true,
            domain: 'reuters.com',
            name: 'Reuters',
          },
          story_id: 'story_stripe_01',
          title: 'Stripe Launches New Enterprise Billing Suite',
          type: 'editorial',
          url: 'https://www.reuters.com/stripe-enterprise-billing',
        },
      ],
      has_more: true,
      meta: { count: 1 },
      next_cursor: 'cursor_next_abc123',
      request_id: 'req_mock_98765',
      key_metadata: {
        credits_consumed: 1,
        credits_remaining: 499,
      },
    };

    return new Response(JSON.stringify(mockApiResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'req_mock_98765',
      },
    });
  };

  const { response } = await searchCompanyNews(
    {
      entityType: 'ticker',
      entityValue: 'NVDA',
      exchange: 'NASDAQ',
      sortBy: 'newest',
      limit: 10,
    },
    {
      apiKey: 'ctx_unit_test_token_xyz',
      fetch: mockFetch,
    }
  );

  assert.equal(capturedUrl, 'https://api.context.dev/v1/news/search');
  assert.equal(capturedMethod.toUpperCase(), 'POST');
  assert.equal(capturedAuthHeader, 'Bearer ctx_unit_test_token_xyz');
  assert.deepEqual(capturedBody, {
    searchBy: {
      type: 'entity',
      entity: {
        type: 'ticker',
        ticker: 'NVDA',
        exchange: 'NASDAQ',
      },
    },
    sortBy: {
      type: 'newest',
    },
    limit: 10,
  });
  assert.equal(response.data.length, 1);
  assert.equal(response.next_cursor, 'cursor_next_abc123');
  assert.equal(response.has_more, true);

  console.info(
    '✓ Test 4 Passed: Official Context.dev SDK sent POST https://api.context.dev/v1/news/search with Bearer token and parsed NewsSearchResponse.'
  );
  console.info('\n============================================================');
  console.info('ALL CONTEXT.DEV SDK VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.info('============================================================');
}

runVerificationSuite().catch((err) => {
  console.error('Verification suite failed:', err);
  process.exit(1);
});
