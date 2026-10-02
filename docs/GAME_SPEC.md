# DASTAKHAN — Shared Game Specification

Version 1.2 — English model instructions, October 2, 2026. Rules version 2.

Changes in 1.2 (owner decisions): 11 food types with 5–6 per level; LINE_H is shown as «Учпучмак» and LINE_V as «Кумыс»; new universal special BESH «Бешбармак»; a fifth tutorial for BESH.

## Purpose and workflow

This is a design proposal and development starter kit, not a completed game or validated level balance. All model-facing instructions are in English. The initial player-facing interface is Russian; preserve authentic food names and place future Kazakh translations in a separate dictionary for human review.

Repository/project name: DASTAKHAN, exactly as requested by the owner. Russian display title: «Дастархан». Use DASTAKHAN consistently for paths, project identifiers and branding in English prompts.

Read this specification before any individual prompt. Execute prompts 01–06 and 08 for the local MVP. Prompt 07 is a later backend stage. Prompt 09 orchestrates the complete local MVP. Work sequentially in one repository; do not create independent frontend, engine and backend projects with incompatible rules. Use frontend-design and webapp-testing skills when available, but verify that their required tools actually exist.

## 1. Product and theme

A single-player browser match-3 game inspired by a welcoming Kazakh feast. Warm, festive and contemporary. This is an artistic game interpretation, not an assertion about traditional serving rituals. No cultural caricatures or copied game characters/branding.

The board is always 11 columns by 11 rows, with row/col coordinates 0–10. MVP boards are complete rectangles without holes. Gravity is downward; new pieces enter from the top. Mobile first, then desktop. No mandatory account, energy system, advertisements or payments in the MVP.

## 2. Basic food pieces

| ID | Russian player label | Required silhouette |
| --- | --- | --- |
| baursak | Баурсак | Golden inflated dough pillow, rounded diamond |
| kurt | Курт | Three small ivory cheese balls in a compact triangular cluster |
| kazy | Казы | Two overlapping burgundy oval sausage slices with prominent cream centers |
| samsa | Самса | Amber triangular pastry with a bold folded seam |
| zhent | Жент | Short ochre fluted cylinder, simplified coarse grain texture |
| tea | Чай | Low turquoise handleless tea bowl, dark tea surface visible |
| manty | Манты | Plump pale dough dumpling with a pleated, gathered top |
| shelpek | Шелпек | Thin round golden flatbread disc with a few toasted blisters, seen at an angle |
| chakchak | Чак-чак | Glossy honey-amber mound of small fried dough nuggets with a drizzle |
| plov | Плов | Compact dome of golden rice with orange carrot strips and one garlic bulb on top |
| lagman | Лагман | Deep bowl of thick hand-pulled noodles with red-pepper and green vegetable topping; deeper and more colourful than the tea piala |

The game has 11 food types. Every level uses a subset of 5–6 of them; new dishes are introduced across the campaign (§9). Never put all 11 on one board. Distinguish pieces by silhouette, not color alone. Do not recolor food unnaturally to solve readability problems. Zhent's molded shape is an artistic serving choice.

Food types do not evolve into other food types. Matches use identical base types; larger matches create special pieces.

## 3. Match rewards

- Exactly 3 in a horizontal/vertical straight line: remove them; no special.
- Exactly 4 horizontally: create LINE_H, displayed as «Учпучмак»; clear its entire row when activated.
- Exactly 4 vertically: create LINE_V, displayed as «Кумыс»; clear its entire column when activated.
- A T or L formed by intersecting horizontal and vertical runs of at least 3, with a union of at least 5 cells: create BOMB, displayed as «Казан»; its effect is a centered 3×3 square.
- A straight run of 5 or more: create RAM, displayed as «Золотой барашек»; it is a universal special without a baseType.
- A run of 5 or more that shares a cell with a perpendicular run of 4 or more (one connected component, L/T/+ shape): create BESH, displayed as «Бешбармак»; it is a universal special without a baseType (§4).
- Diagonals, 2×2 squares and merely connected clusters are not matches. A run of 6+ creates one RAM (or one BESH), not multiple rewards.

