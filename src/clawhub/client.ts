/**
 * ClawHub Integration Client
 *
 * Handles skill search, installation, updates, and Dream learning.
 */

import type {
	ClawHubConfig,
	DreamLearnedSkill,
	SearchFilters,
	Skill,
	SkillDependency,
	SkillInstallResult,
	SkillMetadata,
	SkillSearchResult,
	SkillVersion,
} from "./types.js";

// Mock skill database for offline operation
const MOCK_SKILLS: SkillSearchResult[] = [
	{
		name: "web-search",
		description: "DuckDuckGo web search capability",
		category: "utility",
		tags: ["search", "web"],
		version: "1.2.0",
		author: "synthtek",
		downloads: 1500,
	},
	{
		name: "memory-manager",
		description: "Advanced memory management skills",
		category: "memory",
		tags: ["memory", "storage"],
		version: "2.0.0",
		author: "synthtek",
		downloads: 2300,
	},
	{
		name: "tdd-helper",
		description: "Test-driven development assistant",
		category: "development",
		tags: ["testing", "tdd"],
		version: "1.0.0",
		author: "synthtek",
		downloads: 800,
	},
	{
		name: "cron-scheduler",
		description: "Task scheduling and reminders",
		category: "utility",
		tags: ["cron", "scheduling"],
		version: "1.1.0",
		author: "synthtek",
		downloads: 1200,
	},
];

const MOCK_VERSIONS: Record<string, SkillVersion[]> = {
	"web-search": [
		{
			version: "1.2.0",
			releaseDate: "2026-04-01",
			changelog: "Improved search accuracy",
			isLatest: true,
		},
		{
			version: "1.1.0",
			releaseDate: "2026-03-15",
			changelog: "Added filters",
			isLatest: false,
		},
		{
			version: "1.0.0",
			releaseDate: "2026-02-01",
			changelog: "Initial release",
			isLatest: false,
		},
	],
	"memory-manager": [
		{
			version: "2.0.0",
			releaseDate: "2026-04-10",
			changelog: "Major refactor",
			isLatest: true,
		},
		{
			version: "1.0.0",
			releaseDate: "2026-01-01",
			changelog: "Initial release",
			isLatest: false,
		},
	],
};

export class ClawHubClient {
	private readonly learnedSkills: DreamLearnedSkill[] = [];
	private readonly installedSkills: Map<string, Skill> = new Map();

	constructor(_config: ClawHubConfig) {
		void _config;
	}

	// ── Skill Search ───────────────────────────────────────────────────────────

	searchSkills(query: string, filters?: SearchFilters): SkillSearchResult[] {
		try {
			let results = MOCK_SKILLS.filter(
				(s) =>
					s.name.toLowerCase().includes(query.toLowerCase()) ||
					s.description.toLowerCase().includes(query.toLowerCase()),
			);

			if (filters?.category) {
				results = results.filter((s) => s.category === filters.category);
			}

			if (filters?.tags) {
				results = results.filter((s) =>
					filters.tags?.some((t) => s.tags.includes(t)),
				);
			}

			if (filters?.minDownloads) {
				results = results.filter((s) => s.downloads >= filters.minDownloads!);
			}

			return results;
		} catch {
			return [];
		}
	}

	// ── Skill Installation ─────────────────────────────────────────────────────

	installSkill(name: string, version: string): SkillInstallResult | null {
		if (!this.isValidSkillName(name) || !this.isValidVersion(version)) {
			return null;
		}

		const result: SkillInstallResult = {
			name,
			version,
			success: true,
			path: `skills/${name}@${version}`,
		};

		this.installedSkills.set(name, {
			name,
			version,
			category: "unknown",
			tags: [],
			description: "",
			author: "",
			installed: true,
		});

		return result;
	}

	isValidSkillName(name: string): boolean {
		return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;
	}

	isValidVersion(version: string): boolean {
		return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
	}

	// ── Skill Updates ──────────────────────────────────────────────────────────

	checkForUpdates(name: string, currentVersion: string): SkillVersion | null {
		const versions = MOCK_VERSIONS[name];
		if (!versions) return null;

		const latest = versions.find((v) => v.isLatest);
		if (latest && this.isNewerVersion(latest.version, currentVersion)) {
			return latest;
		}

		return null;
	}

	updateSkill(
		name: string,
		_fromVersion: string,
		toVersion: string,
	): SkillInstallResult | null {
		if (!this.isValidSkillName(name) || !this.isValidVersion(toVersion)) {
			return null;
		}

		const existing = this.installedSkills.get(name);
		if (!existing) return null;

		existing.version = toVersion;

		return {
			name,
			version: toVersion,
			success: true,
			path: `skills/${name}@${toVersion}`,
		};
	}

	isNewerVersion(newer: string, older: string): boolean {
		const newParts = newer.split(".").map(Number);
		const oldParts = older.split(".").map(Number);

		for (let i = 0; i < 3; i++) {
			if (newParts[i] > oldParts[i]) return true;
			if (newParts[i] < oldParts[i]) return false;
		}

		return false;
	}

	// ── Skill Discovery ────────────────────────────────────────────────────────

	discoverSkills(filters?: SearchFilters): SkillSearchResult[] {
		let results = [...MOCK_SKILLS];

		if (filters?.category) {
			results = results.filter((s) => s.category === filters.category);
		}

		if (filters?.tags) {
			results = results.filter((s) =>
				filters.tags?.some((t) => s.tags.includes(t)),
			);
		}

		return results;
	}

	// ── Skill Metadata ─────────────────────────────────────────────────────────

	getSkillMetadata(name: string): SkillMetadata | null {
		const skill = MOCK_SKILLS.find((s) => s.name === name);
		if (!skill) {
			return {
				name,
				description: "Unknown skill",
				category: "unknown",
				tags: [],
				author: "unknown",
				versions: [],
				dependencies: [],
				downloads: 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
		}

		return {
			name: skill.name,
			description: skill.description,
			category: skill.category,
			tags: skill.tags,
			author: skill.author,
			versions: MOCK_VERSIONS[name] ?? [],
			dependencies: [],
			downloads: skill.downloads,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	}

	getSkillVersions(name: string): SkillVersion[] {
		return MOCK_VERSIONS[name] ?? [];
	}

	getSkillDependencies(name: string, _version: string): SkillDependency[] {
		// Return empty for now — dependencies would be fetched from ClawHub API
		void name;
		return [];
	}

	// ── Dream Learning ─────────────────────────────────────────────────────────

	recordDiscoveredSkill(skill: {
		name: string;
		category: string;
		tags: string[];
	}): DreamLearnedSkill {
		const learned: DreamLearnedSkill = {
			name: skill.name,
			category: skill.category,
			tags: skill.tags,
			discoveredAt: Date.now(),
			source: "clawhub",
		};

		this.learnedSkills.push(learned);
		return learned;
	}

	getLearnedSkills(): DreamLearnedSkill[] {
		return [...this.learnedSkills];
	}
}
