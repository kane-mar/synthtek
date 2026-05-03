#!/usr/bin/env node
/**
 * synthtek CLI entry point
 */

import { Command } from 'commander';
import {
  registerStatusCommand,
  registerConfigCommand,
  registerExecCommand,
  registerSearchCommand,
  registerFileCommand,
  registerSpawnCommand,
  registerAgentCommand,
  registerPluginCommand,
  registerChatCommand,
  registerInitCommand,
  registerLogsCommand,
  registerRestartCommand,
  registerStopCommand,
} from './cli/commands/index.js';

const program = new Command();

program
  .name('synthtek')
  .description('A modular plugin-based AI agent framework')
  .version('1.0.0');

// ── Register all commands ───────────────────────────────────────────────────

registerStatusCommand(program);
registerConfigCommand(program);
registerExecCommand(program);
registerSearchCommand(program);
registerFileCommand(program);
registerSpawnCommand(program);
registerAgentCommand(program);
registerPluginCommand(program);
registerChatCommand(program);
registerInitCommand(program);
registerLogsCommand(program);
registerRestartCommand(program);
registerStopCommand(program);

// ── Run ─────────────────────────────────────────────────────────────────────

program.parse(process.argv);
