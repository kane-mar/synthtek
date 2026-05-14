/**
 * Exec command — execute a shell command
 */

import { Command } from 'commander';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../cli-context.js';
import { validateCommand, validateTimeout } from '../../core/cli-validation.js';

const execAsync = promisify(exec);

export function registerExecCommand(program: Command): void {
  program
    .command('exec')
    .description('Execute a shell command')
    .argument('<command>', 'command to execute')
    .option('-d, --dir <path>', 'working directory')
    .option('-t, --timeout <seconds>', 'timeout in seconds', '60')
    .option('-s, --shell', 'use shell to execute')
    .action(async (command: string, opts: { dir?: string; timeout?: string; shell?: boolean }) => {
      try {
        validateCommand(command);
      } catch (err) {
        logger.error('Invalid command', { error: (err as Error).message });
        process.exit(1);
        return;
      }

      let timeoutSeconds = 60;
      try {
        const parsed = parseInt(opts.timeout ?? '60', 10);
        validateTimeout(parsed);
        timeoutSeconds = parsed;
      } catch (err) {
        logger.error('Invalid timeout', { error: (err as Error).message });
        process.exit(1);
        return;
      }

      try {
        const result = await execAsync(command, {
          cwd: opts.dir ?? process.cwd(),
          timeout: timeoutSeconds * 1000,
          shell: opts.shell ? '/bin/bash' : undefined,
        });
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
      } catch (err) {
        const error = err as { code?: number; signal?: string; stdout?: string; stderr?: string };
        if (error.stdout) process.stdout.write(error.stdout);
        if (error.stderr) process.stderr.write(error.stderr);
        logger.error('Command execution failed', {
          code: error.code,
          signal: error.signal,
        });
        process.exit(error.code ?? 1);
      }
    });
}
