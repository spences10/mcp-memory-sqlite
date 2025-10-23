// Vector dimension constant (1536 for OpenAI ada-002 compatibility)
const VECTOR_DIMENSIONS = 1536;

export const schema = [
	// Create entities table (without embedding - that's in the virtual table)
	`CREATE TABLE IF NOT EXISTS entities (
    name TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

	// Create observations table
	`CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_name) REFERENCES entities(name)
  )`,

	// Create relations table
	`CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source) REFERENCES entities(name),
    FOREIGN KEY (target) REFERENCES entities(name),
    UNIQUE(source, target, relation_type)
  )`,

	// Create virtual table for vector embeddings using sqlite-vec
	`CREATE VIRTUAL TABLE IF NOT EXISTS entities_vec USING vec0(embedding float[${VECTOR_DIMENSIONS}])`,

	// Create indexes
	`CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)`,
	`CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_name)`,
	`CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source)`,
	`CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target)`,
];
