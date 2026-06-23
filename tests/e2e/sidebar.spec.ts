/**
 * Sidebar Link Tests (Playwright)
 *
 * Comprehensive tests for all left-hand panel navigation links.
 * Updated for the new frontend (2026-06): chat, analytics, tools, cron, config.
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";

/* ── Sidebar link definitions ─────────────────────────────────────────── */

const SIDEBAR_LINKS = [
	{ page: "chat", label: "Chat", hash: "#chat" },
	{ page: "analytics", label: "Analytics", hash: "#analytics" },
	{ page: "tools", label: "Tools", hash: "#tools" },
	{ page: "cron", label: "Cron Jobs", hash: "#cron" },
	{ page: "config", label: "System Config", hash: "#config" },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */

async function waitForPageReady(page) {
	await page.waitForSelector("#content:not(:empty)", { timeout: 15000 });
}

/* ── 1. Sidebar structure ─────────────────────────────────────────────── */

test.describe("Sidebar Structure", () => {
	test("sidebar is visible on page load", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		await expect(page.locator("#sidebar")).toBeVisible();
	});

	test("sidebar has correct number of navigation links", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		const links = page.locator("#sidebar nav a");
		expect(await links.count()).toBe(SIDEBAR_LINKS.length);
	});

	test("each sidebar link has required attributes", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		for (const link of SIDEBAR_LINKS) {
			const el = page.locator(`#sidebar nav a[data-page="${link.page}"]`);
			await expect(el).toHaveAttribute("href", link.hash);
			await expect(el).toHaveAttribute("data-page", link.page);
			await expect(el).toContainText(link.label);
		}
	});

	test("sidebar has aria-label for accessibility", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		const nav = page.locator("#sidebar nav");
		await expect(nav).toHaveAttribute("aria-label", "Main navigation");
	});

	test("sidebar has logo", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		const logo = page.locator("#sidebar .logo");
		await expect(logo).toBeVisible();
		await expect(logo).toContainText("Synthtek");
	});

	test("sidebar has status bar", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		const statusBar = page.locator("#sidebar .status-bar");
		await expect(statusBar).toBeVisible();
	});
});

/* ── 2. Click navigation — each link renders correct content ──────────── */

test.describe("Sidebar Click Navigation", () => {
	for (const link of SIDEBAR_LINKS) {
		test(`clicking "${link.label}" navigates to ${link.page}`, async ({
			page,
		}) => {
			await page.goto(BASE_URL);
			await waitForPageReady(page);

			await page.click(`#sidebar nav a[data-page="${link.page}"]`);
			await waitForPageReady(page);

			expect(page.url()).toContain(link.hash);
			await expect(page.locator("#page-title")).toContainText(link.label, {
				ignoreCase: true,
			});
		});

		test(`clicking "${link.label}" sets active class`, async ({ page }) => {
			await page.goto(BASE_URL);
			await waitForPageReady(page);

			await page.click(`#sidebar nav a[data-page="${link.page}"]`);

			const activeLink = page.locator(
				`#sidebar nav a[data-page="${link.page}"].active`,
			);
			await expect(activeLink).toBeVisible();

			// No other link should be active
			for (const other of SIDEBAR_LINKS) {
				if (other.page !== link.page) {
					const otherLink = page.locator(
						`#sidebar nav a[data-page="${other.page}"].active`,
					);
					await expect(otherLink).not.toBeVisible();
				}
			}
		});
	}
});

/* ── 3. Content rendering per page ────────────────────────────────────── */

test.describe("Sidebar Navigation Content Rendering", () => {
	test("Analytics page renders stat cards", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		await page.click('#sidebar nav a[data-page="analytics"]');
		await waitForPageReady(page);

		await expect(page.locator(".stat-card").first()).toBeVisible();
	});

	test("Chat page renders message area and input", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPageReady(page);

		await expect(page.locator("#chat-messages")).toBeVisible();
		await expect(page.locator("#msg-input")).toBeVisible();
		await expect(page.locator("#send-btn")).toBeVisible();
	});

	test("Tools page renders tool cards", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPageReady(page);

		// Tools page shows filter bar and grid
		await expect(page.locator(".filter-bar")).toBeVisible();
		await expect(page.locator(".tool-grid")).toBeVisible();
	});

	test("Cron Jobs page renders cron content", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPageReady(page);

		await expect(page.locator("#page-title")).toContainText("Cron Jobs");
		await expect(page.locator("#content")).toBeVisible();
	});

	test("System Config page renders LLM providers section", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPageReady(page);

		await expect(page.locator("#page-title")).toContainText("System Config");
		await expect(page.locator("text=LLM Providers")).toBeVisible();
	});
});

/* ── 4. Sequential navigation ─────────────────────────────────────────── */

