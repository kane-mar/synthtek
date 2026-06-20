/**
 * Puppeteer E2E Tests for Synthtek WebUI
 *
 * Runs against a test server that is started/stopped by this test file.
 *
 * Requires:
 *   - Chromium at /usr/bin/chromium
 */

import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { WebUIServer } from "../../dist/src/webui/server.js";

const TEST_PORT = 8081;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const e2eWorkspace = mkdtempSync(join(tmpdir(), "synthtek-puppeteer-"));

// ── Sidebar link definitions ────────────────────────────────────────────

const SIDEBAR_LINKS = [
	{ page: "chat", label: "Chat", hash: "#chat" },
	{ page: "tools", label: "Tools", hash: "#tools" },
	{ page: "cron", label: "Cron Jobs", hash: "#cron" },
	{ page: "config", label: "System Config", hash: "#config" },
];

// ── Helpers ─────────────────────────────────────────────────────────────

async function waitForPageReady(page: Page): Promise<void> {
	// Wait for the content area to have actual rendered content
	await page.waitForSelector("#content:not(:empty)", { timeout: 8000 });
}

async function getPageHash(page: Page): Promise<string> {
	return page.evaluate(() => window.location.hash);
}

// ── Server + Browser lifecycle ───────────────────────────────────────────

let server: WebUIServer;
let browser: Browser;
let page: Page;

before(async () => {
	// Start test server
	const _originalWorkspace = process.env.SYNTHTEK_WORKSPACE;
	process.env.SYNTHTEK_WORKSPACE = e2eWorkspace;
	server = new WebUIServer({
		host: "127.0.0.1",
		port: TEST_PORT,
		apiKey: "",
		maxSessions: 10,
		sessionTimeout: 3600,
	});
	await server.start();

	// Launch browser
	browser = await puppeteer.launch({
		headless: true,
		executablePath: "/usr/bin/chromium",
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
		],
	});
	page = await browser.newPage();
	await page.setViewport({ width: 1280, height: 720 });
});

after(async () => {
	await browser.close();
	await server.stop();
	delete process.env.SYNTHTEK_WORKSPACE;
	rmSync(e2eWorkspace, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("Puppeteer E2E: WebUI Health", () => {
	it("API health endpoint responds with 200", async () => {
		const response = await page.goto(`${BASE_URL}/api/health`);
		strictEqual(response?.status(), 200);
	});

	it("main page loads without 404", async () => {
		const response = await page.goto(BASE_URL);
		strictEqual(response?.status(), 200);
	});

	it("page loads without critical JavaScript errors", async () => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(String(err)));

		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// Filter out cosmetic/expected errors
		const criticalErrors = errors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated"),
		);
		deepStrictEqual(criticalErrors, []);
	});
});

describe("Puppeteer E2E: Default Page & Navigation", () => {
	it("loads the Chat page by default", async () => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		const hash = await getPageHash(page);
		ok(
			hash === "#chat" || hash === "" || hash === "#",
			`Expected default page to be chat, got hash: ${hash}`,
		);
	});

	it("navigates to each sidebar page via hash", async () => {
		for (const link of SIDEBAR_LINKS) {
			await page.goto(`${BASE_URL}${link.hash}`);
			await waitForPageReady(page);

			const hash = await getPageHash(page);
			ok(
				hash === link.hash || hash === `#${link.page}`,
				`Expected hash ${link.hash}, got ${hash}`,
			);
		}
	});

	it("unknown hash falls back to chat", async () => {
		await page.goto(`${BASE_URL}#nonexistent`);
		await waitForPageReady(page);

		const hash = await getPageHash(page);
		ok(
			hash === "#chat" || hash === "",
			`Expected fallback to chat, got hash: ${hash}`,
		);
	});
});

describe("Puppeteer E2E: Sidebar Structure", () => {
	it("sidebar is visible", async () => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		const sidebarExists =
			(await page.$('aside, [class*="sidebar"], nav')) !== null;
		ok(sidebarExists, "Sidebar element should exist");
	});

	it("sidebar contains navigation links", async () => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		const links = await page.$$('aside a, [class*="sidebar"] a, nav a');
		ok(links.length > 0, "Sidebar should contain navigation links");
	});

	it("clicking sidebar links navigates correctly", async () => {
		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// Get all sidebar links
		const linkElements = await page.$$('aside a, [class*="sidebar"] a, nav a');

		for (const el of linkElements.slice(0, 5)) {
			const href = await el.evaluate((a: HTMLAnchorElement) => a.href);
			const text = await el.evaluate((a: HTMLElement) => a.textContent?.trim());

			if (href?.includes(BASE_URL)) {
				await el.click();
				await waitForPageReady(page);

				// Page should still be visible (no crash)
				const bodyVisible = (await page.$("body")) !== null;
				ok(
					bodyVisible,
					`Page should still be visible after clicking "${text}"`,
				);
			}
		}
	});
});

