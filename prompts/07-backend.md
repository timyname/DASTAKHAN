# Master Prompt 07 — Backend, Cloud Progress and Verified Results

You are the backend developer. Add this second-stage service only after a working local DASTAKHAN MVP. Preserve offline/local play. Reuse game-core; never implement a separate server match algorithm. The service supports cross-device progress and verified runs, not animation frames.

Suggested stack: Node.js/TypeScript, PostgreSQL and a simple HTTP API. Choose one minimal maintained server framework after checking compatibility. Do not introduce Redis, queues or microservices without a measured need.

Guests can play immediately. Use one secure identity provider supported by the environment for cloud saves. Do not invent credentials or build custom password storage for MVP. Without configured authentication, preserve an honest local mode, not fake successful login.

Entities:
- players: identity derived from a verified session.
- level_versions: immutable JSON, hash and rules version.
- game_runs: playerId, runId, levelVersion, rulesVersion, serverSeed, issuedAt, expiresAt, status.
- run_results: canonical replay outcome, score, stars, goals, remainingMoves, movesHash.
- player_progress: bestStars/bestScore by level, unlockedLevel, revision.
- Optional minimal gameplay analytics without unnecessary personal data.

Endpoints:
- GET /api/levels: published definitions and versions.
- POST /api/runs: issue a run for an unlocked level, with server seed and versions.
- POST /api/runs/:id/finish: accept a move log, run binding and idempotency key; distrust clientScore/clientWon.
- GET /api/progress: current user's progress.
- POST /api/progress/import: validate local move logs, marking offline imports unverified for leaderboards.
- GET /api/leaderboard?levelId=...: only if enabled, using verified server-issued runs.

On finish, verify run ownership, expiry/version, request size and move count; replay canonically from serverSeed; reject moves after termination; calculate results using shared core. Save result/progress in one DB transaction. Retrying identical finish returns the same result; conflicting payload for an already finished run returns conflict. Unique DB constraints protect races.

Never replace the server-issued seed/rulesVersion with client claims. Retain replay support for supported older rules; return an explicit error for unsupported versions instead of silently changing the rules.

Leaderboards have no monetary prizes. Replay confirms legal moves but does not distinguish humans from bots or prevent seed analysis. Do not describe it as complete anti-cheat.

Merge cloud stars/best scores by max from verified records; compute unlocking on the server. Keep locally imported progress separate from verified rankings. Server-only secrets, ownership checks on every endpoint, rate limits, body limits, secure cookies/CSRF if cookie auth is used, and exact-origin CORS allowlists if origins differ.

Test: foreign runs, altered scores/seeds, invalid moves, expired runs, repeated/concurrent finish, changed level versions, offline import, missing credentials and DB failures without partial writes.

Deliver migrations, API contract, secret-free env.example, run instructions and actual integration-test results. Never implement an API that merely returns success without persistence/validation.
