# Master Prompt 04 — Art Direction and Image Generation

You are the art director of DASTAKHAN. Read docs/GAME_SPEC.md. Produce one coherent asset family, not unrelated images. Start with a six-piece style reference, then separately exportable sprites. A contact sheet does not replace individual game files.

Use an image-generation tool if available. Otherwise supply prompts plus consistent SVG fallbacks and state that raster generation was not performed. Maintain an asset manifest with paths, dimensions, transparency and provenance. Preserve the IDs/filenames below.

Sprites: 1024×1024 source; delivered 256×256 PNG or WebP with real alpha. Never fake transparency with a checkerboard. Artwork fills 72–80% of the canvas. Consistent camera, light direction and optical scale. Pieces must remain distinguishable at 28–34px; simplify detail instead of oversharpening.

LINE overlays are implemented in code, avoiding 12 duplicate food sprites. BOMB uses one cauldron plus a programmatic baseType badge. RAM is a standalone emblem. Keep backgrounds separate and free of baked-in HUD/text. Implement text, buttons, logos and ornamental frames in HTML/SVG.

Inspect real alpha, dimensions, unclipped shadows, consistent scale and readability on light/dark cells. Do not call a sprite atlas complete until technically assembled from individual assets.

## Shared prefix for EVERY food/special sprite

Create ONE isolated production game sprite for an original Kazakh food match-3 game called DASTAKHAN. Soft dimensional casual-game illustration, handcrafted clay-like volume, appetizing food, clean bold silhouette, restrained texture, rounded edges, warm key light from upper left, subtle ambient occlusion, fixed three-quarter top-down camera at roughly 30 degrees. Centered object filling 76 percent of a square canvas with generous transparent padding. Recognizable at 32 pixels. The same visual family and camera as the attached approved reference. TRUE transparent alpha background. No text, no letters, no numbers, no watermark, no tile frame, no checkerboard, no extra props, no cropped edges. Original design, not an imitation of an existing game's assets. Deliver a single sprite, not a grid or contact sheet.

Append exactly ONE of the following asset descriptions to the prefix:

food-baursak.png:
A single golden Kazakh baursak, a plump fried dough pillow with a rounded diamond silhouette, gently inflated center, warm honey-gold crust, two or three broad surface dimples. No plate. Clearly different from a triangular samsa.

food-kurt.png:
Three small ivory-white Kazakh kurt cheese balls arranged as one compact triangular cluster, lightly chalky matte surfaces with extremely subtle pores. Clear three-lobed silhouette, soft cool shadows to remain visible against a cream board. No bowl or plate.

food-kazy.png:
Two overlapping thick oval slices of Kazakh kazy sausage, burgundy-brown outer meat ring and a large irregular cream-colored fat center, stylized appetizing cooked deli-food appearance, no blood, no raw meat, no plate. Clear oval silhouette with a diagonal arrangement.

food-samsa.png:
One triangular baked samsa pastry, rounded triangular corners, amber flaky crust, one bold folded seam and only a few broad sesame marks. Strong triangular silhouette, visibly flatter and more triangular than a baursak. No plate.

food-zhent.png:
One stylized molded portion of Kazakh zhent, a short ochre-gold cylinder with broad vertical fluting and a coarse millet crumb surface simplified into a few large readable marks. Flat top, compact scalloped cylinder silhouette, no frosting, no chocolate, no plate. Treat the molded shape as an artistic serving choice.

food-tea.png:
A single small turquoise Kazakh tea piala without a handle, broad low bowl with a clearly visible dark amber tea surface, one simple gold ornament accent. Compact bowl silhouette, no saucer, no steam obscuring its outline, no text.

special-kazan.png:
A tiny festive dark teal kazan cauldron with two short side handles, a thick gold rim and a warm glowing center. Friendly magical cooking-pot power-up, clearly round silhouette. No fuse, no realistic explosive device, no food icon badge baked into the art; leave center clean for a programmatic badge.

special-ram.png:
A friendly golden ram-head emblem as a magical game power-up. Symmetrical curled horns, a warm ivory face, gentle confident expression, teal ornamental accents, large readable horn silhouette. A decorative mascot symbol, not cooked food, not a severed anatomical head, no neck stump, no gore, no aggression. No plaque, no text, no background.

obstacle-crumbs.png:
A sparse low flat cluster of warm beige pastry crumbs, 5 to 7 simplified tiny irregular pieces, top-down readable overlay for one board cell. Empty space between crumbs, no plate, no food item, no border. Keep contrast low enough that a food sprite can remain readable above it.

## Gameplay background — separate prompt

