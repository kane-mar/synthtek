/**
 * Search command — search files and content
 */

import { Command } from 'commander';
import { glob } from 'glob';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { logger } from '../cli-context.js';
import { validateGlobPattern } from '../../core/cli-validation.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search files and content')
    .argument('<pattern>', 'search pattern (glob or regex)')
    .option('-t, --type <type>', 'file type filter (py, ts, js, md, json)')
    .option('-p, --path <path>', 'search path', '.')
    .option('-c, --content', 'search file contents')
    .option('-i, --ignore-case', 'case insensitive search')
    .option('-n, --max-results <count>', 'maximum results', '100')
    .action(async (pattern: string, opts: {
      type?: string;
      path?: string;
      content?: boolean;
      ignoreCase?: boolean;
      maxResults?: string;
    }) => {
      try {
        validateGlobPattern(pattern);
      } catch (err) {
        logger.error('Invalid pattern', { error: (err as Error).message });
        process.exit(1);
        return;
      }

      const maxResults = parseInt(opts.maxResults ?? '100', 10) || 100;
      const searchPath = opts.path || '.';
      const flags = opts.ignoreCase ? 'i' : '';

      try {
        // First, find matching files
        const globPattern = opts.type
          ? join(searchPath, `**/*${pattern}.*${opts.type}`)
          : join(searchPath, `**/*${pattern}*`);

        const files = await glob(globPattern, {
          ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        });

        if (opts.content) {
          // Search file contents
          const contentPattern = new RegExp(pattern, flags);
          const matches: Array<{ file: string; line: number; content: string }> = [];

          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
                if (contentPattern.test(lines[i])) {
                  matches.push({
                    file: relative(process.cwd(), file),
                    line: i + 1,
                    content: lines[i].trim(),
                  });
                }
              }
            } catch {
              // Skip binary or unreadable files
            }
          }

          if (matches.length === 0) {
            logger.info('No matches found.');
          } else {
            for (const match of matches) {
              logger.info(`${match.file}:${match.line}: ${match.content}`);
            }
            logger.info(`Found ${matches.length} matches.`);
          }
        } else {
          // Just list files
          const limitedFiles = files.slice(0, maxResults);
          if (limitedFiles.length === 0) {
            logger.info('No files found.');
          } else {
            for (const file of limitedFiles) {
              console.log(relative(process.cwd(), file));
            }
            logger.info(`Found ${limitedFiles.length} files.`);
          }
        }
      } catch (err) {
        logger.error('Search failed', { error: (err as Error).message });
        process.exit(1);
      }
    });
}
