const { Pool } = require("pg");

async function main() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		console.error("🚨 DATABASE_URL is not set in your process environment.");
		process.exit(1);
	}

	const pool = new Pool({ connectionString: databaseUrl });
	const client = await pool.connect();

	try {
		console.log("⌛ Dropping the problematic index...");
		await client.query('DROP INDEX "resume_evaluation_resume_id_checklist_id_index" CASCADE;');
		console.log("✅ Success! The index has been dropped.");
	} catch (err) {
		if (err.message.includes("does not exist")) {
			console.log("ℹ️ Index didn't exist, which is also fine.");
		} else {
			console.error("🚨 Failed to drop index:", err.message);
		}
	} finally {
		client.release();
		await pool.end();
	}
}

main();
