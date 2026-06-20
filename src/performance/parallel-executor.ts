/**
 * Parallel executor for concurrent tool execution with concurrency control
 */

import type {
	ParallelExecutorConfig,
	ToolTask,
	ToolTaskResult,
} from "./types.js";

const DEFAULT_EXECUTOR_CONFIG: ParallelExecutorConfig = {
	maxConcurrency: 5,
	timeoutMs: 30_000,
	failFast: false,
};

export class ParallelExecutor {
	private readonly _config: ParallelExecutorConfig;

	constructor(config?: Partial<ParallelExecutorConfig>) {
		this._config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
	}

	async execute(tasks: ToolTask[]): Promise<ToolTaskResult[]> {
		const results: ToolTaskResult[] = [];
		const failed = { value: false };

		// Process in batches respecting concurrency limit
		const batches: ToolTask[][] = [];
		for (let i = 0; i < tasks.length; i += this._config.maxConcurrency) {
			batches.push(tasks.slice(i, i + this._config.maxConcurrency));
		}

		for (const batch of batches) {
			if (failed.value && this._config.failFast) break;

			const batchResults = await Promise.all(
				batch.map(async (task) => {
					const start = Date.now();
					try {
						const timeoutMs = task.timeoutMs ?? this._config.timeoutMs;
						const value = await this._withTimeout(task.fn(), timeoutMs);
						return {
							id: task.id,
							name: task.name,
							success: true,
							value,
							duration: Date.now() - start,
						} as ToolTaskResult;
					} catch (err: unknown) {
						if (this._config.failFast) {
							failed.value = true;
						}
						return {
							id: task.id,
							name: task.name,
							success: false,
							error: err instanceof Error ? err.message : String(err),
							duration: Date.now() - start,
						} as ToolTaskResult;
					}
				}),
			);

			results.push(...batchResults);
		}

		return results;
	}

	private _withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error(`Task timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			promise
				.then((value) => {
					clearTimeout(timer);
					resolve(value);
				})
				.catch((err) => {
					clearTimeout(timer);
					reject(err);
				});
		});
	}
}
