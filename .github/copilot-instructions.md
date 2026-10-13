# Copilot instructions for Space Pirates Cyber Synopsis

## Project overview
This repository contains a Vite-based browser game called Neon Corsair and a small set of supporting deployment and leaderboard files. The main customer-facing experience is the game in the root of the repository: `index.html`, `style.css`, and `script.js`.

## Primary code paths
- `index.html`: page structure and game shell
- `script.js`: game loop, collisions, score handling, keyboard/touch controls, and leaderboard client logic
- `style.css`: visual design, HUD, overlays, responsive layout, and arcade styling
- `leaderboard/`: leaderboard backend or supporting package, if present
- `template.yaml`, `deploy.sh`, and related deployment assets: AWS packaging/deploy files; keep them consistent with the app if deployment-related changes are required

## Working rules
- Keep changes small, targeted, and consistent with the existing arcade game style.
- Prefer vanilla JavaScript and browser APIs over introducing frameworks or build tooling unless the task explicitly requires it.
- Preserve the game’s current accessibility patterns: button labels, aria attributes, and overlay messaging should remain understandable for assistive technologies.
- Respect the existing `VITE_LEADERBOARD_API_URL` pattern for leaderboard configuration; do not hardcode backend URLs into the browser code.
- When editing deployment or packaging files, keep names, paths, and archive content aligned with the actual project structure.
- Do not manually modify generated artifacts in `dist/`, `target/`, `node_modules/`, or zip archives unless the task explicitly targets those outputs.

## Validation
- After front-end or gameplay changes, validate with the repo’s existing build command:
  - `npm run build`
- If a task is specifically about the Java/Testcontainers examples in this repository, treat those folders as the active scope and avoid broad unrelated edits.

## Scope boundaries
- This repo includes extra example/sample folders and generated artifacts. Treat them as out of scope unless the user asks for work in those areas.
- Do not refactor the game into a framework or rewrite the project structure unless explicitly requested.