Create an original vertical mobile game background for DASTAKHAN, a warm Kazakh food puzzle game. 9:16 portrait composition. A refined dark teal textile tabletop with subtle warm cream and gold ornamental details near the outer edges only, soft warm lighting, understated depth, inviting atmosphere. Keep the central 75 percent extremely calm and low contrast to place an 11 by 11 puzzle board and HUD over it. No game board, no food pieces, no buttons, no text, no logo, no people, no watermark. Decorative illustration, not a screenshot. Opaque background, high quality, 1080 by 1920 or nearest supported portrait size.

## Full-screen style reference — not a working UI

Design a high-fidelity portrait mobile game screen concept for an original Kazakh food match-3 game, DASTAKHAN. Warm premium casual-game art, dark teal and cream palette, restrained gold ornament, friendly dimensional food sprites: baursak dough pillows, white kurt cheese clusters, burgundy kazy slices, triangular samsa, golden zhent cylinders and turquoise tea bowls. A large square ELEVEN-column by ELEVEN-row board dominates the screen, compact goals and remaining-moves HUD above, small pause and help controls. Show a golden ram-head special tile and a cauldron bonus. Food is clearly readable and the screen is uncluttered. Avoid copied branding and excessive decorative frames. This is an art direction reference; exact grid count, readable text and interactions will be implemented in code and must not be inferred as correct from the generated image.

A generated reference may contain the wrong cell count. Code must create exactly 121 cells. Verify actual image dimensions/transparency rather than assuming prompt compliance.

## Rules v2 additions (GAME_SPEC 1.2) — same shared prefix

Use the same shared prefix as above and append exactly ONE description. The game now has 11 food types; any 5–6 appear on one board, but all 11 must stay distinct from each other by silhouette at 28–34 px. LINE_H and LINE_V are no longer drawn as ribbons over food: they use their own sprites with a programmatic base-food badge and code-drawn directional chevrons, so leave a calm central area for the badge.

food-manty.png:
One plump pale steamed manty dumpling, soft warm-ivory dough with a pleated, gathered and pinched top knot, pleats radiating down the upper half. Tall rounded purse silhouette with a flat base. Warm ivory, not cool white, so it differs from kurt; taller and paler than plov. No plate, no steam hiding the outline.

food-shelpek.png:
One thin round golden shelpek flatbread disc seen at a tilted angle, pale golden surface with a few dark toasted blisters and a slightly raised edge, visible thin side. Wide flat oval silhouette. Must not read as a baursak: no puffy pillow, no diamond corners. No plate.

food-chakchak.png:
A glossy honey-amber chak-chak mound shaped like a small rounded pyramid of many small fried dough nuggets, each nugget with a tiny glossy highlight, with one honey drizzle with a drip. Bumpy pyramid silhouette, deep amber colour. Must not read as kurt: many small amber pieces, not three large white balls. No plate.

food-plov.png:
A compact low dome of golden plov rice with short orange carrot strips and one small whole garlic bulb on top, served on a small round cream plate with a cobalt-blue ring. Dome-on-a-brim silhouette. Must not read as samsa, zhent or manty: rounded dome, no triangle, no fluting, no pleats.

food-lagman.png:
A deep terracotta ceramic bowl with a cream ornament band, heaped with thick hand-pulled yellow noodles, red pepper pieces, green vegetable pieces and a few meat cubes above the rim. Deeper and more colourful than the turquoise tea piala, with a heaped top instead of a flat liquid surface. No chopsticks, no steam hiding the outline.

special-uchpuchmak.png:
One golden baked Tatar uchpuchmak pastry lying horizontally: a wide triangular pastry with crimped seams rising to a small round opening on top that shows a hint of filling, two pointed corners reaching far left and right. Wide horizontal silhouette that suggests a row. Leave the front face calm for a programmatic food badge. No arrows, no badge baked in, no plate.

special-kumys.png:
One upright brown leather torsyk flask of kumys: a tall rounded leather body with a narrow neck, cream decorative stitching along the edges, a small gold ram-horn ornament, short leather strap loops, and a white kumys splash crown at the opening. Tall vertical silhouette that suggests a column. Leave the belly calm for a programmatic food badge. No arrows, no badge baked in, no text.

special-besh.png:
A festive round platter of beshbarmak seen from three-quarter view: wide pale noodle sheets, sliced boiled meat and white onion rings heaped low in the centre, on a cream platter with a thick gold rim, a teal dotted ornament ring and a warm gold rim glow. Wide oval platter silhouette. Universal power-up: no food badge, no text, no people, no cutlery.
