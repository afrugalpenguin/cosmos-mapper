# Cosmos DB Schema Documentation Generator

## Project Overview

A Node.js tool that automatically generates Azure DevOps wiki-compatible documentation for Cosmos DB databases. It samples documents from containers, infers schemas, detects relationships, and outputs Markdown with Mermaid ERD diagrams.

## CRITICAL: Data Privacy & Anonymisation

**THIS IS NON-NEGOTIABLE:**

1. **NO identifiable customer data** may ever be committed to this repository
2. **NO real data** in tests, documentation, examples, or any committed files
3. **ALL example values** in generated documentation must be anonymised/synthetic
4. **Query results** shared during development must be sanitised before discussion
5. **The `/output/` folder** is gitignored - generated docs contain real examples and must NEVER be committed

### What This Means in Practice

- Example values in schema docs: Use synthetic data like `"Example Corp"`, `"PRODUCT-001"`, `"user@example.com"`
- GUIDs: Can use real format but not real IDs (generate fake ones)
- Dates: Can use realistic formats but not real transaction dates
- Names, references, descriptions: Must be replaced with generic placeholders
- Test fixtures: Use entirely fabricated data

### When Querying Cosmos DB During Development

If sharing query results to debug or verify behaviour:
- Redact all customer names, product numbers, order references
- Replace real IDs with `<GUID>` or `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Summarise structure without exposing actual values

**If in doubt, anonymise it.**

## Business Context

This tool automates schema discovery and documentation generation.

## Database Structure

The Cosmos DB account has multiple databases:

### Store Databases (one per client/store)
Each store has their own database containing 6 containers:
- `orders`
- `events`
- `importlogs`
- `movements`
- `categories`
- `premiums`

All store databases share the same schema structure - we only need to sample ONE store database to document the template.

### Platform Database (one per stack)
Single database with 14 containers:
- `activitylog`
- `contracts`
- `creditcontrol`
- `dictionaries`
- `documents`
- `housekeeping`
- `infrastructure`
- `categories`
- `processing`
- `reporting`
- `reports`
- `schema`
- `security`
- `stores`

## Technical Requirements

### Input
- Cosmos DB connection (endpoint + key)
- Name of one store database to use as schema template
- Name of platform database

### Output
- Azure DevOps wiki-compatible Markdown files
- Mermaid ERD diagram showing entities and relationships
- Property tables per container showing:
  - Property name/path (including nested properties)
  - Data type (string, number, boolean, datetime, guid, array, object)
  - Required vs optional (based on occurrence frequency in samples)
  - Example values
- Timestamp of when documentation was generated

### Schema Inference Logic
1. Sample N documents per container (configurable, default 100)
2. Recursively walk document structure
3. Track property names, paths, types
4. Handle nested objects (use dot notation: `parent.child`)
5. Handle arrays (use bracket notation: `items[]` for array item properties)
6. Detect optionality by checking occurrence frequency across samples
7. Identify common types: string, number, integer, boolean, datetime (ISO format strings), guid (UUID format strings), array, object

### Relationship Detection
- Look for properties ending in `Id` or `_id`
- Cross-reference against container names
- Example: `productId` in orders container suggests relationship to categories container

### ADO Wiki Compatibility
- Standard Markdown syntax
- Mermaid diagrams in ```mermaid code blocks (ADO renders these natively)
- Use collapsible sections for detailed property tables
- Include generation timestamp

## File Structure

```
cosmos-schema-docs/
├── src/
│   ├── index.js          # Main entry point
│   ├── analyser.js       # Schema inference logic
│   ├── relationships.js  # Relationship detection
│   └── generator.js      # Markdown/Mermaid output generation
├── output/               # Generated documentation goes here
├── package.json
├── .env.example
├── .env                  # Local config (gitignored)
└── README.md
```

## Key Dependencies

- `@azure/cosmos` - Cosmos DB SDK
- No other external dependencies needed - keep it simple

## Running the Tool

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Cosmos connection details

# Run
npm start

# Output appears in ./output/
```

## Future Considerations

- Could be run on a schedule via Azure DevOps pipeline or Windows Task Scheduler
- Output could be committed directly to ADO wiki repo
- Could add HTML output option with nicer styling
- Could add comparison mode to detect schema changes over time

## Code Style Notes

- SQL keywords in lowercase (per user preference)
- Keep it simple and readable
- Good error handling - containers might be empty or inaccessible
- Progress logging so user knows what's happening
