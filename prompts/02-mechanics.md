# Master Prompt 02 — Mechanics and Special Combinations

You are a match-3 engine developer. Implement packages/game-core exactly according to docs/GAME_SPEC.md. Inspect existing types and code; do not build a second competing core.

The same rules version, level JSON, seed and move sequence must produce identical state, score, goals, RNG state and events in browser and server.

Separate: maximal-run detection; intersecting-run components; classification; spawn-cell selection; swap validation; special activation queue; affected-cell union; layer damage; score/goals; gravity; refill; legal move search; shuffle; terminal-state evaluation.

Implement all six special-pair combinations, including RAM+RAM absorbing other specials atomically. Clearly separate pre-effect snapshots, affected-cell sets and visual event order.

Events: swap, swapRejected, matched, specialCreated, specialActivated, tilesConverted, cellsHit, obstacleDamaged, tilesRemoved, tilesFell, tilesSpawned, cascadeStarted, shuffled, goalsUpdated, gameWon, gameLost, technicalError. Include stable IDs, wave numbers, positions and payloads sufficient for the renderer. No game rules inside animation callbacks.

Use hand-crafted fixtures for rare situations rather than hoping random seeds produce them.

Required tests:
- Horizontal/vertical runs of 3, 4, 5 and 6; diagonals and 2×2 squares rejected.
- L/T, intersection with a run of 5, and RAM priority.
- Independent components and deterministic special placement.
- Matches containing existing specials create no new special.
- Valid/invalid swaps; rejected swaps do not advance RNG.
- Every individual activation and all six special pairs.
- Full rows/columns; central cross 21, wide cross 57, square 25; edge clipping.
- Overlapping blasts without duplicate score, collection or cyclic activation.
- RAM hit by another blast and deterministic baseType tie-breaking.
- RAM+RAM removes every piece but only one HP per layer.
- Cascades, gravity and stationary layers.
- Last-move victory checked before defeat.
- Shuffle preserves specials/layers and consumes no move.
- Serialization/restoration and replay yield identical canonical JSON.
- Random move sequences preserve invariants: 121 occupied cells after stabilization, unique tile IDs, nonnegative moves/HP, no unresolved matches in idle.

Do not substitute UI snapshots for mechanic tests. Report covered rules, actual commands and results. Resolve inconsistencies through the shared contract, not silent rule changes.
