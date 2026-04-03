/**
 * CockroachDB-safe schema push.
 *
 * CockroachDB does not support `ALTER TABLE ... DROP CONSTRAINT` for unique
 * indexes — it requires `DROP INDEX ... CASCADE` instead. Drizzle Kit (which
 * uses the PostgreSQL dialect) generates the former, causing the push to fail
 * every time there is a unique-index diff.
 *
 * This script:
 *   1. Runs `drizzle-kit generate` to produce any new migration SQL file.
 *   2. Maintains a `crdb_migrations` tracking table.
 *   3. For each unapplied migration, patches CockroachDB-incompatible SQL and
 *      executes it directly via a raw pg client.
 *
 * Bootstrap (first run / no tracking table yet):
 *   Pass --apply-from=<folder_prefix> to mark all earlier migrations as
 *   already applied without running their SQL:
 *     pnpm db:push --apply-from=20260402185430
 *
 * Usage:
 *   dotenvx run -- tsx scripts/database/crdb-push.ts [--apply-from=<prefix>]
 */

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

if (!process.env.DATABASE_URL) {
	console.error("🚨 DATABASE_URL is not set. Run via: dotenvx run -- pnpm db:push");
	process.exit(1);
}

// Parse --apply-from=<prefix> CLI arg
const applyFromArg = process.argv.find((a) => a.startsWith("--apply-from="));
const applyFromPrefix = applyFromArg ? applyFromArg.split("=")[1] : null;

// ── 1. Generate migration ─────────────────────────────────────────────────────
console.log("⏳ Generating migration diff...");
try {
	const output = execSync("drizzle-kit generate 2>&1", { encoding: "utf-8" });
	console.log(output.trim());
} catch (err: any) {
	console.error(err.stdout ?? err.message);
	process.exit(1);
}

// ── 2. Connect and ensure tracking table exists ───────────────────────────────
const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
	await client.connect();

	await client.query(`
		CREATE TABLE IF NOT EXISTS crdb_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`);

	// ── 3. Find all migration folders sorted by timestamp ─────────────────────
	const allFolders = readdirSync(MIGRATIONS_DIR)
		.filter((f) => /^\d{14}_/.test(f))
		.sort();

	// ── 4. Get already-applied migrations ─────────────────────────────────────
	const { rows } = await client.query<{ name: string }>("SELECT name FROM crdb_migrations");
	const applied = new Set(rows.map((r) => r.name));

	const pending = allFolders.filter((folder) => !applied.has(folder));

	if (pending.length === 0) {
		console.log("✅ All migrations already applied — nothing to do.");
		process.exit(0);
	}

	// ── 5. Bootstrap: seed old migrations as applied without running SQL ───────
	if (applyFromPrefix) {
		const toSeed = pending.filter((folder) => folder < applyFromPrefix);
		if (toSeed.length > 0) {
			console.log(`\n⏩ Seeding ${toSeed.length} migration(s) as already applied (no SQL run):`);
			for (const folder of toSeed) {
				await client.query("INSERT INTO crdb_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [
					folder,
				]);
				console.log(`   ✓ ${folder}`);
				applied.add(folder);
			}
		}
	}

	const toApply = allFolders.filter((folder) => !applied.has(folder));

	if (toApply.length === 0) {
		console.log("\n✅ All migrations already applied — nothing to do.");
		process.exit(0);
	}

	console.log(`\n📋 ${toApply.length} migration(s) to apply:`);
	for (const folder of toApply) {
		console.log(`   • ${folder}`);
	}
	console.log("");

	// ── 6. Apply each pending migration ───────────────────────────────────────
	for (const folder of toApply) {
		const sqlFile = path.join(MIGRATIONS_DIR, folder, "migration.sql");

		if (!existsSync(sqlFile)) {
			console.warn(`⚠️  Skipping ${folder}: migration.sql not found`);
			continue;
		}

		let sql = readFileSync(sqlFile, "utf-8");

		// Patch CockroachDB-incompatible statements
		// CockroachDB rejects:  ALTER TABLE "t" DROP CONSTRAINT "idx_name";
		// Replace with:         DROP INDEX IF EXISTS "idx_name" CASCADE;
		const patched = sql.replace(
			/ALTER TABLE "[^"]+" DROP CONSTRAINT "([^"]+)";/g,
			(_match, indexName) => {
				console.log(
					`   🔧 Patching: ALTER TABLE DROP CONSTRAINT → DROP INDEX IF EXISTS "${indexName}" CASCADE`,
				);
				return `DROP INDEX IF EXISTS "${indexName}" CASCADE;`;
			},
		);

		if (patched !== sql) {
			sql = patched;
			writeFileSync(sqlFile, sql, "utf-8");
			console.log("   ✅ SQL patched for CockroachDB compatibility.");
		}

		// Split on Drizzle's statement separator
		const statements = sql
			.split("--> statement-breakpoint")
			.map((s) => s.trim())
			.filter(Boolean);

		console.log(`⏳ Applying [${folder}] (${statements.length} statement(s))...`);

		try {
			for (const stmt of statements) {
				await client.query(stmt);
			}
			await client.query("INSERT INTO crdb_migrations (name) VALUES ($1)", [folder]);
			console.log(`✅ Applied [${folder}]`);
		} catch (err: any) {
			console.error(`🚨 Failed on [${folder}]:`, err.message);
			process.exit(1);
		}
	}

	console.log("\n✅ All migrations applied successfully.");
} finally {
	await client.end();
}
