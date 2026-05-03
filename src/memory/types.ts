/**
 * Memory module types and interfaces
 */

// ── Common ──────────────────────────────────────────────────────────────────

export type MemoryType = 'short-term' | 'long-term';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

export interface MemorySearchOptions {
  query?: string;
  type?: MemoryType;
  metadataFilter?: Record<string, unknown>;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  total: number;
  truncated: boolean;
}

// ── Short-term Memory (Context) ─────────────────────────────────────────────

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  taskId?: string;
}

export interface ShortTermMemoryConfig {
  maxMessages: number;
  maxTokens: number;
  summarizationThreshold: number; // summarize when context exceeds this many messages
}

export interface ContextSummary {
  summary: string;
  messageCount: number;
  tokensSaved: number;
  createdAt: Date;
}

export interface ShortTermMemoryService {
  addMessage(message: ContextMessage): void;
  getMessages(): ContextMessage[];
  getMessagesWithOptions(options?: {
    limit?: number;
    includeSummaries?: boolean;
  }): ContextMessage[];
  clear(): void;
  getStats(): {
    messageCount: number;
    totalTokens: number;
    summaryCount: number;
  };
  summarize(): Promise<ContextSummary | null>;
  reset(): void;

  // ── Message Merging ────────────────────────────────────────────────────────
  mergeConsecutiveUserMessages(maxAgeMs?: number): number;

  // ── Active Task Protection ─────────────────────────────────────────────────
  markTaskActive(taskId: string): void;
  markTaskComplete(taskId: string): void;

  // ── Session Poisoning Protection ───────────────────────────────────────────
  checkForInjection(message: string): InjectionResult;
  sanitizeMessage(message: string): string;
}

// ── Injection Detection ─────────────────────────────────────────────────────

export interface InjectionResult {
  detected: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high';
}

export type InjectionSensitivity = 'low' | 'medium' | 'high';

// ── Long-term Memory (Persistent) ───────────────────────────────────────────

export interface LongTermMemoryConfig {
  storagePath: string;
  maxEntries: number;
  autoConsolidate: boolean;
  consolidationThreshold: number; // consolidate when entries exceed this count
  searchIndexEnabled: boolean;
}

export interface MemoryCreateOptions {
  content: string;
  type?: MemoryType;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface MemoryUpdateOptions {
  id: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface MemoryConsolidationResult {
  entriesBefore: number;
  entriesAfter: number;
  consolidated: number;
  archived: number;
  duration: number;
}

export interface LongTermMemoryService {
  create(options: MemoryCreateOptions): Promise<MemoryEntry>;
  update(options: MemoryUpdateOptions): Promise<MemoryEntry | null>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<MemoryEntry | null>;
  search(options?: MemorySearchOptions): Promise<MemorySearchResult>;
  list(options?: MemorySearchOptions): Promise<MemorySearchResult>;
  archive(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  consolidate(): Promise<MemoryConsolidationResult>;
  getStats(): Promise<{
    totalEntries: number;
    activeEntries: number;
    archivedEntries: number;
    storageSize: number;
  }>;
  load(): Promise<void>;
  save(): Promise<void>;
}

// ── Memory Manager (unifies both) ───────────────────────────────────────────

export interface MemoryManagerConfig {
  shortTerm: ShortTermMemoryConfig;
  longTerm: LongTermMemoryConfig;
}

export interface MemoryManager {
  shortTerm: ShortTermMemoryService;
  longTerm: LongTermMemoryService;
  init(): Promise<void>;
  shutdown(): Promise<void>;
}

// ── Entity Extraction ───────────────────────────────────────────────────────

export type EntityType =
  | 'Person'
  | 'Organization'
  | 'Location'
  | 'Date'
  | 'Event'
  | 'Concept'
  | 'Task';

export interface Mention {
  text: string;
  position: number;
  length: number;
  context: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  mentions: Mention[];
  firstSeen: Date;
  lastSeen: Date;
  attributes: Record<string, string>;
}

export interface EntityExtractorConfig {
  storagePath: string;
}

export interface EntityExtractorService {
  extractEntities(text: string): Entity[];
  getEntity(id: string): Entity | null;
  listEntities(type?: EntityType): Entity[];
  updateEntity(id: string, updates: Partial<Entity>): void;
  save(): Promise<void>;
  load(): Promise<void>;
}

// ── Knowledge Graph ─────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, string>;
  createdAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  properties?: Record<string, string>;
}

export interface KnowledgeGraphConfig {
  storagePath: string;
}

export interface KnowledgeGraphService {
  addNode(label: string, type: string, properties?: Record<string, string>): KnowledgeNode;
  addEdge(
    source: string,
    target: string,
    relation: string,
    properties?: Record<string, string>,
  ): KnowledgeEdge;
  getNode(id: string): KnowledgeNode | null;
  getNeighbors(nodeId: string, relation?: string): KnowledgeNode[];
  query(path: string): KnowledgeNode[];
  toMarkdown(): string;
  save(): Promise<void>;
  load(): Promise<void>;
}

// ── Schema Management ───────────────────────────────────────────────────────

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object';

export interface SchemaField {
  name: string;
  type: SchemaFieldType;
  description?: string;
  defaultValue?: unknown;
}

export interface Schema {
  name: string;
  fields: SchemaField[];
  requiredFields: string[];
  version: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SchemaManagerService {
  registerSchema(schema: Schema): void;
  getSchema(name: string): Schema | null;
  listSchemas(): Schema[];
  validate(entry: Record<string, unknown>, schemaName: string): SchemaValidationResult;
  createTypedEntry(
    schemaName: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> | null;
}
