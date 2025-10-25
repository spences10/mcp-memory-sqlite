# mcp-memory-sqlite

A personal knowledge graph and memory system for AI assistants using
SQLite with optimized text search. Perfect for giving Claude (or any
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
- 🔍 **Smart Text Search** - Find information using flexible,
  relevance-ranked text search

## Features

- **100% Local & Private**: All your data stays on your machine
- **Easy Setup**: Works out-of-the-box with Claude Desktop
- **Flexible Text Search**: Case-insensitive search with fuzzy
  matching that handles different naming conventions
- **Relevance Ranking**: Results prioritized by name match > type
  match > observation match
- **Smart Deduplication**: Automatically prevents duplicate
  relationships
- **Context-Optimized**: Designed specifically for LLM context
  efficiency - no unnecessary data bloat
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

Create or update entities with observations.

**Parameters:**

- `entities`: Array of entity objects
  - `name` (string): Unique entity identifier
  - `entityType` (string): Type/category of the entity
  - `observations` (string[]): Array of observation strings

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
			]
		}
	]
}
```

### search_nodes

Search for entities and their relations using text search with
relevance ranking.

**Parameters:**

- `query` (string): Text to search for
- `limit` (number, optional): Maximum results to return (default: 10,
  max: 50)

**Example:**

```json
{
	"query": "AI Assistant",
	"limit": 5
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
- **Relevance ranking**: Results prioritized by where match occurs
  (name > type > observation)

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

### get_entity_with_relations

Get an entity along with all its relations and directly connected
entities. Perfect for exploring the knowledge graph around a specific
concept.

**Parameters:**

- `name` (string): Entity name to retrieve

**Returns:**

- `entity`: The requested entity
- `relations`: All relations where this entity is source or target
- `relatedEntities`: All entities connected to this one

**Example:**

```json
{
	"name": "Claude"
}
```

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

The tool uses pure SQLite for fast, reliable storage:

### Tables

- **entities**: Stores entity metadata (name, type, creation time)
- **observations**: Stores observations linked to entities
- **relations**: Stores relationships between entities (with unique
  constraint to prevent duplicates)

All queries use optimized SQLite indexes for fast text search and
relationship traversal.

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
- **better-sqlite3** for Node.js integration
- **Optimized text search** with relevance ranking and fuzzy matching

Your data is stored in a single `.db` file on your computer - no
cloud, no external services, completely private.

## License

MIT

## Credits

Built with:

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast
  SQLite driver
- [tmcp](https://github.com/tmcp-io/tmcp) - MCP server framework
