/**
 * Navigation Module Tests
 *
 * Verifies the extracted navigation logic works correctly:
 * - All sidebar links map to valid pages
 * - Navigation guards prevent double rendering
 * - Hash parsing handles edge cases
 * - Page titles are correct
 * - Active link state updates properly
 */

import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
	NavigationController,
	type NavigationDOM,
	PAGE_TITLES,
	type PageId,
	pageFromHash,
	VALID_PAGES,
} from "../../src/webui/frontend/navigation.js";
import { WebUIServer } from "../../src/webui/server.js";
import type { WebUIConfig } from "../../src/webui/types.js";

// ── Unit tests (no server needed) ──────────────────────────────────────────

describe("navigation module", () => {
	// ── VALID_PAGES ────────────────────────────────────────────────────────

	describe("VALID_PAGES", () => {
		it("contains all expected page ids", () => {
			const expected = ["chat", "tools", "cron", "config", "analytics"];
			deepStrictEqual(VALID_PAGES, expected);
		});

		it("has 5 pages", () => {
			strictEqual(VALID_PAGES.length, 5);
		});

		it("has no duplicates", () => {
			const unique = new Set(VALID_PAGES);
			strictEqual(unique.size, VALID_PAGES.length);
		});
	});

	// ── PAGE_TITLES ────────────────────────────────────────────────────────

	describe("PAGE_TITLES", () => {
		it("has an entry for every valid page", () => {
			for (const page of VALID_PAGES) {
				ok(
					PAGE_TITLES[page as PageId] != null,
					`Missing title for page: ${page}`,
				);
				ok(
					PAGE_TITLES[page as PageId].length > 0,
					`Empty title for page: ${page}`,
				);
			}
		});

		it("has the correct number of titles", () => {
			strictEqual(Object.keys(PAGE_TITLES).length, VALID_PAGES.length);
		});

		it('maps analytics to "Analytics"', () => {
			strictEqual(PAGE_TITLES.analytics, "Analytics");
		});

		it('maps chat to "Chat"', () => {
			strictEqual(PAGE_TITLES.chat, "Chat");
		});

		it('maps cron to "Cron Jobs"', () => {
			strictEqual(PAGE_TITLES.cron, "Cron Jobs");
		});

		it('maps config to "System Config"', () => {
			strictEqual(PAGE_TITLES.config, "System Config");
		});
	});

	// ── pageFromHash ───────────────────────────────────────────────────────

	describe("pageFromHash", () => {
		it("parses a valid hash", () => {
			strictEqual(pageFromHash("#chat", VALID_PAGES), "chat");
		});

		it("parses a hash without #", () => {
			strictEqual(pageFromHash("chat", VALID_PAGES), "chat");
		});

		it("returns chat for empty hash", () => {
			strictEqual(pageFromHash("", VALID_PAGES), "chat");
		});

		it("returns chat for # only", () => {
			strictEqual(pageFromHash("#", VALID_PAGES), "chat");
		});

		it("returns chat for unknown page", () => {
			strictEqual(pageFromHash("#unknown", VALID_PAGES), "chat");
		});

		it("returns chat for malicious hash", () => {
			strictEqual(pageFromHash("#<script>", VALID_PAGES), "chat");
		});

		it("handles all valid pages", () => {
			for (const page of VALID_PAGES) {
				strictEqual(pageFromHash(`#${page}`, VALID_PAGES), page);
			}
		});
	});

	// ── NavigationController (unit) ────────────────────────────────────────

	describe("NavigationController", () => {
		let dom: NavigationDOM;
		let renderCalls: string[];
		let controller: NavigationController;

		function createMockDOM(): NavigationDOM {
			return {
				setHash: () => {},
				updateActiveLink: () => {},
				setTitle: () => {},
			};
		}

		before(() => {
			dom = createMockDOM();
			renderCalls = [];
			controller = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async (page: string) => {
					renderCalls.push(page);
				},
			);
		});

		it("starts with chat as current page", () => {
			strictEqual(controller.getCurrentPage(), "chat");
		});

		it("navigates to a new page", async () => {
			renderCalls = [];
			// Controller starts at 'chat', so navigating to 'tools' triggers a render
			await controller.navigate("tools");
			strictEqual(controller.getCurrentPage(), "tools");
			deepStrictEqual(renderCalls, ["tools"]);
		});

		it("does not re-render when navigating to the same page", async () => {
			// After previous test, current page is 'tools'
			renderCalls = [];
			await controller.navigate("tools");
			strictEqual(renderCalls.length, 0);
		});

		it("ignores navigation while another is in progress", async () => {
			renderCalls = [];
			let resolveRender: (() => void) | undefined;
			const renderPromise = new Promise<void>((resolve) => {
				resolveRender = resolve;
			});

			const slowController = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async (page: string) => {
					renderCalls.push(page);
					await renderPromise;
				},
			);

			// Start a slow navigation
			const navPromise = slowController.navigate("tools");
			// Try to navigate to another page while the first is in progress
			await slowController.navigate("cron");

			// Only the first navigation should have started
			strictEqual(slowController.getCurrentPage(), "tools");

			// Resolve the slow render
			resolveRender?.();
			await navPromise;

			// After the first navigation completes, the second page was ignored
			deepStrictEqual(renderCalls, ["tools"]);
		});

		it("handles hash change correctly", () => {
			renderCalls = [];
			controller.handleHashChange("#tools");
			// handleHashChange calls navigate which is async, so we check the
			// current page was updated synchronously
			strictEqual(controller.getCurrentPage(), "tools");
		});

		it("handles hash change with unknown page", () => {
			controller.handleHashChange("#nonexistent");
			strictEqual(controller.getCurrentPage(), "chat");
		});

		it("initializes from hash correctly", async () => {
			renderCalls = [];
			const freshController = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async (page: string) => {
					renderCalls.push(page);
				},
			);
			await freshController.init("#cron");
			strictEqual(freshController.getCurrentPage(), "cron");
			deepStrictEqual(renderCalls, ["cron"]);
		});

		it("initializes to chat when hash is empty", async () => {
			renderCalls = [];
			const freshController = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async (page: string) => {
					renderCalls.push(page);
				},
			);
			await freshController.init("");
			strictEqual(freshController.getCurrentPage(), "chat");
			// No render call because controller already starts at 'chat'
			// and navigate() skips re-rendering when page === currentPage
			deepStrictEqual(renderCalls, []);
		});
	});

	// ── NavigationDOM mock tracking ────────────────────────────────────────

	describe("NavigationController with tracking DOM", () => {
		it("calls setHash with the page id", async () => {
			let hashCalledWith: string | undefined;
			const dom: NavigationDOM = {
				setHash: (page: string) => {
					hashCalledWith = page;
				},
				updateActiveLink: () => {},
				setTitle: () => {},
			};
			const controller = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async () => {},
			);
			// Controller starts at 'chat', so navigate to 'tools' to trigger setHash
			await controller.navigate("tools");
			strictEqual(hashCalledWith, "tools");
		});

		it("calls updateActiveLink with the page id", async () => {
			let activeCalledWith: string | undefined;
			const dom: NavigationDOM = {
				setHash: () => {},
				updateActiveLink: (page: string) => {
					activeCalledWith = page;
				},
				setTitle: () => {},
			};
			const controller = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async () => {},
			);
			await controller.navigate("tools");
			strictEqual(activeCalledWith, "tools");
		});

		it("calls setTitle with the correct title", async () => {
			let titleCalledWith: string | undefined;
			const dom: NavigationDOM = {
				setHash: () => {},
				updateActiveLink: () => {},
				setTitle: (title: string) => {
					titleCalledWith = title;
				},
			};
			const controller = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async () => {},
			);
			await controller.navigate("cron");
			strictEqual(titleCalledWith, "Cron Jobs");
		});

		it("renders the page", async () => {
			let renderedPage: string | undefined;
			const dom: NavigationDOM = {
				setHash: () => {},
				updateActiveLink: () => {},
				setTitle: () => {},
			};
			const controller = new NavigationController(
				VALID_PAGES,
				PAGE_TITLES,
				dom,
				async (page: string) => {
					renderedPage = page;
				},
			);
			await controller.navigate("config");
			strictEqual(renderedPage, "config");
		});
	});
});

