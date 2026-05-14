/**
 * Async executor service using Node.js child_process
 */

import { ExecutorService, ExecOptions, ExecResult } from './types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class AsyncExecutor implements ExecutorService {
  async execute(options: ExecOptions): Promise<ExecResult> {
    const {
      command,
      workingDir,
      timeout = 60,
      maxOutputSize = 10000,
      shell = false,
      env,
    } = options;

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    try {
      const result = await execFileAsync(command, {
        cwd: workingDir,
        timeout: timeout * 1000,
        maxBuffer: maxOutputSize * 1024,
        shell,
        env: { ...process.env, ...env },
      }) as { stdout: string; stderr: string; status: number; signal: string | null };

      stdout = this.truncate(result.stdout, maxOutputSize);
      stderr = this.truncate(result.stderr, maxOutputSize);

      const exitCode = result.status ?? 0;

      return {
        success: exitCode === 0,
        command,
        stdout,
        stderr,
        code: exitCode,
        signal: result.signal ?? null,
        timedOut: false,
        truncated: result.stdout.length > maxOutputSize || result.stderr.length > maxOutputSize,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      const error = err as Error & { code?: string | number; signal?: string | null; stdout?: string; stderr?: string };

      timedOut = error.signal === 'SIGTERM' || (typeof error.code === 'string' && error.code === 'ETIMEDOUT');

      stdout = this.truncate(error.stdout ?? '', maxOutputSize);
      stderr = this.truncate(error.stderr ?? '', maxOutputSize);

      return {
        success: false,
        command,
        stdout,
        stderr,
        code: typeof error.code === 'number' ? error.code : null,
        signal: error.signal ?? null,
        timedOut,
        truncated: true,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private truncate(str: string, maxChars: number): string {
    if (str.length <= maxChars) return str;
    return str.slice(0, maxChars) + '\n... [truncated]';
  }
}
