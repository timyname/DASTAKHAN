# DASTAKHAN — Asset Specification

Status (rules v2, GAME_SPEC 1.2): delivered as **hand-authored SVG fallbacks**. No image-generation tool was available, so **raster generation (prompt 04) was not performed**. Every file below is an original vector drawing made for this project; none is traced from or imitates another game's assets.

The typed manifest is `apps/web/src/art/manifest.ts`. It is the single source of truth for URLs, label keys, sizes, transparency, provenance and load-failure fallbacks. Rendering lives in `apps/web/src/art/TileArt.tsx` (+ `art.css`).

## Art direction (shared by every sprite)

- Soft dimensional casual-game look: gradients, a single highlight, soft ambient-occlusion contact shadows, and a dark tinted outline for silhouette readability.
- Warm key light from the upper left. Fixed three-quarter top-down camera of roughly 30° (top faces plus a visible side band or thickness).
- Transparent background (real alpha). No text, letters, numbers or tile frames. Only plov and the beshbarmak platter include a plate, because their silhouettes need it.
- The object fills roughly 72–80% of the 256×256 canvas, centred, with padding so shadows are never clipped. Wide objects (shelpek, plov, uchpuchmak, besh) are lower; the tall kumys flask is narrower.
- Palette: dark teal `#143F3A`, cream `#FFF4DF`, gold `#E6B65A`, terracotta `#B75C46`, plus natural food colours and a cobalt plate ring for plov. Food is never recoloured unnaturally.
- Pieces are distinguished by **silhouette first**, colour second.
  - **Original six:** diamond pillow (baursak), three-ball cluster (kurt), two diagonal ovals (kazy), flat triangle (samsa), fluted cylinder (zhent), low bowl (tea).
  - **v2 additions:** tall pleated purse (manty), thin tilted disc (shelpek), bumpy nugget pyramid (chakchak), dome on a plate (plov), deep bowl with heaped noodles (lagman).

## Asset list

All sprites: `viewBox="0 0 256 256"`, `width="256" height="256"`, transparent background, SVG format, provenance `SVG fallback (hand-authored); raster generation not performed`.

### Food (11)

| ID (file stem) | Path (under `apps/web/public/`) | Bytes | Label key | Silhouette / readability notes |
| --- | --- | --- | --- | --- |
| `food-baursak` | `assets/sprites/food-baursak.svg` | 2 410 | `food.baursak` | Golden puffy rounded diamond with a side band, one soft seam and two offset dimples. The dimples are deliberately placed so they don't read as a face. |
| `food-kurt` | `assets/sprites/food-kurt.svg` | 2 163 | `food.kurt` | Three ivory balls in a compact triangle. Cool grey-blue shading and outline keep it visible on cream. |
| `food-kazy` | `assets/sprites/food-kazy.svg` | 3 089 | `food.kazy` | Two thick burgundy oval slices overlapping diagonally, with large cream fat centres. Cooked deli look. |
| `food-samsa` | `assets/sprites/food-samsa.svg` | 2 377 | `food.samsa` | Flat amber triangle with a bold Y-shaped folded seam and sesame marks. |
| `food-zhent` | `assets/sprites/food-zhent.svg` | 4 870 | `food.zhent` | Short ochre fluted cylinder with a scalloped rim and base, plus a few large crumb marks. |
| `food-tea` | `assets/sprites/food-tea.svg` | 2 306 | `food.tea` | Low **turquoise** handleless piala with a flat dark amber tea surface and one gold band. |
| `food-manty` | `assets/sprites/food-manty.svg` | 2 179 | `food.manty` | Tall warm-ivory dumpling with a pinched top knot and seven pleats. Warm ivory and a single body separate it from kurt; it's taller and paler than plov. |
| `food-shelpek` | `assets/sprites/food-shelpek.svg` | 3 696 | `food.shelpek` | Thin pale-golden disc tilted about −16°, with a visible thin side, a raised edge ring and seven dark toasted blisters. It's a wide flat oval, never a diamond pillow like baursak. |
| `food-chakchak` | `assets/sprites/food-chakchak.svg` | 5 372 | `food.chakchak` | Bumpy pyramid of 19 small glossy honey-amber nuggets with a honey drizzle and drip. Many small amber pieces, never three white balls like kurt. |
| `food-plov` | `assets/sprites/food-plov.svg` | 3 862 | `food.plov` | Low golden rice dome with orange carrot strips and a small garlic bulb, on a cream plate with a cobalt ring. The "dome on a brim" silhouette separates it from manty, samsa, zhent and chakchak. |
| `food-lagman` | `assets/sprites/food-lagman.svg` | 3 910 | `food.lagman` | Deep **terracotta** bowl with a cream ornament band. Thick yellow noodles are heaped above the rim with red pepper, green pieces and meat cubes. Colour, depth and the heaped top separate it from the tea piala. |

