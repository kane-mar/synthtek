/**
 * ClawHub Integration Types
 */

export interface ClawHubConfig {
	apiUrl: string;
	apiKey: string;
	timeout: number;
}

export interface Skill {
	name: string;
	version: string;
	category: string;
	tags: string[];
	description: string;
	author: string;
	installed: boolean;
}

export interface SkillSearchResult {
	name: string;
	description: string;
	category: string;
	tags: string[];
	version: string;
	author: string;
	downloads: number;
}

export interface SkillVersion {
	version: string;
	releaseDate: string;
	changelog: string;
	isLatest: boolean;
}

export interface SkillInstallResult {
	name: string;
	version: string;
	success: boolean;
	path: string;
}

export interface SkillMetadata {
	name: string;
	description: string;
	category: string;
	tags: string[];
	author: string;
	versions: SkillVersion[];
	dependencies: string[];
	downloads: number;
	createdAt: string;
	updatedAt: string;
}

export interface SkillDependency {
	name: string;
	version: string;
	required: boolean;
}

export interface DreamLearnedSkill {
	name: string;
	category: string;
	tags: string[];
	discoveredAt: number;
	source: string;
}

export interface SearchFilters {
	category?: string;
	tags?: string[];
	minDownloads?: number;
}
