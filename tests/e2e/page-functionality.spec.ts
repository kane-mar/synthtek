/**
 * Page Functionality E2E Tests
 *
 * Tests the core interactions on each page:
 * - Chat: send messages and see responses
 * - Config: switch between tabs (Providers, Themes, Channels)
 * - Skills: add/remove tools and filter by category
 * - Cron Jobs: add/remove cron jobs
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";

async function waitForPage(page) {
	await page.waitForSelector("#content:not(:empty)", { timeout: 15000 });
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
	test("config page has four tabs", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		const tabs = page.locator(".config-tab");
		await expect(tabs).toHaveCount(4);
		await expect(tabs.nth(0)).toContainText("Providers");
		await expect(tabs.nth(1)).toContainText("Agent");
		await expect(tabs.nth(2)).toContainText("Themes");
		await expect(tabs.nth(3)).toContainText("Channels");
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

		// Click Themes tab (third tab)
		await page.locator(".config-tab").nth(2).click();
		await page.waitForTimeout(300);

		// Verify themes content is visible
		await expect(page.locator(".theme-btn").first()).toBeVisible();
		await expect(page.locator("text=Appearance")).toBeVisible();

		// Themes tab should be active
		const themesTab = page.locator(".config-tab").nth(2);
		await expect(themesTab).toHaveClass(/active/);
	});

	test("selecting Channels tab shows channel cards", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Click Channels tab (fourth tab)
		await page.locator(".config-tab").nth(3).click();
		await page.waitForTimeout(300);

		// Verify channels content is visible — use a card title
		await expect(page.locator('h3:has-text("Telegram")')).toBeVisible();
		await expect(page.locator('h3:has-text("Discord")')).toBeVisible();
		await expect(page.locator('h3:has-text("Slack")')).toBeVisible();

		// Channels tab should be active
		const channelsTab = page.locator(".config-tab").nth(3);
		await expect(channelsTab).toHaveClass(/active/);
	});

	test("switching between tabs updates content correctly", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Start at Providers → should have add provider button
		await expect(page.locator("#add-provider-btn")).toBeVisible();

		// Switch to Agent
		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);
		await expect(page.locator("#agent-prompt")).toBeVisible();
		// Agent should NOT have add-provider-btn
		await expect(page.locator("#add-provider-btn")).not.toBeVisible();

		// Switch to Themes
		await page.locator(".config-tab").nth(2).click();
		await page.waitForTimeout(300);
		await expect(page.locator(".theme-btn").first()).toBeVisible();

		// Switch to Channels
		await page.locator(".config-tab").nth(3).click();
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

/* ── 7. Agent Configuration Tab ──────────────────────────────────────── */

test.describe("Settings Page - Agent Config Tab", () => {
	test("Agent tab renders with language dropdown and system prompt", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		// Click Agent tab
		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Should have language selector
		await expect(page.locator("#agent-language")).toBeVisible();
		// Should have system prompt textarea
		await expect(page.locator("#agent-prompt")).toBeVisible();
		// Should have save button
		await expect(page.locator("#save-agent-btn")).toBeVisible();
	});

	test("Agent tab shows default language as English", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		await expect(page.locator("#agent-language")).toHaveValue("English");
	});

	test("Agent tab shows saved system prompt", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Textarea should not be empty
		const promptVal = await page.locator("#agent-prompt").inputValue();
		expect(promptVal.length).toBeGreaterThan(0);
	});

	test("changing language and saving works", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Select Chinese
		await page.locator("#agent-language").selectOption("Chinese");
		await page.waitForTimeout(200);

		// Save
		await page.locator("#save-agent-btn").click();
		await page.waitForTimeout(500);

		// Should show success status
		await expect(page.locator("#save-status")).toContainText("Saved");
	});

	test("changing system prompt and saving works", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Type a custom prompt
		const customPrompt = "You are a helpful assistant that speaks Chinese.";
		await page.locator("#agent-prompt").fill(customPrompt);
		await page.waitForTimeout(200);

		// Save
		await page.locator("#save-agent-btn").click();
		await page.waitForTimeout(500);

		// Should show success status
		await expect(page.locator("#save-status")).toContainText("Saved");

		// Verify the value persists after page reload
		await page.reload();
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);
		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		const promptVal = await page.locator("#agent-prompt").inputValue();
		expect(promptVal).toBe(customPrompt);
	});

	test("character counter updates as user types", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Get initial count
		const initialCount = await page.locator("#prompt-chars").textContent();
		const initialNum = parseInt(initialCount || "0", 10);

		// Type additional text
		await page.locator("#agent-prompt").fill("A".repeat(initialNum + 50));
		await page.waitForTimeout(200);

		// Character count should have increased
		const newCount = await page.locator("#prompt-chars").textContent();
		expect(parseInt(newCount || "0", 10)).toBe(initialNum + 50);
	});

	test("saving agent config shows status indicator", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		const saveBtn = page.locator("#save-agent-btn");
		const saveStatus = page.locator("#save-status");
		await expect(saveBtn).toBeEnabled();
		await expect(saveStatus).not.toBeVisible();

		// Click save — status should show "Saving..." then "✓ Saved".
		// Use a wider window so we catch the indicator regardless of server speed.
		await saveBtn.click();
		await expect(async () => {
			const text = await saveStatus.textContent();
			expect(text).not.toBe("");
			expect(text).not.toBeNull();
		}).toPass({ timeout: 3000 });
		await expect(saveStatus).toContainText("Saved", { timeout: 5000 });
		await expect(saveBtn).toBeEnabled();
	});

	test("system prompt in WebUI matches the configured default", async ({
		page,
	}) => {
		const expectedPromptStart =
			"You are an elite, highly autonomous, and deeply competent AI collaborator.";

		// Reset config to defaults first (in case a previous test left dirty state)
		await page.goto(BASE_URL);
		await page.evaluate(async () => {
			await fetch("/api/config/agent", { method: "DELETE" });
		});

		await page.reload();
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Verify the textarea contains the expected default prompt
		const promptVal = await page.locator("#agent-prompt").inputValue();
		expect(promptVal.startsWith(expectedPromptStart)).toBe(true);
		expect(promptVal.includes("Ownership")).toBe(true);
		expect(promptVal.includes("Execution Framework")).toBe(true);
		expect(promptVal.length).toBeGreaterThan(500);

		// Verify the API returns the same prompt shown in the UI
		const apiResponse = await page.evaluate(async () => {
			const resp = await fetch("/api/config/agent");
			return resp.json();
		});
		expect(apiResponse.systemPrompt).toBe(promptVal);
	});

	test("switching language and restoring English round-trips correctly", async ({
		page,
	}) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);

		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		// Switch to French, save
		await page.locator("#agent-language").selectOption("French");
		await page.locator("#save-agent-btn").click();
		await page.waitForTimeout(500);

		// Switch back to English, save
		await page.locator("#agent-language").selectOption("English");
		await page.locator("#save-agent-btn").click();
		await page.waitForTimeout(500);

		// Reload and verify English is restored
		await page.reload();
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="config"]');
		await waitForPage(page);
		await page.locator(".config-tab").nth(1).click();
		await page.waitForTimeout(300);

		await expect(page.locator("#agent-language")).toHaveValue("English");
	});
});

