/**
 * Memory Tasks Skill
 *
 * Manages tasks with status tracking, priority, and due dates.
 */

import type { LongTermMemoryService } from "../types.js";
import type {
	MemorySkill,
	MemoryTasksConfig,
	TaskEntry,
	TaskStatus,
} from "./types.js";

const DEFAULT_CONFIG: Required<MemoryTasksConfig> = {
	dataDir: "./memory/skills/tasks",
	enabled: true,
	maxTasks: 1000,
};

function generateId(): string {
	return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class MemoryTasksSkill implements MemorySkill {
	public name = "memory-tasks";
	private memory: LongTermMemoryService | null = null;
	private config: Required<MemoryTasksConfig>;
	private tasks: Map<string, TaskEntry> = new Map();

	constructor(config?: Partial<MemoryTasksConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async init(memory: LongTermMemoryService): Promise<void> {
		this.memory = memory;
		await this.loadTasks();
	}

	async shutdown(): Promise<void> {
		await this.saveTasks();
	}

	/**
	 * Create a new task.
	 */
	async createTask(
		title: string,
		description: string,
		options?: {
			priority?: number;
			tags?: string[];
			dueDate?: Date;
		},
	): Promise<TaskEntry> {
		if (!this.memory) throw new Error("MemoryTasksSkill not initialized");

		const now = new Date();
		const task: TaskEntry = {
			id: generateId(),
			title,
			description,
			status: "pending",
			priority: options?.priority ?? 3,
			tags: options?.tags ?? [],
			dueDate: options?.dueDate,
			createdAt: now,
		};

		this.tasks.set(task.id, task);

		await this.memory.create({
			content: `[TASK] ${title}: ${description}`,
			type: "long-term",
			metadata: { source: "tasks", taskId: task.id, status: task.status },
			tags: ["task", ...(options?.tags ?? [])],
		});

		return task;
	}

	/**
	 * Get a task by ID.
	 */
	async getTask(id: string): Promise<TaskEntry | null> {
		return this.tasks.get(id) ?? null;
	}

	/**
	 * Update a task's status.
	 */
	async updateStatus(
		id: string,
		status: TaskStatus,
	): Promise<TaskEntry | null> {
		const task = this.tasks.get(id);
		if (!task) return null;

		task.status = status;
		if (status === "completed") {
			task.completedAt = new Date();
		}
		this.tasks.set(id, task);

		if (this.memory) {
			await this.memory.update({
				id: (await this.findMemoryEntryForTask(id)) ?? "",
				metadata: { status },
			});
		}

		return task;
	}

	/**
	 * Update task priority.
	 */
	async updatePriority(
		id: string,
		priority: number,
	): Promise<TaskEntry | null> {
		const task = this.tasks.get(id);
		if (!task) return null;

		task.priority = Math.max(1, Math.min(5, priority));
		this.tasks.set(id, task);
		return task;
	}

	/**
	 * Delete a task.
	 */
	async deleteTask(id: string): Promise<boolean> {
		const deleted = this.tasks.delete(id);
		if (deleted && this.memory) {
			const memoryEntry = await this.findMemoryEntryForTask(id);
			if (memoryEntry) {
				await this.memory.archive(memoryEntry);
			}
		}
		return deleted;
	}

	/**
	 * List tasks, optionally filtered by status.
	 */
	async listTasks(status?: TaskStatus): Promise<TaskEntry[]> {
		let tasks = Array.from(this.tasks.values());

		if (status) {
			tasks = tasks.filter((t) => t.status === status);
		}

		// Sort by priority (highest first), then by createdAt
		tasks.sort((a, b) => {
			if (a.priority !== b.priority) return b.priority - a.priority;
			return a.createdAt.getTime() - b.createdAt.getTime();
		});

		return tasks;
	}

	/**
	 * Get overdue tasks.
	 */
	async getOverdueTasks(): Promise<TaskEntry[]> {
		const now = new Date();
		return Array.from(this.tasks.values()).filter(
			(t) =>
				t.dueDate &&
				t.dueDate < now &&
				t.status !== "completed" &&
				t.status !== "cancelled",
		);
	}

	/**
	 * Get task statistics.
	 */
	async getStats(): Promise<{
		total: number;
		pending: number;
		inProgress: number;
		completed: number;
		cancelled: number;
		overdue: number;
	}> {
		const tasks = Array.from(this.tasks.values());
		const now = new Date();

		return {
			total: tasks.length,
			pending: tasks.filter((t) => t.status === "pending").length,
			inProgress: tasks.filter((t) => t.status === "in-progress").length,
			completed: tasks.filter((t) => t.status === "completed").length,
			cancelled: tasks.filter((t) => t.status === "cancelled").length,
			overdue: tasks.filter(
				(t) =>
					t.dueDate &&
					t.dueDate < now &&
					t.status !== "completed" &&
					t.status !== "cancelled",
			).length,
		};
	}

	// ── Private helpers ──

	private async loadTasks(): Promise<void> {
		if (!this.memory) return;

		const result = await this.memory.search({
			metadataFilter: { source: "tasks" },
			limit: this.config.maxTasks,
		});

		for (const entry of result.entries) {
			const taskId = entry.metadata.taskId as string;
			const status = (entry.metadata.status as TaskStatus) ?? "pending";

			if (taskId) {
				const contentMatch = entry.content.match(/\[TASK\]\s*(.+?):\s*(.*)/s);
				this.tasks.set(taskId, {
					id: taskId,
					title: contentMatch?.[1] ?? "Untitled",
					description: contentMatch?.[2] ?? "",
					status,
					priority: 3,
					tags:
						(entry.metadata.tags as string[])?.filter(
							(t: string) => t !== "task",
						) ?? [],
					createdAt: entry.createdAt,
				});
			}
		}
	}

	private async saveTasks(): Promise<void> {
		// Tasks are persisted via long-term memory entries
	}

	private async findMemoryEntryForTask(taskId: string): Promise<string | null> {
		if (!this.memory) return null;
		const result = await this.memory.search({
			metadataFilter: { source: "tasks", taskId },
			limit: 1,
		});
		return result.entries[0]?.id ?? null;
	}
}
