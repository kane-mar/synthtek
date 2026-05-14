/**
 * Memory Ingest Skill
 * 
 * Ingests external content into memory with auto-tagging
 * and content normalization.
 */

import type {
  LongTermMemoryService,
} from '../types.js';
import type {
  MemorySkill,
  IngestResult,
  MemoryIngestConfig,
} from './types.js';

const DEFAULT_CONFIG: Required<MemoryIngestConfig> = {
  dataDir: './memory/skills/ingest',
  enabled: true,
  maxEntries: 100,
  autoTag: true,
};

export class MemoryIngestSkill implements MemorySkill {
  public name = 'memory-ingest';
  private memory: LongTermMemoryService | null = null;
  private config: Required<MemoryIngestConfig>;

  constructor(config?: Partial<MemoryIngestConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(memory: LongTermMemoryService): Promise<void> {
    this.memory = memory;
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Ingest text content into memory.
   */
  async ingestText(
    source: string,
    content: string,
    options?: {
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<IngestResult> {
    if (!this.memory) throw new Error('MemoryIngestSkill not initialized');

    const startTime = Date.now();
    const errors: string[] = [];
    let entriesCreated = 0;
    let entriesUpdated = 0;

    // Split content into chunks if too large
    const chunks = this.chunkContent(content, 5000);

    for (let i = 0; i < chunks.length && entriesCreated < this.config.maxEntries; i++) {
      try {
        const tags = this.config.autoTag
          ? [...(options?.tags ?? []), ...this.autoTag(chunks[i])]
          : options?.tags ?? [];

        await this.memory.create({
          content: chunks[i],
          type: 'long-term',
          metadata: {
            source,
            chunkIndex: i,
            totalChunks: chunks.length,
            ...(options?.metadata ?? {}),
          },
          tags,
        });
        entriesCreated++;
      } catch (err) {
        errors.push(`Failed to ingest chunk ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      source,
      entriesCreated,
      entriesUpdated,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Ingest structured data (JSON) into memory.
   */
  async ingestJSON(
    source: string,
    data: Record<string, unknown>[],
    options?: {
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<IngestResult> {
    if (!this.memory) throw new Error('MemoryIngestSkill not initialized');

    const startTime = Date.now();
    const errors: string[] = [];
    let entriesCreated = 0;

    for (let i = 0; i < data.length && entriesCreated < this.config.maxEntries; i++) {
      try {
        const item = data[i];
        const content = JSON.stringify(item, null, 2);

        const tags = this.config.autoTag
          ? [...(options?.tags ?? []), 'structured', 'json']
          : options?.tags ?? [];

        await this.memory.create({
          content,
          type: 'long-term',
          metadata: {
            source,
            dataType: 'json',
            ...(options?.metadata ?? {}),
          },
          tags,
        });
        entriesCreated++;
      } catch (err) {
        errors.push(`Failed to ingest item ${i}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      source,
      entriesCreated,
      entriesUpdated: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Ingest a file's content into memory.
   */
  async ingestFile(
    source: string,
    filePath: string,
    options?: {
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<IngestResult> {
    if (!this.memory) throw new Error('MemoryIngestSkill not initialized');

    const { readFile } = await import('node:fs/promises');

    const startTime = Date.now();
    const errors: string[] = [];
    let entriesCreated = 0;

    try {
      const content = await readFile(filePath, 'utf-8');
      const result = await this.ingestText(source, content, options);
      entriesCreated = result.entriesCreated;
      errors.push(...result.errors);
    } catch (err) {
      errors.push(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      source,
      entriesCreated,
      entriesUpdated: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }

  // ── Private helpers ──

  /**
   * Split content into chunks of max size.
   */
  private chunkContent(content: string, maxSize: number): string[] {
    if (content.length <= maxSize) return [content];

    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + maxSize, content.length);

      // Try to break at paragraph boundary
      if (end < content.length) {
        const lastNewline = content.lastIndexOf('\n\n', end);
        if (lastNewline > start + 100) {
          end = lastNewline;
        }
      }

      chunks.push(content.slice(start, end).trim());
      start = end;
    }

    return chunks;
  }

  /**
   * Auto-generate tags based on content analysis.
   */
  private autoTag(content: string): string[] {
    const tags = new Set<string>();
    const lower = content.toLowerCase();

    // Detect content type
    if (/\b(code|function|class|import|export)\b/.test(lower)) {
      tags.add('code');
    }
    if (/\b(http|url|api|endpoint)\b/.test(lower)) {
      tags.add('api');
    }
    if (/\b(date|time|schedule|deadline)\b/.test(lower)) {
      tags.add('time-sensitive');
    }
    if (/\b(todo|task|goal|objective)\b/.test(lower)) {
      tags.add('task');
    }
    if (/\b(note|reminder|important)\b/.test(lower)) {
      tags.add('note');
    }
    if (/\b(config|setting|parameter)\b/.test(lower)) {
      tags.add('config');
    }

    return Array.from(tags);
  }
}
