import { expect, test } from "@playwright/test";

const BASE_URL =
	process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:8080";

test.describe("WebUI - Navigation & Default Page", () => {
	test("loads the Chat page by default", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("networkidle");

		// The default page should be Chat
		const activeLink = page.locator("#sidebar nav a.active");
		await expect(activeLink).toBeVisible();
		await expect(activeLink).toHaveAttribute("data-page", "chat");
	});

	test("has Analytics tab (not old Dashboard)", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("networkidle");

		// Should have Analytics link
		await expect(
			page.locator('#sidebar nav a[data-page="analytics"]'),
		).toBeVisible();
		// Should not have old dashboard link
		await expect(
			page.locator('#sidebar nav a[data-page="dashboard"]'),
		).not.toBeVisible();
	});

	test("navigates to System Config page", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("networkidle");

		await page.click('#sidebar nav a[data-page="config"]');
		await page.waitForLoadState("networkidle");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("#page-title")).toContainText("System Config");
	});
});

test.describe("WebUI - System Config Tabs", () => {
	test("config tabs are functional", async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForLoadState("networkidle");
		await page.click('#sidebar nav a[data-page="config"]');
		await page.waitForTimeout(500);

		// Should have tab buttons
		const tabButtons = page.locator(".config-tab");
		const count = await tabButtons.count();
		expect(count).toBeGreaterThan(0);

		// Click each tab and verify page doesn't crash
		for (let i = 0; i < Math.min(count, 5); i++) {
			await tabButtons.nth(i).click();
			await page.waitForTimeout(300);
			await expect(page.locator("body")).toBeVisible();
		}
	});
});

test.describe("WebUI - General Health", () => {
	test("page loads without JavaScript errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));

		await page.goto(BASE_URL);
		await page.waitForLoadState("networkidle");

		// Filter out expected/cosmetic errors
		const criticalErrors = errors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated"),
		);

		expect(criticalErrors).toEqual([]);
	});

	test("API health endpoint responds", async ({ request }) => {
		const healthUrl = `${BASE_URL}/api/health`;
		const response = await request.get(healthUrl);
		expect(response.ok()).toBeTruthy();
	});
});
