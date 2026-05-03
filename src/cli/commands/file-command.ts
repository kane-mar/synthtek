/**
 * File command — file operations
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from '../cli-context.js';
import { sanitizePath } from '../../core/cli-validation.js';

export function registerFileCommand(program: Command): void {
  program
    .command('file')
    .description('File operations')
    .addCommand(
      new Command('read')
        .description('Read a file')
        .argument('<path>', 'file path')
        .option('-o, --offset <line>', 'start line number', '1')
        .option('-l, --limit <lines>', 'max lines to read', '100')
        .action((path: string, opts: { offset: string; limit: string }) => {
          try {
            const safePath = sanitizePath(path);
            if (!existsSync(safePath)) {
              logger.error(`File not found: ${safePath}`);
              process.exit(1);
              return;
            }
            const content = readFileSync(safePath, 'utf-8');
            const lines = content.split('\n');
            const offset = parseInt(opts.offset, 10) - 1 || 0;
            const limit = parseInt(opts.limit, 10) || 100;
            const slice = lines.slice(offset, offset + limit);
            console.log(slice.join('\n'));
          } catch (err) {
            logger.error('Failed to read file', { error: (err as Error).message });
            process.exit(1);
          }
        })
    )
    .addCommand(
      new Command('write')
        .description('Write content to a file')
        .argument('<path>', 'file path')
        .argument('<content>', 'content to write')
        .action((path: string, content: string) => {
          try {
            const safePath = sanitizePath(path);
            const dir = dirname(safePath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }
            writeFileSync(safePath, content, 'utf-8');
            logger.info(`File written: ${safePath}`);
          } catch (err) {
            logger.error('Failed to write file', { error: (err as Error).message });
            process.exit(1);
          }
        })
    )
    .addCommand(
      new Command('info')
        .description('Show file information')
        .argument('<path>', 'file path')
        .action((path: string) => {
          try {
            const safePath = sanitizePath(path);
            if (!existsSync(safePath)) {
              logger.error(`File not found: ${safePath}`);
              process.exit(1);
              return;
            }
            const stats = statSync(safePath);
            logger.info('File info', {
              path: safePath,
              size: `${stats.size} bytes`,
              created: stats.birthtime.toISOString(),
              modified: stats.mtime.toISOString(),
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
            });
          } catch (err) {
            logger.error('Failed to get file info', { error: (err as Error).message });
            process.exit(1);
          }
        })
    );
}
