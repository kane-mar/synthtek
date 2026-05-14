/**
 * Status command — show synthtek status and configuration
 */

import { Command } from 'commander';
import { logger, config } from '../cli-context.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show synthtek status and configuration')
    .action(async () => {
      const cfg = config.getAll();
      logger.info('synthtek status', {
        name: cfg.name,
        version: cfg.version,
        workspace: cfg.workspace,
        logLevel: cfg.logLevel,
      });
    });
}
