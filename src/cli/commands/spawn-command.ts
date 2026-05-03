/**
 * Spawn command — spawn background tasks
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { logger } from '../cli-context.js';

export function registerSpawnCommand(program: Command): void {
  program
    .command('spawn')
    .description('Spawn a background task')
    .argument('<command>', 'command to run')
    .option('-n, --name <name>', 'task name')
    .option('-d, --dir <path>', 'working directory')
    .action((command: string, opts: { name?: string; dir?: string }) => {
      const taskName = opts.name || command.split(' ')[0];
      const [cmd, ...args] = command.split(' ');

      const child = spawn(cmd, args, {
        cwd: opts.dir || process.cwd(),
        detached: true,
        stdio: 'ignore',
      });

      child.unref();
      logger.info(`Task spawned: ${taskName} (PID: ${child.pid})`);
    });
}
