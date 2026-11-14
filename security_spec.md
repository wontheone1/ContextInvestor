# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Global Catch-All Deny**: Every path not explicitly matched under `/cached_searches/{cacheId}`, `/saved_articles/{savedId}`, or `/followed_companies/{followId}` is strictly denied (`allow read, write: if false;`).
2. **Path Variable Hardening (`isValidId`)**: All single-document operations (`get`, `create`, `update`, `delete`) must validate document IDs (`cacheId`, `savedId`, `followId`) against `^[a-zA-Z0-9_\-]+$` with maximum length `128`.
3. **Cached Search Integrity (`/cached_searches/{cacheId}`)**:
   - Document `cacheKey` must strictly equal `cacheId`.
   - Strict schema allowlist (`hasAll` and `hasOnly`) with explicit string `.size()` boundaries (`entityValue <= 120`, `cursorKey <= 256`, `articlesJson <= 500000`, `nextCursor <= 512`, `requestId <= 128`).
   - `updatedAt` must equal `request.time` (server timestamp).
4. **Saved Article Ownership & Isolation (`/saved_articles/{savedId}`)**:
   - Requires verified authenticated user (`request.auth != null && request.auth.token.email_verified == true`).
   - `userId` must strictly equal `request.auth.uid` on `create` and remain immutable on `update`.
   - `get`, `list`, `update`, and `delete` are strictly restricted to documents where `resource.data.userId == request.auth.uid`.
   - `createdAt` must equal `request.time` on `create` and remain immutable on `update`.
5. **Followed Company Watchlist Ownership & Isolation (`/followed_companies/{followId}`)**:
   - Requires verified authenticated user (`request.auth != null && request.auth.token.email_verified == true`).
   - Strict schema allowlist (`companyKey`, `userId`, `label`, `entityType`, `value`, `sector`, `createdAt`) with explicit `.size()` and regex bounds.
   - `userId` must strictly equal `request.auth.uid` on `create` and remain immutable on `update`.
   - `get`, `list`, `update`, and `delete` are strictly restricted to documents where `resource.data.userId == request.auth.uid`.
   - `createdAt` must equal `request.time` on `create` and remain immutable on `update`.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on `cached_searches`**: Adding `isAdmin: true` to a `cached_searches` write -> Rejected by `hasOnly()`.
2. **Oversized String DoW on `cached_searches`**: Sending `entityValue` with 10,000 characters -> Rejected by `.size() <= 120`.
3. **ID Poisoning on `cached_searches`**: Creating a document with path ID containing spaces or special characters -> Rejected by `isValidId(cacheId)`.
4. **Key Mismatch on `cached_searches`**: Setting `data.cacheKey` different from path `cacheId` -> Rejected by `data.cacheKey == cacheId`.
5. **Forged Client Timestamp on `cached_searches`**: Supplying a past or future `updatedAt` timestamp instead of `request.time` -> Rejected by `data.updatedAt == request.time`.
6. **Unauthenticated Write on `saved_articles`**: Attempting to bookmark an article with `request.auth == null` -> Rejected by `isSignedIn()`.
7. **Unverified Email Spoof on `followed_companies`**: Authenticated user with `email_verified: false` attempting to follow a company -> Rejected by `isVerifiedUser()`.
8. **Identity Spoofing on `followed_companies`**: Authenticated user setting `userId: "other_user_uid"` -> Rejected by `data.userId == request.auth.uid`.
9. **Cross-Tenant Read/List on `followed_companies`**: Authenticated user listing `followed_companies` without filtering by `userId == request.auth.uid` -> Rejected by `resource.data.userId == request.auth.uid`.
10. **Owner Hijack on `followed_companies` Update**: Attempting to mutate `userId`, `companyKey`, or `createdAt` during an update -> Rejected by immutability gates and `affectedKeys().hasOnly(['label', 'sector'])`.
11. **Value Poisoning on `followed_companies` Update**: Updating `label` to a number or a 5,000-character string -> Rejected by `isValidFollowedCompany(incoming())`.
12. **Unauthorized Delete on `followed_companies`**: Authenticated user attempting to delete another user's followed company -> Rejected by `existing().userId == request.auth.uid`.
