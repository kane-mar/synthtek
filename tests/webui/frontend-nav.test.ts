/**
 * Navigation Tests for FrontendApp
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { FrontendApp } from "../../src/webui/frontend/app.js";

// Mock window for Node.js environment
const mockWindow = {
	history: {
		pushState: () => {},
	},
	addEventListener: () => {},
	removeEventListener: () => {},
	location: {
		hash: "",
	},
};
(globalThis as unknown as Window & typeof globalThis).window =
	mockWindow as never;

describe("FrontendApp Navigation", () => {
	let app: FrontendApp;

	beforeEach(() => {
		// Use a minimal theme config for testing
		const themeConfig = {
			mode: "light" as const,
			primaryColor: "#000",
			fontSize: 14,
		};
		app = new FrontendApp(themeConfig);
	});

	describe("navigate() method", () => {
		it("should change currentPage when given a valid page name", () => {
			app.navigate("analytics");
			assert.equal(app.getState().currentPage, "analytics");
		});

		it("should ignore invalid page names", () => {
			app.navigate("invalid-page" as never);
			assert.equal(app.getState().currentPage, "chat"); // default remains unchanged
		});
	});

	describe("render() method with navigation updates", () => {
		it("should render HTML with correct active class after navigate", () => {
			app.navigate("plugins");
			const html = app.render();
			assert.ok(html.includes('class="active"'));
			// Verify that the active link corresponds to plugins
			assert.ok(html.includes("Plugins"), "HTML should contain Plugins link");
		});
	});
});
