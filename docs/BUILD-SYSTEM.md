# Build System Documentation

## Overview

This repository uses a **centralized build system** that enforces consistency across all BVE dashboards. Each dashboard can be developed modularly with tests, then built into a single-file HTML for deployment.

## Architecture

```
SDLC-BVE-dashboards-for-X/
├── scripts/                     # Build & validation scripts
│   ├── build-dashboard.js       # Build single dashboard
│   ├── build-all.js             # Build all dashboards
│   ├── validate-structure.js    # Validate dashboard structure
│   └── verify-all-calculations.js # Run all verification scripts
├── build-config/
│   └── dashboard-config.js      # Central configuration
├── BVE-dashboards-for-*/        # Dashboard packages
│   └── dashboard/*/
│       ├── src/                 # Modular source (development)
│       ├── tests/               # Unit tests
│       ├── dist/                # Built output (deployment)
│       └── index.html           # Original (preserved)
└── package.json                 # Root package with workspaces
```

## Build Process

### Single Dashboard

```bash
# Build specific dashboard
npm run build:ai-assisted

# Or use the script directly
node scripts/build-dashboard.js BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency
```

### All Dashboards

```bash
# Build everything
npm run build
```

### What Happens During Build

1. **Read Configuration** - Load dashboard config from `build-config/dashboard-config.js`
2. **Bundle JavaScript** - Use esbuild to bundle all `src/` modules
3. **Bundle CSS** - Combine inline styles (if separate files exist)
4. **Inject CDN Links** - Add React, Highcharts, Primer CSS from CDNs
5. **Generate HTML** - Merge template + bundled JS/CSS
6. **Write Output** - Save to `dist/index.html`
7. **Validate** - Ensure output is valid single-file HTML

### Fallback Behavior

If modular source (`src/main.js`) doesn't exist yet:
- ✅ Copies existing `index.html` to `dist/`
- ⚠️ Warns that modularization is pending
- 💡 Suggests next steps for extraction

This allows **gradual migration** - dashboards work immediately while we extract modules.

## Configuration

### Dashboard Config (`build-config/dashboard-config.js`)

```javascript
export const dashboardConfig = {
  common: {
    externals: ['react', 'react-dom', 'highcharts'],
    cdnLinks: { /* CDN URLs */ },
    output: { format: 'iife', minify: true }
  },
  dashboards: {
    'ai-assisted-coding-efficiency': {
      path: 'BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency',
      name: 'AI Assisted Coding — Efficiency Dashboard',
      entry: 'src/main.js',
      template: 'src/template.html',
      output: 'dist/index.html',
      modules: [ /* list of source files */ ]
    }
  }
};
```

### Adding a New Dashboard

1. Add entry to `dashboardConfig.dashboards`
2. Create directory structure
3. Run `npm run validate`
4. Build with `npm run build`

## Structure Validation

```bash
# Validate all dashboards
npm run validate
```

**Checks:**
- ✅ Required directories exist (`src/`, `tests/`, `dist/`)
- ✅ Required files exist (`package.json`, `README.md`)
- ✅ Required npm scripts defined (`test`, `build`)
- ⚠️ Warns if modules not extracted yet
- ⚠️ Warns if no test files found

## Calculation Verification

```bash
# Run all verification scripts
npm run verify:all
```

Runs `verify_math.cjs` for each dashboard to validate:
- Calculation accuracy
- Method comparison
- Expected outputs

## Testing

```bash
# Run all tests across all dashboards
npm test

# Run tests for specific dashboard
npm run test:ai-assisted
```

Uses **npm workspaces** to run tests in each dashboard package.

## Development Workflow

### Option 1: Modular First (Recommended for New Dashboards)

1. Create modular source in `src/`
2. Write tests in `tests/`
3. Run `npm test` until passing
4. Run `npm run build`
5. Deploy `dist/index.html`

### Option 2: Extract from Monolith (Current Migration)

1. Start with working `index.html`
2. Extract pure functions to `src/core/`
3. Write tests for extracted logic
4. Gradually extract components
5. Run `npm run build` to generate new version
6. Compare original vs built output

## Build Output

### Development Build
```bash
NODE_ENV=development npm run build:ai-assisted
```
- Unminified code
- Readable formatting
- Inline source comments

### Production Build (Default)
```bash
npm run build:ai-assisted
```
- Minified JavaScript
- Optimized CSS
- No source comments
- Single-file HTML (~100-200 KB)

## External Dependencies

**Always loaded via CDN** (never bundled):
- React 18 (production UMD)
- React DOM 18 (production UMD)
- Highcharts 11.4.8
- Highcharts Accessibility Module
- Primer CSS 21.3.1

**Bundled into output**:
- All application code from `src/`
- Core business logic
- Data processors
- Utilities

## File Size Optimization

Current dashboard sizes:
- **AI Assisted Coding Efficiency**: ~120 KB (including inline JS/CSS)
- Target for all dashboards: < 200 KB

**Optimization techniques:**
1. Minification (esbuild)
2. Tree shaking (unused code removal)
3. CDN for heavy libraries (React, Highcharts)
4. Inline small assets only

## Best Practices

1. **Keep dashboards independent** - No cross-dashboard imports
2. **Test before building** - All tests should pass
3. **Validate structure** - Run `npm run validate` regularly
4. **Version control dist/** - Commit built output for easy deployment
5. **Document assumptions** - Explain calculation methods in comments

## Migration Checklist

For each dashboard:
- [ ] Directory structure created
- [ ] Core modules extracted to `src/core/`
- [ ] Tests written with >80% coverage
- [ ] Build config added to `dashboard-config.js`
- [ ] Build script tested (`npm run build`)
- [ ] Output validated (opens in browser, features work)
- [ ] Verification script passing
- [ ] README updated
