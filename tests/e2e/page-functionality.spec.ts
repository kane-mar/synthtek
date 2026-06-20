/**
 * Page Functionality E2E Tests
 *
 * Tests the core interactions on each page:
 * - Chat: send messages and see responses
 * - Config: switch between tabs (Providers, Themes, Channels)
 * - Tools: add/remove tools and filter by category
 * - Cron Jobs: add/remove cron jobs
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";

async function waitForPage(page) {
	await page.waitForSelector("#content:not(:empty)", { timeout: 5000 });
}

/* ── 1. Chat Page ────────────────────────────────────────────────────── */

test.describe("Chat Page", () => {
	test("chat page renders message area and input", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		await expect(page.locator("#chat-messages")).toBeVisible();
		await expect(page.locator("#msg-input")).toBeVisible();
		await expect(page.locator("#send-btn")).toBeVisible();
	});

	test("typing in the input and clicking send sends a message", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		// Type a message
		const input = page.locator("#msg-input");
		await input.fill("Hello, Synthtek!");

		// Click send
		await page.click("#send-btn");

		// The user message should appear in chat
		await expect(page.locator("#chat-messages .msg-user")).toBeVisible();
		await expect(page.locator("#chat-messages .msg-user")).toContainText(
			"Hello, Synthtek!",
		);
	});

	test("pressing Enter sends a message", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		const input = page.locator("#msg-input");
		await input.fill("Enter key test");

		// Press Enter
		await input.press("Enter");
		await page.waitForTimeout(500);

		// User message should appear (use last to avoid conflict with other tests)
		await expect(page.locator("#chat-messages .msg-user").last()).toBeVisible();
		await expect(page.locator("#chat-messages .msg-user").last()).toContainText(
			"Enter key test",
		);
	});

	test("empty message does not send", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		// Wait for chat messages to finish loading (check that either messages or error/empty state appeared)
		await page
			.waitForFunction(
				() => {
					const msgs = document.querySelectorAll("#chat-messages .msg");
					return msgs.length > 0 || document.querySelector(".msg-assistant");
				},
				{ timeout: 5000 },
			)
			.catch(() => {});

		// Count existing messages after loading completed
		const beforeCount = await page.locator("#chat-messages .msg").count();

		// Click send with empty input
		await page.click("#send-btn");
		await page.waitForTimeout(500);

		// No new message should appear
		const afterCount = await page.locator("#chat-messages .msg").count();
		expect(afterCount).toBe(beforeCount);
	});

	test("input is cleared after sending", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		const input = page.locator("#msg-input");
		await input.fill("Clear test");
		await page.click("#send-btn");
		await page.waitForTimeout(300);

		// Input should be cleared
		await expect(input).toHaveValue("");
	});

	test("send button is enabled after sending completes", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		const sendBtn = page.locator("#send-btn");
		await expect(sendBtn).toBeEnabled();

		// Send a message
		await page.locator("#msg-input").fill("Test");
		await page.click("#send-btn");
		await page.waitForTimeout(1000);

		// Button should be re-enabled
		await expect(sendBtn).toBeEnabled();
	});

	test("multiple messages appear in sequence", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="chat"]');
		await waitForPage(page);

		// Get current user message count
		const _initialCount = await page
			.locator("#chat-messages .msg-user")
			.count();

		// Send first message
		await page.locator("#msg-input").fill("First message");
		await page.click("#send-btn");
		await page.waitForTimeout(300);

		// Send second message
		await page.locator("#msg-input").fill("Second message");
		await page.click("#send-btn");
		await page.waitForTimeout(300);

		// Both messages should be visible (check from the last two)
		const allUser = page.locator("#chat-messages .msg-user");
		const count = await allUser.count();
		await expect(allUser.nth(count - 2)).toContainText("First message");
		await expect(allUser.nth(count - 1)).toContainText("Second message");
	});
});

/* ── 2. Config / Settings Page Tabs ──────────────────────────────────── */

