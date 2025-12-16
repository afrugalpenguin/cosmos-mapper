# CosmosMapper Roadmap

A phased plan to evolve CosmosMapper from MVP to a comprehensive Cosmos DB documentation and analysis tool.

## Phase 1: Enhanced Documentation

**Goal:** Make the generated documentation more useful and comprehensive.

### Schema Versioning & Change Detection
- [ ] Store schema snapshots in a local cache/history
- [ ] Compare current schema against previous runs
- [ ] Generate change reports (new properties, removed properties, type changes)
- [ ] Highlight breaking changes vs additive changes
- [ ] Add `--diff` flag to show only what changed since last run

### Improved Type Detection
- [ ] Detect email addresses, URLs, phone numbers
- [ ] Recognise enum-like fields (limited set of values)
- [ ] Detect nullable vs truly optional fields
- [ ] Identify computed/derived fields (e.g., always matches pattern)
- [ ] Support custom type patterns via config

### Documentation Quality
- [ ] Add property descriptions from inline comments (if using a schema source)
- [ ] Generate sample queries for each container
- [ ] Include partition key strategy documentation
- [ ] Document indexing product per container
- [ ] Add data volume estimates (doc count, average size)

---

## Phase 2: Multiple Output Formats

**Goal:** Support different documentation platforms and use cases.

### Output Formats
- [ ] HTML output with collapsible sections and search
- [ ] Confluence wiki format
- [ ] Notion export
- [ ] PDF generation (via HTML)
- [ ] JSON schema export (for tooling integration)
- [ ] OpenAPI-style schema definitions

### Template System
- [ ] Customisable Markdown templates
- [ ] Branding/styling options for HTML output
- [ ] Custom header/footer content
- [ ] Logo embedding in outputs

---

## Phase 3: CI/CD Integration

**Goal:** Automate documentation as part of the development workflow.

### Pipeline Support
- [ ] Azure DevOps pipeline task/extension
- [ ] GitHub Actions workflow template
- [ ] Exit codes for schema drift detection (fail build on breaking changes)
- [ ] Auto-commit documentation to wiki repos
- [ ] PR comments with schema changes summary

### Configuration
- [ ] Config file support (`cosmosmapper.config.json`)
- [ ] Environment-specific profiles (dev, staging, prod)
- [ ] Container include/exclude patterns
- [ ] Sensitive field redaction rules

---

## Phase 4: Analysis & Insights

**Goal:** Go beyond documentation to provide actionable insights.

### Schema Analysis
- [ ] Identify potential normalisation opportunities
- [ ] Detect duplicate/redundant data patterns
- [ ] Flag inconsistent naming conventions
- [ ] Suggest index optimisations based on detected query patterns
- [ ] Estimate storage costs based on schema

### Data Quality Metrics
- [ ] Null percentage per field
- [ ] Value distribution summaries
- [ ] Outlier detection
- [ ] Data freshness indicators (last modified timestamps)

### Relationship Insights
- [ ] Orphaned reference detection
- [ ] Circular dependency warnings
- [ ] Missing inverse relationships
- [ ] Relationship strength metrics (how often references exist)

---

## Phase 5: Interactive Features

**Goal:** Provide a richer exploration experience.

### Web UI
- [ ] Local web server mode (`npm run serve`)
- [ ] Interactive ERD with zoom/pan/filter
- [ ] Click-through from ERD to container details
- [ ] Search across all schemas
- [ ] Side-by-side schema comparison

### Query Builder
- [ ] Generate sample queries from schema
- [ ] Visual query builder based on detected relationships
- [ ] Export queries in multiple formats (SDK, SQL API)

---

## Phase 6: Enterprise Features

**Goal:** Support larger organisations and complex deployments.

### Multi-Account Support
- [ ] Document multiple Cosmos DB accounts in one run
- [ ] Cross-account relationship detection
- [ ] Unified ERD across accounts

### Access Control
- [ ] Support for Azure AD authentication (already have DefaultAzureCredential)
- [ ] Managed Identity documentation
- [ ] RBAC role documentation per container

### Compliance
- [ ] PII field detection and flagging
- [ ] Data classification suggestions
- [ ] Retention product documentation
- [ ] Audit trail for schema changes

---

## Quick Wins (Can Do Anytime)

These are smaller improvements that add value without major architectural changes:

- [ ] `--watch` mode for continuous regeneration during development
- [ ] Progress bar instead of dots during sampling
- [ ] Container-level sampling size config (some containers need more samples)
- [ ] Quiet mode for CI (`--quiet`)
- [ ] Verbose mode for debugging (`--verbose`)
- [ ] `--container` flag to document single container
- [ ] Copy-to-clipboard for Mermaid diagrams
- [ ] Validate config/connection before sampling
- [ ] Better error messages with troubleshooting hints

---

## Community & Ecosystem

- [ ] Publish to npm as global CLI tool
- [ ] VS Code extension for inline schema viewing
- [ ] Contribute Mermaid ERD improvements upstream
- [ ] Blog post / documentation site
- [ ] Example outputs for common patterns

---

## Prioritisation Suggestions

### High Impact, Lower Effort
1. Schema change detection (Phase 1)
2. Config file support (Phase 3)
3. HTML output with search (Phase 2)
4. `--watch` mode (Quick Win)

### High Impact, Higher Effort
1. CI/CD pipeline integration (Phase 3)
2. Interactive web UI (Phase 5)
3. Data quality metrics (Phase 4)

### Nice to Have
1. Multiple output formats beyond HTML/Markdown
2. Enterprise features
3. Query builder

---

## Version Milestones

| Version | Focus | Key Features |
|---------|-------|--------------|
| 1.0 | MVP | Current functionality |
| 1.1 | Polish | Quick wins, better errors, config file |
| 1.2 | Change Detection | Schema versioning, diff reports |
| 2.0 | Multi-Format | HTML output, templates, CI/CD |
| 3.0 | Analysis | Insights, metrics, recommendations |
| 4.0 | Interactive | Web UI, visual exploration |

---

## Contributing

Ideas and contributions welcome! This roadmap is a living document - priorities may shift based on user feedback and real-world usage patterns.
