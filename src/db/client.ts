import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { Entity, Relation, SearchResult } from '../types/index.js';

// Types for configuration
interface DatabaseConfig {
	dbPath: string;
}

// Vector dimension constant (1536 for OpenAI ada-002 compatibility)
const VECTOR_DIMENSIONS = 1536;

export class DatabaseManager {
	private static instance: DatabaseManager;
	private db: Database.Database;

	private constructor(config: DatabaseConfig) {
		if (!config.dbPath) {
			throw new Error('Database path is required');
		}

		// Open database connection
		this.db = new Database(config.dbPath);

		// Load sqlite-vec extension
		sqliteVec.load(this.db);

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

	// Convert Float32Array to Buffer for sqlite-vec
	private vector_to_buffer(
		numbers: number[] | undefined,
	): Buffer | null {
		// If no embedding provided, return null
		if (!numbers || !Array.isArray(numbers)) {
			return null;
		}

		// Validate vector dimensions
		if (numbers.length !== VECTOR_DIMENSIONS) {
			throw new Error(
				`Vector dimension mismatch: expected ${VECTOR_DIMENSIONS} dimensions (compatible with OpenAI ada-002/ada-003-small), but received ${numbers.length}. Please use ${VECTOR_DIMENSIONS}-dimensional embeddings or omit the embedding parameter to skip vector search for this entity.`,
			);
		}

		// Validate all elements are numbers and convert NaN/Infinity to 0
		const sanitized_numbers = numbers.map((n) => {
			if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) {
				console.warn(
					`Invalid vector value detected, using 0.0 instead of: ${n}`,
				);
				return 0.0;
			}
			return n;
		});

		// Create Float32Array and return as Buffer
		const float32Array = new Float32Array(sanitized_numbers);
		return Buffer.from(float32Array.buffer);
	}

	// Convert Buffer back to number array
	private buffer_to_vector(
		buffer: Buffer | null,
	): number[] | undefined {
		if (!buffer) {
			return undefined;
		}
		const float32Array = new Float32Array(
			buffer.buffer,
			buffer.byteOffset,
			buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
		);
		return Array.from(float32Array);
	}

