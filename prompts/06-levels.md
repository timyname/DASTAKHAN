# Master Prompt 06 — Levels, Tutorials and Editor

You are the game designer/content developer. Implement the 15 initial definitions exactly as specified in docs/GAME_SPEC.md. Validate JSON with one shared schema used by runtime, editor and later backend.

LevelDefinition fields: id, version, rulesVersion, rows=11, cols=11, allowedTypes, moveLimit, goals, overlays[{row,col,hp}], optional tutorialId. Seed is a run input, not a disguised arbitrary board.

MVP goal types: collect(type,count), clearCrumbs(cellCount). HP2 cells count only when fully destroyed. Do not confuse obstacle cell count with total HP.

Create four independent fixed tutorials: LINE, BOMB, RAM+food, RAM+RAM. Fixtures define a complete verified board and expected action/outcome. Do not promise rewards that random generation may not provide.

Internal editor: 11×11 grid, HP0/1/2 brush, allowed-type toggles, move limit, goals, validation, test play using a seed, JSON import/export. Enable only in development or protected admin environments; never expose unrestricted server-level editing to public visitors.

Simulate levels over a fixed seed set with a simple bot preferring objectives, specials and immediate collection. Record number of runs, bot version, win rate, median remaining moves and shuffle frequency. Bot results are technical signals, not predictions of human success rates.

Retain initial definitions as v1. Version any balance changes and compare outcomes; never mutate an already-published level under the same version. Propose adjustments after human playtesting. Do not make unsupported retention/monetization claims.
