/**
 * Memory Manager
 * 
 * Unifies short-term (context) and long-term (persistent) memory
 * into a single manager for the agent.
 */

import type {
  MemoryManager,
  MemoryManagerConfig,
  ShortTermMemoryService,
  LongTermMemoryService,
} from './types.js';
import { ShortTermMemoryImpl } from './short-term.js';
import { LongTermMemoryImpl } from './long-term.js';

export class MemoryManagerImpl implements MemoryManager {
  public shortTerm: ShortTermMemoryService;
  public longTerm: LongTermMemoryService;
  private config: MemoryManagerConfig;

  constructor(config?: Partial<MemoryManagerConfig>) {
    this.config = {
      shortTerm: config?.shortTerm ?? { maxMessages: 100, maxTokens: 128000, summarizationThreshold: 50 },
      longTerm: config?.longTerm ?? { storagePath: './memory', maxEntries: 10000, autoConsolidate: true, consolidationThreshold: 1000, searchIndexEnabled: true },
    };

    this.shortTerm = new ShortTermMemoryImpl(this.config.shortTerm);
    this.longTerm = new LongTermMemoryImpl(this.config.longTerm);
  }

  async init(): Promise<void> {
    await this.longTerm.load();
  }

  async shutdown(): Promise<void> {
    await this.longTerm.save();
  }
}
