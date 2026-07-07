/**
 * SynthTek WebUI E2E tests.
 * Core functional tests — page loads, navigation, and API health.
 * Kept lean to avoid OOM on the self-hosted runner.
 */
import { expect, test } from "@playwright/test";

const BASE_URL =
	process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:8080";

test.describe("SynthTek WebUI", () => {
	// ── Page Load ────────────────────────────────────────────────────────

	test("page loads with sidebar and main content", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar", { timeout: 15000 });
		await page.waitForSelector("#main", { timeout: 5000 });
		await expect(page.locator("#sidebar")).toBeVisible();
	});

	test("chat link is active by default and page has title", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar nav a.active", { timeout: 15000 });
		await page.waitForSelector("#page-title", { timeout: 5000 });

		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"chat",
		);
		await expect(page.locator("#page-title")).toBeVisible();
	});

	test("chat page renders with input and send button", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#chat-messages", { timeout: 15000 });
		await expect(page.locator("#msg-input")).toBeVisible();
		await expect(page.locator("#send-btn")).toBeVisible();
	});

	// ── URL-based Navigation ─────────────────────────────────────────────

	test("navigating via URL hash shows correct pages", async ({ page }) => {
		// Config
		await page.goto(`${BASE_URL}/#config`);
		await page.waitForSelector("#config-panel", { timeout: 15000 });
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"config",
		);

		// Analytics
		await page.goto(`${BASE_URL}/#analytics`);
		await page.waitForTimeout(1000);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"analytics",
		);

		// Tools
		await page.goto(`${BASE_URL}/#tools`);
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"tools",
		);

		// Back to chat
		await page.goto(`${BASE_URL}/#chat`);
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"chat",
		);
	});

	test("invalid hash defaults to chat", async ({ page }) => {
		await page.goto(`${BASE_URL}/#invalid-page`);
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"chat",
		);
	});

	// ── Click-based Navigation ───────────────────────────────────────────

	test("click navigation updates active link correctly", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar nav a.active", { timeout: 15000 });

		await page.click('#sidebar nav a[data-page="config"]');
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"config",
		);

		await page.click('#sidebar nav a[data-page="chat"]');
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"chat",
		);
	});

	// ── Status Bar ───────────────────────────────────────────────────────

	test("status bar shows connection status", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".status-bar", { timeout: 15000 });
		await expect(page.locator(".status-dot")).toBeVisible();
	});

	// ── API Health ───────────────────────────────────────────────────────

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