test.describe("Settings Page - Tabs", () => {
	test("config page has three tabs", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		const tabs = page.locator(".config-tab");
		await expect(tabs).toHaveCount(3);
		await expect(tabs.nth(0)).toContainText("Providers");
		await expect(tabs.nth(1)).toContainText("Themes");
		await expect(tabs.nth(2)).toContainText("Channels");
	});

	test("Providers tab is active by default", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// First tab should be active
		const firstTab = page.locator(".config-tab").nth(0);
		await expect(firstTab).toHaveClass(/active/);
		await expect(firstTab).toContainText("Providers");
	});

	test("selecting Themes tab shows theme buttons", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Click Themes tab
		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Verify themes content is visible
		await expect(page.locator(".theme-btn").first()).toBeVisible();
		await expect(page.locator("text=Appearance")).toBeVisible();

		// Themes tab should be active
		const themesTab = page.locator(".config-tab").nth(1);
		await expect(themesTab).toHaveClass(/active/);
	});

	test("selecting Channels tab shows channel cards", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Click Channels tab (third tab)
		await page.locator(".config-tab").nth(2).click();
		await page.waitForTimeout(300);

		// Verify channels content is visible — use a card title
		await expect(page.locator('h3:has-text("Telegram")')).toBeVisible();
		await expect(page.locator('h3:has-text("Discord")')).toBeVisible();
		await expect(page.locator('h3:has-text("Slack")')).toBeVisible();

		// Channels tab should be active
		const channelsTab = page.locator(".config-tab").nth(2);
		await expect(channelsTab).toHaveClass(/active/);
	});

	test("switching between tabs updates content correctly", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Start at Providers → should have add provider button
		await expect(page.locator("#add-provider-btn")).toBeVisible();

		// Switch to Themes
		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);
		await expect(page.locator(".theme-btn").first()).toBeVisible();
		// Themes should NOT have add-provider-btn
		await expect(page.locator("#add-provider-btn")).not.toBeVisible();

		// Switch to Channels
		await page.locator(".config-tab").nth(2).click();
		await page.waitForTimeout(300);
		await expect(page.locator('h3:has-text("Telegram")')).toBeVisible();

		// Switch back to Providers
		await page.locator(".config-tab").nth(0).click();
		await page.waitForTimeout(300);
		await expect(page.locator("#add-provider-btn")).toBeVisible();
	});

	test("clicking same tab again does not cause errors", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Click Providers tab twice
		await page.locator(".config-tab").nth(0).click();
		await page.waitForTimeout(300);
		await page.locator(".config-tab").nth(0).click();
		await page.waitForTimeout(300);

		// Page should still be functional
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("#add-provider-btn")).toBeVisible();
	});
});

/* ── 3. Tools Page — Add & Remove ────────────────────────────────────── */

