# Projection Models

Source: `shared/materializers/leverage-summary.js`

## Scale-Factor Pattern

All projections use a uniform scale-factor approach:
```
projected = current × (1 / structural_factor)
```

This answers: "If we increased the structural factor to 100%, how much more value would we get?"

## AI-Assisted Projections

### Adoption → 100%

Current adoption 30%, time saved = 1,050 hours:
```
scale = 1 / 0.30 = 3.33×
projected_time_saved = 1,050 × 3.33 = 3,500 hours
```

**Meaning**: If all developers adopted Copilot (not just the current 30%), time saved would increase ~3.3×.

### PR Assist → 100%

Current PR assist rate 45%, time saved = 1,050 hours:
```
scale = 1 / 0.45 = 2.22×
projected_time_saved = 1,050 × 2.22 = 2,333 hours
```

**Meaning**: If every PR was created by a Copilot-active developer (not just 45%), time saved would increase ~2.2×.

### LoC Assist → 100%

Current LoC assist rate 60%, time saved = 1,050 hours:
```
scale = 1 / 0.60 = 1.67×
projected_time_saved = 1,050 × 1.67 = 1,750 hours
```

## Agentic Projections

### Adoption → 100%

Current adoption 10%, time saved = 30 hours:
```
scale = 1 / 0.10 = 10×
projected_time_saved = 30 × 10 = 300 hours
projected_completion_gain = completions × (10 - 1) = 9× more merges
```

### Merge Rate → 100%

Different formula — projects based on eliminating waste:
```
proj_saved = est_duration_factor × time_spent × (1 - yield)
proj_completion_gain = attempts - completions
proj_yield = 1.0
```

Example: 100 attempts, 60 merged (yield = 60%), time_spent = 50h, duration_factor = 2:
```
proj_saved = 2 × 50 × (1 - 0.60) = 40 hours
proj_completion_gain = 100 - 60 = 40 more merges
```

### Repo Coverage → 100%

Current coverage 20% (10 of 50 repos), time saved = 30 hours:
```
scale = 1 / 0.20 = 5×
projected_time_saved = 30 × 5 = 150 hours
projected_completion_gain = completions × (5 - 1) = 4× more merges
```

## Projection Caps

Dashboard-level caps prevent unrealistic projections:
- AI-Assisted: `cfg_projection_cap_ai` (default: 5×)
- Agentic: `cfg_projection_cap_agentic` (default: 9×)

## When Projections Are NOT Generated

A projection is only created when:
- The structural factor is > 0 AND < 1
- The relevant data is available

If adoption = 100%, no adoption projection is generated (already at maximum).
If no PR data exists, no PR assist projection is generated.