LINE_H, LINE_V and BOMB retain their food baseType and participate in future matches of that type. LINE_H is drawn as a triangular uchpuchmak pastry lying horizontally, LINE_V as an upright leather torsyk flask of kumys; both carry a readable base-food badge and small directional arrows along their real effect axis. BOMB uses one cauldron image with a readable food badge. RAM is a friendly golden ram-head emblem with curled horns, not a realistic severed head or a dish depiction. BESH is a festive platter of beshbarmak (wide noodle sheets, sliced meat, onion) with a gold rim glow; no badge.

Find maximal matching runs, then merge runs that intersect at actual cells. Do not merge components just because same-type pieces are adjacent. A connected matching component produces at most one special. Independent components resolve simultaneously and may each create one.

Priority: BESH > RAM > BOMB > LINE > ordinary removal. Select the creation cell deterministically: swap destination if in the component; otherwise swap origin if in it; otherwise greatest row and then smallest col. Cascades always use the final fallback rule.

A new special survives the wave that created it, is not activated during that wave, and is subject to gravity afterwards. Protection ends at the next wave. A matching component containing any existing special activates that special but does not create another special. This MVP restriction avoids ambiguous special multiplication.

## 4. Activation and special pairs

LINE/BOMB activate when included in a baseType match or hit by another special. Tapping a single special selects it; tapping does not activate it.

RAM + ordinary food: always a legal adjacent swap. Consume RAM and remove every piece with the selected food baseType. Existing LINE/BOMB of that baseType activate too. Show golden arcs to targets followed by a soft wave.

RAM hit by another effect: select the most frequent baseType when its activation is enqueued. Tie-break order: the FOOD_TYPES order baursak, kurt, kazy, samsa, zhent, tea, manty, shelpek, chakchak, plov, lagman. If no baseType exists, remove RAM without a secondary effect.

BESH «Бешбармак», effect «Дастархан для всех»: swapping BESH with any adjacent piece is always legal; BESH also activates when hit by another effect. It removes every piece of the three most frequent base types on the wave's pre-removal board (same counting and tie-break as RAM; fewer if fewer types exist) plus a 5×5 square centered on BESH (its position after the swap). Specials inside the affected cells are hit and activate normally (LINE/BOMB of a targeted type activate too). Swapped with ordinary food, LINE or BOMB, only the BESH effect is applied and the partner is hit by it. BESH + RAM and BESH + BESH trigger «Большой той» exactly like RAM + RAM. Show a festive platter wave reaching the targeted pieces.

Any two adjacent specials can be swapped for one move, even without a match. The pair effect replaces the individual activations of those two specials. Its center is the swap destination after the swap. Third-party specials hit by the pair effect chain normally, except the explicit RAM+RAM override below.

| Pair | Exact effect |
| --- | --- |
| LINE + LINE, any orientations | One row plus one column through the center: 21 unique cells on the full board |
| LINE + BOMB | Three adjacent rows plus three adjacent columns through the center: up to 57 unique cells |
| BOMB + BOMB | One centered 5×5 square: up to 25 cells; one damage wave, no delayed second blast |
| RAM + LINE | Capture the line's baseType and orientation. Convert every ordinary piece of that type in the board snapshot to that LINE orientation and activate them. Consume the initial pair. Existing specials of that baseType are enqueued with their original kind unchanged. Others activate only if hit. |
| RAM + BOMB | Same snapshot/conversion behavior, converting ordinary pieces of that baseType to BOMB. Existing specials retain their kinds. |
| RAM + RAM (also BESH + RAM, BESH + BESH) | «Большой той»: one board-wide effect removes every current piece and deals one hit to each obstacle layer. Other specials are absorbed without individual activation. Refill and evaluate goals normally; this is not automatic victory. |

Clip all areas at board edges; never wrap. Two RAM pieces must be adjacent and swapped; they do not combine remotely. Highlight an available RAM pair and teach this explicitly.