test.describe("Tools Page - Add & Remove", () => {
	test("tools page renders with default tools", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Should show tool grid with cards
		await expect(page.locator(".tool-grid")).toBeVisible();
		await expect(page.locator(".tool-card").first()).toBeVisible();

		// Should have filter bar
		await expect(page.locator(".filter-bar")).toBeVisible();

		// Should have Add Tool button
		await expect(page.locator("#add-tool-btn")).toBeVisible();
	});

	test("filtering tools by category works", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Get all filter buttons
		const filterBtns = page.locator(".filter-btn");
		const count = await filterBtns.count();
		expect(count).toBeGreaterThan(1);

		// Click each filter and verify it becomes active
		for (let i = 0; i < count; i++) {
			await filterBtns.nth(i).click();
			await page.waitForTimeout(300);
			await expect(filterBtns.nth(i)).toHaveClass(/active/);
		}
	});

	test("add a custom tool via modal", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Clean up any leftover custom tools from previous runs
		await page.evaluate(async () => {
			const resp = await fetch("/api/tools");
			const tools = await resp.json();
			for (const t of Array.isArray(tools) ? tools : []) {
				if (t.custom) {
					await fetch(`/api/tools/${encodeURIComponent(t.name)}`, {
						method: "DELETE",
					});
				}
			}
		});

		// Get initial tool count
		const initialCount = await page.locator(".tool-card").count();

		// Click Add Tool
		await page.click("#add-tool-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5000 });
		await expect(page.locator("#tool-modal-title")).toContainText(
			"Add Custom Tool",
		);

		// Fill form
		await page.locator("#tool-name").fill("my_e2e_test_tool");
		await page.locator("#tool-desc").fill("A tool created by E2E test");
		await page.locator("#tool-category").fill("testing");

		// Click Add
		await page.click("#tool-save-btn");
		await page.waitForTimeout(1000);

		// Modal should close and tool should appear
		await expect(page.locator(".modal-overlay")).not.toBeVisible();
		await expect(
			page.locator('.tool-card:has-text("my_e2e_test_tool")'),
		).toBeVisible();

		// Tool count should increase
		const newCount = await page.locator(".tool-card").count();
		expect(newCount).toBe(initialCount + 1);
	});

	test("add tool requires a name", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Open modal
		await page.click("#add-tool-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible();

		// Leave name empty, fill other fields
		await page.locator("#tool-desc").fill("No name tool");
		await page.locator("#tool-category").fill("testing");

		// Try to save
		await page.click("#tool-save-btn");
		await page.waitForTimeout(500);

		// Modal should still be visible with error
		await expect(page.locator(".modal-overlay")).toBeVisible();
		await expect(page.locator("#tool-error")).toBeVisible();
		await expect(page.locator("#tool-error")).toContainText("required");
	});

	test("delete a custom tool", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Clean up any leftover custom tools from previous runs
		await page.evaluate(async () => {
			const resp = await fetch("/api/tools");
			const tools = await resp.json();
			for (const t of Array.isArray(tools) ? tools : []) {
				if (t.custom) {
					await fetch(`/api/tools/${encodeURIComponent(t.name)}`, {
						method: "DELETE",
					});
				}
			}
		});

		// First add a tool to delete via the UI
		await page.click("#add-tool-btn");
		await expect(page.locator(".modal-overlay").first()).toBeVisible();
		await page.locator("#tool-name").fill("delete_me_tool");
		await page.locator("#tool-desc").fill("Tool to delete");
		await page.click("#tool-save-btn");
		await page.waitForTimeout(1000);
		await expect(page.locator(".modal-overlay")).not.toBeVisible();

		// Verify it appears
		const toolCard = page.locator('.tool-card:has-text("delete_me_tool")');
		await expect(toolCard).toBeVisible();

		// Get the tool count before delete
		const beforeCount = await page.locator(".tool-card").count();

		// Use evaluate to bypass confirm dialog and call the API directly
		await page.evaluate(async () => {
			const resp = await fetch("/api/tools/delete_me_tool", {
				method: "DELETE",
			});
			if (!resp.ok) throw new Error(`Delete failed: ${await resp.text()}`);
		});
		await page.waitForTimeout(500);

		// Reload tools page to reflect server state
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Tool should be removed
		await expect(toolCard).not.toBeVisible();
		const afterCount = await page.locator(".tool-card").count();
		expect(afterCount).toBe(beforeCount - 1);
	});

	test("cancel add tool modal closes it", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Open modal
		await page.click("#add-tool-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible();

		// Click Cancel
		await page.click("#tool-cancel-btn");
		await page.waitForTimeout(300);

		// Modal should close
		await expect(page.locator(".modal-overlay")).not.toBeVisible();
	});

	test("add duplicate tool name shows error", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Add a tool
		await page.click("#add-tool-btn");
		await page.locator("#tool-name").fill("unique_tool_name");
		await page.locator("#tool-desc").fill("First");
		await page.click("#tool-save-btn");
		await page.waitForTimeout(1000);

		// Try to add another with same name
		await page.click("#add-tool-btn");
		await page.locator("#tool-name").fill("unique_tool_name");
		await page.locator("#tool-desc").fill("Duplicate");
		await page.click("#tool-save-btn");
		await page.waitForTimeout(1000);

		// Should show error (modal stays)
		await expect(page.locator("#tool-error")).toBeVisible();
		await expect(page.locator("#tool-error")).toContainText(/already|exists/i);
	});
});

/* ── 4. Cron Jobs Page — Add & Remove ────────────────────────────────── */

