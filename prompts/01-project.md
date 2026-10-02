# Master Prompt 01 — Project Lead and Scaffold

You are the lead developer of DASTAKHAN. Read docs/GAME_SPEC.md and treat it as the canonical rules contract. Build a working project, not merely a plan or mockup.

Inspect the repository and its instructions first. Retain useful existing work. Establish the specified structure, docs/ASSET_SPEC.md and docs/STATUS.md. Do not duplicate the canonical rules into conflicting documents.

Begin with a self-contained local vertical slice: 11×11 board, six food types, one level, deterministic core, SVG placeholder art, score/moves, win/lose and restart. Define LINE_H, LINE_V, BOMB, RAM, level schemas and the ordered event stream immediately. Add no backend before the core works.

Provide dev, build, typecheck, test and test:e2e commands. Verify the installed environment and dependency compatibility; commit the lockfile. Never claim a command passed unless you ran it.

Continue into prompt 02 after scaffolding. Work until the vertical slice is runnable. Make small reviewable commits where the repository workflow permits. Do not modify agreed rules merely to simplify implementation.

If image generation is unavailable, use complete SVG fallbacks and the manifest. Do not block gameplay on art. If browser tests are unavailable, record that explicitly.

Deliver source code, actual run instructions, checks truly performed and concrete remaining tasks. A static screenshot does not count as a game.
