// Comment bank rows carry the reviewer's organisation; the starter set has no author.
// Needs a migrated local database: node --env-file=.env --import tsx --test <this file>
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/integrations/drizzle/client";
import { reviewSnippet } from "@/integrations/drizzle/schema";
import { createSnippet, listSnippets } from "./resume-feedback.service";

const tenantId = `check-${crypto.randomUUID()}`;
after(() => db.delete(reviewSnippet).where(eq(reviewSnippet.tenantId, tenantId)));

test("starter set and saved snippets keep the organisation", async () => {
	const starters = await listSnippets(tenantId, "org-check");
	assert.ok(starters.length > 0);
	for (const s of starters) {
		assert.equal(s.organisationId, "org-check");
		assert.equal(s.authorId, null);
	}

	await createSnippet(tenantId, "org-check", "reviewer-check", "Quantify this result.");
	const saved = (await listSnippets(tenantId, "org-check")).find((s) => s.content === "Quantify this result.");
	assert.equal(saved?.organisationId, "org-check");
	assert.equal(saved?.authorId, "reviewer-check");
});