## 5. Resolution, scoring and determinism

State flow: idle → swapping → resolving → falling → refilling → checking → idle/won/lost. Accept gameplay input only in idle. Pause/exit must remain safely accessible.

An illegal swap animates forward and back, consumes no move, does not advance RNG and changes neither score nor goals. A legal swap consumes exactly one move, locks input, resolves effects, applies gravity/refill and continues cascades until stable.

Per wave: detect matches and protected special spawn cells; resolve the queue of existing specials; union affected cells; apply removal/damage once; then gravity/refill. Stable activation queue ordering: row, col, tileId. Each existing special activates at most once per wave. Overlapping effects do not double-count damage, collection or points.

RAM conversions use the pre-removal board snapshot. Converted entities receive deterministic IDs linked to the originals and cannot be processed twice. Event iteration order must not alter results.

Collect a baseType goal when an ordinary piece or LINE/BOMB of that baseType is actually removed. RAM and BESH have no baseType. The piece retained as a newly created special is not collected/scored until the special is eventually removed.

Base score: 10 per removed piece, including RAM and BESH; 20 per fully destroyed obstacle. Partial obstacle damage has no score. Creating a special gives no extra points. Wave multipliers are ×1, ×2, ×3, ×4, then capped at ×5. All chained blasts before the next gravity step belong to one wave. Each player move resets the multiplier.

Stars are awarded only on victory: 1 for all goals completed, 2 if at least 20% of starting moves remain, 3 if at least 40% remain. Apply the highest eligible tier. No automatic remaining-move celebration blasts in MVP.

Fully resolve the last move and all cascades, then check victory before defeat. A last-move win earns one star if no moves remain. Defeat requires incomplete goals and zero moves.

Use seeded RNG, versioned rules and versioned levels. No Date.now or Math.random in game-core. Tile IDs use a deterministic counter. Bound generation/shuffle attempts and cascades per move with constants recorded in rules. On overflow, surface a technical error and restore the last stable state, rather than silently awarding a win or consuming a move.

## 6. MVP obstacles

Only «Крошки на скатерти» (crumbs): stationary under-tile layers with 1 or 2 HP. They do not block swaps, matches or gravity. A wave removing a tile at that cell or directly affecting the cell deals at most 1 damage to its layer. HP2 is visually denser than HP1. Layers never fall with pieces.

A protected newly created special's cell takes no obstacle damage merely from its generating match; an independent blast can damage the layer without destroying the protected special. RAM+RAM removes one HP everywhere, so HP2 layers require another hit.

Do not add generators, ice, locked cells, portals, diagonal gravity or falling ingredients before validating the base game.

## 7. Board generation and dead boards

Every starting board must have no pre-existing match and at least one legal move. Select uniformly from allowed types; no hidden adaptation to the player's actions.

A legal move is an ordinary match-producing swap, RAM or BESH with any adjacent piece, or a swap of two specials.

After stabilization, if no legal move exists and the game is unfinished, shuffle free of charge. Preserve piece types and specials; preserve obstacle positions/HP. Require no ready matches and at least one legal move. After bounded shuffle attempts, deterministically regenerate ordinary pieces while retaining specials and layers; log a fallback event. Never lose objective progress.

After 5 idle seconds, highlight one legal swap as a hint. Do not claim the hint is optimal.

## 8. Architecture and persistence

Suggested MVP stack: TypeScript, Vite, React for screens, an isolated DOM renderer with transform animations, Vitest for core tests, Playwright for browser testing. Choose compatible current stable versions and commit the lockfile; do not invent version numbers.

Start with 121 DOM pieces, without WebGL or a game engine. If profiling reveals a real renderer bottleneck, replace the renderer behind the shared interface without rewriting game rules.

- packages/game-core: pure logic, types, seeded RNG, rulesVersion and events.
- apps/web: screens, rendering, input, audio and local progress.
- apps/api: optional later Node.js/TypeScript + PostgreSQL backend.
- content/levels: schema-validated JSON definitions.
- public/assets: images/audio and a typed manifest.
- docs: specifications, status and run instructions.

