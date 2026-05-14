/**
 * Memory Defrag Skill
 * 
 * Removes duplicates, archives low-value entries,
 * and optimizes storage.
 */

import type {
  LongTermMemoryService,
  MemoryEntry,
} from '../types.js';
import type {
  MemorySkill,
  DefragResult,
  MemoryDefragConfig,
} from './types.js';

const DEFAULT_CONFIG: Required<MemoryDefragConfig> = {
  dataDir: './memory/skills/defrag',
  enabled: true,
  similarityThreshold: 0.85,
  maxEntries: 10000,
};

export class MemoryDefragSkill implements MemorySkill {
  public name = 'memory-defrag';
  private memory: LongTermMemoryService | null = null;
  private config: Required<MemoryDefragConfig>;

  constructor(config?: Partial<MemoryDefragConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(memory: LongTermMemoryService): Promise<void> {
    this.memory = memory;
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Run defragmentation — remove duplicates, archive low-value entries.
   */
  async defrag(): Promise<DefragResult> {
    if (!this.memory) {
      throw new Error('MemoryDefragSkill not initialized');
    }

    const startTime = Date.now();
    const statsBefore = await this.memory.getStats();
    let duplicatesRemoved = 0;
    let lowValueArchived = 0;

    // Get all active entries
    const result = await this.memory.search({
      type: 'long-term',
      limit: this.config.maxEntries,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    // Detect and remove duplicates
    const seen = new Map<string, MemoryEntry>();
    for (const entry of result.entries) {
      const hash = this.hashContent(entry.content);
      const existing = seen.get(hash);

      if (existing) {
        // Keep the newer entry, archive the older one
        if (entry.updatedAt > existing.updatedAt) {
          await this.memory.archive(existing.id);
          seen.set(hash, entry);
        } else {
          await this.memory.archive(entry.id);
        }
        duplicatesRemoved++;
      } else {
        seen.set(hash, entry);
      }
    }

    // Archive low-value entries (very short, old, no tags)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    for (const entry of result.entries) {
      if (
        !entry.archived &&
        entry.content.length < 20 &&
        entry.updatedAt < cutoffDate &&
        (!entry.metadata.tags || (entry.metadata.tags as string[]).length === 0)
      ) {
        await this.memory.archive(entry.id);
        lowValueArchived++;
      }
    }

    const statsAfter = await this.memory.getStats();

    return {
      entriesBefore: statsBefore.totalEntries,
      entriesAfter: statsAfter.totalEntries,
      duplicatesRemoved,
      lowValueArchived,
      storageFreed: statsBefore.storageSize - statsAfter.storageSize,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Simple content hash for duplicate detection.
   */
  private hashContent(content: string): string {
    const normalized = content.toLowerCase().trim();
    // Simple hash: use first 50 chars as fingerprint
    return normalized.slice(0, 50);
  }
}
