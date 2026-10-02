# REDESIGN — DASTAKHAN Mobile Game Polish

<!-- CODING AGENT: Read this file before your next design or frontend task. The owner requested a substantial mobile-only redesign, not a color-only refresh. Implement this brief against the current codebase. -->

Status: owner-requested redesign brief, October 2, 2026.
Instruction language: English. Player-facing interface: Russian.

## Priority and scope

Read this file, CLAUDE.md, AGENTS.md and docs/GAME_SPEC.md before editing.
This brief supersedes earlier frontend instructions about a desktop-specific layout and ornamental styling. Preserve the 11×11 board, deterministic engine, scoring, saves, all special combinations and level rules. Do not rewrite working game logic to achieve a visual redesign.

Inspect the current branch and local uncommitted changes first. The owner has already run a playable build on a computer; the remote repository may not yet contain that code. If source is missing, say so and implement from the existing build prompt only when appropriate. Do not claim a visual redesign was applied when you only edited this brief.

Aim for premium mobile-game craftsmanship. “Game of the year” is an ambition for quality, not a claim or a reason to add distracting effects.

## Skills to activate

Check which skills are actually installed. These are skill names/capability requests, not npm package names or verified installation URLs. Do not invent install commands or pretend missing skills are available.

| Priority | Skill | Assignment |
| --- | --- | --- |
| Core | apple-design | Direct manipulation, velocity-aware springs, spatially consistent transitions, restrained materials, readable hierarchy |
| Core | emil-design-eng | Component polish, instant press feedback, disciplined spacing, optical alignment, short purposeful transitions |
| Core | mobile-native | Safari viewport, safe areas, touch/scroll behavior, standalone PWA behavior, actual-device verification |
| Core | frontend-design | Coherent game art direction, strong composition, distinctive screens and consistent design tokens |
| Validation | webapp-testing | Reproducible browser tests, screenshots, touch flows and regressions |
| Assets, when available | imagegen | Consistent food sprites, ram and cauldron art, quiet background; verify actual outputs |

Use the explicit requirements in this document as the fallback for missing skills. Do not block all development waiting for a skill. Use one animation library, Motion for React, if compatible with the existing project. Motion is a library, not an Apple SDK or proof of native performance. Do not also add GSAP and React Spring without a demonstrated need.

Reference documentation:
- https://motion.dev/docs/react
- https://motion.dev/docs/react-transitions
- https://motion.dev/docs/react-motion-config
- https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- https://github.com/anthropics/skills

## Review of the owner's current screenshots

The supplied photographs show a desktop layout with diagonal background stripes, repeated gold borders/ornamental separators, a large logo card, four broad menu buttons, seven columns of level tiles, and a two-column text-heavy combination reference. Some introductory tiles appear empty after the six food icons. Investigate those empty entries; do not assume the cause without inspecting code.

Static photographs do not demonstrate animation quality or performance.

| Current presentation | Required redesign | Purpose |
| --- | --- | --- |
| Full-screen diagonal stripes | Quiet deep-teal surface with restrained edge ornament | Keep attention on food and gameplay |
| Repeated gold outlines and nested cards | Tonal surfaces, fewer borders, consistent corner radii | Clearer hierarchy and less noise |
| Oversized title card and equally weighted actions | Compact identity, appetizing food arrangement, one dominant Continue/Play action | Obvious next action |
| Seven-column level grid | Three-column mobile level grid, stars and clear current-level state | Comfortable touch selection |
| Dense two-column rule document | Single-column concise cards with interactive “Show” demonstrations | Teach through motion |
| Empty decorative tiles | Correct assets or remove unintended placeholders | Finished visual quality |

## Device contract — mobile only

Primary targets: iPhone 14 Pro, iPhone 14 Pro Max and similar portrait phones.
Validate CSS viewport widths 360, 375, 390, 393, 414, 430 and 440; explicitly test 393×852 and 430×932 as layout presets. Viewport presets are not proof of physical-device behavior. Browser controls, display scaling and standalone mode change available height.

