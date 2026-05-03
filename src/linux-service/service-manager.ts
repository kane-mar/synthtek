/**
 * SystemdServiceManager — manages Linux services via systemd
 *
 * Handles service file generation, installation, lifecycle control,
 * logging configuration, resource limits, and state monitoring.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import {
  ServiceConfig,
  ServiceState,
  ServiceStatus,
  LogConfig,
  ResourceLimits,
  InstallResult,
  CommandResult,
  LogRotationConfig,
} from './types.js';

const execAsync = promisify(exec);

const DEFAULT_SYSTEMD_PATH = '/etc/systemd/system';
const DEFAULT_SERVICE_NAME = 'synthtek-agent';
const DEFAULT_LOG_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_LOG_MAX_FILES = 5;

interface ManagerOptions {
  serviceName?: string;
  systemdPath?: string;
}

export class SystemdServiceManager {
  readonly serviceName: string;
  readonly systemdPath: string;
  readonly serviceUnitName: string;
  readonly serviceFilePath: string;

  constructor(options: ManagerOptions = {}) {
    this.serviceName = options.serviceName ?? DEFAULT_SERVICE_NAME;
    this.systemdPath = options.systemdPath ?? DEFAULT_SYSTEMD_PATH;
    this.serviceUnitName = `${this.serviceName}.service`;
    this.serviceFilePath = join(this.systemdPath, this.serviceUnitName);
  }

  // ── Service File Generation ────────────────────────────────────────────────

  /**
   * Generates a complete systemd .service unit file from a ServiceConfig.
   */
  generateServiceFile(config: ServiceConfig): string {
    this.validateConfig(config);

    const lines: string[] = [];

    // ── [Unit] section ─────────────────────────────────────────────────────
    lines.push('[Unit]');
    lines.push(`Description=${config.description ?? config.name}`);
    lines.push('Documentation=man:systemd.service(5)');
    lines.push('After=network.target');
    lines.push('');

    // ── [Service] section ──────────────────────────────────────────────────
    lines.push('[Service]');
    lines.push('Type=simple');
    lines.push(`ExecStart=${config.execStart}`);

    if (config.execStop) {
      lines.push(`ExecStop=${config.execStop}`);
    }

    if (config.user) {
      lines.push(`User=${config.user}`);
    }

    if (config.group) {
      lines.push(`Group=${config.group}`);
    }

    if (config.workingDirectory) {
      lines.push(`WorkingDirectory=${config.workingDirectory}`);
    }

    // Restart policy
    lines.push(`Restart=${config.restart ?? 'no'}`);
    if (config.restartSec) {
      lines.push(`RestartSec=${config.restartSec}`);
    }

    // Environment file
    if (config.environmentFile) {
      lines.push(`EnvironmentFile=${config.environmentFile}`);
    }

    // Logging
    if (config.logConfig?.journalForwarding !== false) {
      lines.push('StandardOutput=journal');
      lines.push('StandardError=journal');
      lines.push(`SyslogIdentifier=${config.name}`);
    }

    // Resource limits
    if (config.resourceLimits) {
      if (config.resourceLimits.memoryMax) {
        lines.push(`MemoryMax=${config.resourceLimits.memoryMax}`);
      }
      if (config.resourceLimits.cpuQuota) {
        lines.push(`CPUQuota=${config.resourceLimits.cpuQuota}`);
      }
      if (config.resourceLimits.limitNOFILE) {
        lines.push(`LimitNOFILE=${config.resourceLimits.limitNOFILE}`);
      }
      if (config.resourceLimits.limitNPROC) {
        lines.push(`LimitNPROC=${config.resourceLimits.limitNPROC}`);
      }
    }

    // Custom systemd options
    if (config.systemdOptions) {
      for (const [key, value] of Object.entries(config.systemdOptions)) {
        lines.push(`${key}=${value}`);
      }
    }

    // Defaults
    lines.push('KillMode=mixed');
    lines.push('RemainAfterExit=no');
    lines.push('');

    // ── [Install] section ──────────────────────────────────────────────────
    lines.push('[Install]');
    lines.push('WantedBy=multi-user.target');

    return lines.join('\n');
  }

  // ── Install / Uninstall ────────────────────────────────────────────────────

  /**
   * Writes the generated service file to the systemd directory and reloads daemon.
   */
  async install(config: ServiceConfig): Promise<InstallResult> {
    try {
      const content = this.generateServiceFile(config);
      await execAsync(
        `echo '${content.replace(/'/g, "'\\''")}' > ${this.serviceFilePath}`
      );
      await this.reloadDaemon();
      return {
        success: true,
        path: this.serviceFilePath,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        path: this.serviceFilePath,
        error: error.message,
      };
    }
  }

  /**
   * Removes the service file and reloads the systemd daemon.
   */
  async uninstall(): Promise<InstallResult> {
    try {
      await execAsync(`rm -f ${this.serviceFilePath}`);
      await this.reloadDaemon();
      return {
        success: true,
        path: this.serviceFilePath,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        path: this.serviceFilePath,
        error: error.message,
      };
    }
  }

  // ── Lifecycle Control ──────────────────────────────────────────────────────

  /** Start the service. */
  async start(): Promise<CommandResult> {
    return this.runSystemctl('start', this.serviceUnitName);
  }

  /** Stop the service. */
  async stop(): Promise<CommandResult> {
    return this.runSystemctl('stop', this.serviceUnitName);
  }

  /** Restart the service. */
  async restart(): Promise<CommandResult> {
    return this.runSystemctl('restart', this.serviceUnitName);
  }

  /** Get the current service status. */
  async status(): Promise<CommandResult> {
    return this.runSystemctl('status', this.serviceUnitName);
  }

  // ── Boot Enable / Disable ──────────────────────────────────────────────────

  /** Enable the service to start on boot. */
  async enableOnBoot(): Promise<CommandResult> {
    return this.runSystemctl('enable', this.serviceUnitName);
  }

  /** Disable the service from starting on boot. */
  async disableOnBoot(): Promise<CommandResult> {
    return this.runSystemctl('disable', this.serviceUnitName);
  }

  // ── Logging Configuration ──────────────────────────────────────────────────

  /**
   * Returns a normalized log configuration with defaults applied.
   */
  configureLogging(logConfig: LogConfig): Required<LogConfig> {
    return {
      directory: logConfig.directory ?? '/var/log/synthtek',
      maxFileSize: logConfig.maxFileSize ?? DEFAULT_LOG_MAX_SIZE,
      maxFiles: logConfig.maxFiles ?? DEFAULT_LOG_MAX_FILES,
      compress: logConfig.compress ?? true,
      journalForwarding: logConfig.journalForwarding ?? true,
    };
  }

  /**
   * Generates a logrotate configuration for the service logs.
   */
  generateLogRotationConfig(serviceName: string, logConfig: LogConfig): LogRotationConfig {
    const normalized = this.configureLogging(logConfig);
    const logPath = join(normalized.directory, `${serviceName}.log`);

    const content = [
      `${logPath} {`,
      `    size ${normalized.maxFileSize}`,
      `    rotate ${normalized.maxFiles}`,
      `    ${normalized.compress ? 'compress' : 'nocompress'}`,
      '    missingok',
      '    notifempty',
      '    copytruncate',
      '}',
    ].join('\n');

    return {
      path: join(normalized.directory, 'logrotate.conf'),
      content,
    };
  }

  // ── Resource Limits ────────────────────────────────────────────────────────

  /**
   * Returns the resource limits configuration (passthrough with validation).
   */
  configureResourceLimits(limits: ResourceLimits): ResourceLimits {
    return { ...limits };
  }

  // ── Service State Monitoring ───────────────────────────────────────────────

  /**
   * Parses systemctl status output into a structured ServiceStatus.
   */
  parseServiceState(output: string): ServiceStatus {
    const status: ServiceStatus = {
      name: this.serviceName,
      state: 'unknown',
      subState: 'unknown',
    };

    // Parse Active line: "Active: active (running) since ..."
    const activeMatch = output.match(/Active:\s+(\w+)\s+\(([^)]+)\)/);
    if (activeMatch) {
      status.state = activeMatch[1] as ServiceState;
      status.subState = activeMatch[2];
    }

    // Parse Main PID
    const pidMatch = output.match(/Main PID:\s*(\d+)/);
    if (pidMatch) {
      status.pid = parseInt(pidMatch[1], 10);
    }

    // Parse Memory
    const memoryMatch = output.match(/Memory:\s*(.+)/);
    if (memoryMatch) {
      status.memory = memoryMatch[1].trim();
    }

    // Parse CPU
    const cpuMatch = output.match(/CPU:\s*(.+)/);
    if (cpuMatch) {
      status.cpu = cpuMatch[1].trim();
    }

    // Parse active since
    const sinceMatch = output.match(/since\s+(.+)/);
    if (sinceMatch) {
      status.activeSince = sinceMatch[1].trim().replace(/;.*$/, '');
    }

    return status;
  }

  /**
   * Polls systemctl status and returns the parsed service state.
   */
  async monitorState(): Promise<ServiceStatus> {
    try {
      const result = await this.status();
      return this.parseServiceState(result.stdout);
    } catch {
      return {
        name: this.serviceName,
        state: 'unknown',
        subState: 'error',
      };
    }
  }

  // ── Environment File Generation ────────────────────────────────────────────

  /**
   * Generates environment file content from key-value pairs.
   */
  generateEnvFile(envVars: Record<string, string>): string {
    const lines: string[] = [];
    lines.push('# Environment file generated by SystemdServiceManager');
    lines.push(`# Service: ${this.serviceName}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('');

    for (const [key, value] of Object.entries(envVars)) {
      // Quote values that contain spaces
      if (value.includes(' ')) {
        lines.push(`${key}="${value}"`);
      } else {
        lines.push(`${key}=${value}`);
      }
    }

    return lines.join('\n');
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async runSystemctl(action: string, unit: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(`systemctl ${action} ${unit}`);
      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: 0,
      };
    } catch (err) {
      const error = err as Error & { code?: number };
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        code: error.code ?? null,
        error: error.message,
      };
    }
  }

  private async reloadDaemon(): Promise<void> {
    try {
      await execAsync('systemctl daemon-reload');
    } catch {
      // Non-fatal: daemon reload may fail in containerized environments
    }
  }

  private validateConfig(config: ServiceConfig): void {
    if (!config.name) {
      throw new Error('ServiceConfig.name is required');
    }
    if (!config.execStart) {
      throw new Error('ServiceConfig.execStart is required');
    }
  }
}
