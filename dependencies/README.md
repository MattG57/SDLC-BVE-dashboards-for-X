# Dashboard Dependencies & Schema Mapping

This document provides a comprehensive view of how data schemas map to each dashboard in the BVE dashboards suite.

## Schema Dependency Tree

### AI-Assisted Coding Efficiency Dashboard
```
BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/
├── GitHub Copilot Metrics API Schemas
│   ├── Team-level Schema
│   │   └── https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema#team-level-schema-example
│   └── User-level Schema
│       └── https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema#user-level-schema-example
│
├── Processed Data Schema
│   └── aggregated-metrics.json
│       ├── total_active_users: number
│       ├── total_suggestions_count: number
│       ├── total_acceptances_count: number
│       ├── total_lines_suggested: number
│       ├── total_lines_accepted: number
│       ├── acceptance_rate: number
│       ├── active_chat_users: number
│       ├── languages: Array<LanguageMetric>
│       │   ├── name: string
│       │   ├── total_engaged_users: number
│       │   └── editors: Array<EditorMetric>
│       │       ├── name: string
│       │       ├── total_engaged_users: number
│       │       ├── models: Array<ModelMetric>
│       │       │   ├── name: string
│       │       │   ├── is_custom_model: boolean
│       │       │   ├── custom_model_training_date: string|null
│       │       │   ├── total_engaged_users: number
│       │       │   ├── languages: Array<LanguageBreakdown>
│       │       │   │   ├── name: string
│       │       │   │   ├── total_engaged_users: number
│       │       │   │   ├── total_code_suggestions: number
│       │       │   │   ├── total_code_acceptances: number
│       │       │   │   ├── total_code_lines_suggested: number
│       │       │   │   └── total_code_lines_accepted: number
│       │       │   └── total_chats: number
│       │       └── total_engaged_users: number
│       └── by_day: Array<DailyMetric>
│           ├── day: string (ISO date)
│           ├── total_active_users: number
│           ├── total_engaged_users: number
│           ├── copilot_ide_code_completions: Object
│           │   ├── total_engaged_users: number
│           │   ├── editors: Array<EditorBreakdown>
│           │   │   ├── name: string
│           │   │   ├── total_engaged_users: number
│           │   │   ├── models: Array<ModelBreakdown>
│           │   │   │   ├── name: string
│           │   │   │   ├── is_custom_model: boolean
│           │   │   │   ├── custom_model_training_date: string|null
│           │   │   │   ├── total_engaged_users: number
│           │   │   │   ├── languages: Array<LanguageBreakdown>
│           │   │   │   └── total_code_suggestions: number
│           │   │   │       total_code_acceptances: number
│           │   │   │       total_code_lines_suggested: number
│           │   │   │       total_code_lines_accepted: number
│           │   │   └── total_engaged_users: number
│           │   └── languages: Array<LanguageMetric>
│           ├── copilot_ide_chat: Object
│           │   ├── total_engaged_users: number
│           │   └── editors: Array<EditorChatBreakdown>
│           │       ├── name: string
│           │       ├── total_engaged_users: number
│           │       └── models: Array<ModelChatBreakdown>
│           │           ├── name: string
│           │           ├── is_custom_model: boolean
│           │           ├── custom_model_training_date: string|null
│           │           ├── total_engaged_users: number
│           │           └── total_chats: number
│           └── copilot_dotcom_chat: Object
│               ├── total_engaged_users: number
│               └── models: Array<ModelChatBreakdown>
│
└── Developer-specific Data Schema
    └── Per-developer metrics matching User-level Schema structure
```

### Agentic AI Coding Efficiency Dashboard
```
BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/
├── GitHub Copilot Metrics API Schemas
│   ├── Team-level Schema
│   │   └── https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema#team-level-schema-example
│   └── User-level Schema
│       └── https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema#user-level-schema-example
│
├── Processed Data Schema
│   └── aggregated-metrics.json
│       ├── total_active_users: number
│       ├── total_dotcom_chat_users: number
│       ├── total_dotcom_pr_summaries: number
│       ├── total_cli_users: number
│       ├── total_cli_commands: number
│       ├── by_day: Array<DailyMetric>
│       │   ├── day: string (ISO date)
│       │   ├── total_active_users: number
│       │   ├── copilot_dotcom_pull_requests: Object
│       │   │   ├── total_engaged_users: number
│       │   │   ├── repositories: Array<RepositoryBreakdown>
│       │   │   │   ├── name: string
│       │   │   │   ├── total_engaged_users: number
│       │   │   │   └── models: Array<ModelPRBreakdown>
│       │   │   │       ├── name: string
│       │   │   │       ├── is_custom_model: boolean
│       │   │   │       ├── custom_model_training_date: string|null
│       │   │   │       ├── total_pr_summaries_created: number
│       │   │   │       └── total_engaged_users: number
│       │   │   └── total_pr_summaries_created: number
│       │   ├── copilot_dotcom_chat: Object
│       │   │   ├── total_engaged_users: number
│       │   │   └── models: Array<ModelChatBreakdown>
│       │   │       ├── name: string
│       │   │       ├── is_custom_model: boolean
│       │   │       ├── custom_model_training_date: string|null
│       │   │       ├── total_engaged_users: number
│       │   │       └── total_chats: number
│       │   └── copilot_dotcom_cli: Object
│       │       ├── total_engaged_users: number
│       │       └── models: Array<ModelCLIBreakdown>
│       │           ├── name: string
│       │           ├── is_custom_model: boolean
│       │           ├── custom_model_training_date: string|null
│       │           ├── total_engaged_users: number
│       │           └── total_chats: number
│       └── repositories: Array<RepositoryMetric>
│           ├── name: string
│           ├── total_engaged_users: number
│           └── total_pr_summaries: number
│
└── Developer-specific Data Schema
    └── Per-developer metrics matching User-level Schema structure
```

