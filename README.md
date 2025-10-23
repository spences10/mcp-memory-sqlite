# mcp-memory-sqlite

A personal knowledge graph and memory system for AI assistants using
SQLite and vector search. Perfect for giving Claude (or any
MCP-compatible AI) persistent memory across conversations!

## Why Use This?

Give your AI assistant a memory! This tool lets Claude (or other AI
assistants) remember entities, concepts, and their relationships
across conversations. Perfect for:

- 📚 **Personal Knowledge Management** - Build your own knowledge
  graph
- 🤖 **AI Assistant Memory** - Help Claude remember important
  information about your projects, preferences, and context
- 🔗 **Relationship Tracking** - Connect ideas, people, projects, and
  concepts
- 🔍 **Smart Search** - Find information using text search or semantic
  similarity

## Features

- **100% Local & Private**: All your data stays on your machine
- **Easy Setup**: Works out-of-the-box with Claude Desktop
- **Flexible Search**: Case-insensitive text search that handles
  different naming conventions
- **Vector Search**: Semantic similarity using OpenAI-compatible
  embeddings (1536 dimensions)
- **Smart Deduplication**: Automatically prevents duplicate
  relationships
- **Simple API**: Intuitive tools for creating, searching, and
  managing your knowledge graph

## Quick Start

**For Claude Desktop users** (recommended):

Add this to your Claude Desktop config:

```json
{
	"mcpServers": {
		"memory": {
			"command": "npx",
			"args": ["-y", "mcp-memory-sqlite"]
		}
	}
}
```

That's it! Claude can now remember things across conversations.

## Installation

If you want to use it in your own project:

```bash
npm install mcp-memory-sqlite
# or
pnpm add mcp-memory-sqlite
```

## Configuration

**Optional**: Customize the database location with an environment
variable:

- `SQLITE_DB_PATH`: Where to store your data (default:
  `./sqlite-memory.db`)

## MCP Tools

### create_entities

Create or update entities with observations and optional embeddings.

**Parameters:**

- `entities`: Array of entity objects
  - `name` (string): Unique entity identifier
  - `entityType` (string): Type/category of the entity
  - `observations` (string[]): Array of observation strings
  - `embedding` (number[], optional): 1536-dimensional vector for
    semantic search

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

Search for entities and their relations using text or vector
similarity.

**Parameters:**

- `query`: String for text search OR array of numbers for vector
  similarity search

**Text Search Example:**

```json
{
	"query": "AI Assistant"
}
```

**Text Search Features:**

- **Case-insensitive**: Searches ignore case differences
- **Flexible matching**: Automatically handles variations in spacing,
  underscores, and hyphens
  - "JavaScript framework" will match "javascript_framework"
  - "web-development" will match "web_development" or "web
    development"
- **Searches across**: Entity names, entity types, and all
  observations

**Vector Search Example:**

```json
{
  "query": [0.1, 0.2, 0.3, ...] // 1536 dimensions
}
```

### read_graph

Get recent entities and their relations (returns last 10 entities by
default).

**Parameters:** None

### create_relations

Create relationships between entities. Duplicate relations (same
source, target, and type) are automatically ignored.

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

**Note:** If you attempt to create the same relation multiple times,
only the first one will be stored. This prevents duplicate
relationships in your knowledge graph.

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

**Minimal configuration (uses default `./sqlite-memory.db`):**

```json
{
	"mcpServers": {
		"memory": {
			"command": "npx",
			"args": ["-y", "mcp-memory-sqlite"]
		}
	}
}
```

**With custom database path:**

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

The tool uses SQLite with the sqlite-vec extension for vector
operations:

### Regular Tables

- **entities**: Stores entity metadata (name, type, creation time)
- **observations**: Stores observations linked to entities
- **relations**: Stores relationships between entities

### Virtual Table

- **entities_vec**: Virtual table using vec0 for 1536-dimensional
  vector embeddings

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

## How It Works

Under the hood, this uses:

- **SQLite** for fast, reliable local storage
- **sqlite-vec** for vector similarity search
- **better-sqlite3** for Node.js integration

Your data is stored in a single `.db` file on your computer - no
cloud, no external services, completely private.

## License

MIT

## Credits

Built with:

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast
  SQLite driver
- [sqlite-vec](https://github.com/asg017/sqlite-vec) - Vector search
  extension
- [tmcp](https://github.com/tmcp-io/tmcp) - MCP server framework