### Specials and obstacles

| ID | Path | Bytes | Used by | Notes |
| --- | --- | --- | --- | --- |
| `special-uchpuchmak` | `assets/sprites/special-uchpuchmak.svg` | 1 933 | LINE_H «Учпучмак» (`special.LINE_H`) | Wide golden triangular pastry lying horizontally. Crimped seams rise to a small opening on top, and pointed corners reach left and right. The front face is calm for the badge. |
| `special-kumys` | `assets/sprites/special-kumys.svg` | 2 723 | LINE_V «Кумыс» (`special.LINE_V`) | Upright brown leather torsyk flask. It has cream stitching, gold ram-horn ornaments, strap loops, a gold neck cord and a white kumys splash at the opening. Tall vertical silhouette; the belly is calm for the badge. |
| `special-kazan` | `assets/sprites/special-kazan.svg` | 2 849 | BOMB «Казан» (`special.BOMB`) | Dark-teal round cauldron with two short gold handles, a thick gold rim and a warm glowing opening. The belly is clean for the badge. No fuse. |
| `special-ram` | `assets/sprites/special-ram.svg` | 5 947 | RAM «Золотой барашек» (`special.RAM`) | Symmetrical golden ram-head emblem with large curled horns, an ivory face, a wool cap and teal gem accents. No neck stump; it's an emblem, not food. |
| `special-besh` | `assets/sprites/special-besh.svg` | 4 598 | BESH «Бешбармак» (`special.BESH`) | Festive cream platter with a thick gold rim and a teal dotted ornament ring. Noodle sheets, sliced meat and onion rings sit heaped low, with three sparkles. Universal: no badge. |
| `obstacle-crumbs-hp1` | `assets/sprites/obstacle-crumbs-hp1.svg` | 2 438 | Crumbs, 1 HP (`obstacle.crumbs`) | Seven sparse warm-beige crumbs near the cell edges over a very faint wash. Low contrast, drawn **under** the tile. |
| `obstacle-crumbs-hp2` | `assets/sprites/obstacle-crumbs-hp2.svg` | 5 466 | Crumbs, 2 HP (`obstacle.crumbs`) | Nineteen crumbs, some toasted darker, over a stronger wash. Visibly denser than HP1. |

### Background

| ID | Path | Bytes | Size | Notes |
| --- | --- | --- | --- | --- |
| `background` | `assets/background.svg` | 5 350 | 1080×1920 (9:16), **opaque** | Dark teal `#143F3A` textile twill with a soft warm centre light and a vignette. Faint cream/gold ram-horn scrolls, a rhombus chain and a thin frame sit near the outer edges only, so the centre stays calm. No board, HUD or text. |

Total delivered art: about 67 KB uncompressed for 19 files (every file is under 6 KB).

## Composition of special tiles (code + sprites)

Recorded in `SPECIAL_COMPOSITION` in the manifest:

| Special | Sprite | Code-drawn layers |
| --- | --- | --- |
| `LINE_H` «Учпучмак» | `special-uchpuchmak` | A base-food badge (50% of the tile, centred at 56% height), plus two bold gold chevrons with dark outlines on the **left and right** edges. The chevrons point outward along the row, which is the real effect axis. |
| `LINE_V` «Кумыс» | `special-kumys` | A base-food badge (50%, centred at 52% height), plus two gold chevrons on the **top and bottom** edges, pointing outward along the column. |
| `BOMB` «Казан» | `special-kazan` | A base-food badge (54%) on the cauldron belly. |
| `RAM` «Золотой барашек» | `special-ram` | A soft CSS radial gold glow. No badge (`base` is `null`). |
| `BESH` «Бешбармак» | `special-besh` | A soft CSS radial gold glow. No badge (`base` is `null`). |

The badge is a dark ring, a gold ring and a cream disc, with the base food sprite drawn at 88% of the badge so that the food itself fills about two thirds of it. Player-facing names come from the i18n dictionaries; the art contains no text.