Share the exact game-core package between browser and server replays.

Core API: createGame(level, seed), getLegalMoves(state), applyMove(state, move), serializeState(state), restoreState(snapshot). applyMove returns nextState and ordered visual events sufficient to reconstruct intermediate scenes, not just the final array. No DOM, React, network, animation timers or storage access inside game-core.

Saves include schemaVersion, rulesVersion, levelVersion, levelId, seed, rngState, last stable state, move log, objectives and moves remaining. Save only stable states; hiding the tab mid-animation preserves the last stable state.

## 9. First 15 levels: provisional balance

Every board is 11×11. Multiple goals must all be completed. Campaign boards start without specials; tutorials use separate fixtures.

| Level | Allowed types (FOOD_TYPES order) | Moves | Goals / layers |
| --- | --- | --- | --- |
| 01 | baursak, kurt, kazy, samsa, tea | 20 | Collect 25 baursak |
| 02 | baursak, kurt, kazy, samsa, tea | 22 | Collect 20 kurt and 20 kazy |
| 03 | baursak, kurt, kazy, samsa, zhent, tea | 24 | Collect 30 samsa |
| 04 | baursak, kurt, kazy, samsa, zhent, tea | 25 | Collect 25 tea and 25 zhent |
| 05 | baursak, kurt, kazy, samsa, tea, manty | 25 | Clear 9 HP1 cells: rows 4–6, cols 4–6 |
| 06 | baursak, kazy, samsa, tea, manty, shelpek | 26 | Clear 25 HP1 cells: rows 3–7, cols 3–7 |
| 07 | baursak, kurt, samsa, tea, manty, shelpek | 26 | Clear 22 HP1 cells: rows 2 and 8, all cols; collect 25 baursak |
| 08 | kurt, kazy, samsa, zhent, tea, chakchak | 27 | Clear 9 HP2 cells: rows 4–6, cols 4–6 |
| 09 | baursak, kazy, tea, manty, shelpek, chakchak | 28 | Clear 21 HP1 cells: row 5 OR col 5 |
| 10 | kurt, kazy, samsa, tea, chakchak, plov | 28 | Collect 35 kurt and 35 kazy |
| 11 | baursak, zhent, tea, manty, plov, lagman | 29 | Clear 25 cells in rows 3–7, cols 3–7; central rows 4–6/cols 4–6 are HP2, remaining cells HP1 |
| 12 | kurt, samsa, shelpek, chakchak, plov, lagman | 30 | Clear 40 HP1 cells on the board's outside perimeter |
| 13 | baursak, kazy, zhent, manty, chakchak, lagman | 30 | Clear 16 HP2 cells: four 2×2 blocks starting at (1,1), (1,8), (8,1), (8,8) |
| 14 | baursak, kurt, kazy, samsa, zhent, tea | 30 | Collect 25 of each of these six food types |
| 15 | baursak, kazy, tea, shelpek, plov, lagman | 32 | Clear 25 central HP2 cells, rows 3–7/cols 3–7; collect 40 tea |

New dishes appear in order: manty (05), shelpek (06), chakchak (08), plov (10), lagman (11).

Levels 1–2 introduce swaps. After 2, offer a fixed LINE tutorial (Учпучмак and Кумыс); after 4, BOMB; after 7, RAM; after 10, RAM+RAM; after 12, BESH («Бешбармак»). Tutorials do not rely on lucky random generation, do not spend campaign progress, can be skipped and replayed.

Do not call levels balanced until simulation and human playtesting have been performed.

## Technical references

- Official Anthropic skills: https://github.com/anthropics/skills
- Vite: https://vite.dev/guide/
- React with TypeScript: https://react.dev/learn/typescript
- Playwright device emulation: https://playwright.dev/docs/emulation

Consult documentation for the actual installed versions. Templates and skills do not prove that game mechanics work.
