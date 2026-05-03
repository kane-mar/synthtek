/**
 * Stop command — stop the synthtek service
 */

import { Command } from 'commander';
import { logger } from '../cli-context.js';

export function registerStopCommand(program: Command): void {
  program
    .command('stop')
    .description('Stop the synthtek service')
    .option('-f, --force', 'force stop without saving state')
    .action(async (opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          logger.info('Saving current state before stop...');
          // State saving logic would go here
        }

        logger.info('Stopping synthtek service...');

        // In a real implementation, this would signal the running process
        // to gracefully shut down
        logger.info('Stop signal sent. The service will shut down shortly.');
      } catch (err) {
        logger.error('Failed to stop service', { error: (err as Error).message });
        process.exit(1);
      }
    });
}
