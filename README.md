# Cosmos Mapper

<p align="left">
  <img src="logo.svg" alt="CosmosMapper Logo" width="200">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![Azure Cosmos DB](https://img.shields.io/badge/Azure-Cosmos%20DB-0078D4)](https://azure.microsoft.com/services/cosmos-db/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/)

Azure Cosmos DB schema documentation generator with ERD diagrams.

Automatically samples documents from your Cosmos DB containers, infers schemas, detects relationships, and generates industry standard, wiki-compatible, Markdown documentation with Mermaid ERD diagrams.

## Features

- **Schema Inference**: Samples documents and infers property types, optionality, and patterns
- **Type Detection**: Recognises GUIDs, dates, reference objects, lookup objects, and more
- **Relationship Detection**: Identifies foreign key-like relationships between containers
- **Cross-Database Support**: Detects relationships between containers across different databases
- **Mermaid ERD Diagrams**: Generates visual entity relationship diagrams (compatible with these tools: https://mermaid.js.org/ecosystem/integrations-community.html).

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file and configure your Cosmos DB connection:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Option 1: Key-based authentication
COSMOS_ENDPOINT=https://your-account.azure.com:443/
COSMOS_KEY=your-primary-key [Read Only supported and strongly suggested]

# Option 2: Azure AD / Managed Identity
# Just set COSMOS_ENDPOINT and leave COSMOS_KEY empty

# Optional: Documents to sample per container (default: 100)
SAMPLE_SIZE=100
```

### Authentication Options

**Key-based**: Set both `COSMOS_ENDPOINT` and `COSMOS_KEY`

**Azure AD / Managed Identity**: Set only `COSMOS_ENDPOINT`. The tool uses `DefaultAzureCredential` which supports:
- Managed Identity (Azure VMs, App Service, etc.)
- Azure CLI (`az login`)
- Visual Studio Code
- Environment variables (`AZURE_CLIENT_ID`, `AZURE_STORE_ID`, `AZURE_CLIENT_SECRET`)

## Usage

```bash
npm start
```

Output is generated in the `./output/` directory.

## Output Structure

```
output/
├── index.md                 # Main overview with ERD
├── store-db/
│   ├── _overview.md         # Database ERD and container list
│   ├── orders.md            # Container schema details
│   ├── categories.md
│   └── ...
├── platform-db/
│   ├── _overview.md
│   ├── contracts.md
│   └── ...
└── _cross-database.md       # Cross-database relationships
```

## Type Detection

The tool detects and labels these types:

| Type | Detection |
|------|-----------|
| GUID | UUID format strings |
| DateTime | ISO 8601 date strings |
| DateTimeObject | `{ Value: "ISO string", Epoch: number }` |
| ReferenceObject | `{ Id: "guid", Name: "string", Code: "string" }` |
| LookupObject | `{ Id: number, Name: "string", Code: "string" }` |
| Integer | Whole numbers |
| Number | Decimal numbers |
| Boolean | true/false |
| Array | Arrays of any type |
| Object | Nested objects |

## Relationship Detection

Relationships are detected from:

- Properties ending in `Id` (e.g., `StoreId` → `stores`)
- Properties ending in `_id` (e.g., `product_id` → `categories`)
- Nested objects with `Id` property (e.g., `Product.Id` → `categories`)
- Reference pattern objects

> **Note:** Unlike relational databases, Cosmos DB has no enforced foreign keys. Relationships shown in the ERD are **inferred from naming conventions**, not database constraints. Some detected relationships may be:
> - Denormalised copies (embedded snapshots) rather than live references
> - Pointing to containers with slightly different names than guessed
> - Application-level conventions that don't represent true data relationships
>
> Always verify critical relationships against your application code or domain knowledge.

## Demo with Cosmos DB Emulator

You can test the tool locally using the Azure Cosmos DB Emulator:

### 1. Install the Emulator

```powershell
winget install Microsoft.Azure.CosmosEmulator
```

Or download from: https://aka.ms/cosmosdb-emulator

### 2. Seed Sample Data

```bash
npm run seed
```

This creates `ecommerce-store` and `sample-platform` databases with synthetic data.

### 3. Configure and Run

Update `.env`:

```env
COSMOS_ENDPOINT=https://localhost:8081
COSMOS_KEY=YOURKEYHERE
STORE_DATABASE=ecommerce-store
PLATFORM_DATABASE=sample-platform
```

Then run:

```bash
npm start
```

## License

MIT
