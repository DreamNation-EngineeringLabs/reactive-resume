import { Pool } from "pg";
import { env } from "@/utils/env";

declare global {
	var __engLabsPool: Pool | undefined;
}

export function getEngLabsPool(): Pool | null {
	// When resume + eng-labs share one Postgres, only DATABASE_URL may be set — reuse it for org/student reads.
	const url = env.ENG_LABS_DATABASE_URL ?? env.DATABASE_URL;
	if (!url) return null;

	if (!globalThis.__engLabsPool) {
		globalThis.__engLabsPool = new Pool({ connectionString: url });
	}

	return globalThis.__engLabsPool;
}
