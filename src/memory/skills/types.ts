/**
 * Memory Skills Types
 */

import type { LongTermMemoryService } from "../types.js";

// ── Base Skill Interface ─────────────────────────────────────────────────────

export interface MemorySkill {
	/** Unique skill identifier */
	name: string;

	/** Initialize the skill with memory service */
	init(memory: LongTermMemoryService): Promise<void>;

	/** Shutdown and cleanup */
	shutdown(): Promise<void>;
}

export interface MemorySkillConfig {
	/** Base directory for skill data */
	dataDir?: string;
	/** Whether to enable the skill */
	enabled?: boolean;
}

// ── Reflection Skill ─────────────────────────────────────────────────────────

export interface ReflectionResult {
	/** Entries reviewed during reflection */
	entriesReviewed: number;
	/** New insights generated */
	insightsGenerated: number;
	/** Entries archived as low-value */
	archived: number;
	/** Duration in ms */
	duration: number;
	/** Timestamp of reflection */
	timestamp: Date;
}

export interface MemoryReflectConfig extends MemorySkillConfig {
	/** How often to run reflection (in seconds) */
	intervalSeconds?: number;
	/** Max entries to review per reflection cycle */
	maxReview?: number;
	/** Minimum age of entries to consider for archiving (in days) */
	archiveAgeDays?: number;
}

// ── Defrag Skill ─────────────────────────────────────────────────────────────

export interface DefragResult {
	/** Entries before defrag */
	entriesBefore: number;
	/** Entries after defrag */
	entriesAfter: number;
	/** Duplicates removed */
	duplicatesRemoved: number;
	/** Low-value entries archived */
	lowValueArchived: number;
	/** Storage freed (bytes) */
	storageFreed: number;
	/** Duration in ms */
	duration: number;
}

export interface MemoryDefragConfig extends MemorySkillConfig {
	/** Similarity threshold for duplicate detection (0-1) */
	similarityThreshold?: number;
	/** Max entries to keep */
	maxEntries?: number;
}

// ── Notes Skill ──────────────────────────────────────────────────────────────

export interface NoteEntry {
	/** Unique note ID */
	id: string;
	/** Note title */
	title: string;
	/** Note content */
	content: string;
	/** Tags for categorization */
	tags: string[];
	/** When the note was created */
	createdAt: Date;
	/** When the note was last modified */
	updatedAt: Date;
	/** Whether the note is pinned/priority */
	pinned: boolean;
}

export interface MemoryNotesConfig extends MemorySkillConfig {
	/** Max notes to keep */
	maxNotes?: number;
}

// ── Tasks Skill ──────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in-progress" | "completed" | "cancelled";

export interface TaskEntry {
	/** Unique task ID */
	id: string;
	/** Task title/description */
	title: string;
	/** Detailed description */
	description: string;
	/** Current status */
	status: TaskStatus;
	/** Priority (1-5, 5 being highest) */
	priority: number;
	/** Tags for categorization */
	tags: string[];
	/** Due date (optional) */
	dueDate?: Date;
	/** When the task was created */
	createdAt: Date;
	/** When the task was completed (if completed) */
	completedAt?: Date;
}

export interface MemoryTasksConfig extends MemorySkillConfig {
	/** Max tasks to keep */
	maxTasks?: number;
}

// ── Ingest Skill ─────────────────────────────────────────────────────────────

export interface IngestResult {
	/** Source of the ingested data */
	source: string;
	/** Number of entries created */
	entriesCreated: number;
	/** Number of entries updated */
	entriesUpdated: number;
	/** Errors encountered */
	errors: string[];
	/** Duration in ms */
	duration: number;
}

export interface MemoryIngestConfig extends MemorySkillConfig {
	/** Max entries to create per ingest */
	maxEntries?: number;
	/** Whether to auto-tag ingested content */
	autoTag?: boolean;
}

// ── Lifecycle Skill ──────────────────────────────────────────────────────────

export type LifecycleState = "active" | "idle" | "archived" | "degraded";

export interface MemoryLifecycleConfig extends MemorySkillConfig {
	/** Idle timeout in seconds before transitioning to idle */
	idleTimeout?: number;
	/** Whether to auto-archive after idle period */
	autoArchive?: boolean;
}