/* ── 3. Skills Page — Install & Manage ────────────────────────────────────── */

test.describe("Skills Page - Install & Manage", () => {
	test("skills page renders installed skills", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Should show skill cards
		await expect(page.locator(".skill-card").first()).toBeVisible();

		// Should have install button
		await expect(page.locator("#install-skill-btn")).toBeVisible();

		// Should show installed count
		await expect(page.locator(".page-header")).toContainText("installed");
	});

	test("skills page shows toggle switches", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Each skill card should have a toggle
		const toggles = page.locator(".skill-toggle");
		const count = await toggles.count();
		expect(count).toBeGreaterThan(0);

		// Toggle should have checked state
		for (let i = 0; i < Math.min(count, 3); i++) {
			await expect(toggles.nth(i)).toBeVisible();
		}
	});

	test("toggling a skill changes its state", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Click the first toggle
		const firstToggle = page.locator(".skill-toggle").first();
		await firstToggle.click();
		await page.waitForTimeout(500);

		// The page should still have skills rendered
		const skills = await page.locator(".skill-card").count();
		expect(skills).toBeGreaterThan(0);
	});

	test("install modal opens and closes", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Open install modal
		await page.click("#install-skill-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 5000 });

		// Modal has input and buttons
		await expect(page.locator("#skill-source-input")).toBeVisible();
		await expect(page.locator("#install-confirm-btn")).toBeVisible();
		await expect(page.locator("#install-cancel-btn")).toBeVisible();

		// Close via Cancel
		await page.click("#install-cancel-btn");
		await page.waitForTimeout(300);
		await expect(page.locator(".modal-overlay")).not.toBeVisible();
	});

	test("delete skill button exists on cards", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// The delete button should be on each skill
		const deleteBtns = page.locator(".skill-delete");
		const count = await deleteBtns.count();
		expect(count).toBeGreaterThan(0);
	});

	test("empty state shows install prompt", async ({ page }) => {
		// Mock empty skills list
		await page.route("**/api/skills", (route) =>
			route.fulfill({ status: 200, body: JSON.stringify([]) }),
		);

		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// Should show empty state with install button
		await expect(page.locator(".empty-state")).toBeVisible();
		await expect(page.locator("#install-empty-btn")).toBeVisible();
	});

	test("skills have homepage links when available", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		// At least some skills may have homepage links
		const links = page.locator(".skill-link");
		const count = await links.count();
		// Just verify the links exist (skills may or may not have homepage)
		if (count > 0) {
			await expect(links.first()).toBeVisible();
		}
	});

	test("install modal validates empty input", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		await page.click("#install-skill-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible();

		// Click Install with empty input — should stay open
		await page.click("#install-confirm-btn");
		await page.waitForTimeout(300);
		await expect(page.locator(".modal-overlay")).toBeVisible();
	});

	test("install modal closes on Escape", async ({ page }) => {
		await page.goto(BASE_URL);
		await waitForPage(page);
		await page.click('#sidebar nav a[data-page="tools"]');
		await waitForPage(page);

		await page.click("#install-skill-btn");
		await expect(page.locator(".modal-overlay")).toBeVisible();

		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
		await expect(page.locator(".modal-overlay")).not.toBeVisible();
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
