/**
 * Init command — initialize a new synthtek project
 */

import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../cli-context.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new synthtek project')
    .option('-n, --name <name>', 'project name')
    .option('-d, --dir <path>', 'target directory', '.')
    .action(async (opts: { name?: string; dir?: string }) => {
      try {
        const projectDir = opts.dir || '.';
        const projectName = opts.name || 'synthtek-project';

        // Create directory structure
        const dirs = ['plugins', 'config', 'logs'];
        for (const dir of dirs) {
          const dirPath = join(projectDir, dir);
          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
            logger.info(`Created directory: ${dir}`);
          }
        }

        // Create default config
        const configPath = join(projectDir, 'config', 'synthtek.json');
        if (!existsSync(configPath)) {
          writeFileSync(configPath, JSON.stringify({
            name: projectName,
            version: '1.0.0',
            logLevel: 'info',
            workspace: projectDir,
          }, null, 2));
          logger.info('Created default configuration');
        }

        // Create README
        const readmePath = join(projectDir, 'README.md');
        if (!existsSync(readmePath)) {
          writeFileSync(readmePath, `# ${projectName}\n\nA synthtek AI agent project.\n`);
          logger.info('Created README.md');
        }

        logger.info(`Project initialized: ${projectName}`);
      } catch (err) {
        logger.error('Failed to initialize project', { error: (err as Error).message });
        process.exit(1);
      }
    });
}
