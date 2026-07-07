/**
 * SynthTek WebUI E2E tests.
 * API tests run first (lightweight, no browser), then UI tests.
 */
import { expect, test } from "@playwright/test";

const BASE_URL =
	process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:3456";

test.describe("SynthTek WebUI", () => {
	// ── API Health (lightweight, no browser needed) ──────────────────────

	test("API /api/health returns healthy", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/health`);
		expect(resp.ok()).toBeTruthy();
		const body = await resp.json();
		expect(body.status).toBe("started");
	});

	test("API /api/stats returns stats", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/stats`);
		expect(resp.ok()).toBeTruthy();
		const body = await resp.json();
		expect(body).toHaveProperty("activeSessions");
	});

	test("API /api/providers returns providers list", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/providers`);
		expect(resp.ok()).toBeTruthy();
	});

	test("API /api/sessions returns sessions list", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/sessions`);
		expect(resp.ok()).toBeTruthy();
	});

	test("API /api/skills returns skills list", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/skills`);
		expect(resp.ok()).toBeTruthy();
	});

	test("API /api/analytics/summary returns summary", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/analytics/summary`);
		expect(resp.ok()).toBeTruthy();
	});

	test("API /api/metrics returns metrics", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/metrics`);
		expect(resp.ok()).toBeTruthy();
	});

	test("API returns 404 for unknown routes", async ({ request }) => {
		const resp = await request.get(`${BASE_URL}/api/nonexistent`);
		expect(resp.status()).toBe(404);
	});
});
