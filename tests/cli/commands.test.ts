/**
 * CLI Commands Tests
 * Verifies that CLI command modules register correctly.
 */

import { ok } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { Command } from "commander";
import { registerAgentCommand } from "../../src/cli/commands/agent-command.js";
import { registerChatCommand } from "../../src/cli/commands/chat-command.js";
import { registerConfigCommand } from "../../src/cli/commands/config-command.js";
import { registerExecCommand } from "../../src/cli/commands/exec-command.js";
import { registerFileCommand } from "../../src/cli/commands/file-command.js";
import { registerInitCommand } from "../../src/cli/commands/init-command.js";
import { registerLogsCommand } from "../../src/cli/commands/logs-command.js";
import { registerPluginCommand } from "../../src/cli/commands/plugin-command.js";
import { registerRestartCommand } from "../../src/cli/commands/restart-command.js";
import { registerSearchCommand } from "../../src/cli/commands/search-command.js";
import { registerSpawnCommand } from "../../src/cli/commands/spawn-command.js";
import { registerStatusCommand } from "../../src/cli/commands/status-command.js";
import { registerStopCommand } from "../../src/cli/commands/stop-command.js";

describe("CLI command registration", () => {
	let program: Command;

	beforeEach(() => {
		program = new Command();
		program.exitOverride(); // Prevent process.exit calls
	});

	it("registers status command", () => {
		registerStatusCommand(program);
		const cmd = program.commands.find((c) => c.name() === "status");
		ok(cmd, "status command should be registered");
	});

	it("registers config command with subcommands", () => {
		registerConfigCommand(program);
		const cmd = program.commands.find((c) => c.name() === "config");
		ok(cmd, "config command should be registered");
	});

	it("registers exec command", () => {
		registerExecCommand(program);
		const cmd = program.commands.find((c) => c.name() === "exec");
		ok(cmd, "exec command should be registered");
	});

	it("registers search command", () => {
		registerSearchCommand(program);
		const cmd = program.commands.find((c) => c.name() === "search");
		ok(cmd, "search command should be registered");
	});

	it("registers file command", () => {
		registerFileCommand(program);
		const cmd = program.commands.find((c) => c.name() === "file");
		ok(cmd, "file command should be registered");
	});

	it("registers spawn command", () => {
		registerSpawnCommand(program);
		const cmd = program.commands.find((c) => c.name() === "spawn");
		ok(cmd, "spawn command should be registered");
	});

	it("registers agent command", () => {
		registerAgentCommand(program);
		const cmd = program.commands.find((c) => c.name() === "agent");
		ok(cmd, "agent command should be registered");
	});

	it("registers plugin command", () => {
		registerPluginCommand(program);
		const cmd = program.commands.find((c) => c.name() === "plugin");
		ok(cmd, "plugin command should be registered");
	});

	it("registers chat command", () => {
		registerChatCommand(program);
		const cmd = program.commands.find((c) => c.name() === "chat");
		ok(cmd, "chat command should be registered");
	});

	it("registers init command", () => {
		registerInitCommand(program);
		const cmd = program.commands.find((c) => c.name() === "init");
		ok(cmd, "init command should be registered");
	});

	it("registers logs command", () => {
		registerLogsCommand(program);
		const cmd = program.commands.find((c) => c.name() === "logs");
		ok(cmd, "logs command should be registered");
	});

	it("registers restart command", () => {
		registerRestartCommand(program);
		const cmd = program.commands.find((c) => c.name() === "restart");
		ok(cmd, "restart command should be registered");
	});

	it("registers stop command", () => {
		registerStopCommand(program);
		const cmd = program.commands.find((c) => c.name() === "stop");
		ok(cmd, "stop command should be registered");
	});
});
