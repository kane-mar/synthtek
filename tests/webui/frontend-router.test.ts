/**
 * Tests for HashRouter — hash-based SPA navigation
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { HashRouter } from "../../src/webui/frontend/router.js";
import type { PageName } from "../../src/webui/frontend/types.js";

describe("HashRouter", () => {
	let router: HashRouter;
	let onPageChange: PageName | undefined;

	beforeEach(() => {
		onPageChange = undefined;
		router = new HashRouter({
			defaultPage: "chat",
			validPages: [
				"chat",
				"analytics",
				"plugins",
				"config",
				"sessions",
				"media",
			],
		});
		router.onPageChange((page) => {
			onPageChange = page;
		});
	});

	describe("parseHash", () => {
		it("returns default page for empty hash", () => {
			strictEqual(router.parseHash(""), "chat");
		});

		it("returns default page for hash without fragment", () => {
			strictEqual(router.parseHash("#"), "chat");
		});

		it("parses valid hash fragment", () => {
			strictEqual(router.parseHash("#analytics"), "analytics");
		});

		it("parses hash with trailing slash", () => {
			strictEqual(router.parseHash("#analytics/"), "analytics");
		});

		it("parses hash with query string", () => {
			strictEqual(router.parseHash("#analytics?tab=metrics"), "analytics");
		});

		it("returns default page for invalid hash", () => {
			strictEqual(router.parseHash("#nonexistent"), "chat");
		});

		it("handles lowercase page names", () => {
			strictEqual(router.parseHash("#Chat"), "chat");
		});
	});

	describe("hashForPage", () => {
		it("generates hash for chat", () => {
			strictEqual(router.hashForPage("chat"), "#chat");
		});

		it("generates hash for analytics", () => {
			strictEqual(router.hashForPage("analytics"), "#analytics");
		});

		it("generates hash for plugins", () => {
			strictEqual(router.hashForPage("plugins"), "#plugins");
		});

		it("generates hash for config", () => {
			strictEqual(router.hashForPage("config"), "#config");
		});

		it("generates hash for sessions", () => {
			strictEqual(router.hashForPage("sessions"), "#sessions");
		});

		it("generates hash for media", () => {
			strictEqual(router.hashForPage("media"), "#media");
		});
	});

	describe("navigate", () => {
		it("navigates to a valid page", () => {
			router.navigate("analytics");
			strictEqual(onPageChange, "analytics");
		});

		it("does not navigate to an invalid page", () => {
			router.navigate("nonexistent" as never);
			strictEqual(onPageChange, undefined);
		});

		it("does not navigate to the same page", () => {
			// Router starts on default 'chat'
			router.navigate("chat");
			strictEqual(onPageChange, undefined);
		});

		it("updates currentPage after navigation", () => {
			router.navigate("plugins");
			strictEqual(router.currentPage, "plugins");
		});
	});

	describe("isActive", () => {
		it("returns true for current page", () => {
			ok(router.isActive("chat"));
		});

		it("returns false for non-current page", () => {
			ok(!router.isActive("analytics"));
		});

		it("reflects navigation changes", () => {
			router.navigate("analytics");
			ok(router.isActive("analytics"));
			ok(!router.isActive("chat"));
		});
	});

	describe("renderNavLinks", () => {
		it("renders links with correct hash fragments", () => {
			const links = router.renderNavLinks();
			ok(links.includes('href="#chat"'), "includes chat link");
			ok(links.includes('href="#analytics"'), "includes analytics link");
			ok(links.includes('href="#plugins"'), "includes plugins link");
			ok(links.includes('href="#config"'), "includes config link");
			ok(links.includes('href="#sessions"'), "includes sessions link");
			ok(links.includes('href="#media"'), "includes media link");
		});

		it("marks current page as active", () => {
			const links = router.renderNavLinks();
			ok(links.includes('class="active"'), "includes active class");
		});

		it("updates active class after navigation", () => {
			router.navigate("analytics");
			const links = router.renderNavLinks();
			ok(
				links.includes('href="#analytics"') && links.includes('class="active"'),
				"analytics link is active",
			);
		});
	});

	describe("onPageChange callback", () => {
		it("fires callback on navigation", () => {
			router.navigate("plugins");
			strictEqual(onPageChange, "plugins");
		});

		it("supports multiple callbacks", () => {
			let secondPage: PageName | undefined;
			router.onPageChange((page) => {
				secondPage = page;
			});

			router.navigate("media");
			strictEqual(onPageChange, "media");
			strictEqual(secondPage, "media");
		});

		it("does not fire callback for same-page navigation", () => {
			router.navigate("chat"); // already on chat
			strictEqual(onPageChange, undefined);
		});
	});

	describe("constructor with custom config", () => {
		it("uses custom default page", () => {
			const customRouter = new HashRouter({
				defaultPage: "analytics",
				validPages: [
					"chat",
					"analytics",
					"plugins",
					"config",
					"sessions",
					"media",
				],
			});
			strictEqual(customRouter.currentPage, "analytics");
		});

		it("rejects pages not in validPages list", () => {
			const limitedRouter = new HashRouter({
				defaultPage: "chat",
				validPages: ["chat", "analytics"],
			});
			limitedRouter.navigate("plugins");
			strictEqual(limitedRouter.currentPage, "chat"); // should stay on default
		});
	});
});
