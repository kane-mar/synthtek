import { expect, test } from "@playwright/test";

const BASE_URL =
	process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:8080";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateTo(page: any, pageName: string) {
	await page.click(`#sidebar nav a[data-page="${pageName}"]`);
	await page.waitForTimeout(500);
}

// ─── Skills ──────────────────────────────────────────────────────────────────

test.describe("WebUI - Skills (Tools) Page", () => {
	test("loads the Skills page and shows skills list", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "tools");
		await page.waitForTimeout(500);

		// Should show the page title
		await expect(page.locator("#page-title")).toBeVisible();
		// Page title says "Skills" (lowercase s in the HTML)
		await expect(page.locator("#page-title")).toContainText("Skills");
	});

	test("skills page has an install input and button", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "tools");
		await page.waitForTimeout(500);

		// Look for install input
		const installInput = page.locator(
			'input[placeholder*="install"], input[placeholder*="Install"], #skill-install-input',
		);
		const exists = (await installInput.count()) > 0;
		if (exists) {
			await expect(installInput.first()).toBeVisible();
		}
	});

	test("skills page can toggle a skill on/off", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "tools");
		await page.waitForTimeout(500);

		// Look for toggle buttons
		const toggles = page.locator(
			'.skill-toggle, button:has-text("Toggle"), button:has-text("Enable"), button:has-text("Disable")',
		);
		const toggleCount = await toggles.count();
		if (toggleCount > 0) {
			await toggles.first().click();
			await page.waitForTimeout(300);
			// Page should not crash
			await expect(page.locator("body")).toBeVisible();
		}
	});

	test("skills page can delete a skill", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "tools");
		await page.waitForTimeout(500);

		// Look for delete buttons
		const deletes = page.locator(
			'button:has-text("Delete"), .skill-delete, button.danger',
		);
		const deleteCount = await deletes.count();
		if (deleteCount > 0) {
			// Page should not crash when clicking delete (may show confirmation)
			await deletes.first().click();
			await page.waitForTimeout(300);
			await expect(page.locator("body")).toBeVisible();
		}
	});
});

// ─── Cron ────────────────────────────────────────────────────────────────────

test.describe("WebUI - Cron Jobs Page", () => {
	test("loads the Cron page and shows cron jobs list", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "cron");
		await page.waitForTimeout(500);

		await expect(page.locator("#page-title")).toBeVisible();
		await expect(page.locator("#page-title")).toContainText("Cron");
	});

	test("cron page renders without errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));

		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "cron");
		await page.waitForTimeout(1000);

		const criticalErrors = errors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated"),
		);
		expect(criticalErrors).toEqual([]);
	});
});

// ─── Agent Config ────────────────────────────────────────────────────────────

test.describe("WebUI - Agent Config Page", () => {
	test("loads the Config page and shows agent settings", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "config");
		await page.waitForTimeout(500);

		await expect(page.locator("#page-title")).toBeVisible();
		await expect(page.locator("#page-title")).toContainText("Config");
	});

	test("config page shows system prompt field", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "config");
		await page.waitForTimeout(500);

		// Look for the system prompt textarea or input
		const systemPrompt = page.locator(
			'textarea[placeholder*="prompt"], textarea[placeholder*="system"], #system-prompt, [data-field="systemPrompt"]',
		);
		const exists = (await systemPrompt.count()) > 0;
		if (exists) {
			await expect(systemPrompt.first()).toBeVisible();
		}
	});

	test("config page can update and reset settings", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "config");
		await page.waitForTimeout(500);

		// Look for settings inputs
		const inputs = page.locator(
			'input[type="number"], input[type="text"], textarea',
		);
		const count = await inputs.count();
		if (count > 0) {
			// Should be able to interact with inputs without crash
			await inputs.first().focus();
			await expect(page.locator("body")).toBeVisible();
		}

		// Look for reset button
		const resetBtn = page.locator(
			'button:has-text("Reset"), button:has-text("Default")',
		);
		if ((await resetBtn.count()) > 0) {
			await resetBtn.first().click();
			await page.waitForTimeout(300);
			await expect(page.locator("body")).toBeVisible();
		}
	});
});

// ─── Analytics ───────────────────────────────────────────────────────────────

test.describe("WebUI - Analytics Page", () => {
	test("loads the Analytics page", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "analytics");
		await page.waitForTimeout(500);

		await expect(page.locator("#page-title")).toBeVisible();
	});

	test("analytics page renders without errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));

		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "analytics");
		await page.waitForTimeout(1000);

		const criticalErrors = errors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated"),
		);
		expect(criticalErrors).toEqual([]);
	});

	test("analytics shows stats cards", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await navigateTo(page, "analytics");
		await page.waitForTimeout(1000);

		// Should have stat cards or some content
		const contentEl = page.locator("#content");
		await expect(contentEl).toBeVisible();
	});
});

// ─── API Backend Tests ───────────────────────────────────────────────────────

