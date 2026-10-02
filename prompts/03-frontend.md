# Master Prompt 03 — Frontend, Mobile Input and Animation

You are the frontend/game UI developer. Use frontend-design if available. Build DASTAKHAN on the existing game-core. The UI must not independently calculate matches, score or victory.

Art direction: appetizing dimensional casual-game food, dark teal #143F3A, cream #FFF4DF, gold #E6B65A, terracotta #B75C46. Restrained Kazakh ornamental accents on frame/background; calm surfaces behind pieces. Original branding and characters. Avoid a corporate-dashboard appearance.

Screens: start; 15-level selection; gameplay; pause/settings; win; lose; combination guide; separate tutorial scenes. Defeat offers replay, not purchased moves. Settings: sound, music if available, reduced motion. Win shows stars, goals and next level. Player-facing copy is Russian, model-facing documentation English.

Mobile layout:
- Compact upper HUD: back/pause, level, moves remaining.
- Objective icons and remaining counts; score is secondary.
- Square 11×11 board uses nearly all available width.
- Short hint/combo label and help below.
- Safe-area insets, 100dvh, no horizontal overflow or browser-chrome overlap.
- On short screens reduce decoration before compromising board visibility.
- Desktop: centered board with reasonable maximum size and side goals/help.

At 390px viewport and 16px total side margins, board width is about 374px and cell pitch about 34px. Do not promise 44px for each of 11 cells. Support both swipe and tap-first/tap-neighbor, strong selection and cancellation. Outside-board controls must have at least 44×44 CSS px targets. Avoid large cell gaps; evaluate real touch accuracy on narrow phones.

Use Pointer Events and pointer capture. Swipe threshold: 0.25 cell pitch. Dominant axis selects direction; one gesture produces one swap. Ignore additional pointers. Set touch-action:none only on the board; do not globally disable page zoom.

Keyboard: arrows move focus, Enter selects/swaps, Escape cancels. Make objective summaries accessible without announcing 121 changes individually.

Renderer maintains the visual scene and plays core events. Tile IDs remain stable through falls. Avoid recreating all pieces each frame; animate transform/opacity and put particles on a separate layer. Never show the final board before intermediate events have played.

Configurable timings: swap 140ms, rejection return 140ms, removal 160ms, fall 90ms + 25ms per cell capped at 280ms, LINE sweep 240ms, BOMB 280ms, RAM beams 450ms, RAM+RAM 700ms. Parallelize effects within a wave rather than serially waiting through dozens of blasts.

LINE emits golden trails in both directions along the full affected row/column. BOMB has a warm rounded flash but the actual affected area stays 3×3. RAM+RAM brings emblems together, expands a golden ring across the board and turns pieces into sparks/confetti. No gore/aggression. Reduced motion removes shakes/traveling particles and retains short highlights. Avoid frequent bright flashes.

Enable audio only after user interaction; support mute and pausing when hidden. If sound files do not exist, implement brief Web Audio synthesized sounds and disclose that choice.

Check 360×800, 390×844, 430×932, 768×1024, 1440×900 and short landscape. Smooth phone performance is the goal; do not claim measured 60fps without measurement.

Deliver functional screens and controls. Capture real screenshots and inspect clipping, overlap and console errors. Browser emulation is not a physical iPhone test.
