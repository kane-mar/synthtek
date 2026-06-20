/**
 * Provider Modal E2E Test
 *
 * Tests the "Add Provider" modal flow in the new frontend.
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";

/** Type text into any element (works with custom <text> elements) */
async function typeText(page, selector, text) {
	const el = page.locator(selector);
	await el.waitFor({ state: "visible", timeout: 5000 });
	await el.click();
	await page.waitForTimeout(100);
	await el.pressSequentially(text, { delay: 10 });
}

test.describe("Provider Modal", () => {
	test("opens the add provider modal", async ({ page }) => {
		await page.goto(`${BASE_URL}/#config`);
		await page.waitForSelector("#content:not(:empty)", { timeout: 5000 });

		await page.click("#add-provider-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5000 });
		await expect(page.locator("#modal-title")).toContainText(/Add|Edit/);
	});

	test("fills and submits the add provider form", async ({ page }) => {
		const requests: string[] = [];
		page.on("request", (req) => requests.push(`${req.method()} ${req.url()}`));

		const pageErrors: string[] = [];
		page.on("pageerror", (err) => pageErrors.push(err.message));

		await page.goto(`${BASE_URL}/#config`);
		await page.waitForSelector("#content:not(:empty)", { timeout: 5000 });

		// Open modal
		await page.click("#add-provider-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5000 });

		// Fill fields using pressSequentially (works with <text> elements)
		await typeText(page, "#prov-name", "Test Provider");
		await page.locator("#prov-type").selectOption("openai");
		await typeText(page, "#prov-url", "https://api.openai.com");
		await typeText(page, "#prov-key", "sk-test123");
		await typeText(page, "#prov-models", "gpt-4");
		await typeText(page, "#prov-default", "gpt-4");

		// Click Save
		await page.click("#save-provider");
		await page.waitForTimeout(2000);

		// Check results
		console.log("=== Requests ===");
		for (const req of requests) console.log(req);
		console.log("=== Page Errors ===");
		for (const err of pageErrors) console.log(err);

		// Check if modal overlay is still visible
		const overlayVisible = await page.locator(".modal-overlay").isVisible();
		console.log(`Modal overlay still visible: ${overlayVisible}`);

		// Check for provider rows in table
		const rows = await page.locator("table tbody tr").count();
		console.log(`Table rows: ${rows}`);
	});

	test("intercepts the POST request to /api/providers", async ({ page }) => {
		await page.route("**/api/providers", async (route) => {
			const request = route.request();
			console.log(`Intercepted: ${request.method()} ${request.url()}`);
			console.log(`PostData:`, request.postData());
			await route.continue();
		});

		await page.goto(`${BASE_URL}/#config`);
		await page.waitForSelector("#content:not(:empty)", { timeout: 5000 });

		await page.click("#add-provider-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5000 });

		await typeText(page, "#prov-name", "Test Provider");

		await page.click("#save-provider");
		await page.waitForTimeout(2000);
	});
});
