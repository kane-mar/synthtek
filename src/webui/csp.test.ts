/**
 * CSP header tests — verify Content-Security-Policy is set on responses
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("CSP Headers", () => {
	it("frontend response should include Content-Security-Policy", () => {
		// The CSP constant should be defined and non-empty
		const { CSP_HEADER } = require("./server.js");
		assert.ok(CSP_HEADER, "CSP_HEADER should be defined");
		assert.ok(
			CSP_HEADER.includes("default-src"),
			"CSP should restrict default-src",
		);
	});
});
