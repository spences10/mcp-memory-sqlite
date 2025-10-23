import { DatabaseConfig } from './client.js';

export function get_database_config(): DatabaseConfig {
	const db_path = process.env.SQLITE_DB_PATH || './sqlite-memory.db';

	return {
		dbPath: db_path,
	};
}
