/**
 * Long-term Memory (Persistent Storage)
 * 
 * Provides persistent memory storage with search, consolidation,
 * archiving, and lifecycle management.
 */

import { mkdir, readFile, writeFile, appendFile, stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import type {
  MemoryEntry,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryCreateOptions,
  MemoryUpdateOptions,
  MemoryConsolidationResult,
  LongTermMemoryConfig,
  LongTermMemoryService,
} from './types.js';

const DEFAULT_CONFIG: Required<LongTermMemoryConfig> = {
  storagePath: './memory',
  maxEntries: 10000,
  autoConsolidate: true,
  consolidationThreshold: 1000,
  searchIndexEnabled: true,
};

/**
 * Generate a unique ID for memory entries
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `mem_${timestamp}_${random}`;
}

/**
 * Simple text search with relevance scoring
 */
function searchInText(text: string, query: string): number {
  if (!query) return 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);

  let score = 0;
  for (const term of terms) {
    const index = lowerText.indexOf(term);
    if (index !== -1) {
      // Higher score for matches near the beginning
      score += Math.max(1, 10 - Math.floor(index / 10));
      // Bonus for exact word matches
      const wordRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordRegex.test(text)) {
        score += 5;
      }
    }
  }

  return score;
}

export class LongTermMemoryImpl implements LongTermMemoryService {
  private entries: Map<string, MemoryEntry> = new Map();
  private searchIndex: Map<string, string[]> = new Map(); // id -> terms
  private config: Required<LongTermMemoryConfig>;
  private storageFile: string;
  private indexFile: string;
  private loaded = false;

  constructor(config?: Partial<LongTermMemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageFile = resolve(this.config.storagePath, 'memory.jsonl');
    this.indexFile = resolve(this.config.storagePath, 'search-index.json');
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    await mkdir(dirname(this.storageFile), { recursive: true });

    // Load entries from JSONL file
    try {
      const content = await readFile(this.storageFile, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as MemoryEntry;
          // Restore Date objects
          entry.createdAt = new Date(entry.createdAt);
          entry.updatedAt = new Date(entry.updatedAt);
          this.entries.set(entry.id, entry);

          if (this.config.searchIndexEnabled) {
            this.indexEntry(entry);
          }
        } catch {
          // Skip invalid lines
        }
      }
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Load search index
    if (this.config.searchIndexEnabled) {
      try {
        const indexContent = await readFile(this.indexFile, 'utf-8');
        const indexData = JSON.parse(indexContent) as Record<string, string[]>;
        this.searchIndex = new Map(Object.entries(indexData));
      } catch {
        // Index doesn't exist yet, will be rebuilt
      }
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    if (!this.loaded) return;

    await mkdir(dirname(this.storageFile), { recursive: true });

    // Write all entries to JSONL
    const lines: string[] = [];
    for (const entry of this.entries.values()) {
      lines.push(JSON.stringify(entry));
    }
    await writeFile(this.storageFile, lines.join('\n') + '\n', 'utf-8');

    // Write search index
    if (this.config.searchIndexEnabled) {
      await writeFile(
        this.indexFile,
        JSON.stringify(Object.fromEntries(this.searchIndex)),
        'utf-8',
      );
    }
  }

  async create(options: MemoryCreateOptions): Promise<MemoryEntry> {
    if (!this.loaded) await this.load();

    const now = new Date();
    const entry: MemoryEntry = {
      id: generateId(),
      type: options.type ?? 'long-term',
      content: options.content,
      metadata: {
        ...(options.metadata ?? {}),
        tags: options.tags ?? [],
      },
      createdAt: now,
      updatedAt: now,
      archived: false,
    };

    this.entries.set(entry.id, entry);

    if (this.config.searchIndexEnabled) {
      this.indexEntry(entry);
    }

    // Append to JSONL file
    await appendFile(this.storageFile, JSON.stringify(entry) + '\n', 'utf-8');

    // Auto-consolidate if needed
    if (
      this.config.autoConsolidate &&
      this.entries.size > this.config.consolidationThreshold
    ) {
      await this.consolidate();
    }

    return entry;
  }

  async update(options: MemoryUpdateOptions): Promise<MemoryEntry | null> {
    if (!this.loaded) await this.load();

    const entry = this.entries.get(options.id);
    if (!entry) return null;

    if (options.content !== undefined) {
      entry.content = options.content;
    }
    if (options.metadata !== undefined) {
      entry.metadata = { ...entry.metadata, ...options.metadata };
    }
    if (options.tags !== undefined) {
      entry.metadata.tags = options.tags;
    }
    entry.updatedAt = new Date();

    // Update search index
    if (this.config.searchIndexEnabled) {
      this.searchIndex.delete(entry.id);
      this.indexEntry(entry);
    }

    await this.save();
    return entry;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.loaded) await this.load();

    const deleted = this.entries.delete(id);
    if (deleted) {
      this.searchIndex.delete(id);
      await this.save();
    }
    return deleted;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    if (!this.loaded) await this.load();
    return this.entries.get(id) ?? null;
  }