// ── Integration tests (with real server) ──────────────────────────────────

describe("WebUI navigation integration", () => {
	const TEST_PORT = 4005;
	const e2eWorkspace = mkdtempSync(join(tmpdir(), "synthtek-nav-"));
	const originalWorkspace = process.env.SYNTHTEK_WORKSPACE;

	const config: WebUIConfig = {
		host: "127.0.0.1",
		port: TEST_PORT,
		apiKey: "test-key",
		maxSessions: 10,
		sessionTimeout: 3600,
	};

	let server: WebUIServer;

	before(async () => {
		process.env.SYNTHTEK_WORKSPACE = e2eWorkspace;
		server = new WebUIServer(config);
		await server.start();
	});

	after(async () => {
		await server.stop();
		if (originalWorkspace) {
			process.env.SYNTHTEK_WORKSPACE = originalWorkspace;
		} else {
			delete process.env.SYNTHTEK_WORKSPACE;
		}
		rmSync(e2eWorkspace, { recursive: true, force: true });
	});

	it("serves the frontend with all sidebar links", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		ok(res.ok);
		const html = await res.text();

		for (const page of VALID_PAGES) {
			ok(
				html.includes(`data-page="${page}"`),
				`Sidebar should contain link for page: ${page}`,
			);
		}
	});

	it("sidebar links have correct href attributes", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		for (const page of VALID_PAGES) {
			ok(
				html.includes(`href="#${page}"`),
				`Sidebar should contain href for page: ${page}`,
			);
		}
	});

	it("frontend script includes VALID_PAGES array", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		for (const page of VALID_PAGES) {
			ok(
				html.includes(`'${page}'`),
				`Frontend script should reference page: ${page}`,
			);
		}
	});

	it("frontend script includes page title mappings", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		ok(html.includes("Dashboard"), "Should include Dashboard title");
		ok(html.includes("Chat"), "Should include Chat title");
		ok(html.includes("Cron Jobs"), "Should include Cron Jobs title");
		ok(html.includes("System Config"), "Should include System Config title");
	});

	it("frontend script includes navigate function", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		ok(html.includes("function navigate"), "Should include navigate function");
		ok(html.includes("renderPage"), "Should include renderPage function");
	});

	it("frontend script includes hashchange listener", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		ok(html.includes("hashchange"), "Should include hashchange listener");
	});

	it("frontend script includes sidebar click handlers", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		ok(html.includes("#sidebar nav a"), "Should include sidebar selector");
		ok(html.includes("preventDefault"), "Should prevent default link behavior");
	});

	it("chat page is the default", async () => {
		const res = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
		const html = await res.text();

		ok(
			html.includes('data-page="chat" class="active"'),
			"Chat link should be active by default",
		);
	});
});
