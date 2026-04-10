# Dashboard Status

This file is the canonical status snapshot for dashboard readiness and migration progress.

## Current State

| Dashboard | Path | Data collection target(s) | Modular source | Tests | Build wiring | Status |
|---|---|---|---|---|---|---|
| AI-Assisted Efficiency | `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/` | `ai-assisted-efficiency` | Yes | Yes | Yes | Ready |
| AI-Assisted Structural | `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/` | `ai-assisted-structural`, `pr-review-structural` | Partial | Partial | Yes | In progress |
| AI-Assisted Element | `BVE-dashboards-for-ai-assisted-coding/dashboard/element/` | File upload (same data as efficiency/structural) | No | No | No | Ready (standalone) |
| Agentic Efficiency | `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/` | `agentic-efficiency` | Yes | Yes | Yes | Ready |
| Agentic Element | `BVE-dashboards-for-agentic-ai-coding/dashboard/element/` | File upload (same data as agentic efficiency) | No | No | No | Ready (standalone) |
| Integrated Leverage | `dashboard/integrated/` | File upload (AI-assisted + agentic data) | No | No | No | Ready (standalone) |

## Notes by Dashboard

### AI-Assisted Efficiency

- Production `index.html` exists and is directly usable.
- Modular source and tests exist under `src/` and `tests/`.
- Build and validation flows are wired through the root scripts.

### AI-Assisted Structural

- Production `index.html` exists.
- Query targets and output directories are already registered.
- Documentation and build-system support exist, but modular extraction and test coverage are still incomplete.

### AI-Assisted Element

- Production `index.html` exists as a self-contained HTML file with in-browser JSX transpilation.
- Loads data via file upload — uses the same JSON files as the efficiency and structural dashboards.
- No `run-query.sh` target needed; no `data/` output directory.
- Shows leverage as a rectangle (dev-hours × completions) with structural factor projections and developer search overlay.

### Agentic Efficiency

- Production `index.html` exists and is directly usable.
- Modular source and tests exist under `src/` and `tests/`.
- Query target, workspace wiring, and build integration are present.

### Agentic Element

- Production `index.html` exists as a self-contained HTML file with in-browser JSX transpilation.
- Loads data via file upload — uses the same JSON files as the agentic efficiency dashboard.
- No `run-query.sh` target needed; no `data/` output directory.
- Uses an additive leverage model with duration-based and LoC-based estimation methods.

### Integrated Leverage

- Production `index.html` at `dashboard/integrated/`.
- Loads data via file upload from both AI-Assisted and Agentic source files.
- No `run-query.sh` target needed; no `data/` output directory.
- Mode selector: Current Only, Unimproved, Current, Projected (Conservative), Projected (Aggressive).
- Clickable element sub-rectangles navigate to the element dashboards.

## Still Pending

- Complete the structural dashboard migration to the same modular/tested pattern as the two efficiency dashboards.
- Continue build and test hardening where new dashboards or schemas are introduced.
- Element and integrated dashboards are standalone HTML (no modular source, tests, or build wiring yet). Consider migrating if the dashboards grow in complexity.

## Related Docs

- [getting-started.md](getting-started.md)
- [data-collection.md](data-collection.md)
- [development.md](development.md)
- [BUILD-SYSTEM.md](BUILD-SYSTEM.md)
