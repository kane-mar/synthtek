/**
 * Memory Reflect Skill
 *
 * Periodically reviews memory entries, generates insights,
 * and archives low-value entries.
 */

import type { LongTermMemoryService, MemoryEntry } from "../types.js";
import type {
	MemoryReflectConfig,
	MemorySkill,
	ReflectionResult,
} from "./types.js";

const DEFAULT_CONFIG: Required<MemoryReflectConfig> = {
	dataDir: "./memory/skills/reflect",
	enabled: true,
	intervalSeconds: 3600, // 1 hour
	maxReview: 100,
	archiveAgeDays: 30,
};

export class MemoryReflectSkill implements MemorySkill {
	public name = "memory-reflect";
	private memory: LongTermMemoryService | null = null;
	private config: Required<MemoryReflectConfig>;
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(config?: Partial<MemoryReflectConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async init(memory: LongTermMemoryService): Promise<void> {
		this.memory = memory;

		if (this.config.enabled) {
			this.startPeriodicReflection();
		}
	}

	async shutdown(): Promise<void> {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Run a reflection cycle — review entries, archive low-value ones.
	 */
	async reflect(): Promise<ReflectionResult> {
		if (!this.memory) {
			throw new Error("MemoryReflectSkill not initialized");
		}

		const startTime = Date.now();
		let entriesReviewed = 0;
		let insightsGenerated = 0;
		let archived = 0;

		// Get recent entries to review
		const result = await this.memory.search({
			type: "long-term",
			limit: this.config.maxReview,
			sortBy: "updatedAt",
			sortOrder: "desc",
		});

		entriesReviewed = result.entries.length;

		// Archive old, short entries that haven't been updated recently
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAgeDays);

		for (const entry of result.entries) {
			// Low-value heuristic: short content, old, no tags
			const isLowValue =
				entry.content.length < 30 &&
				entry.updatedAt < cutoffDate &&
				(!entry.metadata.tags ||
					(entry.metadata.tags as string[]).length === 0);

			if (isLowValue) {
				await this.memory.archive(entry.id);
				archived++;
			}
		}

		// Generate insight entries for patterns found
		const patterns = this.detectPatterns(result.entries);
		for (const pattern of patterns) {
			await this.memory.create({
				content: `Insight: ${pattern}`,
				type: "long-term",
				metadata: { source: "reflection", type: "insight" },
				tags: ["insight", "reflection"],
			});
			insightsGenerated++;
		}

		return {
			entriesReviewed,
			insightsGenerated,
			archived,
			duration: Date.now() - startTime,
			timestamp: new Date(),
		};
	}

	/**
	 * Detect patterns in memory entries.
	 */
	private detectPatterns(entries: MemoryEntry[]): string[] {
		const patterns: string[] = [];
		const tagCounts = new Map<string, number>();

		for (const entry of entries) {
			const tags = (entry.metadata.tags as string[]) ?? [];
			for (const tag of tags) {
				tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		}

		// Report frequently used tags
		for (const [tag, count] of tagCounts) {
			if (count >= 3) {
				patterns.push(`Tag "${tag}" appears in ${count} entries`);
			}
		}

		return patterns;
	}

	/**
	 * Start periodic reflection cycles.
	 */
	private startPeriodicReflection(): void {
		this.intervalId = setInterval(async () => {
			try {
				await this.reflect();
			} catch {
				// Silently handle errors during periodic reflection
			}
		}, this.config.intervalSeconds * 1000);
	}
}
