# Vendored: patch-gg/pixelfx

Upstream: https://github.com/patch-gg/pixelfx
Commit:   5294518ce7c72e48b6100a744596e0acf57f2826 (2026-11-12, v0.3.1)
License:  MIT (see LICENSE and NOTICE.md in this directory)

This is a copy of the upstream repository, taken so the game runs from static files with no install step.

## What is here

- `src/core`, `src/fx` — the engine and all 244 effects, used by the game at runtime.
- `tools/` — the upstream render / check / list / sheet tools. They work in place:
  `node vendor/pixelfx/tools/render.mjs fire/torch`
- `docs/AUTHORING.md`, `docs/CATALOG.md` — the effect contract and the catalog.
- `skills/pixelfx` — the Claude Code skill (also installed at `.claude/skills/pixelfx`).
- `gallery/` — the upstream gallery page (`node vendor/pixelfx/tools/serve.mjs`, then `/gallery/`).

## What was left out

- `gallery/fonts/PatchPixel-Regular.woff2` — Patch's own typeface, not covered by the MIT license. The gallery
  falls back to a system font without it.
- `docs/readme/*.gif` — 12 MB of README animations.
- `package-lock.json`, `.github/`, `.claude-plugin/` — not needed here.

## Local changes

One small patch, so a game can dress the stock skeleton in its own costumes:

- `src/core/rig.js`: `posed()` also returns `part` (an `Int8Array`: which body part each pixel belongs to), and the
  part table is exported as `PARTS`.
- `src/core/index.js`: re-exports `PARTS` and `WEAPONS` from `rig.js`.

Nothing else differs from upstream. To refresh: copy the same paths from a new checkout and re-apply the patch
(`git diff` against upstream shows it is about ten lines).
