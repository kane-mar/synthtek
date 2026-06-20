/**
 * Multi-instance support — manage multiple agent instances with separate configs
 */

import type { AgentConfig } from "./schema.js";

export interface InstanceConfig {
	name: string;
	config: AgentConfig;
	configPath: string | null;
	workspace: string;
}

export interface InstanceManager {
	getInstance(name: string): InstanceConfig | null;
	listInstances(): string[];
	addInstance(
		name: string,
		config: AgentConfig,
		configPath: string | null,
	): void;
	removeInstance(name: string): boolean;
	getDefaultInstance(): InstanceConfig | null;
	setDefaultInstance(name: string): void;
}

export class InstanceManagerImpl implements InstanceManager {
	private instances: Map<string, InstanceConfig> = new Map();
	private defaultInstanceName: string | null = null;

	getInstance(name: string): InstanceConfig | null {
		return this.instances.get(name) ?? null;
	}

	listInstances(): string[] {
		return Array.from(this.instances.keys());
	}

	addInstance(
		name: string,
		config: AgentConfig,
		configPath: string | null,
	): void {
		this.instances.set(name, {
			name: config.name,
			config: { ...config },
			configPath,
			workspace: config.workspace,
		});

		if (!this.defaultInstanceName) {
			this.defaultInstanceName = name;
		}
	}

	removeInstance(name: string): boolean {
		const removed = this.instances.delete(name);
		if (removed && this.defaultInstanceName === name) {
			const remaining = Array.from(this.instances.keys());
			this.defaultInstanceName = remaining.length > 0 ? remaining[0] : null;
		}
		return removed;
	}

	getDefaultInstance(): InstanceConfig | null {
		if (!this.defaultInstanceName) return null;
		return this.instances.get(this.defaultInstanceName) ?? null;
	}

	setDefaultInstance(name: string): void {
		if (this.instances.has(name)) {
			this.defaultInstanceName = name;
		}
	}
}

// ── Multi-config loader ──────────────────────────────────────────────────────

export interface MultiConfigLoader {
	load(): Map<string, AgentConfig>;
	loadInstance(name: string): AgentConfig | null;
	discoverInstances(): string[];
}

export class MultiConfigLoaderImpl implements MultiConfigLoader {
	private instanceManager: InstanceManager;
	// private secretResolver: SecretResolver;

	constructor(
		instanceManager?: InstanceManager,
		// secretResolver?: SecretResolver,
	) {
		this.instanceManager = instanceManager ?? new InstanceManagerImpl();
		// this.secretResolver = secretResolver ?? new SecretResolverImpl();
	}

	load(): Map<string, AgentConfig> {
		const configs = new Map<string, AgentConfig>();

		// Load default instance
		const defaultInstance = this.instanceManager.getDefaultInstance();
		if (defaultInstance) {
			configs.set("default", defaultInstance.config);
		}

		// Load all instances
		for (const name of this.instanceManager.listInstances()) {
			const instance = this.instanceManager.getInstance(name);
			if (instance) {
				configs.set(name, instance.config);
			}
		}

		return configs;
	}

	loadInstance(name: string): AgentConfig | null {
		const instance = this.instanceManager.getInstance(name);
		return instance ? instance.config : null;
	}

	discoverInstances(): string[] {
		// Discover instances from instance manager
		const instances = this.instanceManager.listInstances();
		return instances;
	}
}
