import Database from 'better-sqlite3';
import { Entity, Relation, SearchResult } from '../types/index.js';

// Types for configuration
interface DatabaseConfig {
	dbPath: string;
}

export class DatabaseManager {
	private static instance: DatabaseManager;
	private db: Database.Database;

	private constructor(config: DatabaseConfig) {
		if (!config.dbPath) {
			throw new Error('Database path is required');
		}

		// Open database connection
		this.db = new Database(config.dbPath);

		// Configure database for better performance and safety
		this.db.pragma('journal_mode = WAL');
		this.db.pragma('synchronous = NORMAL');
		this.db.pragma('cache_size = 1000');
		this.db.pragma('foreign_keys = ON');
		this.db.pragma('temp_store = MEMORY');
	}

	public static async get_instance(
		config: DatabaseConfig,
	): Promise<DatabaseManager> {
		if (!DatabaseManager.instance) {
			DatabaseManager.instance = new DatabaseManager(config);
			await DatabaseManager.instance.initialize();
		}
		return DatabaseManager.instance;
	}

	// Entity operations
	async create_entities(
		entities: Array<{
			name: string;
			entityType: string;
			observations: string[];
		}>,
	): Promise<void> {
		const transaction = this.db.transaction(() => {
			for (const entity of entities) {
				// Validate entity name
				if (
					!entity.name ||
					typeof entity.name !== 'string' ||
					entity.name.trim() === ''
				) {
					throw new Error('Entity name must be a non-empty string');
				}

				// Validate entity type
				if (
					!entity.entityType ||
					typeof entity.entityType !== 'string' ||
					entity.entityType.trim() === ''
				) {
					throw new Error(
						`Invalid entity type for entity "${entity.name}"`,
					);
				}

				// Validate observations
				if (
					!Array.isArray(entity.observations) ||
					entity.observations.length === 0
				) {
					throw new Error(
						`Entity "${entity.name}" must have at least one observation`,
					);
				}

				if (
					!entity.observations.every(
						(obs) => typeof obs === 'string' && obs.trim() !== '',
					)
				) {
					throw new Error(
						`Entity "${entity.name}" has invalid observations. All observations must be non-empty strings`,
					);
				}

				// Check if entity exists
				const existing = this.db
					.prepare('SELECT name FROM entities WHERE name = ?')
					.get(entity.name);

				if (existing) {
					// Update existing entity
					this.db
						.prepare(
							'UPDATE entities SET entity_type = ? WHERE name = ?',
						)
						.run(entity.entityType, entity.name);
				} else {
					// Insert new entity
					this.db
						.prepare(
							'INSERT INTO entities (name, entity_type) VALUES (?, ?)',
						)
						.run(entity.name, entity.entityType);
				}

				// Clear old observations
				this.db
					.prepare('DELETE FROM observations WHERE entity_name = ?')
					.run(entity.name);

				// Add new observations
				const insert_obs = this.db.prepare(
					'INSERT INTO observations (entity_name, content) VALUES (?, ?)',
				);
				for (const observation of entity.observations) {
					insert_obs.run(entity.name, observation);
				}
			}
		});

		try {
			transaction();
		} catch (error) {
			// Wrap all errors with context
			throw new Error(
				`Entity operation failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async get_entity(name: string): Promise<Entity> {
		const entity_result = this.db
			.prepare(
				'SELECT name, entity_type FROM entities WHERE name = ?',
			)
			.get(name) as { name: string; entity_type: string } | undefined;

		if (!entity_result) {
			throw new Error(`Entity not found: ${name}`);
		}

		const observations_result = this.db
			.prepare(
				'SELECT content FROM observations WHERE entity_name = ?',
			)
			.all(name) as Array<{ content: string }>;

		return {
			name: entity_result.name,
			entityType: entity_result.entity_type,
			observations: observations_result.map((row) => row.content),
		};
	}

	async search_entities(
		query: string,
		limit: number = 10,
	): Promise<Entity[]> {
		// Validate and clamp limit
		const effective_limit = Math.min(Math.max(1, limit), 50);

		// Normalize query for flexible matching: replace spaces/underscores with wildcards
		const normalized_query = query.replace(/[\s_-]+/g, '%');
		const search_pattern = `%${normalized_query}%`;

		// Use relevance scoring: name match (3) > type match (2) > observation match (1)
		const results = this.db
			.prepare(
				`
        SELECT DISTINCT
          e.name,
          e.entity_type,
          e.created_at,
          CASE
            WHEN e.name LIKE ? COLLATE NOCASE THEN 3
            WHEN e.entity_type LIKE ? COLLATE NOCASE THEN 2
            ELSE 1
          END as relevance_score
        FROM entities e
        LEFT JOIN observations o ON e.name = o.entity_name
        WHERE e.name LIKE ? COLLATE NOCASE
           OR e.entity_type LIKE ? COLLATE NOCASE
           OR o.content LIKE ? COLLATE NOCASE
        ORDER BY relevance_score DESC, e.created_at DESC
        LIMIT ?
      `,
			)
			.all(
				search_pattern,
				search_pattern,
				search_pattern,
				search_pattern,
				search_pattern,
				effective_limit,
			) as Array<{
			name: string;
			entity_type: string;
		}>;

		const entities: Entity[] = [];
		for (const row of results) {
			const name = row.name;
			const observations = this.db
				.prepare(
					'SELECT content FROM observations WHERE entity_name = ?',
				)
				.all(name) as Array<{ content: string }>;

			entities.push({
				name,
				entityType: row.entity_type,
				observations: observations.map((obs) => obs.content),
			});
		}

		return entities;
	}

	async get_recent_entities(limit = 10): Promise<Entity[]> {
		const results = this.db
			.prepare(
				'SELECT name, entity_type FROM entities ORDER BY created_at DESC LIMIT ?',
			)
			.all(limit) as Array<{ name: string; entity_type: string }>;

		const entities: Entity[] = [];
		for (const row of results) {
			const name = row.name;
			const observations = this.db
				.prepare(
					'SELECT content FROM observations WHERE entity_name = ?',
				)
				.all(name) as Array<{ content: string }>;

			entities.push({
				name,
				entityType: row.entity_type,
				observations: observations.map((obs) => obs.content),
			});
		}

		return entities;
	}

	// Relation operations
	async create_relations(relations: Relation[]): Promise<void> {
		try {
			if (relations.length === 0) return;

			const transaction = this.db.transaction(() => {
				// Use INSERT OR IGNORE to silently skip duplicate relations
				const insert = this.db.prepare(
					'INSERT OR IGNORE INTO relations (source, target, relation_type) VALUES (?, ?, ?)',
				);
				for (const relation of relations) {
					insert.run(
						relation.from,
						relation.to,
						relation.relationType,
					);
				}
			});

			transaction();
		} catch (error) {
			throw new Error(
				`Failed to create relations: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async delete_entity(name: string): Promise<void> {
		try {
			// Check if entity exists first
			const existing = this.db
				.prepare('SELECT name FROM entities WHERE name = ?')
				.get(name);

			if (!existing) {
				throw new Error(`Entity not found: ${name}`);
			}

			const transaction = this.db.transaction(() => {
				// Delete associated observations first (due to foreign key)
				this.db
					.prepare('DELETE FROM observations WHERE entity_name = ?')
					.run(name);

				// Delete associated relations (due to foreign key)
				this.db
					.prepare(
						'DELETE FROM relations WHERE source = ? OR target = ?',
					)
					.run(name, name);

				// Delete the entity
				this.db
					.prepare('DELETE FROM entities WHERE name = ?')
					.run(name);
			});

			transaction();
		} catch (error) {
			throw new Error(
				`Failed to delete entity "${name}": ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async delete_relation(
		source: string,
		target: string,
		type: string,
	): Promise<void> {
		try {
			const result = this.db
				.prepare(
					'DELETE FROM relations WHERE source = ? AND target = ? AND relation_type = ?',
				)
				.run(source, target, type);

			if (result.changes === 0) {
				throw new Error(
					`Relation not found: ${source} -> ${target} (${type})`,
				);
			}
		} catch (error) {
			throw new Error(
				`Failed to delete relation: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	async get_relations_for_entities(
		entities: Entity[],
	): Promise<Relation[]> {
		if (entities.length === 0) return [];

		const entity_names = entities.map((e) => e.name);
		const placeholders = entity_names.map(() => '?').join(',');

		const results = this.db
			.prepare(
				`
        SELECT source as from_entity, target as to_entity, relation_type
        FROM relations
        WHERE source IN (${placeholders})
        OR target IN (${placeholders})
      `,
			)
			.all(...entity_names, ...entity_names) as Array<{
			from_entity: string;
			to_entity: string;
			relation_type: string;
		}>;

		return results.map((row) => ({
			from: row.from_entity,
			to: row.to_entity,
			relationType: row.relation_type,
		}));
	}

	async get_entity_with_relations(
		name: string,
	): Promise<{ entity: Entity; relations: Relation[]; relatedEntities: Entity[] }> {
		// Get the main entity
		const entity = await this.get_entity(name);

		// Get all relations where this entity is source or target
		const relations = await this.get_relations_for_entities([entity]);

		// Get all related entity names
		const related_names = new Set<string>();
		for (const rel of relations) {
			if (rel.from !== name) related_names.add(rel.from);
			if (rel.to !== name) related_names.add(rel.to);
		}

		// Fetch all related entities
		const relatedEntities: Entity[] = [];
		for (const related_name of related_names) {
			try {
				const related_entity = await this.get_entity(related_name);
				relatedEntities.push(related_entity);
			} catch (error) {
				// Skip entities that no longer exist
				console.warn(
					`Related entity "${related_name}" not found: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		return { entity, relations, relatedEntities };
	}

	// Graph operations
	async read_graph(): Promise<{
		entities: Entity[];
		relations: Relation[];
	}> {
		const recent_entities = await this.get_recent_entities();
		const relations =
			await this.get_relations_for_entities(recent_entities);
		return { entities: recent_entities, relations };
	}

	async search_nodes(
		query: string,
		limit: number = 10,
	): Promise<{ entities: Entity[]; relations: Relation[] }> {
		try {
			// Validate text query
			if (typeof query !== 'string') {
				throw new Error('Text query must be a string');
			}
			if (query.trim() === '') {
				throw new Error('Text query cannot be empty');
			}

			// Text-based search
			const entities = await this.search_entities(query, limit);

			// If no entities found, return empty result
			if (entities.length === 0) {
				return { entities: [], relations: [] };
			}

			const relations =
				await this.get_relations_for_entities(entities);
			return { entities, relations };
		} catch (error) {
			throw new Error(
				`Node search failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	// Database operations
	public get_client() {
		return this.db;
	}

	public async initialize() {
		try {
			// Create tables if they don't exist
			this.db.exec(`
				CREATE TABLE IF NOT EXISTS entities (
					name TEXT PRIMARY KEY,
					entity_type TEXT NOT NULL,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				);
			`);

			this.db.exec(`
				CREATE TABLE IF NOT EXISTS observations (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					entity_name TEXT NOT NULL,
					content TEXT NOT NULL,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (entity_name) REFERENCES entities(name)
				);
			`);

			this.db.exec(`
				CREATE TABLE IF NOT EXISTS relations (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					source TEXT NOT NULL,
					target TEXT NOT NULL,
					relation_type TEXT NOT NULL,
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (source) REFERENCES entities(name),
					FOREIGN KEY (target) REFERENCES entities(name),
					UNIQUE(source, target, relation_type)
				);
			`);

			// Create indexes
			this.db.exec(`
				CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
			`);

			this.db.exec(`
				CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_name);
			`);

			this.db.exec(`
				CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source);
			`);

			this.db.exec(`
				CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target);
			`);
		} catch (error) {
			throw new Error(
				`Database initialization failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	public async close() {
		try {
			this.db.close();
		} catch (error) {
			console.error('Error closing database connection:', error);
		}
	}
}

export type { DatabaseConfig };
