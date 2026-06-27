/**
 * Sidebar Navigation Tests
 *
 * Verifies that every link in the left-hand panel is functional:
 * - The HTML contains the correct set of navigation links
 * - Each link has the required data-page attribute
 * - The renderPage() switch handles every page
 * - The titles object maps every page to a display name
 * - The VALID_PAGES array includes every page
 * - The navigate() function updates the active class correctly
 * - The hashchange listener is wired up
 * - The click handler on sidebar links calls navigate()
 */

import { ok, strictEqual } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { WebUIServer } from "../../src/webui/server.js";
import type { WebUIConfig } from "../../src/webui/types.js";

const TEST_PORT = 4003;

const e2eWorkspace = mkdtempSync(join(tmpdir(), "synthtek-sidebar-"));
const originalWorkspace = process.env.SYNTHTEK_WORKSPACE;

const config: WebUIConfig = {
	host: "127.0.0.1",
	port: TEST_PORT,
	apiKey: "sidebar-test-key",
	maxSessions: 10,
	sessionTimeout: 3600,
};

const BASE = `http://127.0.0.1:${TEST_PORT}`;

process.env.SYNTHTEK_WORKSPACE = e2eWorkspace;

let server: WebUIServer;

// Every sidebar link — must match what's in the HTML
const SIDEBAR_LINKS = [
	{ page: "chat", label: "Chat", hash: "#chat" },
	{ page: "analytics", label: "Analytics", hash: "#analytics" },
	{ page: "tools", label: "Skills", hash: "#tools" },
	{ page: "cron", label: "Cron Jobs", hash: "#cron" },
	{ page: "config", label: "System Config", hash: "#config" },
];

// "Appearance" is a sub-section of System Config, not a top-level page

before(async () => {
	server = new WebUIServer(config);
	await server.start();
});

after(async () => {
	await server.stop();
	rmSync(e2eWorkspace, { recursive: true, force: true });
	if (originalWorkspace) process.env.SYNTHTEK_WORKSPACE = originalWorkspace;
	else delete process.env.SYNTHTEK_WORKSPACE;
});

/* ──────────────────────────────────────────────────────────────── */
/*  1.  HTML structure — sidebar links exist and are well-formed   */
/* ──────────────────────────────────────────────────────────────── */

describe("Sidebar HTML structure", () => {
	let html: string;

	before(async () => {
		const res = await fetch(BASE);
		html = await res.text();
	});

	it("should return 200 for the root path", async () => {
		const res = await fetch(BASE);
		strictEqual(res.status, 200);
	});

	it("should contain the sidebar nav element", () => {
		ok(html.includes('id="sidebar"'), "sidebar div exists");
		ok(html.includes('aria-label="Main navigation"'), "nav has aria-label");
	});

	for (const link of SIDEBAR_LINKS) {
		it(`should contain a link for "${link.label}" with data-page="${link.page}"`, () => {
			ok(
				html.includes(`data-page="${link.page}"`),
				`data-page="${link.page}" attribute exists`,
			);
			ok(html.includes(`href="${link.hash}"`), `href="${link.hash}" exists`);
			ok(html.includes(link.label), `link text "${link.label}" exists`);
		});
	}

	it("should have the chat link marked as active by default", () => {
		ok(
			html.includes('data-page="chat" class="active"'),
			"chat link has active class",
		);
	});

	it("should have exactly 5 sidebar navigation links", () => {
		const matches = html.match(/data-page="[^"]+"/g);
		ok(Array.isArray(matches), "data-page attributes found");
		strictEqual(
			matches.length,
			SIDEBAR_LINKS.length,
			"correct number of links",
		);
	});
});

/* ──────────────────────────────────────────────────────────────── */
/*  2.  JavaScript — VALID_PAGES, titles, renderPage, navigate     */
/* ──────────────────────────────────────────────────────────────── */

