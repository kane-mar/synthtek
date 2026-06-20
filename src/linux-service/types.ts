/**
 * Type definitions for the Linux Service (systemd) module
 */

// ── Service Configuration ─────────────────────────────────────────────────────

export type RestartPolicy =
	| "no"
	| "always"
	| "on-failure"
	| "on-abnormal"
	| "on-abort"
	| "on-watchdog";

export interface ServiceConfig {
	name: string;
	description?: string;
	user?: string;
	group?: string;
	workingDirectory?: string;
	execStart: string;
	execStop?: string;
	restart?: RestartPolicy;
	restartSec?: number;
	environmentFile?: string;
	logConfig?: LogConfig;
	resourceLimits?: ResourceLimits;
	systemdOptions?: SystemdUnitOptions;
}

// ── Service State ─────────────────────────────────────────────────────────────

export type ServiceState =
	| "active"
	| "inactive"
	| "failed"
	| "activating"
	| "deactivating"
	| "unknown";

export interface ServiceStatus {
	name: string;
	state: ServiceState;
	subState: string;
	activeSince?: string;
	pid?: number;
	memory?: string;
	cpu?: string;
}

// ── Logging Configuration ─────────────────────────────────────────────────────

export interface LogConfig {
	directory?: string;
	maxFileSize?: number; // bytes, default 10MB
	maxFiles?: number; // default 5
	compress?: boolean; // default true
	journalForwarding?: boolean; // default true
}

// ── Resource Limits ───────────────────────────────────────────────────────────

export interface ResourceLimits {
	memoryMax?: string; // e.g., "512M", "1G"
	cpuQuota?: string; // e.g., "50%", "200%"
	limitNOFILE?: number;
	limitNPROC?: number;
}

// ── Systemd Unit Options ──────────────────────────────────────────────────────

export interface SystemdUnitOptions {
	[key: string]: string | number;
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface InstallResult {
	success: boolean;
	path: string;
	error?: string;
}

export interface CommandResult {
	success: boolean;
	stdout: string;
	stderr: string;
	code: number | null;
	error?: string;
}

export interface EnvFileResult {
	success: boolean;
	path: string;
	error?: string;
}

export interface LogRotationConfig {
	path: string;
	content: string;
}