### AI-Assisted Coding Structural Dashboard
```
BVE-dashboards-for-ai-assisted-coding/dashboard/structural/
├── GitHub Pull Request API Schema
│   └── https://docs.github.com/en/rest/pulls/pulls
│       ├── number: number
│       ├── title: string
│       ├── state: string
│       ├── created_at: string (ISO datetime)
│       ├── updated_at: string (ISO datetime)
│       ├── merged_at: string|null (ISO datetime)
│       ├── closed_at: string|null (ISO datetime)
│       ├── user: Object
│       │   ├── login: string
│       │   └── ...
│       ├── additions: number
│       ├── deletions: number
│       ├── changed_files: number
│       ├── commits: number
│       ├── labels: Array<Label>
│       │   ├── name: string
│       │   └── ...
│       └── ...
│
├── GitHub PR Review API Schema
│   └── https://docs.github.com/en/rest/pulls/reviews
│       ├── id: number
│       ├── user: Object
│       │   └── login: string
│       ├── body: string
│       ├── state: string
│       ├── submitted_at: string (ISO datetime)
│       └── ...
│
├── GitHub PR Review Comments API Schema
│   └── https://docs.github.com/en/rest/pulls/comments
│       ├── id: number
│       ├── user: Object
│       │   └── login: string
│       ├── body: string
│       ├── created_at: string (ISO datetime)
│       ├── path: string
│       ├── position: number|null
│       └── ...
│
└── Processed Data Schema
    └── pr-review-metrics.json
        ├── summary: Object
        │   ├── total_prs: number
        │   ├── copilot_assisted_prs: number
        │   ├── non_copilot_prs: number
        │   ├── avg_review_comments_copilot: number
        │   ├── avg_review_comments_non_copilot: number
        │   ├── avg_review_time_copilot: number (hours)
        │   ├── avg_review_time_non_copilot: number (hours)
        │   └── date_range: Object
        │       ├── start: string (ISO date)
        │       └── end: string (ISO date)
        │
        └── pull_requests: Array<PRMetric>
            ├── number: number
            ├── title: string
            ├── author: string
            ├── created_at: string (ISO datetime)
            ├── merged_at: string|null (ISO datetime)
            ├── copilot_assisted: boolean
            ├── additions: number
            ├── deletions: number
            ├── changed_files: number
            ├── commits: number
            ├── review_comments_count: number
            ├── review_time_hours: number|null
            └── labels: Array<string>
```

## Schema Validation Points

Each dashboard validates data at multiple stages:

1. **API Response Validation**: Raw data from GitHub APIs
2. **File Load Validation**: Data loaded from JSON files
3. **Post-Processing Validation**: Data after transformation/aggregation
4. **Render Validation**: Data structure before rendering to UI

## Data Collection Scripts

### AI-Assisted Coding
- **Script**: `BVE-dashboards-for-ai-assisted-coding/data/ai-assisted-coding.sh`
- **API Used**: GitHub Copilot Metrics API (Team & User levels)
- **Output**: Raw metrics data file

### Agentic AI Coding
- **Script**: `BVE-dashboards-for-agentic-ai-coding/data/agentic-ai-coding.sh`
- **API Used**: GitHub Copilot Metrics API (Team & User levels)
- **Output**: Raw metrics data file

### PR Review Analysis
- **Script**: `BVE-dashboards-for-ai-assisted-coding/data/pr_review.sh`
- **APIs Used**: 
  - GitHub Pull Requests API
  - GitHub PR Reviews API
  - GitHub PR Comments API
- **Output**: PR review metrics file

## Common Schema Elements

All dashboards share common patterns for:
- Date/time formatting (ISO 8601)
- User identification (login strings)
- Numeric metrics (non-negative integers)
- Model information (name, custom_model flags)
- Engagement tracking (total_engaged_users)

## Testing Strategy

Each schema has corresponding test files:
- `schema.test.js`: Validates schema structure
- `{module}.test.js`: Tests data processing logic
- Example data files for validation in `tests/fixtures/`

For detailed API schema examples, refer to:
- [GitHub Copilot Metrics API Documentation](https://docs.github.com/en/copilot/reference/copilot-usage-metrics)
- [GitHub Pull Requests API Documentation](https://docs.github.com/en/rest/pulls)
