/**
 * Memory module
 * 
 * Provides short-term (context) and long-term (persistent) memory
 * management for the agent.
 */

// Types
export type {
  MemoryType,
  MemoryEntry,
  MemorySearchOptions,
  MemorySearchResult,
  ContextMessage,
  ShortTermMemoryConfig,
  ShortTermMemoryService,
  ContextSummary,
  LongTermMemoryConfig,
  LongTermMemoryService,
  MemoryCreateOptions,
  MemoryUpdateOptions,
  MemoryConsolidationResult,
  MemoryManagerConfig,
  MemoryManager,
  EntityType,
  Entity,
  EntityExtractorConfig,
  EntityExtractorService,
  Mention,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphConfig,
  KnowledgeGraphService,
  Schema,
  SchemaField,
  SchemaFieldType,
  SchemaValidationResult,
  SchemaManagerService,
} from './types.js';

// Implementations
export { ShortTermMemoryImpl } from './short-term.js';
export { LongTermMemoryImpl } from './long-term.js';
export { MemoryManagerImpl } from './manager.js';
export { EntityExtractorImpl } from './entity-extractor.js';
export { KnowledgeGraphImpl } from './knowledge-graph.js';
export { SchemaManagerImpl } from './schema-manager.js';
export { MemorySecurityIntegration } from './integration.js';

// Memory Skills
export {
  MemoryReflectSkill,
  MemoryDefragSkill,
  MemoryNotesSkill,
  MemoryTasksSkill,
  MemoryMetadataSearchSkill,
  MemoryIngestSkill,
  MemoryLifecycleSkill,
} from './skills/index.js';

export type {
  MemorySkill,
  MemorySkillConfig,
  ReflectionResult,
  DefragResult,
  NoteEntry,
  TaskEntry,
  TaskStatus,
  IngestResult,
  LifecycleState,
  MetadataSearchQuery,
} from './skills/index.js';