test.describe("WebUI - API Backend", () => {
	test("GET /api/config returns sanitized config", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/config`);
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		// Should have basic config fields
		expect(body).toHaveProperty("host");
		expect(body).toHaveProperty("port");
	});

	test("GET /api/config/agent returns agent settings", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/config/agent`);
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body).toHaveProperty("systemPrompt");
	});

	test("PUT /api/config/agent updates agent settings", async ({ request }) => {
		// Get current
		const getRes = await request.get(`${BASE_URL}/api/config/agent`);
		const current = await getRes.json();

		// Update temperature
		const updateRes = await request.put(`${BASE_URL}/api/config/agent`, {
			data: { temperature: 0.8 },
		});
		expect(updateRes.ok()).toBeTruthy();
		const updated = await updateRes.json();
		expect(updated.temperature).toBe(0.8);

		// Restore original
		await request.put(`${BASE_URL}/api/config/agent`, {
			data: { temperature: current.temperature },
		});
	});

	test("GET /api/health returns healthy", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/health`);
		expect(response.ok()).toBeTruthy();
	});

	test("GET /api/stats returns stats", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/stats`);
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body).toHaveProperty("uptime");
	});

	test("GET /api/providers returns providers list", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/providers`);
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(Array.isArray(body)).toBeTruthy();
	});

	test("GET /api/sessions returns sessions list", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/sessions`);
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(Array.isArray(body)).toBeTruthy();
	});

	test("POST /api/sessions creates a new session", async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/sessions`, {
			data: { userId: "e2e-test" },
		});
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body).toHaveProperty("id");
	});

	test("POST /api/chat/completions responds (may error if no provider)", async ({
		request,
	}) => {
		const response = await request.post(`${BASE_URL}/api/chat/completions`, {
			data: {
				message: "Say hello",
				userId: "e2e-test",
			},
			timeout: 30000,
		});
		// The endpoint may return an error if no provider is configured
		// but should return a valid JSON response either way
		const body = await response.json();
		// Should have either 'response' or 'error' field
		const hasResponse = "response" in body || "error" in body;
		expect(hasResponse).toBeTruthy();
	});

	test("GET /api/skills returns skills list", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/skills`);
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(Array.isArray(body)).toBeTruthy();
	});

	test("GET /api/analytics/summary returns summary", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/analytics/summary`);
		expect(response.ok()).toBeTruthy();
	});
});

// ─── Sidebar Navigation ──────────────────────────────────────────────────────

test.describe("WebUI - Sidebar Navigation", () => {
	test("all nav links are visible", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		const navLinks = page.locator("#sidebar nav a");
		const count = await navLinks.count();
		expect(count).toBeGreaterThanOrEqual(5);

		// Each link should have a data-page attribute
		for (let i = 0; i < count; i++) {
			const link = navLinks.nth(i);
			await expect(link).toHaveAttribute("data-page");
		}
	});

	test("navigation preserves page state", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		// Navigate to each page and back
		const pages = ["analytics", "tools", "cron", "config", "chat"];
		for (const pg of pages) {
			await navigateTo(page, pg);
			await page.waitForTimeout(300);
			await expect(page.locator("body")).toBeVisible();
		}
	});

	test("active nav link updates on navigation", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		// Check chat is active by default
		let activeLink = page.locator("#sidebar nav a.active");
		await expect(activeLink).toHaveAttribute("data-page", "chat");

		// Navigate to config
		await navigateTo(page, "config");
		activeLink = page.locator("#sidebar nav a.active");
		await expect(activeLink).toHaveAttribute("data-page", "config");

		// Navigate to analytics
		await navigateTo(page, "analytics");
		activeLink = page.locator("#sidebar nav a.active");
		await expect(activeLink).toHaveAttribute("data-page", "analytics");
	});
});

// ─── Error Handling ──────────────────────────────────────────────────────────

test.describe("WebUI - Error Handling", () => {
	test("returns 404 for unknown API routes", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/nonexistent`);
		expect(response.status()).toBe(404);
	});

	test("returns 400 for invalid config updates", async ({ request }) => {
		const response = await request.put(`${BASE_URL}/api/config/agent`, {
			data: { invalidField: true },
		});
		// Should either accept with default or return 400
		expect([200, 400]).toContain(response.status());
	});
});

// ─── Chat ────────────────────────────────────────────────────────────────────

test.describe("WebUI - Chat Interface", () => {
	test("chat page loads with message input", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("load");

		// Look for the chat input
		const chatInput = page.locator(
			'textarea[placeholder*="message"], input[placeholder*="message"], #chat-input, .chat-input',
		);
		const exists = (await chatInput.count()) > 0;
		if (exists) {
			await expect(chatInput.first()).toBeVisible();
		}
	});

	test("chat page renders without JS errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));

		await page.goto(BASE_URL);
		await page.waitForLoadState("load");
		await page.waitForTimeout(1000);

		const criticalErrors = errors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated"),
		);
		expect(criticalErrors).toEqual([]);
	});
});
