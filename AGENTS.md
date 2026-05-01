# NMF Curator Studio Agent Notes

NMF Curator Studio owns the NMF curator and related marketing/runtime surfaces after the 2026-05-01 repo rename.

## Canon And Coordination

- Before dispatching or changing product behavior, consult BD canon: `bd memories nmf-curator-studio` and `bd memories project_repo_canonical_nmf_curator_studio_2026_05_01`.
- Coordinate across all three stores: BD beads for durable state, GitHub Projects/issues for execution tracking, and `cross_thread/` ferries for thread-to-thread handoff.
- Keep ferries short, cite exact PRs/SHAs, and include any open Build-3 or Strategy handoff.
- `bd setup codex` integration is expected after the Codex-E fire-go; until then, preserve this file as the repo-local standing instruction.

## Lane

- Strategy owns product disposition and canonical naming.
- Build-3 owns TSX, Workers/API integration, Vercel, domains, and runtime verification.
- Design owns visual DNA and aesthetic specs.
- Codex-B owns non-runtime repo hygiene and migration docs unless directly delegated otherwise.
- Build-2 is the sole DB writer. Do not run production DB DDL/DML here.

## Guardrails

- Do not reintroduce pre-rename repo identifiers except in historical migration notes.
- Use canonical repo name `nmf-curator-studio` for new docs, scripts, and CI labels.
- Do not run production ingest or DB mutation scripts from this repo.
- Self-QE Part A: verify changed files and cite command output before reporting done.
- Self-QE Part B: use Gemini second-eye when requested for cross-product consistency review.
