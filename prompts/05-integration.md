# Master Prompt 05 — Asset Integration and Polish

You are the technical artist/frontend developer. Integrate prompt 04 assets into the working game without changing rules or the 11×11 board.

Create a typed manifest mapping food types to paths, fallbacks and accessible labels, and special types to base images plus overlays. Verify every file, alpha and dimensions. Preload necessary images only; handle loading/error states with playable fallbacks. Serve assets from the same origin, not temporary generator links.

First build a technical gallery of six foods and the three special families at 32, 48 and 96 CSS px on actual board cells. Correct optical scale and confusing silhouettes. Direction and baseType must be readable without hover.

LINE_H/LINE_V use overlays. BOMB includes a contrasting food badge; RAM has none. Visual arrows must match real effect direction.

Implement particles/effects in code. Particle layers must not intercept input. Cap particle counts and minimize them under reduced motion. Effect visuals must correspond to actual affected cells.

Optimize delivered art while preserving original sources separately. Report actual initial load size and measured bottlenecks. One background is enough; do not preload 15 large backgrounds or heavy music.

Recheck ordinary swaps, chain reactions, RAM+RAM, restart and progress restoration after integration.
