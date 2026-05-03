/**
 * Memory Metadata Search Skill
 * 
 * Advanced search capabilities using metadata fields,
 * tags, and content patterns.
 */

import type {
  LongTermMemoryService,
  MemoryEntry,
  MemorySearchResult,
} from '../types.js';
import type {
  MemorySkill,
} from './types.js';

export interface MetadataSearchQuery {
  /** Text query for content search */
  query?: string;
  /** Filter by tags (AND logic — entry must have all tags) */
  tags?: string[];
  /** Filter by metadata key-value pairs */
  metadata?: Record<string, unknown>;
  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** Filter by content type */
  contentType?: string;
  /** Limit results */
  limit?: number;
  /** Sort order */
  sortBy?: 'createdAt' | 'updatedAt' | 'relevance';
}

export class MemoryMetadataSearchSkill implements MemorySkill {
  public name = 'memory-metadata-search';
  private memory: LongTermMemoryService | null = null;

  constructor() {
  }

  async init(memory: LongTermMemoryService): Promise<void> {
    this.memory = memory;
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Advanced metadata search.
   */
  async search(query: MetadataSearchQuery): Promise<MemorySearchResult> {
    if (!this.memory) throw new Error('MemoryMetadataSearchSkill not initialized');

    // Start with base search
    let result = await this.memory.search({
      query: query.query,
      limit: query.limit ?? 100,
      sortBy: query.sortBy ?? 'relevance',
    });

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      result.entries = result.entries.filter((entry) => {
        const entryTags = (entry.metadata.tags as string[]) ?? [];
        return query.tags!.every((tag) => entryTags.includes(tag));
      });
    }

    // Filter by metadata
    if (query.metadata) {
      result.entries = result.entries.filter((entry) => {
        return Object.entries(query.metadata!).every(
          ([key, value]) => entry.metadata[key] === value,
        );
      });
    }

    // Filter by date range
    if (query.dateRange) {
      result.entries = result.entries.filter((entry) => {
        const created = entry.createdAt;
        if (query.dateRange!.from && created < query.dateRange!.from!) return false;
        if (query.dateRange!.to && created > query.dateRange!.to!) return false;
        return true;
      });
    }

    // Filter by content type
    if (query.contentType) {
      result.entries = result.entries.filter(
        (entry) => entry.metadata.source === query.contentType,
      );
    }

    result.total = result.entries.length;
    result.truncated = false;

    return result;
  }

  /**
   * Get all unique tags across memory entries.
   */
  async getAllTags(): Promise<Map<string, number>> {
    if (!this.memory) throw new Error('MemoryMetadataSearchSkill not initialized');

    const tagCounts = new Map<string, number>();
    const result = await this.memory.search({ limit: 1000 });

    for (const entry of result.entries) {
      const tags = (entry.metadata.tags as string[]) ?? [];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    return tagCounts;
  }

  /**
   * Get entries grouped by source/type.
   */
  async groupBySource(): Promise<Map<string, MemoryEntry[]>> {
    if (!this.memory) throw new Error('MemoryMetadataSearchSkill not initialized');

    const groups = new Map<string, MemoryEntry[]>();
    const result = await this.memory.search({ limit: 1000 });

    for (const entry of result.entries) {
      const source = (entry.metadata.source as string) ?? 'unknown';
      if (!groups.has(source)) {
        groups.set(source, []);
      }
      groups.get(source)!.push(entry);
    }

    return groups;
  }
}
