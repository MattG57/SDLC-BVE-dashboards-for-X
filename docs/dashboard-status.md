# Dashboard Status

This file is the canonical status snapshot for dashboard readiness and migration progress.

**Last reviewed:** 2026-03-29

## Current State

| Dashboard | Path | Data collection target(s) | Modular source | Tests | Build wiring | Status |
|---|---|---|---|---|---|---|
| AI-Assisted Efficiency | `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/` | `ai-assisted-efficiency` | Yes | Yes | Yes | Ready |
| AI-Assisted Structural | `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/` | `ai-assisted-structural`, `pr-review-structural` | Partial | Partial | Yes | In progress |
| Agentic Efficiency | `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/` | `agentic-efficiency` | Yes | Yes | Yes | Ready |

## Notes by Dashboard

### AI-Assisted Efficiency

- Production `index.html` exists and is directly usable.
- Modular source and tests exist under `src/` and `tests/`.
- Build and validation flows are wired through the root scripts.

### AI-Assisted Structural

- Production `index.html` exists.
- Query targets and output directories are already registered.
- Documentation and build-system support exist, but modular extraction and test coverage are still incomplete.

### Agentic Efficiency

- Production `index.html` exists and is directly usable.
- Modular source and tests exist under `src/` and `tests/`.
- Query target, workspace wiring, and build integration are present.

## Still Pending

- Complete the structural dashboard migration to the same modular/tested pattern as the two efficiency dashboards.
- Continue build and test hardening where new dashboards or schemas are introduced.

## Related Docs

- [getting-started.md](getting-started.md)
- [data-collection.md](data-collection.md)
- [development.md](development.md)
- [BUILD-SYSTEM.md](BUILD-SYSTEM.md)