  async search(options?: MemorySearchOptions): Promise<MemorySearchResult> {
    if (!this.loaded) await this.load();

    const {
      query,
      type,
      metadataFilter,
      limit = 50,
      sortBy = 'relevance',
      sortOrder = 'desc',
    } = options ?? {};

    let candidates = Array.from(this.entries.values()).filter(
      (e) => !e.archived,
    );

    // Filter by type
    if (type) {
      candidates = candidates.filter((e) => e.type === type);
    }

    // Filter by metadata
    if (metadataFilter) {
      candidates = candidates.filter((e) => {
        return Object.entries(metadataFilter).every(
          ([key, value]) => e.metadata[key] === value,
        );
      });
    }

    // Search by query
    let scored: Array<{ entry: MemoryEntry; score: number }> = [];

    if (query) {
      for (const entry of candidates) {
        const contentScore = searchInText(entry.content, query);
        const metaScore = searchInText(
          JSON.stringify(entry.metadata),
          query,
        );
        const totalScore = contentScore + metaScore;

        if (totalScore > 0) {
          scored.push({ entry, score: totalScore });
        }
      }

      // Sort by relevance score
      scored.sort((a, b) =>
        sortOrder === 'desc' ? b.score - a.score : a.score - b.score,
      );

      candidates = scored.map((s) => s.entry);
    } else {
      // Sort by date if no query
      candidates.sort((a, b) => {
        const dateA =
          sortBy === 'updatedAt' ? a.updatedAt : a.createdAt;
        const dateB =
          sortBy === 'updatedAt' ? b.updatedAt : b.createdAt;
        return sortOrder === 'desc'
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      });
    }

    const truncated = candidates.length > limit;
    return {
      entries: candidates.slice(0, limit),
      total: candidates.length,
      truncated,
    };
  }

  async list(options?: MemorySearchOptions): Promise<MemorySearchResult> {
    return this.search(options);
  }

  async archive(id: string): Promise<boolean> {
    if (!this.loaded) await this.load();

    const entry = this.entries.get(id);
    if (!entry) return false;

    entry.archived = true;
    entry.updatedAt = new Date();
    this.searchIndex.delete(id);
    await this.save();
    return true;
  }

  async restore(id: string): Promise<boolean> {
    if (!this.loaded) await this.load();

    const entry = this.entries.get(id);
    if (!entry) return false;

    entry.archived = false;
    entry.updatedAt = new Date();

    if (this.config.searchIndexEnabled) {
      this.indexEntry(entry);
    }

    await this.save();
    return true;
  }

  async consolidate(): Promise<MemoryConsolidationResult> {
    if (!this.loaded) await this.load();

    const startTime = Date.now();
    const entriesBefore = this.entries.size;
    let consolidated = 0;
    let archived = 0;

    // Archive entries older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const [id, entry] of this.entries) {
      if (
        !entry.archived &&
        entry.updatedAt < ninetyDaysAgo &&
        entry.content.length < 50 // Short, old entries are good archive candidates
      ) {
        entry.archived = true;
        entry.updatedAt = new Date();
        this.searchIndex.delete(id);
        archived++;
      }
    }

    // Enforce max entries by archiving oldest
    while (this.entries.size > this.config.maxEntries) {
      let oldestId: string | null = null;
      let oldestDate = new Date();

      for (const [id, entry] of this.entries) {
        if (!entry.archived && entry.updatedAt < oldestDate) {
          oldestDate = entry.updatedAt;
          oldestId = id;
        }
      }

      if (oldestId) {
        const entry = this.entries.get(oldestId)!;
        entry.archived = true;
        entry.updatedAt = new Date();
        this.searchIndex.delete(oldestId);
        archived++;
      } else {
        break;
      }
    }

    consolidated = entriesBefore - this.entries.size + archived;

    await this.save();

    return {
      entriesBefore,
      entriesAfter: this.entries.size,
      consolidated,
      archived,
      duration: Date.now() - startTime,
    };
  }

  async getStats(): Promise<{
    totalEntries: number;
    activeEntries: number;
    archivedEntries: number;
    storageSize: number;
  }> {
    if (!this.loaded) await this.load();

    let storageSize = 0;
    try {
      const stats = await stat(this.storageFile);
      storageSize = stats.size;
    } catch {
      // File doesn't exist
    }

    let activeEntries = 0;
    let archivedEntries = 0;

    for (const entry of this.entries.values()) {
      if (entry.archived) {
        archivedEntries++;
      } else {
        activeEntries++;
      }
    }

    return {
      totalEntries: this.entries.size,
      activeEntries,
      archivedEntries,
      storageSize,
    };
  }

  /**
   * Index an entry for search
   */
  private indexEntry(entry: MemoryEntry): void {
    const terms = new Set<string>();

    // Extract terms from content
    const words = entry.content.toLowerCase().split(/\W+/).filter(Boolean);
    for (const word of words) {
      if (word.length > 2) {
        terms.add(word);
      }
    }

    // Extract terms from metadata tags
    const tags = (entry.metadata.tags as string[]) ?? [];
    for (const tag of tags) {
      terms.add(tag.toLowerCase());
    }

    this.searchIndex.set(entry.id, Array.from(terms));
  }
}
