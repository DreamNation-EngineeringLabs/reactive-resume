// Run: pnpm exec tsx --env-file=.env --test src/integrations/orpc/services/printer.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Browser } from "puppeteer-core";
import { withPage } from "./printer";

function fakeBrowser(fail?: Error) {
	const pages: { closed: boolean }[] = [];
	const browser = {
		connected: true,
		disconnected: false,
		pages,
		newPage: async () => {
			const page = { closed: false, close: async () => void (page.closed = true) };
			pages.push(page);
			return page;
		},
		disconnect: async () => void (browser.disconnected = true),
		fail,
	};
	return browser;
}
const connectTo = (browsers: ReturnType<typeof fakeBrowser>[]) => async () => browsers.shift() as unknown as Browser;
const run = async (_page: unknown, browser: Browser) => {
	const { fail } = browser as unknown as ReturnType<typeof fakeBrowser>;
	if (fail) throw fail;
	return "pdf";
};

test("a session the printer dropped is retried once on a new connection", async () => {
	const stale = fakeBrowser(new Error("Navigating frame was detached"));
	const fresh = fakeBrowser();
	assert.equal(await withPage(run, connectTo([stale, fresh])), "pdf");
	assert.equal(stale.disconnected, true);
	assert.ok([...stale.pages, ...fresh.pages].every((p) => p.closed));
});

test("a render error is not retried, and its page is still closed", async () => {
	const browser = fakeBrowser(new Error("Waiting failed: 5000ms exceeded"));
	const next = fakeBrowser();
	await assert.rejects(withPage(run, connectTo([browser, next])), /5000ms exceeded/);
	assert.equal(next.pages.length, 0);
	assert.equal(browser.pages[0].closed, true);
});

test("a second dropped session gives up instead of looping", async () => {
	const lost = new Error("Target closed");
	await assert.rejects(
		withPage(run, connectTo([fakeBrowser(lost), fakeBrowser(lost), fakeBrowser()])),
		/Target closed/,
	);
});
