/**
 * Logs command — view and manage logs
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../cli-context.js';

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('View and manage logs')
    .option('-f, --file <file>', 'log file path')
    .option('-n, --lines <count>', 'number of lines', '50')
    .option('-l, --level <level>', 'filter by log level', 'info')
    .option('-s, --search <pattern>', 'search pattern')
    .option('-t, --tail', 'follow log output')
    .action(async (opts: {
      file?: string;
      lines?: string;
      level?: string;
      search?: string;
      tail?: boolean;
    }) => {
      try {
        const logFile = opts.file ?? join(process.cwd(), 'logs', 'synthtek.log');

        if (!existsSync(logFile)) {
          logger.error(`Log file not found: ${logFile}`);
          process.exit(1);
          return;
        }

        const content = readFileSync(logFile, 'utf-8');
        const lines = content.split('\n');
        const lineCount = parseInt(opts.lines ?? '50', 10) || 50;
        const recentLines = lines.slice(-lineCount);

        // Filter by level
        const filtered = recentLines.filter((line) => {
          if (!opts.level) return true;
          return line.includes(`[${opts.level.toUpperCase()}]`);
        });

        // Filter by search pattern
        const searched = filtered.filter((line) => {
          if (!opts.search) return true;
          return line.includes(opts.search);
        });

        for (const line of searched) {
          if (line.trim()) console.log(line);
        }

        if (searched.length === 0) {
          logger.info('No matching log entries found.');
        }
      } catch (err) {
        logger.error('Failed to read logs', { error: (err as Error).message });
        process.exit(1);
      }
    });
}
