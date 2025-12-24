# CosmosMapper Roadmap

A phased plan to evolve CosmosMapper from MVP to a comprehensive Cosmos DB documentation and analysis tool.

## Current Status (v1.6)

**Completed:**
- Schema inference with type detection (GUIDs, dates, emails, URLs, phones, enums, reference objects, etc.)
- Relationship detection from naming conventions
- **Relationship confidence scoring** with multi-factor analysis
- **Cardinality analysis** (one-to-one vs many-to-one)
- **Denormalization/snapshot detection**
- Cross-database relationship support
- HTML output with collapsible sections and search
- Mermaid ERD diagram generation
- Config file support with CLI overrides
- Container include/exclude patterns
- **Schema versioning & change detection** (snapshots, diff, breaking change detection)
- **Improved type detection** (email, URL, phone, enum, nullable, computed fields, custom patterns)
- **Quick wins bundle**: `--watch`, `--quiet`, `--verbose`, `--container` flags
- 319 unit tests with 95% coverage

---

## Phase 1: Enhanced Documentation

**Goal:** Make the generated documentation more useful and comprehensive.

### Schema Versioning & Change Detection
- [x] Store schema snapshots in a local cache/history ✅
- [x] Compare current schema against previous runs ✅
- [x] Generate change reports (new properties, removed properties, type changes) ✅
- [x] Highlight breaking changes vs additive changes ✅
- [x] Add `--diff` flag to show only what changed since last run ✅

### Improved Type Detection
- [x] Detect email addresses, URLs, phone numbers ✅
- [x] Recognise enum-like fields (limited set of values) ✅
- [x] Detect nullable vs truly optional fields ✅
- [x] Identify computed/derived fields (e.g., always matches pattern) ✅
- [x] Support custom type patterns via config ✅

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
- [x] HTML output with collapsible sections and search ✅
- [x] Mermaid ERD diagrams in both HTML and Markdown ✅
- [ ] Confluence wiki format
- [ ] Notion export
- [ ] PDF generation (via HTML)
- [ ] JSON schema export (for tooling integration)
- [ ] OpenAPI-style schema definitions

### Template System
- [x] EJS template system for HTML output ✅
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
- [x] Config file support (`cosmosmapper.config.json`) ✅
- [x] CLI argument overrides ✅
- [ ] Environment-specific profiles (dev, staging, prod)
- [x] Container include/exclude patterns ✅
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
- [x] Field frequency/population rates ✅
- [ ] Null percentage per field
- [ ] Value distribution summaries
- [ ] Outlier detection
- [ ] Data freshness indicators (last modified timestamps)

### Relationship Insights
- [x] Orphaned reference detection ✅
- [x] Relationship confidence scoring (referential integrity, type consistency, naming pattern, frequency) ✅
- [x] Cardinality analysis (one-to-one vs many-to-one) ✅
- [x] Denormalization/snapshot detection ✅
- [x] Cross-database relationship detection ✅
- [ ] Relationship overrides (confirm/ignore via config)
- [ ] Circular dependency warnings
- [ ] Missing inverse relationships

---

## Phase 5: Interactive Features

**Goal:** Provide a richer exploration experience.

### Configuration UI
- [ ] Web-based setup wizard (`npm run setup`)
- [ ] Connect to Cosmos account and browse available databases
- [ ] Select endpoint(s) and database(s) to document
- [ ] Save configuration profiles for different environments
- [ ] Support for multiple Cosmos accounts in one session

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

- [x] `--watch` mode for continuous regeneration during development ✅
- [ ] Progress bar instead of dots during sampling
- [ ] Container-level sampling size config (some containers need more samples)
- [x] Quiet mode for CI (`--quiet`) ✅
- [x] Verbose mode for debugging (`--verbose`) ✅
- [x] `--container` flag to document single container ✅
- [ ] Copy-to-clipboard for Mermaid diagrams
- [x] Validate config/connection before sampling ✅
- [ ] Better error messages with troubleshooting hints
- [x] Comprehensive test suite (319 tests, 95% coverage) ✅

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
1. ~~Schema change detection (Phase 1)~~ ✅ Done
2. ~~Config file support (Phase 3)~~ ✅ Done
3. ~~HTML output with search (Phase 2)~~ ✅ Done
4. ~~`--watch` mode (Quick Win)~~ ✅ Done

### High Impact, Higher Effort
1. CI/CD pipeline integration (Phase 3)
2. Interactive web UI (Phase 5)
3. ~~Relationship confidence scoring (Phase 4)~~ ✅ Done
4. Data quality metrics (Phase 4)

### Nice to Have
1. Multiple output formats beyond HTML/Markdown
2. Enterprise features
3. Query builder

---

## Version Milestones

| Version | Focus | Key Features | Status |
|---------|-------|--------------|--------|
| 1.0 | MVP | Schema inference, relationship detection, Markdown output | ✅ Complete |
| 1.1 | Polish | Config file, CLI args, container filtering, test suite | ✅ Complete |
| 1.2 | HTML & ERDs | HTML output with search, Mermaid ERD diagrams | ✅ Complete |
| 1.3 | Confidence | Relationship confidence scoring, cardinality analysis, validation | ✅ Complete |
| 1.4 | Change Detection | Schema versioning, diff reports, breaking change detection | ✅ Complete |
| 1.5 | Type Detection | Email/URL/phone detection, enum fields, nullable tracking, custom patterns | ✅ Complete |
| 1.6 | Quick Wins | Watch mode, quiet/verbose modes, single container filter | ✅ Complete |
| 2.0 | CI/CD | Pipeline integration, exit codes, auto-commit | Planned |
| 3.0 | Analysis | Data quality metrics, recommendations | Planned |
| 4.0 | Interactive | Web UI, visual exploration | Planned |

---

## Contributing

Ideas and contributions welcome! This roadmap is a living document - priorities may shift based on user feedback and real-world usage patterns.