Use one mobile composition. On larger screens center the same app at max-width 440px over a quiet outer background; do not stretch the game into a desktop dashboard. Do not reject visitors based on user-agent strings.

Portrait is the preferred gameplay format. For landscape/short screens provide a usable constrained layout or a calm rotate-to-portrait message; never silently clip controls. Do not claim browser orientation locking works without verifying support.

Use width=device-width, initial-scale=1, viewport-fit=cover; a dynamic-height app shell; and safe-area-inset values with fallbacks. Respect Dynamic Island, Safari chrome and the home indicator. Never hardcode notch padding by phone model. Never disable user zoom globally.

The gameplay board and essential HUD should fit the normal portrait view without page scrolling. Level selection and help may scroll in controlled containers. Set touch-action:none only on the game gesture surface, not all content. Use proper native scroll for documents and sheet content.

## Visual direction

Mood: a premium, warm Kazakh feast with calm iOS-inspired interface behavior.
Retain the identity of DASTAKHAN; avoid generic white settings-app styling.

Palette starting points:
- Deep teal background: #123C36
- Raised teal surface: #204D44
- Warm cream: #FFF4DF
- Honey gold accent: #E6B65A
- Terracotta secondary accent: #B75C46

Use gold selectively for primary action, current level and celebration. Create contrast through surface tones and spacing, not an outline around everything. No animated full-screen background. No glass on 121 cells. If used, translucent material belongs on a small navigation surface or a paused sheet and must have an opaque fallback.

Use system-ui/-apple-system for controls and body text. A distinctive display font is allowed for the logo only if legible and fast to load. Common body text 16px; reduce only short secondary labels deliberately. Primary controls at least 44×44 CSS px, primary buttons around 52–56px tall.

Spacing scale: 4, 8, 12, 16, 24, 32. Corners: consistent tokens around 12px for small controls, 20px for cards and 28px for sheets; tune by optical review, not random per-component values. Avoid excessive pill buttons, thick borders, giant shadows and tiny explanatory text.

Food should have bold silhouettes, consistent lighting, camera, optical scale and generous contrast. Replace weak placeholder art with a unified set when generation is available. Do not pretend existing fallback SVGs are final generated art.

## Screen composition

Home:
- Compact wordmark and a restrained food/ram composition.
- One dominant Continue button when progress exists, otherwise Play.
- Current level and progress as concise supporting information.
- Secondary Levels and Combinations actions; a small accessible Settings control.
- No unnecessary registration/storage disclaimer dominating the bottom.

Levels:
- Three columns with generous hit areas.
- Distinguish current, completed and locked states by structure/iconography as well as color.
- Auto-position the current level when sensible; do not animate a long tour through all levels.
- Keep tutorials discoverable without a second wall of buttons.

Gameplay:
- Compact pause/level/moves HUD; food objectives directly below.
- 11×11 board as wide as practical; roughly 8px side margins where safe.
- With 393px width and 16px total horizontal margins, pitch is about 34.3px; at 430px it is about 37.6px. Borders/gaps reduce actual art size. Do not claim every cell has a 44px target.
- Compensate with recognizable silhouettes, minimal gaps, visible selection and both swipe and tap-two-neighbors input. Never expand neighboring hitboxes so they overlap ambiguously.
- Keep rules/help out of the primary playing area.

Combinations:
- Single-column cards with a visual recipe and one short explanation.
- A Show action replays a deterministic mini-board demonstration.
- Demonstrations are isolated from the actual campaign state and saves.

Settings/help:
- Accessible bottom sheets with backdrop, close button, focus management and scroll containment.
- A sheet tracks the finger continuously during drag, supports cancellation and settles from its current position.
- Provide non-gesture alternatives to every dismiss action.

Victory/defeat:
- Celebrate a win clearly, then show a prominent next action.
- Restrained defeat treatment and instant access to replay.
- Do not replay an extended celebration every time a panel opens.