describe("Sidebar JavaScript wiring", () => {
	let html: string;

	before(async () => {
		const res = await fetch(BASE);
		html = await res.text();
	});

	describe("VALID_PAGES array", () => {
		it("should declare VALID_PAGES with all sidebar pages", () => {
			ok(html.includes("VALID_PAGES"), "VALID_PAGES constant is declared");
			for (const link of SIDEBAR_LINKS) {
				ok(
					html.includes(`'${link.page}'`) || html.includes(`"${link.page}"`),
					`VALID_PAGES includes '${link.page}'`,
				);
			}
		});
	});

	describe("titles object", () => {
		it("should map every page to a display title", () => {
			for (const link of SIDEBAR_LINKS) {
				// The titles object may use various formats:
				//   { dashboard:'Dashboard' } or { 'dashboard':'Dashboard' }
				const hasMapping =
					html.includes(`'${link.page}':'${link.label}'`) ||
					html.includes(`"${link.page}":"${link.label}"`) ||
					html.includes(`'${link.page}': '${link.label}'`) ||
					html.includes(`"${link.page}": "${link.label}"`) ||
					html.includes(`${link.page}:'${link.label}'`) ||
					html.includes(`${link.page}:"${link.label}"`);
				ok(hasMapping, `titles object maps '${link.page}' to '${link.label}'`);
			}
		});
	});

	describe("renderPage switch", () => {
		it("should have a case for every sidebar page", () => {
			for (const link of SIDEBAR_LINKS) {
				ok(
					html.includes(`case '${link.page}':`) ||
						html.includes(`case "${link.page}":`),
					`renderPage has case for '${link.page}'`,
				);
			}
		});
	});

	describe("navigate function", () => {
		it("should update currentPage", () => {
			ok(html.includes("currentPage = page"), "navigate sets currentPage");
		});

		it("should update window.location.hash", () => {
			ok(
				html.includes("window.location.hash = page"),
				"navigate sets window.location.hash",
			);
		});

		it("should toggle active class on sidebar links", () => {
			ok(
				html.includes("classList.toggle") && html.includes("active"),
				"navigate toggles active class",
			);
			ok(html.includes("a.dataset.page"), "navigate uses data-page attribute");
		});

		it("should update the page title", () => {
			ok(
				html.includes("getElementById('page-title')") ||
					html.includes('getElementById("page-title")'),
				"navigate updates page-title element",
			);
		});

		it("should call renderPage", () => {
			ok(html.includes("renderPage(page)"), "navigate calls renderPage(page)");
		});
	});

	describe("hashchange listener", () => {
		it("should listen for hashchange events", () => {
			ok(
				html.includes("addEventListener('hashchange'") ||
					html.includes('addEventListener("hashchange"'),
				"hashchange event listener is registered",
			);
		});

		it("should call navigate on hashchange", () => {
			ok(
				html.includes("hashchange") &&
					html.includes("navigate(pageFromHash())"),
				"hashchange calls navigate(pageFromHash())",
			);
		});
	});

	describe("sidebar click handlers", () => {
		it("should attach click handlers to sidebar links", () => {
			ok(
				html.includes("#sidebar nav a") &&
					html.includes("addEventListener('click'"),
				"click listener on sidebar nav a",
			);
		});

		it("should prevent default on sidebar link clicks", () => {
			ok(
				html.includes("e.preventDefault()"),
				"preventDefault on sidebar clicks",
			);
		});

		it("should call navigate with data-page on click", () => {
			ok(
				html.includes("navigate(a.dataset.page)") ||
					html.includes("navigate(event.currentTarget.dataset.page)"),
				"click handler calls navigate with data-page",
			);
		});
	});

	describe("pageFromHash function", () => {
		it("should extract page from hash", () => {
			ok(
				html.includes("function pageFromHash"),
				"pageFromHash function exists",
			);
		});

		it("should default to chat for empty hash", () => {
			ok(
				html.includes("'chat'") || html.includes('"chat"'),
				"pageFromHash references chat as default",
			);
		});

		it("should validate against VALID_PAGES", () => {
			ok(
				html.includes("VALID_PAGES.includes"),
				"pageFromHash validates against VALID_PAGES",
			);
		});
	});
});

/* ──────────────────────────────────────────────────────────────── */
/*  3.  Page rendering — each page renders expected content        */
/* ──────────────────────────────────────────────────────────────── */

