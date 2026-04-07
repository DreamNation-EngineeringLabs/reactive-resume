import { Pool, type PoolClient } from "pg";
import { env } from "@/utils/env";

declare global {
	var __engLabsPool: Pool | undefined;
}

function getPool(): Pool | null {
	if (!env.ENG_LABS_DATABASE_URL) return null;
	if (!globalThis.__engLabsPool) {
		globalThis.__engLabsPool = new Pool({ connectionString: env.ENG_LABS_DATABASE_URL });
	}
	return globalThis.__engLabsPool;
}

/**
 * Runs a callback with a connected pg client for the eng-labs database.
 * Returns null (and does not run the callback) if ENG_LABS_DATABASE_URL is not configured.
 */
export async function withEngLabsClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T | null> {
	const pool = getPool();
	if (!pool) return null;

	const client = await pool.connect();
	try {
		return await fn(client);
	} finally {
		client.release();
	}
}
