# Soundmark Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: No unmodeled collection or path may ever be read or written (`match /{document=**} { allow read, write: if false; }`).
2. **PII Isolation**: User emails live exclusively under `/users/{userId}/private/info` and are strictly restricted to the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`). Public profiles at `/users/{userId}` never store PII.
3. **Owner Identity & Verified Email**: Every create/update/delete enforces `request.auth != null && request.auth.token.email_verified == true`, `incoming().ownerUid == request.auth.uid`, and immutability of `ownerUid` and `createdAt` on update.
4. **Master Gate**: Subcollections `/users/{userId}/private/*`, `/users/{userId}/library/*`, and `/users/{userId}/playlists/{playlistId}` verify the parent `/users/{userId}` document exists (`exists(...)`) and check path `userId == request.auth.uid`.
5. **Bounded Arrays & Strict String Sizes**: All strings check `.size()`, IDs match `^[a-zA-Z0-9_\\-]+$`, `likedIds.size() <= 200`, `pinnedMatchIds.size() <= 50`, `trackIds.size() <= 200`.
6. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
7. **Immutable Leaderboard Entries**: `/stageScores/{scoreId}` allows authenticated create with bounded score/combo/accuracy values and disallows client updates (`allow update: if false;`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. Unauthenticated read on `/users/u1/private/info` -> `PERMISSION_DENIED`
2. Non-owner read (`uid: u2`) on `/users/u1/private/info` -> `PERMISSION_DENIED`
3. Unverified email (`email_verified: false`) create on `/users/u1` -> `PERMISSION_DENIED`
4. Shadow field injection (`isAdmin: true`) on `/users/u1` create -> `PERMISSION_DENIED`
5. Identity spoofing (`ownerUid: "u2"` when auth is `"u1"`) on `/users/u1/library/state` -> `PERMISSION_DENIED`
6. Path ID poisoning (`playlistId` with 2KB junk or invalid characters) -> `PERMISSION_DENIED`
7. Client-forged `createdAt` timestamp (`createdAt != request.time`) -> `PERMISSION_DENIED`
8. Mutating immutable `createdAt` or `ownerUid` on `/users/u1/playlists/pl1` update -> `PERMISSION_DENIED`
9. Oversized array (`likedIds` with > 200 entries) on `/users/u1/library/state` -> `PERMISSION_DENIED`
10. Blanket `list` query scraping `/users/u1/playlists` by user `"u2"` -> `PERMISSION_DENIED`
11. Score tampering (`update` on `/stageScores/s1`) -> `PERMISSION_DENIED`
12. Orphaned subcollection write (`/users/missing/playlists/pl1` when parent `/users/missing` does not exist) -> `PERMISSION_DENIED`
