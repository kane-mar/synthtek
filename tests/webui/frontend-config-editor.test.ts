/**
 * Tests for WebUI Config Editor Component
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { ConfigEditorComponent } from "../../src/webui/frontend/config-editor.js";
import type {
	ConfigField,
	ConfigSection,
} from "../../src/webui/frontend/types.js";

describe("ConfigEditorComponent", () => {
	let editor: ConfigEditorComponent;

	beforeEach(() => {
		editor = new ConfigEditorComponent();
	});

	describe("constructor", () => {
		it("creates config editor", () => {
			ok(editor, "editor created");
		});

		it("starts with empty sections", () => {
			strictEqual(editor.sections.length, 0);
		});
	});

	describe("section management", () => {
		it("adds a section", () => {
			const section: ConfigSection = {
				name: "general",
				fields: [],
			};
			editor.addSection(section);
			strictEqual(editor.sections.length, 1);
		});

		it("prevents duplicate sections", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addSection({ name: "general", fields: [] });
			strictEqual(editor.sections.length, 1);
		});

		it("removes a section", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.removeSection("general");
			strictEqual(editor.sections.length, 0);
		});
	});

	describe("field management", () => {
		it("adds a text field", () => {
			const field: ConfigField = {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
				required: true,
			};
			editor.addField("general", field);
			strictEqual(editor.sections[0].fields.length, 1);
		});

		it("adds a number field", () => {
			const field: ConfigField = {
				key: "port",
				label: "Port",
				type: "number",
				value: 3000,
			};
			editor.addField("general", field);
			strictEqual(editor.sections[0].fields[0].type, "number");
		});

		it("adds a boolean field", () => {
			const field: ConfigField = {
				key: "enabled",
				label: "Enabled",
				type: "boolean",
				value: true,
			};
			editor.addField("general", field);
			strictEqual(editor.sections[0].fields[0].type, "boolean");
		});

		it("adds a select field with options", () => {
			const field: ConfigField = {
				key: "theme",
				label: "Theme",
				type: "select",
				value: "light",
				options: ["light", "dark", "system"],
			};
			editor.addField("general", field);
			strictEqual(editor.sections[0].fields[0].options?.length, 3);
		});

		it("adds a secret field", () => {
			const field: ConfigField = {
				key: "apiKey",
				label: "API Key",
				type: "secret",
				value: "secret-value",
			};
			editor.addField("general", field);
			strictEqual(editor.sections[0].fields[0].type, "secret");
		});
	});

	describe("value management", () => {
		it("gets field value", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
			});
			strictEqual(editor.getFieldValue("general", "host"), "localhost");
		});

		it("sets field value", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
			});
			editor.setFieldValue("general", "host", "0.0.0.0");
			strictEqual(editor.getFieldValue("general", "host"), "0.0.0.0");
		});

		it("returns null for non-existent field", () => {
			strictEqual(editor.getFieldValue("missing", "key"), null);
		});
	});

	describe("validation", () => {
		it("validates required text fields", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "",
				required: true,
			});
			ok(!editor.validateSection("general"), "empty required field fails");
		});

		it("validates non-empty required fields", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
				required: true,
			});
			ok(editor.validateSection("general"), "non-empty required field passes");
		});

		it("validates number range", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "port",
				label: "Port",
				type: "number",
				value: 3000,
			});
			ok(editor.validateSection("general"), "valid number passes");
		});

		it("collects validation errors", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "",
				required: true,
			});
			editor.validateSection("general");
			const errors = editor.getValidationErrors("general");
			ok(errors.length > 0, "has validation errors");
		});
	});

	describe("export/import", () => {
		it("exports config as JSON", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
			});
			const exported = editor.exportConfig();
			ok(typeof exported === "string", "exports string");
			ok(exported.includes("host"), "includes field key");
		});

		it("imports config from JSON", () => {
			const json = JSON.stringify([
				{
					name: "general",
					fields: [
						{ key: "host", label: "Host", type: "text", value: "localhost" },
					],
				},
			]);
			editor.importConfig(json);
			strictEqual(editor.sections.length, 1);
		});

		it("returns config as object", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
			});
			const config = editor.getConfig();
			ok(config, "returns config object");
		});
	});

	describe("render", () => {
		it("renders config editor HTML", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
			});
			const html = editor.render();
			ok(typeof html === "string", "renders string");
			ok(html.includes("Host"), "includes field label");
		});

		it("renders empty state", () => {
			const html = editor.render();
			ok(html.includes("No configuration"), "shows empty state");
		});

		it("renders section headers", () => {
			editor.addSection({ name: "general", fields: [] });
			const html = editor.render();
			ok(html.includes("general"), "includes section name");
		});

		it("renders validation errors", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "",
				required: true,
			});
			editor.validateSection("general");
			const html = editor.render();
			ok(html.includes("error"), "shows error state");
		});
	});

	describe("reset", () => {
		it("resets all sections", () => {
			editor.addSection({ name: "general", fields: [] });
			editor.addField("general", {
				key: "host",
				label: "Host",
				type: "text",
				value: "localhost",
			});
			editor.reset();
			strictEqual(editor.sections.length, 0);
		});
	});
});
