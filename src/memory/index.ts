/**
 * Memory module
 *
 * Provides short-term (context) and long-term (persistent) memory
 * management for the agent.
 */

export { EntityExtractorImpl } from "./entity-extractor.js";
export { MemorySecurityIntegration } from "./integration.js";
export { KnowledgeGraphImpl } from "./knowledge-graph.js";
export { LongTermMemoryImpl } from "./long-term.js";
export { MemoryManagerImpl } from "./manager.js";
export { SchemaManagerImpl } from "./schema-manager.js";
// Implementations
export { ShortTermMemoryImpl } from "./short-term.js";
export type {
	DefragResult,
	IngestResult,
	LifecycleState,
	MemorySkill,
	MemorySkillConfig,
	MetadataSearchQuery,
	NoteEntry,
	ReflectionResult,
	TaskEntry,
	TaskStatus,
} from "./skills/index.js";

// Memory Skills
export {
	MemoryDefragSkill,
	MemoryIngestSkill,
	MemoryLifecycleSkill,
	MemoryMetadataSearchSkill,
	MemoryNotesSkill,
	MemoryReflectSkill,
	MemoryTasksSkill,
} from "./skills/index.js";
// Types
export type {
	ContextMessage,
	ContextSummary,
	Entity,
	EntityExtractorConfig,
	EntityExtractorService,
	EntityType,
	KnowledgeEdge,
	KnowledgeGraphConfig,
	KnowledgeGraphService,
	KnowledgeNode,
	LongTermMemoryConfig,
	LongTermMemoryService,
	MemoryConsolidationResult,
	MemoryCreateOptions,
	MemoryEntry,
	MemoryManager,
	MemoryManagerConfig,
	MemorySearchOptions,
	MemorySearchResult,
	MemoryType,
	MemoryUpdateOptions,
	Mention,
	Schema,
	SchemaField,
	SchemaFieldType,
	SchemaManagerService,
	SchemaValidationResult,
	ShortTermMemoryConfig,
	ShortTermMemoryService,
} from "./types.js";