test.describe("Cron Jobs Page - Add & Remove", () => {
	test("cron page renders with empty state", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Should show page title and add button
		await expect(page.locator("#page-title")).toContainText("Cron Jobs");
		await expect(page.locator("#add-cron-btn")).toBeVisible();

		// Should show empty state initially
		await expect(page.locator("text=No Cron Jobs")).toBeVisible();
	});

	test("add a cron job via modal", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Click New Job
		await page.click("#add-cron-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5000 });
		await expect(page.locator("#cron-modal-title")).toContainText(
			"New Cron Job",
		);

		// Fill form
		await page.locator("#cron-schedule").fill("*/5 * * * *");
		await page.locator("#cron-message").fill("E2E test cron job");

		// Create
		await page.click("#cron-save-btn");
		await page.waitForTimeout(1000);

		// Modal should close, job should appear
		await expect(page.locator(".modal-overlay")).not.toBeVisible();
		await expect(
			page.locator('.cron-row:has-text("E2E test cron job")'),
		).toBeVisible();
		await expect(page.locator("text=*/5 * * * *")).toBeVisible();
	});

	test("add cron job requires schedule", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Open modal
		await page.click("#add-cron-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible();

		// Fill message but not schedule
		await page.locator("#cron-message").fill("Missing schedule");
		await page.click("#cron-save-btn");
		await page.waitForTimeout(500);

		// Modal should stay with error
		await expect(page.locator(".modal-overlay")).toBeVisible();
		await expect(page.locator("#cron-error")).toBeVisible();
		await expect(page.locator("#cron-error")).toContainText("Schedule");
	});

	test("add cron job requires message", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Open modal
		await page.click("#add-cron-btn");
		await page.locator("#cron-schedule").fill("0 * * * *");
		// Leave message empty
		await page.click("#cron-save-btn");
		await page.waitForTimeout(500);

		// Modal should stay with error
		await expect(page.locator(".modal-overlay")).toBeVisible();
		await expect(page.locator("#cron-error")).toBeVisible();
		await expect(page.locator("#cron-error")).toContainText("Message");
	});

	test("delete a cron job", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// First add a job
		await page.click("#add-cron-btn");
		await page.locator("#cron-schedule").fill("0 0 * * *");
		await page.locator("#cron-message").fill("delete_me_cron");
		await page.click("#cron-save-btn");
		await page.waitForTimeout(1000);
		await expect(
			page.locator('.cron-row:has-text("delete_me_cron")'),
		).toBeVisible();

		// Get count before delete
		const beforeCount = await page.locator(".cron-row").count();

		// Delete using direct API call to bypass confirm dialog
		// First get the cron job id from the page
		const jobId = await page.evaluate(() => {
			const rows = document.querySelectorAll(".cron-row");
			for (const row of rows) {
				if (row.textContent.includes("delete_me_cron")) {
					const btn = row.querySelector(".delete-cron");
					return btn ? btn.dataset.id : null;
				}
			}
			return null;
		});
		expect(jobId).toBeTruthy();

		// Delete via API
		await page.evaluate(async (id) => {
			const resp = await fetch(`/api/cron/${id}`, { method: "DELETE" });
			if (!resp.ok) throw new Error(`Delete failed: ${await resp.text()}`);
		}, jobId);
		await page.waitForTimeout(500);

		// Reload cron page
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Should be removed
		await expect(
			page.locator('.cron-row:has-text("delete_me_cron")'),
		).not.toBeVisible();
		const afterCount = await page.locator(".cron-row").count();
		expect(afterCount).toBe(beforeCount - 1);
	});

	test("multiple cron jobs can be added", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Clean up any leftover cron jobs from previous tests
		await page.evaluate(async () => {
			const resp = await fetch("/api/cron");
			const jobs = await resp.json();
			for (const job of Array.isArray(jobs) ? jobs : []) {
				await fetch(`/api/cron/${job.id}`, { method: "DELETE" });
			}
		});
		// Reload to see clean state
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Add first
		await page.click("#add-cron-btn");
		await page.locator("#cron-schedule").fill("*/1 * * * *");
		await page.locator("#cron-message").fill("First cron");
		await page.click("#cron-save-btn");
		await page.waitForTimeout(500);

		// Add second
		await page.click("#add-cron-btn");
		await page.locator("#cron-schedule").fill("*/2 * * * *");
		await page.locator("#cron-message").fill("Second cron");
		await page.click("#cron-save-btn");
		await page.waitForTimeout(500);

		// Both should be visible
		await expect(
			page.locator('.cron-row:has-text("First cron")'),
		).toBeVisible();
		await expect(
			page.locator('.cron-row:has-text("Second cron")'),
		).toBeVisible();

		// There should be 2 cron rows
		const rowCount = await page.locator(".cron-row").count();
		expect(rowCount).toBe(2);
	});

	test("cancel cron modal closes it", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Open modal
		await page.click("#add-cron-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible();

		// Click Cancel
		await page.click("#cron-cancel-btn");
		await page.waitForTimeout(300);

		// Modal should close
		await expect(page.locator(".modal-overlay")).not.toBeVisible();
	});

	test("empty state returns when all cron jobs are deleted", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Clean up any leftover cron jobs from previous tests
		await page.evaluate(async () => {
			const resp = await fetch("/api/cron");
			const jobs = await resp.json();
			for (const job of Array.isArray(jobs) ? jobs : []) {
				await fetch(`/api/cron/${job.id}`, { method: "DELETE" });
			}
		});
		// Reload to verify empty state
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Add a job first
		await page.click("#add-cron-btn");
		await page.locator("#cron-schedule").fill("0 0 * * *");
		await page.locator("#cron-message").fill("Temp cron");
		await page.click("#cron-save-btn");
		await page.waitForTimeout(500);
		await expect(page.locator(".cron-row")).toBeVisible();

		// Get its ID and delete via direct API call
		const jobId = await page.evaluate(() => {
			const btn = document.querySelector(".delete-cron");
			return btn ? btn.dataset.id : null;
		});
		expect(jobId).toBeTruthy();

		await page.evaluate(async (id) => {
			const resp = await fetch(`/api/cron/${id}`, { method: "DELETE" });
			if (!resp.ok) throw new Error(`Delete failed: ${await resp.text()}`);
		}, jobId);
		await page.waitForTimeout(500);

		// Reload cron page
		await page.click('#sidebar nav a[data-page="cron"]');
		await waitForPage(page);

		// Empty state should return
		await expect(page.locator("text=No Cron Jobs")).toBeVisible();
	});
});