## Load failures and fallbacks

- `preloadAssets()` loads every sprite plus the background through `Image`. It never rejects and resolves `{ failed: string[] }` with asset IDs. The default per-asset timeout is 10 s; a timeout is reported but not cached as a failure.
- A failed URL is recorded once (`markAssetFailed`). Later tiles render the fallback immediately.
- Each `<img>` tracks `onError` in component state. Instead of a broken-image icon, it switches to a playable CSS shape coloured from the manifest. Every fallback shape has a light outer ring so it stays visible on dark cells.

| Asset | Fallback shape | Glyph |
| --- | --- | --- |
| baursak | diamond | ◆ |
| kurt | circle | ∴ |
| kazy | oval | ◎ |
| samsa | triangle | ▲ |
| zhent | rounded block | ≡ |
| tea | bowl | ◡ |
| manty | drop | ✿ |
| shelpek | tilted disc | ◌ |
| chakchak | mound | ⠿ |
| plov | dome | ◓ |
| lagman | deep bowl | ≋ |
| uchpuchmak | wide triangle | (badge on top) |
| kumys | flask | (badge on top) |
| kazan | circle | ✹ |
| ram | circle | ♈ |
| besh | platter | ✺ |

  Crumbs fall back to a CSS speckle pattern. Badges and chevrons are code-drawn, so LINE direction and base type survive sprite failures.
- All art elements use `pointer-events: none`, and images use `draggable={false}`. The board cell handles input.

## Verification performed

These checks were run in the dev technical gallery (`apps/web/gallery.html`, dev server only; it is not in the production build input), in the built-in browser pane and in headless Edge at 1× and 2× device pixel ratio:

- All 11 foods were checked at 32, 48 and 96 CSS px on cream `#FFF4DF` and dark teal `#1D5A52` cells.
- LINE_H, LINE_V and BOMB were checked for each of the 11 bases, along with RAM, BESH and specials over crumbs.
- Crumbs HP1/HP2 were checked under every food.
- Forced CSS fallbacks were shown for every food and special.
- A "confusable pairs" panel was checked at 28/32/34 px: lagman/tea, shelpek/baursak, chakchak/kurt, plov/samsa/zhent, manty/kurt/plov and chakchak/plov.
- 11×11 sample boards were checked at 34 px pitch for the classic six, the new dishes plus tea, and a "risky six" set (light and dark). An all-11 stress board was checked at 28 and 34 px.
- A canvas alpha bounding-box check measured each sprite against 72%/80% guides. The measured box includes soft contact shadows.
- The background was previewed with a mock board overlay.

## Known limitations

- These are vector fallbacks, not painted raster art. Texture detail is intentionally restrained.
- At 28–32 px on 1× screens, badge foods are about 12–14 px. Golden bases (baursak, samsa, zhent, shelpek, plov) inside a badge are told apart by coarse shape and only partly by colour. Badges are clearer at 34 px and up or on 2× screens.
- The badge covers most of the uchpuchmak's front face. On the board the LINE_H tile reads as "golden pastry with ⟨ ⟩ chevrons and a badge" more than as a detailed uchpuchmak. The top chevron of LINE_V covers part of the kumys splash.
- Kumys is a tall, narrow object: about 55% wide and 81% tall including the splash and shadow.
- Soft shadows are radial gradients rather than blur filters, which keeps rendering cheap for 121 tiles.

## Replacing with raster art later

Raster sprites generated from the prompt 04 prompts, including the "Rules v2 additions" section (1024² source, 256² PNG/WebP delivery with real alpha), can replace these files **1:1, keeping the IDs**:

1. Export the files with the same IDs as above (for example `food-manty.png` or `special-kumys.png`) into `apps/web/public/assets/sprites/`. Keep the high-resolution sources outside the delivered folder.
2. In `manifest.ts`, change the file extension and `format` for those IDs, keep `width`/`height` at 256, and update `provenance` to describe the generator and approval.
3. Re-run the gallery checks: real alpha (no checkerboard), unclipped shadows, consistent optical scale, the confusable-pairs panel at 28–34 px, and badge readability on light and dark cells.
4. Badges, chevrons, glows and fallbacks are code and need no changes. For LINE_H, LINE_V and BOMB, keep the sprite centre calm so the badge doesn't hide key features.
