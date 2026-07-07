/**
 * E2E tests for SynthTek WebUI
 *
 * These tests match the current frontend HTML structure.
 * Replace the old tests as the frontend evolves.
 */

import { expect, test } from "@playwright/test";

const BASE_URL =
	process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:8080";

test.describe("SynthTek WebUI", () => {
	// ── Page Load & Structure ─────────────────────────────────────────────

	test("page loads with sidebar, main content, and status bar", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar", { timeout: 15000 });
		await page.waitForSelector("#main", { timeout: 5000 });
		await page.waitForSelector(".status-bar", { timeout: 5000 });

		const sidebar = page.locator("#sidebar");
		await expect(sidebar).toBeVisible();
		await expect(page.locator("#main")).toBeVisible();
	});

	test("sidebar has navigation links with data-page attributes", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar nav", { timeout: 15000 });

		const navLinks = page.locator("#sidebar nav a");
		const count = await navLinks.count();
		expect(count).toBeGreaterThanOrEqual(4);

		const pages = await navLinks.evaluateAll((links) =>
			links.map((a) => a.getAttribute("data-page")),
		);
		expect(pages).toContain("chat");
		expect(pages).toContain("analytics");
		expect(pages).toContain("config");
	});

	test("chat link is active by default", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar nav a.active", { timeout: 15000 });

		const activeLink = page.locator("#sidebar nav a.active");
		await expect(activeLink).toBeVisible();
		await expect(activeLink).toHaveAttribute("data-page", "chat");
	});

	test("page title shows current section", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#page-title", { timeout: 25000 });
		await expect(page.locator("#page-title")).toBeVisible();
	});

	// ── Chat Page ─────────────────────────────────────────────────────────

	test("chat page renders with messages area and input", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#chat-messages", { timeout: 15000 });

		await expect(page.locator("#chat-messages")).toBeVisible();
		await expect(page.locator("#chat-input-bar")).toBeVisible();
		await expect(page.locator("#msg-input")).toBeVisible();
		await expect(page.locator("#send-btn")).toBeVisible();
	});

	test("chat page renders without JavaScript errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));

		await page.goto(BASE_URL);
		await page.waitForSelector("#chat-messages", { timeout: 15000 });

		expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
	});

	// ── Navigation ────────────────────────────────────────────────────────

	test("navigating to analytics shows analytics page", async ({ page }) => {
		await page.goto(`${BASE_URL}/#analytics`);
		await page.waitForSelector("#sidebar nav a.active", { timeout: 15000 });

		// Analytics page should show chart or stats
		await expect(
			page.locator("#sidebar nav a.active[data-page='analytics']"),
		).toBeVisible();
		const hasChart = await page
			.locator("#token-chart")
			.isVisible()
			.catch(() => false);
		const hasStatsCard = await page
			.locator(".stat-card")
			.isVisible()
			.catch(() => false);
		expect(hasChart || hasStatsCard).toBeTruthy();
	});

	test("navigating to tools shows skills page", async ({ page }) => {
		await page.goto(`${BASE_URL}/#tools`);
		await page.waitForSelector("#sidebar nav a.active", { timeout: 15000 });

		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"tools",
		);
	});

	test("navigating to config shows system config", async ({ page }) => {
		await page.goto(`${BASE_URL}/#config`);
		// Wait for config panel to render
		await page.waitForSelector("#config-panel", { timeout: 15000 });

		await expect(page.locator("#config-panel")).toBeVisible();
	});

	test("active nav link updates on navigation", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar nav a.active", { timeout: 15000 });

		// Initially chat
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"chat",
		);

		// Click analytics
		await page.click('#sidebar nav a[data-page="analytics"]');
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"analytics",
		);

		// Click back to chat
		await page.click('#sidebar nav a[data-page="chat"]');
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"chat",
		);
	});

	// ── Config Page ──────────────────────────────────────────────────────

	async function navigateToConfig(page: any, url: string) {
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				await page.goto(url, { timeout: 30000 });
				await page.waitForSelector("#config-panel", { timeout: 25000 });
				return;
			} catch (e: any) {
				if (attempt < 3 && e.message?.includes("ERR_CONNECTION")) {
					console.log(
						`Config navigation attempt ${attempt} failed, retrying...`,
					);
					await new Promise((r) => setTimeout(r, 5000));
					continue;
				}
				throw e;
			}
		}
	}

	test("config page shows provider section with add button", async ({
		page,
	}) => {
		await navigateToConfig(page, `${BASE_URL}/#config`);
		await page.waitForSelector("#add-provider-btn", { timeout: 25000 });

		await expect(page.locator("#config-panel")).toBeVisible();
		await expect(page.locator("#add-provider-btn")).toBeVisible();
	});

	test("config page shows agent settings", async ({ page }) => {
		await navigateToConfig(page, `${BASE_URL}/#config`);
		await page.waitForSelector("#config-agent", { timeout: 25000 });

		await expect(page.locator("#config-agent")).toBeVisible();
		await expect(page.locator("#agent-language")).toBeVisible();
	});

	// ── Status Bar ───────────────────────────────────────────────────────

	test("status bar shows connection status", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".status-bar", { timeout: 15000 });

		const statusDot = page.locator(".status-dot");
		await expect(statusDot).toBeVisible();
	});

	// ── API Health ────────────────────────────────────────────────────────

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

	// ── Hash-based routing ────────────────────────────────────────────────

	test("navigating via URL hash shows correct page", async ({ page }) => {
		await page.goto(`${BASE_URL}/#config`);
		await page.waitForSelector("#config-panel", { timeout: 15000 });
		await expect(page.locator("#config-panel")).toBeVisible();

		await page.goto(`${BASE_URL}/#analytics`);
		await page.waitForTimeout(500);
		await expect(page.locator("#sidebar nav a.active")).toHaveAttribute(
			"data-page",
			"analytics",
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

	// ── Theme / color-scheme ─────────────────────────────────────────────

	test("page loads with light color scheme by default", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector("#sidebar", { timeout: 15000 });

		const scheme = await page.evaluate(() =>
			document.documentElement.getAttribute("style"),
		);
		expect(scheme).toContain("color-scheme");
	});
});
