/**
 * Access control for synthtek
 * Per-user, per-channel, per-resource access control
 */

import type {
	AccessCheckResult,
	AccessControlConfig,
	AccessControlRule,
	AccessLevel,
} from "./types.js";

const DEFAULT_ACCESS_CONTROL_CONFIG: AccessControlConfig = {
	defaultLevel: "none",
	denyByDefault: true,
	rules: [],
};

const ACCESS_LEVELS: Record<AccessLevel, number> = {
	none: 0,
	read: 1,
	write: 2,
	admin: 3,
};

export class AccessControl {
	private readonly _config: AccessControlConfig;
	private readonly _rules: AccessControlRule[] = [];

	constructor(config?: Partial<AccessControlConfig>) {
		this._config = { ...DEFAULT_ACCESS_CONTROL_CONFIG, ...config };
		this._rules = [...(this._config.rules ?? [])];
	}

	check(channel: string, user: string): AccessCheckResult {
		// Find the best matching rule
		let bestLevel: AccessLevel = this._config.denyByDefault
			? "none"
			: (this._config.defaultLevel ?? "none");
		let bestMatch: AccessControlRule | null = null;

		for (const rule of this._rules) {
			if (rule.active === false) continue;

			const matchesChannel = !rule.channel || rule.channel === channel;
			const matchesUser = !rule.user || rule.user === user;

			if (matchesChannel && matchesUser) {
				const ruleLevel = ACCESS_LEVELS[rule.level];
				const bestLevelValue = ACCESS_LEVELS[bestLevel];

				if (ruleLevel > bestLevelValue) {
					bestLevel = rule.level;
					bestMatch = rule;
				}
			}
		}

		// Check time restriction if present
		if (bestMatch?.timeRestriction) {
			// TODO: Implement time-based access control
		}

		const granted = !this._config.denyByDefault || bestLevel !== "none";

		return {
			granted,
			level: granted ? bestLevel : "none",
			reason: granted ? undefined : "Access denied by default policy",
		};
	}

	checkResource(user: string, resource: string): AccessCheckResult {
		// Find rules that apply to this resource
		let bestLevel: AccessLevel = this._config.denyByDefault
			? "none"
			: (this._config.defaultLevel ?? "none");
		let hasUserRule = false;
		let resourceMatched = false;

		for (const rule of this._rules) {
			if (rule.active === false) continue;
			if (rule.user !== user) continue;

			hasUserRule = true;

			// If rule has no resources specified, it applies to all
			if (!rule.resources || rule.resources.length === 0) {
				const ruleLevel = ACCESS_LEVELS[rule.level];
				const bestLevelValue = ACCESS_LEVELS[bestLevel];
				if (ruleLevel > bestLevelValue) {
					bestLevel = rule.level;
				}
				resourceMatched = true;
			} else if (rule.resources.includes(resource)) {
				resourceMatched = true;
				const ruleLevel = ACCESS_LEVELS[rule.level];
				const bestLevelValue = ACCESS_LEVELS[bestLevel];
				if (ruleLevel > bestLevelValue) {
					bestLevel = rule.level;
				}
			}
		}

		// If user has resource-specific rules but none match this resource, deny
		if (hasUserRule && !resourceMatched) {
			return {
				granted: false,
				level: "none",
				reason: `No access to resource '${resource}'`,
			};
		}

		const granted = !this._config.denyByDefault || bestLevel !== "none";

		return {
			granted,
			level: granted ? bestLevel : "none",
			reason: granted ? undefined : `No access to resource '${resource}'`,
		};
	}

	addRule(rule: AccessControlRule): void {
		this._rules.push(rule);
	}

	removeRule(channel?: string, user?: string): boolean {
		const idx = this._rules.findIndex((r) => {
			if (channel && r.channel !== channel) return false;
			if (user && r.user !== user) return false;
			return true;
		});

		if (idx !== -1) {
			this._rules.splice(idx, 1);
			return true;
		}
		return false;
	}

	get rules(): readonly AccessControlRule[] {
		return this._rules;
	}
}