## Motion system

Create central motion tokens; do not scatter unrelated durations and easing curves.

| Interaction | Starting target |
| --- | --- |
| Press feedback | Start on pointerdown; scale to 0.97 with a quick 80–120ms response; commit on release and allow cancellation |
| Screen navigation | 180–240ms, short directional displacement plus opacity |
| Sheet settling | A restrained spring around a 250–350ms visual response, tuned on device |
| Tile swap | 120–160ms |
| Invalid swap | Return promptly; no move/score change |
| Tile removal | 140–180ms |
| Falling | Distance-aware, roughly 100–280ms, synchronized by wave |
| Line sweep | 200–260ms |
| Cauldron blast | 240–320ms |
| RAM selection | 350–450ms |
| RAM+RAM | 600–800ms maximum prominent effect before returning to play |

These are starting design targets, not fixed promises about spring settling time. Profile and tune them. Motion must explain causality: selection → swap → match → effect → fall → refill → goal update.

Springs belong primarily to sheets and direct-manipulation UI. During a drag, the surface follows the pointer 1:1; apply spring settling after release, carrying velocity where supported. Avoid lagging the dragged surface behind the finger.

Menus/sheets can be interrupted and reversed without snapping. This does NOT override game safety: prevent additional board moves while a move/cascade resolves. Keep safe pause/navigation feedback responsive and preserve stable-state saves.

Use transform and opacity for frequent animation. Avoid transition:all, permanent will-change on every element, per-frame React state for all tiles, large animated blur filters and hundreds of unbounded particles. One stable tile identity must survive motion.

Parallelize independent effects within the same wave. Do not serialize 50 identical explosions into a long delay. Do not create an artificial pause after every cascade. Match visual hit areas to actual engine outcomes.

Reduced motion: remove shake, bounce and large travel; retain short opacity/highlight feedback and understandable game events. Respect reduced transparency where supported. Haptics are optional and capability-dependent; never promise iPhone Safari vibration. Synchronize supported audio with actual effects, provide mute, and unlock audio only after user interaction.

## Performance and validation

Target consistent frame pacing and responsive touch, not a decorative animation count. Aim for 60fps on target hardware; do not promise 120fps or claim measurement from screenshots.

Profile a full-board RAM+RAM effect and a long cascade. Record device/browser, test scenario and observed frame-time/long-task evidence. Do not turn development metrics into fake user-facing claims. Pause nonessential animation/audio when the page is hidden.

Test:
- Both target portrait presets plus narrow and short cases.
- Safari/WebKit where available, and Chromium for comparison.
- Fast repeated taps/swipes, pointer cancellation and accidental second-finger contact.
- Open/close/re-grab sheets; scrolling inside a sheet must not drag the board.
- Browser controls expanded/collapsed; standalone PWA if implemented.
- Reload after a stable move; tab hiding mid-cascade; no duplicate scoring.
- Missing art, reduced motion, increased text size and mute.
- Every existing engine test still passes.

Physical iPhone review is required for the final touch/performance judgment. If unavailable, state exactly what remains unverified. Never describe emulator results as real-device results.

## Execution and delivery

1. Inspect current source and record a concise before-state review.
2. Establish tokens and one polished mobile gameplay screen plus home.
3. Apply the visual language to levels, help, settings and results.
4. Implement coordinated motion and integrate consistent art.
5. Run regression checks and inspect actual screenshots; fix clipping and readability.
6. Update docs/STATUS.md with completed work, actual checks and remaining device validation.

Do not stop after writing a proposal. When asked to execute this redesign, implement it in the existing project, preserving unrelated changes. Keep commits reviewable. If the source is missing from the current checkout, clearly report that blocker rather than overwriting the owner's unpushed build.

Deliver actual code changes, screenshots, run commands and verification results. Explain what improved and what remains untested. No fabricated images, tests, deployment links or performance numbers.

