# DASTAKHAN

A Kazakh-food browser match-3 game concept: an 11×11 board, falling food pieces and powerful special combinations.

**Status: development starter kit.** This repository contains the complete specification and master prompts. Game code and production assets have not been implemented yet.

All model-facing instructions are **English**. The initial game interface is **Russian**.

## Start on your computer

```bash
git clone https://github.com/timyname/DASTAKHAN.git
cd DASTAKHAN
```

Open the folder in your editor and launch Claude Code. Alternatively use **Code → Download ZIP**, extract it and open the folder. Cloning is preferable for ongoing Git synchronization.

Send this instruction to your coding agent:

> Read CLAUDE.md, docs/GAME_SPEC.md and prompts/09-build-mvp.md. Execute prompt 09 to build and verify the complete local MVP in stages. Begin with the project scaffold and deterministic engine, then UI, assets and levels. Keep docs/STATUS.md current. Use available tools for real, and explicitly report unavailable generation or checks. Keep development instructions in English and the player-facing UI in Russian.

There is no package.json yet. Do not run npm install or npm run dev until the agent creates the application. The agent must update this README with the actual commands once implemented.

## Repository contents

| File | Purpose |
| --- | --- |
| docs/GAME_SPEC.md | Canonical rules, architecture and 15 provisional levels |
| docs/DASTAKHAN_Master_Prompts_EN.txt | Complete English pack in one portable file |
| prompts/01-project.md | Scaffold and vertical slice |
| prompts/02-mechanics.md | Deterministic engine and tests |
| prompts/03-frontend.md | UI, input and animation |
| prompts/04-assets.md | Individual sprite/background generation prompts |
| prompts/05-integration.md | Asset integration and polish |
| prompts/06-levels.md | Levels, tutorials and internal editor |
| prompts/07-backend.md | Later cloud progress and replay validation |
| prompts/08-qa.md | Acceptance checks |
| prompts/09-build-mvp.md | One instruction for the full local MVP |

## Game at a glance

Baursak, kurt, kazy, samsa, zhent and tea. Match 3 to clear; 4 creates a line special; L/T creates a 3×3 cauldron; straight 5+ creates a golden ram. Swap two neighboring ram specials for a board-wide clear. Exact rules are in the specification.

Build the local game with local saves first. Add the backend after a working MVP. Level balance is provisional and requires playtesting.

## Cafe platform demo and mobile redesign

The homepage now introduces DASTAKHAN for cafes. Open `#guest` to try the guest flow, `#demo` for the local restaurant console, and `#play` for the mobile game. The demo uses illustrative restaurant content and browser-local data; its coupons are not real prizes.

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

See [CAFE_ROADMAP.md](docs/CAFE_ROADMAP.md) for the product, economics assumptions and production architecture. The first reward policy is 50% off **one prize dish now**, or that dish free on a later visit. It is not a 50% discount on the whole bill. Real rewards require a secure backend and staff authentication.

Design references: [Emil Kowalski's skills](https://github.com/emilkowalski/skills), the repository's REDESIGN.md, and the available emil-design-eng/mobile-native guidance. This update applies the guidance; it does not claim those skills have been installed on another computer.