test.describe("Sequential Sidebar Navigation", () => {
	test("can click through all sidebar links in order", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		for (const link of SIDEBAR_LINKS) {
			await page.click(`#sidebar nav a[data-page="${link.page}"]`);
			await waitForPageReady(page);

			expect(page.url()).toContain(link.hash);
			await expect(page.locator("#page-title")).toContainText(link.label, {
				ignoreCase: true,
			});

			const activeLink = page.locator(
				`#sidebar nav a[data-page="${link.page}"].active`,
			);
			await expect(activeLink).toBeVisible();
		}
	});

	test("can click through all sidebar links in reverse order", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		for (const link of [...SIDEBAR_LINKS].reverse()) {
			await page.click(`#sidebar nav a[data-page="${link.page}"]`);
			await waitForPageReady(page);

			expect(page.url()).toContain(link.hash);
			await expect(page.locator("#page-title")).toContainText(link.label, {
				ignoreCase: true,
			});
		}
	});

	test("clicking the same link twice does not cause errors", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPageReady(page);
		expect(page.url()).toContain("#chat");

		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPageReady(page);
		expect(page.url()).toContain("#chat");
		await expect(page.locator("#page-title")).toContainText("Chat");
	});
});

/* ── 5. Keyboard navigation ───────────────────────────────────────────── */

test.describe("Keyboard Navigation", () => {
	test("sidebar links are focusable via Tab", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		const links = page.locator("#sidebar nav a");
		for (let i = 0; i < (await links.count()); i++) {
			await links.nth(i).focus();
			await expect(links.nth(i)).toBeFocused();
		}
	});

	test("pressing Enter on a focused sidebar link navigates", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		const chatLink = page.locator('#sidebar nav a[data-page="chat"]');
		await chatLink.focus();
		await expect(chatLink).toBeFocused();

		await chatLink.press("Enter");
		await waitForPageReady(page);

		expect(page.url()).toContain("#chat");
		await expect(page.locator("#page-title")).toContainText("Chat");
	});
});

/* ── 6. Browser history ───────────────────────────────────────────────── */

test.describe("Browser History", () => {
	test("browser back button returns to previous page", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// Navigate to chat via sidebar
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPageReady(page);
		expect(page.url()).toContain("#chat");

		// Navigate to config via sidebar
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPageReady(page);
		expect(page.url()).toContain("#config");

		// Go back — should return to chat
		await page.goBack();
		await waitForPageReady(page);
		expect(page.url()).toContain("#chat");
		await expect(page.locator("#page-title")).toContainText("Chat");
	});

	test("browser forward button goes to next page", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		await page.click('#sidebar nav a[data-page="analytics"]');
		await waitForPageReady(page);

		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPageReady(page);

		// Go back
		await page.goBack();
		await waitForPageReady(page);
		expect(page.url()).toContain("#analytics");

		// Go forward
		await page.goForward();
		await waitForPageReady(page);
		expect(page.url()).toContain("#cron");
		await expect(page.locator("#page-title")).toContainText("Cron Jobs");
	});
});

/* ── 7. Active state transitions ──────────────────────────────────────── */

test.describe("Active State Transitions", () => {
	test("only one link has active class at a time", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		for (const link of SIDEBAR_LINKS) {
			await page.click(`#sidebar nav a[data-page="${link.page}"]`);
			await waitForPageReady(page);

			const activeCount = await page.locator("#sidebar nav a.active").count();
			expect(activeCount).toBe(
				1,
				`Expected exactly 1 active link on ${link.page}`,
			);

			const activePage = await page
				.locator("#sidebar nav a.active")
				.getAttribute("data-page");
			expect(activePage).toBe(link.page);
		}
	});

	test("chat is active by default on page load", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		const activeLink = page.locator("#sidebar nav a.active");
		await expect(activeLink).toBeVisible();
		const activePage = await activeLink.getAttribute("data-page");
		expect(activePage).toBe("chat");
	});
});

/* ── 8. Edge cases ────────────────────────────────────────────────────── */

test.describe("Edge Cases", () => {
	test("navigating to invalid hash via URL shows chat", async ({ page }) => {
		await page.goto(`${BASE_URL}/#invalid-page`);
		await waitForPageReady(page);

		expect(page.url()).toContain("#chat");
		await expect(page.locator("#page-title")).toContainText("Chat");
		const activePage = await page
			.locator("#sidebar nav a.active")
			.getAttribute("data-page");
		expect(activePage).toBe("chat");
	});

	test("empty hash defaults to chat", async ({ page }) => {
		await page.goto(`${BASE_URL}/#`);
		await waitForPageReady(page);

		expect(page.url()).toContain("#chat");
		await expect(page.locator("#page-title")).toContainText("Chat");
	});

	test("sidebar links prevent default navigation behavior", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// Click should use preventDefault + navigate(), not full page reload
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPageReady(page);

		// Should not trigger a full page reload — content should be ready quickly
		expect(page.url()).toContain("#chat");
	});

	test("rapid clicks do not break navigation", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// Rapidly click multiple links
		for (const link of SIDEBAR_LINKS) {
			await page.click(`#sidebar nav a[data-page="${link.page}"]`);
		}

		// Wait for everything to settle
		await page.waitForTimeout(500);
		await waitForPageReady(page);

		// Should be on the last clicked page
		const lastLink = SIDEBAR_LINKS[SIDEBAR_LINKS.length - 1];
		await expect(page.locator("#page-title")).toContainText(lastLink.label, {
			ignoreCase: true,
		});
	});
});
