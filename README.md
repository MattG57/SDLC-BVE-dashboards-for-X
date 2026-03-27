# SDLC BVE Dashboards for X

Business Value Engineering (BVE) dashboards for measuring GitHub Copilot and SDLC metrics impact across organizations.

## 🎯 Overview

This repository contains a suite of **single-file HTML dashboards** that run entirely in the browser. Each dashboard is:

- ✅ **Self-contained** - No server required, opens directly in browser
- ✅ **Testable** - Modular source with comprehensive unit tests
- ✅ **Validated** - Calculation verification scripts included
- ✅ **Consistent** - Centralized build system enforces standards

## 📊 Dashboards

### AI Assisted Coding
Measures GitHub Copilot impact on developer productivity.

#### 1. Efficiency Dashboard
**Path:** `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/`

Estimates time and cost savings from Copilot IDE features:
- Interactions-based calculation
- LoC-based calculation  
- Manual daily percentage
- Labor cost savings

**Status:** ✅ Migrated with modular source + tests

#### 2. Structural Dashboard
**Path:** `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/`

Assesses organizational adoption patterns:
- Adoption completeness
- Usage consistency
- Output correlation

**Status:** 🔄 Pending migration

### Agentic AI Coding
Measures autonomous coding agent productivity.

#### Efficiency Dashboard
**Path:** `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/`

Estimates human-equivalent time saved by Copilot Coding Agent:
- Duration-based calculation (merged PRs)
- LoC-based calculation
- PR quality metrics
- Turbulence analysis

**Status:** 🔄 Pending migration

## 🚀 Quick Start

### View a Dashboard

```bash
# Option 1: Open directly
open BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html

# Option 2: Build to dist/ first
npm run build:ai-assisted
open BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/dist/index.html
```

Upload your data JSON via the browser interface.

### Collect Data

```bash
# Set credentials
export GITHUB_TOKEN="your_token_here"

# Run query script
cd BVE-dashboards-for-ai-assisted-coding/data/queries
ENTERPRISE="my-enterprise" DAYS=28 ./ai-assisted-coding.sh > my-data.json
```

### Run Tests

```bash
# Install dependencies (including devDependencies for testing)
npm install --include=dev

# Run all tests
npm test

# Run tests for specific dashboard
npm run test:ai-assisted
```

### Build Dashboards

```bash
# Build all dashboards
npm run build

# Build specific dashboard
npm run build:ai-assisted

# Validate structure
npm run validate

# Verify calculations
npm run verify:all
```

## 🏗️ Architecture

```
SDLC-BVE-dashboards-for-X/
├── scripts/                        # Centralized build scripts
│   ├── build-dashboard.js          # Build single dashboard
│   ├── build-all.js                # Build all dashboards
│   ├── validate-structure.js       # Validate structure
│   └── verify-all-calculations.js  # Verify math
├── build-config/
│   └── dashboard-config.js         # Central configuration
├── docs/
│   └── BUILD-SYSTEM.md             # Build system documentation
├── BVE-dashboards-for-ai-assisted-coding/
│   ├── dashboard/
│   │   ├── efficiency/             # ✅ Migrated
│   │   │   ├── src/                # Modular source
│   │   │   ├── tests/              # Unit tests
│   │   │   ├── dist/               # Built output
│   │   │   └── index.html          # Original
│   │   └── structural/             # 🔄 Pending
│   ├── data/
│   │   ├── queries/                # Data collection scripts
│   │   ├── schemas/                # JSON schemas
│   │   └── examples/               # Sample data
│   └── README.md
├── BVE-dashboards-for-agentic-ai-coding/
│   └── (similar structure)         # 🔄 Pending
└── package.json                     # Root with workspaces
```

## 📚 Documentation

- **[Build System](docs/BUILD-SYSTEM.md)** - Build process, configuration, workflows
- **[AI Assisted Coding](BVE-dashboards-for-ai-assisted-coding/README.md)** - Dashboard usage
- **[Efficiency Dashboard](BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/README.md)** - Architecture details
- **[Migration Status](BVE-dashboards-for-ai-assisted-coding/docs/MIGRATION-STATUS.md)** - Current progress

## 🧪 Testing & Validation

### Unit Tests
```bash
npm test                    # All dashboards
npm run test:ai-assisted    # Specific dashboard
```

**Coverage:** 50+ tests, >80% code coverage

### Calculation Verification
```bash
npm run verify:all          # All verification scripts
cd BVE-dashboards-for-ai-assisted-coding/data
node verify_math.cjs        # Specific dashboard
```

### Structure Validation
```bash
npm run validate            # Check all dashboards
```

Validates:
- Required directories exist
- Required files present
- npm scripts defined
- Tests exist

## 🔧 Development Workflow

### For New Dashboards

1. Add configuration to `build-config/dashboard-config.js`
2. Create directory structure
3. Develop modular source in `src/`
4. Write tests in `tests/`
5. Run `npm test` until passing
6. Run `npm run build`
7. Deploy `dist/index.html`

### For Existing Dashboards (Migration)

1. Start with working `index.html`
2. Extract pure functions to `src/core/`
3. Write tests for extracted logic
4. Run tests to validate
5. Gradually extract components
6. Build and compare outputs

## 📦 Build System

### Centralized Configuration
All dashboards share:
- Common CDN dependencies (React, Highcharts, Primer CSS)
- Build settings (minification, format)
- Validation rules
- Output structure

### Build Process
1. Bundle modular source with esbuild
2. Inject CDN links
3. Generate single-file HTML
4. Output to `dist/`

**Result:** Deployable single-file HTML (~100-200 KB)

### Fallback
If modular source doesn't exist yet:
- Copies existing `index.html` to `dist/`
- Allows gradual migration

See **[Build System Documentation](docs/BUILD-SYSTEM.md)** for details.

## 🎯 Migration Status

| Dashboard | Structure | Core Logic | Tests | Build | Status |
|-----------|-----------|------------|-------|-------|--------|
| AI Assisted - Efficiency | ✅ | ✅ | ✅ | ✅ | **Complete** |
| AI Assisted - Structural | ✅ | ⏳ | ⏳ | ⏳ | Pending |
| Agentic - Efficiency | ⏳ | ⏳ | ⏳ | ⏳ | Pending |

**Legend:** ✅ Complete | ⏳ Pending | 🔄 In Progress

## 🛠️ Scripts Reference

| Command | Description |
|---------|-------------|
| `npm install --include=dev` | Install all dependencies (including test frameworks) |
| `npm test` | Run all tests |
| `npm run build` | Build all dashboards |
| `npm run build:ai-assisted` | Build AI Assisted dashboards |
| `npm run validate` | Validate dashboard structure |
| `npm run verify:all` | Verify calculations |
| `npm run lint` | Lint JavaScript files |
| `npm run format` | Format code with Prettier |

## 📋 Requirements

- **Node.js:** >= 18.0.0
- **npm:** >= 9.0.0
- **Browser:** Modern browser (Chrome, Firefox, Safari, Edge)

## 🤝 Contributing

1. **Add tests first** - Write tests for new logic
2. **Keep functions pure** - No side effects in core modules
3. **Update docs** - JSDoc comments + README updates
4. **Run validation** - `npm run validate && npm test`
5. **Build before commit** - Ensure `dist/` is up to date

## 📄 License

*(Add license information)*

## 📞 Support

*(Add support/contact information)*

---

**Built with:** React 18, Highcharts 11, Primer CSS, esbuild, Vitest
