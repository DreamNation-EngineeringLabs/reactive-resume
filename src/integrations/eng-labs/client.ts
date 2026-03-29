import { Pool } from "pg";
import { env } from "@/utils/env";

declare global {
	var __engLabsPool: Pool | undefined;
}

export function getEngLabsPool(): Pool | null {
	if (!env.ENG_LABS_DATABASE_URL) return null;

	if (!globalThis.__engLabsPool) {
		globalThis.__engLabsPool = new Pool({ connectionString: env.ENG_LABS_DATABASE_URL });
	}

	return globalThis.__engLabsPool;
}
