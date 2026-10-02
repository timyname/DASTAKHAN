# Master Prompt 09 — Build the Entire Local MVP

Build the complete DASTAKHAN browser game from this repository. Read docs/GAME_SPEC.md in full; its contract overrides assumptions about generic match-3 behavior.

Deliver working source and a runnable game: 11×11 board, six Kazakh food pieces, LINE from 4, BOMB from L/T, golden RAM from straight 5+, all six special-pair combinations, RAM+RAM board clear, 15 levels, fixed tutorials, local saves, mobile swipe and tap-swap, optional sound with mute, menus and combination guide.

Execute prompts 01–06 and 08 sequentially. Continue between ordinary implementation stages without stopping at a plan. Keep docs/STATUS.md current and verify results. If an external capability is unavailable, use the specified honest working fallback and continue all unblocked work.

Order: engine and tests, gameplay UI, assets/animations, levels/editor, full QA. Do not substitute a generated image for working game code. Do not invent rules, APIs, credentials or test outcomes. Do not implement prompt 07 backend in this local MVP; provide a ProgressRepository boundary for later integration.

Use frontend-design and webapp-testing if present. Follow prompt 04 for art; if image generation is unavailable, implement complete SVG fallbacks and disclose them. The game must work without a server or unavailable image.

Keep model-facing instructions/documentation in English. Player-facing UI stays Russian, with authentic food labels. Add translation dictionaries rather than mixing language decisions into engine logic.

At completion provide actual run/build commands, a preview if the environment supports it, completed checks, limitations and updated docs/STATUS.md. If hosting is unconfigured, deliver a local command and build output; do not fabricate a public URL.
