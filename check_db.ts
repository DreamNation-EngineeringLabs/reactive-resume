import { db } from "./src/integrations/drizzle/client";
import { sql } from "drizzle-orm";

async function check() {
	try {
		console.log("Checking DB columns for 'resumes' table...");
		const res = await db.execute(sql`
			SELECT column_name, data_type 
			FROM information_schema.columns 
			WHERE table_name = 'resumes'
		`);
		console.log("COLUMNS FOUND:", JSON.stringify(res.rows, null, 2));
	} catch (e) {
		console.error("DB CHECK FAILED:", e);
	} finally {
		process.exit(0);
	}
}

check();