	// Entity operations
	async create_entities(
		entities: Array<{
			name: string;
			entityType: string;
			observations: string[];
			embedding?: number[];
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

				// Handle vector embedding
				if (entity.embedding) {
					const vector_buffer = this.vector_to_buffer(
						entity.embedding,
					);
					if (vector_buffer) {
						// Check if vector exists
						const existing_vec = this.db
							.prepare(
								'SELECT rowid FROM entities_vec WHERE rowid = (SELECT rowid FROM entities WHERE name = ?)',
							)
							.get(entity.name);

						if (existing_vec) {
							// Update existing vector
							this.db
								.prepare(
									'UPDATE entities_vec SET embedding = ? WHERE rowid = (SELECT rowid FROM entities WHERE name = ?)',
								)
								.run(vector_buffer, entity.name);
						} else {
							// Insert new vector
							this.db
								.prepare(
									'INSERT INTO entities_vec (embedding) VALUES (?)',
								)
								.run(vector_buffer);
						}
					}
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

	async search_similar(
		embedding: number[],
		limit: number = 5,
	): Promise<SearchResult[]> {
		try {
			// Validate input vector
			if (!Array.isArray(embedding)) {
				throw new Error('Search embedding must be an array');
			}

			const vector_buffer = this.vector_to_buffer(embedding);
			if (!vector_buffer) {
				throw new Error('Invalid embedding vector');
			}

			// Use vec_distance_cosine for similarity search
			const results = this.db
				.prepare(
					`
					SELECT
						e.name,
						e.entity_type,
						v.embedding,
						vec_distance_cosine(v.embedding, ?) as distance
					FROM entities e
					INNER JOIN entities_vec v ON v.rowid = e.rowid
					WHERE v.embedding IS NOT NULL
					ORDER BY distance ASC
					LIMIT ?
				`,
				)
				.all(vector_buffer, limit) as Array<{
				name: string;
				entity_type: string;
				embedding: Buffer;
				distance: number;
			}>;

			// Get observations for each entity
			const search_results: SearchResult[] = [];
			for (const row of results) {
				try {
					const observations = this.db
						.prepare(
							'SELECT content FROM observations WHERE entity_name = ?',
						)
						.all(row.name) as Array<{ content: string }>;

					const entity_embedding = this.buffer_to_vector(
						row.embedding,
					);

					search_results.push({
						entity: {
							name: row.name,
							entityType: row.entity_type,
							observations: observations.map((obs) => obs.content),
							embedding: entity_embedding,
						},
						distance: row.distance,
					});
				} catch (error) {
					console.warn(
						`Failed to process search result for entity "${
							row.name
						}": ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
					// Continue processing other results
					continue;
				}
			}

			return search_results;
		} catch (error) {
			throw new Error(
				`Similarity search failed: ${
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

		// Try to get embedding from vec table
		let embedding: number[] | undefined;
		const vec_result = this.db
			.prepare(
				'SELECT v.embedding FROM entities_vec v INNER JOIN entities e ON v.rowid = e.rowid WHERE e.name = ?',
			)
			.get(name) as { embedding: Buffer } | undefined;

		if (vec_result) {
			embedding = this.buffer_to_vector(vec_result.embedding);
		}

		return {
			name: entity_result.name,
			entityType: entity_result.entity_type,
			observations: observations_result.map((row) => row.content),
			embedding,
		};
	}

	async search_entities(query: string): Promise<Entity[]> {
		const results = this.db
			.prepare(
				`
        SELECT DISTINCT e.name, e.entity_type
        FROM entities e
        LEFT JOIN observations o ON e.name = o.entity_name
        WHERE e.name LIKE ? OR e.entity_type LIKE ? OR o.content LIKE ?
      `,
			)
			.all(`%${query}%`, `%${query}%`, `%${query}%`) as Array<{
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

			// Try to get embedding
			let embedding: number[] | undefined;
			const vec_result = this.db
				.prepare(
					'SELECT v.embedding FROM entities_vec v INNER JOIN entities e ON v.rowid = e.rowid WHERE e.name = ?',
				)
				.get(name) as { embedding: Buffer } | undefined;

			if (vec_result) {
				embedding = this.buffer_to_vector(vec_result.embedding);
			}

			entities.push({
				name,
				entityType: row.entity_type,
				observations: observations.map((obs) => obs.content),
				embedding,
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

			// Try to get embedding
			let embedding: number[] | undefined;
			const vec_result = this.db
				.prepare(
					'SELECT v.embedding FROM entities_vec v INNER JOIN entities e ON v.rowid = e.rowid WHERE e.name = ?',
				)
				.get(name) as { embedding: Buffer } | undefined;

			if (vec_result) {
				embedding = this.buffer_to_vector(vec_result.embedding);
			}

			entities.push({
				name,
				entityType: row.entity_type,
				observations: observations.map((obs) => obs.content),
				embedding,
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

				// Delete from vector table
				this.db
					.prepare(
						'DELETE FROM entities_vec WHERE rowid = (SELECT rowid FROM entities WHERE name = ?)',
					)
					.run(name);

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

	// Graph operations
	async read_graph(): Promise<{
		entities: Entity[];
		relations: Relation[];
	}> {
		const recent_entities = await this.get_recent_entities();
		const relations = await this.get_relations_for_entities(
			recent_entities,
		);
		return { entities: recent_entities, relations };
	}

	async search_nodes(
		query: string | number[],
	): Promise<{ entities: Entity[]; relations: Relation[] }> {
		try {
			let entities: Entity[];

			if (Array.isArray(query)) {
				// Validate vector query
				if (!query.every((n) => typeof n === 'number')) {
					throw new Error('Vector query must contain only numbers');
				}
				// Vector similarity search
				const results = await this.search_similar(query);
				entities = results.map((r) => r.entity);
			} else {
				// Validate text query
				if (typeof query !== 'string') {
					throw new Error('Text query must be a string');
				}
				if (query.trim() === '') {
					throw new Error('Text query cannot be empty');
				}
				// Text-based search
				entities = await this.search_entities(query);
			}

			// If no entities found, return empty result
			if (entities.length === 0) {
				return { entities: [], relations: [] };
			}

			const relations = await this.get_relations_for_entities(
				entities,
			);
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

			// Create virtual table for vector embeddings
			this.db.exec(`
				CREATE VIRTUAL TABLE IF NOT EXISTS entities_vec
				USING vec0(embedding float[${VECTOR_DIMENSIONS}]);
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
