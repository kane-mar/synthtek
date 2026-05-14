/**
 * Linux Service module — systemd service management for synthtek
 */

export { SystemdServiceManager } from './service-manager.js';
export type {
  ServiceConfig,
  ServiceState,
  ServiceStatus,
  LogConfig,
  ResourceLimits,
  SystemdUnitOptions,
  InstallResult,
  CommandResult,
  EnvFileResult,
  LogRotationConfig,
  RestartPolicy,
} from './types.js';
