# DASTAKHAN tutorial fixtures

Five fixed tutorials (GAME_SPEC v1.2 §9, rules version 2). Each file is a
`TutorialDefinition` (`packages/game-core/src/types.ts`): a level frame (`level`,
validated by the shared `validateLevel`), a complete 11×11 `board` fixture, a refill
`seed`, the scripted `steps` (the only swaps the tutorial allows) and i18n keys.

Coordinates are `(row,col)`, row 0 at the top. Fixture tokens: `B` baursak, `K` kurt,
`Z` kazy, `S` samsa, `J` zhent, `T` tea, `M` manty, `H` shelpek, `C` chakchak, `P` plov,
`L` lagman; second char `.` ordinary, `h` LINE_H, `v` LINE_V, `b` BOMB; `RR` is RAM and
`XX` is BESH.

| Offered after | File | Steps | Moves | Board types | Goal | Seed |
| --- | --- | --- | --- | --- | --- | --- |
| level-02 | `tutorial-line.json` | 2 | 5 | original six | collect 5 baursak | 1001 |
| level-04 | `tutorial-bomb.json` | 2 | 5 | original six | collect 5 kurt | 1002 |
| level-07 | `tutorial-ram.json` | 2 | 5 | original six | collect 10 baursak | 1003 |
| level-10 | `tutorial-ram-ram.json` | 1 | 4 | original six | collect 12 tea | 1004 |
| level-12 | `tutorial-besh.json` | 2 | 5 | level-12 six | collect 25 shelpek | 1008 |

"Original six" = baursak, kurt, kazy, samsa, zhent, tea. "Level-12 six" = kurt, samsa,
shelpek, chakchak, plov, lagman. Each frame's `allowedTypes` lists exactly the types shown
on its board (FOOD_TYPES order), so refills never introduce a food the board did not show.

## Design rules

- No starting fixture contains a horizontal or vertical run of 3+ equal food bases
  (specials count by their base; RAM and BESH never match). There are no exemptions.
- Step 1 creates the special being taught. For LINE, BOMB and RAM the moved piece lands
  on the swap destination, so the engine creates the special there (GAME_SPEC §3).
- Every step-2 piece (including pieces counted toward the goal) lies strictly below
  every cell step 1 touches (max row 4 / 5 / 3 / 7 for line / bomb / ram / besh).
  Gravity only moves tiles above removed cells, so step 2's pieces cannot move.
- Collect goals use a food type that step 1 never matches, so step 1 cannot end the
  tutorial early; the final step removes at least the goal count, so every tutorial
  ends in a win on its final step.
- i18n keys: `tutorial.<slug>.title`, `tutorial.<slug>.step1`, `.step2`,
  `tutorial.<slug>.done` with slugs `line`, `bomb`, `ram`, `ramRam`, `besh`
  (`ramRam` has only `step1`).

## Why BESH is created by a cascade

On a board with no ready match, a single swap can never directly complete a 5-run
crossing a perpendicular 4-run. Exactly one piece of the matching type moves in. It must
land on the crossing cell, otherwise one of the two runs would already exist. That cell
must then be the middle of the 5 and an inner cell of the 4. All four of its neighbours
are therefore run cells, and none of them can be the swap origin. In normal play BESH
therefore only appears through cascades. The tutorial teaches it that way, with a cascade
made only of fixture tiles, so it does not depend on random refills.

## Expected outcomes (verified on the engine)

`content/tutorials.test.ts` replays every tutorial with
`createGameFromBoard(level, board, seed)` + `applyMove` and asserts the events below.
`content/content.test.ts` checks the same designs with a small local resolver that does
not use the engine.

### tutorial-line (LINE_H «Учпучмак»)

1. Swap `(4,4)` → `(3,4)`: the samsa moves up and row 3 cols 2–5 become an exact samsa
   4. A samsa `LINE_H` is created at `(3,4)` (wave 1 only).
2. Swap `(10,5)` → `(9,5)`: the baursak completes `Bh (9,3)`, `B (9,4)`, `B (9,5)`. The
   pre-placed line fires (`row`) and clears row 9, which holds 6 baursak. Goal 5/5, won.

### tutorial-bomb (BOMB «Казан»)

1. Swap `(2,4)` → `(3,4)`: kazy T-shape (row 3 cols 3–5 + col 4 rows 3–5). A kazy `BOMB`
   is created at `(3,4)` (wave 1 only) and falls to `(5,4)`.
2. Swap `(10,6)` → `(9,6)`: completes `Kb (9,4)`, `K (9,5)`, `K (9,6)`. The pre-placed
   bomb fires (`square3`, rows 8–10 × cols 3–5). At least 6 kurt are removed. Goal 5/5, won.

### tutorial-ram (RAM «Золотой барашек»)

1. Swap `(3,5)` → `(2,5)`: row 2 cols 3–7 become a straight tea 5. `RAM` is created at
   `(2,5)` (wave 1 only).
2. Swap `RR (9,5)` → `(9,6)` with the ordinary baursak: `ramColor` on baursak removes every
   baursak (19+ remain on the board after step 1). Goal 10/10, won.

### tutorial-ram-ram (RAM + RAM «Большой той»)

1. Swap `RR (5,5)` → `(5,6)`: `bigToi` removes every piece. The board holds 16 tea.
   Goal 12/12, won.

### tutorial-besh (BESH «Бешбармак»)

1. Swap the chakchak `(5,4)` → `(5,3)`: it completes a vertical chakchak 3 at col 3
   rows 3–5 (wave 1, no special). The plov above, at `(1,3)` and `(2,3)`, falls 3 rows. Row 4
   cols 1–5 becomes a plov 5 crossing the plov 4 at col 3 rows 4–7 (wave 2, 8 cells).
   As a cascade it uses the fallback creation cell, so `BESH` is created at `(7,3)`.
   The step-1 text should explain that the move makes the plov fall into the cross.
2. Swap the pre-placed `XX (9,8)` → `(9,9)` with the ordinary food: the `besh` effect
   («Дастархан для всех») targets the three most frequent types plus the 5×5 around
   `(9,9)`. Shelpek is clearly the most frequent: after step 1 there are 41 on the board
   against at most 16 of any other type, with only 10 refilled cells. It is always targeted. Goal 25/25, won.

The seed matters only for refills. Seed 1008 was chosen so that step 1 of
tutorial-besh resolves in exactly its two designed waves (seed 1005 produced an extra
refill cascade). If the rules or the RNG change, rerun `npx vitest run content`. If a
replay fails, change only the `seed` and bump the tutorial `version`.
