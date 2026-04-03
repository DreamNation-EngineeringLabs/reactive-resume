import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export async function migrateDatabase() {
	console.log("⌛ Running database migrations...");

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("🚨 DATABASE_URL is not set");
		process.exit(1);
	}

	const pool = new Pool({ connectionString: databaseUrl });
	const db = drizzle({ client: pool });

	try {
		await migrate(db, { migrationsFolder: "./migrations" });
		console.log("✅ Database migrations completed");
	} catch (error) {
		console.error("🚨 Database migrations failed:", error);
	} finally {
		await pool.end();
	}
}

if (import.meta.main) {
	await migrateDatabase();
}