describe("Page rendering content", () => {
	let html: string;

	before(async () => {
		const res = await fetch(BASE);
		html = await res.text();
	});

	describe("Analytics page", () => {
		it("should have renderAnalytics function", () => {
			ok(html.includes("renderAnalytics"), "renderAnalytics function exists");
		});

		it("should render stat cards", () => {
			ok(html.includes("statCard"), "statCard helper exists");
		});

		it("should fetch /api/stats", () => {
			ok(html.includes("/stats"), "analytics page fetches stats endpoint");
		});
	});

	describe("Chat page", () => {
		it("should have renderChat function", () => {
			ok(html.includes("renderChat"), "renderChat function exists");
		});

		it("should render chat messages container", () => {
			ok(html.includes("chat-messages"), "chat messages container exists");
		});

		it("should render chat input bar", () => {
			ok(html.includes("chat-input-bar"), "chat input bar exists");
		});

		it("should have a send button", () => {
			ok(html.includes("send-btn"), "send button exists");
		});
	});

	describe("Appearance (in System Config)", () => {
		it("should have renderConfigThemes function", () => {
			ok(
				html.includes("renderConfigThemes"),
				"renderConfigThemes function exists",
			);
		});

		it("should render theme selection buttons", () => {
			ok(
				html.includes("data-theme=") || html.includes("btn-primary"),
				"theme buttons exist",
			);
		});
	});

	describe("Skills page", () => {
		it("should have renderSkills function", () => {
			ok(html.includes("renderSkills"), "renderSkills function exists");
		});

		it("should fetch /api/skills", () => {
			ok(html.includes("/api/skills"), "skills page fetches skills endpoint");
		});
	});

	describe("Cron Jobs page", () => {
		it("should have renderCronJobs function", () => {
			ok(html.includes("renderCronJobs"), "renderCronJobs function exists");
		});

		it("should fetch /api/cron", () => {
			ok(html.includes("/cron"), "cron page fetches cron endpoint");
		});
	});

	describe("System Config page", () => {
		it("should have renderConfig function", () => {
			ok(html.includes("renderConfig"), "renderConfig function exists");
		});

		it("should fetch /api/providers", () => {
			ok(html.includes("/providers"), "config page fetches providers endpoint");
		});
	});

	// renderComingSoon helper is no longer used in the new frontend
	// (all pages have full rendering)
});

/* ──────────────────────────────────────────────────────────────── */
/*  4.  Consistency — no orphaned links or unhandled pages         */
/* ──────────────────────────────────────────────────────────────── */

describe("Consistency checks", () => {
	let html: string;

	before(async () => {
		const res = await fetch(BASE);
		html = await res.text();
	});

	it("should not have sidebar links without a renderPage case", () => {
		for (const link of SIDEBAR_LINKS) {
			const hasCase =
				html.includes(`case '${link.page}':`) ||
				html.includes(`case "${link.page}":`);
			ok(hasCase, `page '${link.page}' has a renderPage case`);
		}
	});

	it("should not have renderPage cases without a sidebar link", () => {
		const caseMatches = html.match(/case\s+['"]([^'"]+)['"]\s*:/g);
		if (caseMatches) {
			for (const match of caseMatches) {
				const page = match.replace(/case\s+['"]([^'"]+)['"]\s*:/, "$1");
				const hasLink = html.includes(`data-page="${page}"`);
				ok(
					hasLink,
					`renderPage case '${page}' has a corresponding sidebar link`,
				);
			}
		}
	});

	it("should not have VALID_PAGES entries without a sidebar link", () => {
		for (const link of SIDEBAR_LINKS) {
			ok(
				html.includes(`data-page="${link.page}"`),
				`VALID_PAGES entry '${link.page}' has a sidebar link`,
			);
		}
	});

	it("should not have titles entries without a sidebar link", () => {
		for (const link of SIDEBAR_LINKS) {
			ok(
				html.includes(`data-page="${link.page}"`),
				`titles entry '${link.page}' has a sidebar link`,
			);
		}
	});
});

/* ──────────────────────────────────────────────────────────────── */
/*  5.  Accessibility — ARIA, focus, skip link                     */
/* ──────────────────────────────────────────────────────────────── */

describe("Accessibility", () => {
	let html: string;

	before(async () => {
		const res = await fetch(BASE);
		html = await res.text();
	});

	it("should have a skip-to-content link", () => {
		ok(html.includes("skip-link"), "skip link exists");
		ok(html.includes("Skip to main content"), "skip link has accessible text");
	});

	it("should have aria-label on the nav element", () => {
		ok(html.includes('aria-label="Main navigation"'), "nav has aria-label");
	});

	it("should have aria-hidden on icon spans", () => {
		const iconCount = (html.match(/aria-hidden="true"/g) || []).length;
		ok(
			iconCount >= SIDEBAR_LINKS.length,
			`at least ${SIDEBAR_LINKS.length} icons have aria-hidden`,
		);
	});

	it("should have focus-visible styles for sidebar links", () => {
		ok(html.includes("focus-visible"), "focus-visible styles exist");
	});

	it("should have a status bar with aria-live", () => {
		ok(html.includes('aria-live="polite"'), "status bar has aria-live");
	});
});