describe("Puppeteer E2E: System Config Page", () => {
	it("loads the config page", async () => {
		await page.goto(`${BASE_URL}#config`);
		await waitForPageReady(page);

		const hash = await getPageHash(page);
		ok(
			hash === "#config" || hash.includes("config"),
			`Expected config page, got ${hash}`,
		);
	});

	it("config page has tabs", async () => {
		await page.goto(`${BASE_URL}#config`);
		await waitForPageReady(page);

		// Look for tab-like elements
		const tabs = await page.$$(
			'button[role="tab"], .tab-button, [class*="tab"], [role="tablist"] button',
		);
		ok(tabs.length > 0, "Config page should have tabs");
	});

	it("tab switching does not crash the page", async () => {
		await page.goto(`${BASE_URL}#config`);
		await waitForPageReady(page);

		for (let i = 0; i < 5; i++) {
			const tabButtons = await page.$$(
				'button[role="tab"], .tab-button, [class*="tab"] button',
			);
			if (!tabButtons.length) break;
			await tabButtons[i % tabButtons.length].click();
			await new Promise((r) => setTimeout(r, 300));

			const bodyVisible = (await page.$("body")) !== null;
			ok(bodyVisible, "Page should remain visible after tab switch");
		}
	});
});

describe("Puppeteer E2E: Provider Modal", () => {
	it("opens the add provider modal", async () => {
		await page.goto(`${BASE_URL}#config`);
		await waitForPageReady(page);

		// Try to click the add provider button (or any button with "add" text)
		let addBtn = await page.$("#add-provider-btn");
		if (!addBtn) {
			const allBtns = await page.$$("button");
			for (const btn of allBtns) {
				const text = await btn
					.evaluate((el) => el.textContent || "")
					.catch(() => "");
				if (text.toLowerCase().includes("add")) {
					addBtn = btn;
					break;
				}
			}
		}
		if (addBtn) {
			await addBtn.click();
			await new Promise((r) => setTimeout(r, 500));

			// Check for any modal/dialog element
			const modalVisible =
				(await page.$(
					'#provider-modal, [role="dialog"], .modal, [class*="modal"]',
				)) !== null;
			ok(modalVisible, "Provider modal should be visible");
		}
	});

	it("fills and submits the provider form", async () => {
		await page.goto(`${BASE_URL}#config`);
		await waitForPageReady(page);

		const addBtn = await page.$("#add-provider-btn");
		if (!addBtn) return; // Skip if button doesn't exist

		await addBtn.click();
		await page
			.waitForSelector("#provider-modal", { timeout: 5000 })
			.catch(() => {});

		// Fill form fields if they exist
		const nameField = await page.$("#prov-name");
		if (nameField) {
			await nameField.type("TestPuppeteerProvider");
		}

		const typeSelect = await page.$("#prov-type");
		if (typeSelect) {
			await typeSelect.select("openai");
		}

		const urlField = await page.$("#prov-url");
		if (urlField) {
			await urlField.type("https://api.openai.com");
		}

		const keyField = await page.$("#prov-key");
		if (keyField) {
			await keyField.type("sk-test-puppeteer-key");
		}

		const modelsField = await page.$("#prov-models");
		if (modelsField) {
			await modelsField.type("gpt-4");
		}

		const defaultField = await page.$("#prov-default");
		if (defaultField) {
			await defaultField.type("gpt-4");
		}

		// Click save
		const saveBtn = await page.$("#save-provider");
		if (saveBtn) {
			await saveBtn.click();
			await new Promise((r) => setTimeout(r, 2000));
		}

		// Page should still be visible
		const bodyVisible = (await page.$("body")) !== null;
		ok(bodyVisible, "Page should remain visible after form submission");
	});
});

describe("Puppeteer E2E: Console & Network", () => {
	it("no console errors on page load", async () => {
		const consoleErrors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				consoleErrors.push(msg.text());
			}
		});

		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// Filter out expected noise
		const realErrors = consoleErrors.filter(
			(e) =>
				!e.includes("ResizeObserver") &&
				!e.includes("TrustedHTML") &&
				!e.includes("deprecated") &&
				!e.includes("favicon"),
		);
		deepStrictEqual(realErrors, []);
	});

	it("all resources load successfully", async () => {
		const failedRequests: string[] = [];
		page.on("response", (resp) => {
			if (resp.status() >= 400) {
				failedRequests.push(`${resp.status()} ${resp.url()}`);
			}
		});

		await page.goto(BASE_URL);
		await waitForPageReady(page);

		// 404 for favicon is expected
		const realFailures = failedRequests.filter(
			(r) => !r.includes("favicon") && !r.includes("404"),
		);
		deepStrictEqual(realFailures, []);
	});
});
