/**
 * Linux Service module — systemd service management for synthtek
 */

export { SystemdServiceManager } from "./service-manager.js";
export type {
	CommandResult,
	EnvFileResult,
	InstallResult,
	LogConfig,
	LogRotationConfig,
	ResourceLimits,
	RestartPolicy,
	ServiceConfig,
	ServiceState,
	ServiceStatus,
	SystemdUnitOptions,
} from "./types.js";
