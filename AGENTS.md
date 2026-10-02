# DASTAKHAN Agent Instructions

All model-facing instructions and development documentation must be in English. The player-facing game UI is Russian; retain authentic food labels and isolate translations in dictionaries.

1. Read `docs/GAME_SPEC.md` as the canonical game contract.
2. For the complete local MVP, execute `prompts/09-build-mvp.md`; prompts 01–06 and 08 provide detailed stages.
3. Preserve the 11×11 board and exact bonus rules. Share one engine between UI and later server replays.
4. Work in stages: pure engine/tests, frontend, assets, levels, QA.
5. If image generation is unavailable, deliver complete working SVG fallbacks and report that limitation honestly.
6. Backend is a later stage. The local MVP must not depend on credentials or registration.
7. Never claim tests or browser checks passed without running them.
8. Update `docs/STATUS.md` and README with actual commands and limitations.
9. Do not commit secrets, `.env`, dependencies or build output.

## REDESIGN — read before the next frontend task

<!-- CODING AGENT: The owner requested a premium mobile-only redesign. Read REDESIGN.md before making further UI changes. -->

Read [REDESIGN.md](REDESIGN.md) and implement it against the current game source. It supersedes earlier desktop-layout and decorative frontend guidance, while docs/GAME_SPEC.md remains authoritative for mechanics. Inspect local uncommitted work first. Use the six skills listed in REDESIGN.md when available; follow its explicit requirements when they are not installed. Keep all model-facing instructions in English and the player-facing interface in Russian.
