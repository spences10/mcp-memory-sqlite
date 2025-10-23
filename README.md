# mcp-memory-sqlite

SQLite-based persistent memory tool for MCP (Model Context Protocol) with vector search capabilities.

## Features

- **Persistent Knowledge Graph**: Store entities, observations, and relationships in a local SQLite database
- **Vector Search**: Semantic similarity search using sqlite-vec with 1536-dimensional embeddings (OpenAI ada-002 compatible)
- **Entity Management**: Create, retrieve, update, and delete entities with observations
- **Relationship Tracking**: Define and query relationships between entities
- **Text Search**: Full-text search across entities and observations
- **Local & Private**: All data stored locally in a SQLite database file

## Installation

```bash
npm install mcp-memory-sqlite
# or
pnpm add mcp-memory-sqlite
```

## Configuration

The server can be configured using environment variables:

- `SQLITE_DB_PATH`: Path to the SQLite database file (default: `./sqlite-memory.db`)

## MCP Tools

### create_entities

Create or update entities with observations and optional embeddings.

**Parameters:**
- `entities`: Array of entity objects
  - `name` (string): Unique entity identifier
  - `entityType` (string): Type/category of the entity
  - `observations` (string[]): Array of observation strings
  - `embedding` (number[], optional): 1536-dimensional vector for semantic search

**Example:**
```json
{
  "entities": [
    {
      "name": "Claude",
      "entityType": "AI Assistant",
      "observations": [
        "Created by Anthropic",
        "Focuses on being helpful, harmless, and honest"
      ],
      "embedding": [0.1, 0.2, ...] // 1536 dimensions
    }
  ]
}
```

### search_nodes

Search for entities and their relations using text or vector similarity.

**Parameters:**
- `query`: String for text search OR array of numbers for vector similarity search

**Text Search Example:**
```json
{
  "query": "AI Assistant"
}
```

**Vector Search Example:**
```json
{
  "query": [0.1, 0.2, 0.3, ...] // 1536 dimensions
}
```

### read_graph

Get recent entities and their relations (returns last 10 entities by default).

**Parameters:** None

### create_relations

Create relationships between entities.

**Parameters:**
- `relations`: Array of relation objects
  - `source` (string): Source entity name
  - `target` (string): Target entity name
  - `type` (string): Relationship type

**Example:**
```json
{
  "relations": [
    {
      "source": "Claude",
      "target": "Anthropic",
      "type": "created_by"
    }
  ]
}
```

### delete_entity

Delete an entity and all associated data (observations and relations).

**Parameters:**
- `name` (string): Entity name to delete

### delete_relation

Delete a specific relation between entities.

**Parameters:**
- `source` (string): Source entity name
- `target` (string): Target entity name
- `type` (string): Relationship type

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "mcp-memory-sqlite"],
      "env": {
        "SQLITE_DB_PATH": "/path/to/your/memory.db"
      }
    }
  }
}
```

## Database Schema

The tool uses SQLite with the sqlite-vec extension for vector operations:

### Regular Tables

- **entities**: Stores entity metadata (name, type, creation time)
- **observations**: Stores observations linked to entities
- **relations**: Stores relationships between entities

### Virtual Table

- **entities_vec**: Virtual table using vec0 for 1536-dimensional vector embeddings

## Vector Embeddings

The tool expects 1536-dimensional float vectors, compatible with:
- OpenAI text-embedding-ada-002
- OpenAI text-embedding-3-small
- Other models producing 1536-dimensional embeddings

To generate embeddings, you can use:
- OpenAI Embeddings API
- Local embedding models like sentence-transformers
- Other embedding services that produce 1536-dim vectors

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run in development mode
pnpm run dev

# Run tests
pnpm test
```

## Technical Details

- Built with better-sqlite3 for fast, synchronous SQLite access
- Uses sqlite-vec for efficient vector similarity search
- Implements WAL mode for better concurrency
- Foreign key constraints for data integrity
- Transaction support for atomic operations

## License

MIT

## Credits

Built with:
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite driver
- [sqlite-vec](https://github.com/asg017/sqlite-vec) - Vector search extension
- [tmcp](https://github.com/tmcp-io/tmcp) - MCP server framework
