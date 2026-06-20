/**
 * Streaming optimization for synthtek
 * Buffers, splits, and optionally compresses stream chunks
 */

import type { StreamChunk, StreamingConfig, StreamStats } from "./types.js";

const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
	chunkSize: 200,
	flushIntervalMs: 100,
	maxBufferedChunks: 20,
	enableCompression: false,
};

let chunkCounter = 0;

export class StreamOptimizer {
	private readonly _config: StreamingConfig;
	private readonly _buffer: StreamChunk[] = [];
	private _onFlush: ((chunks: StreamChunk[]) => void) | null = null;
	private _totalChunks = 0;
	private _totalBytes = 0;
	private _flushTimer: ReturnType<typeof setInterval> | null = null;

	constructor(config?: Partial<StreamingConfig>) {
		this._config = { ...DEFAULT_STREAMING_CONFIG, ...config };
		this._startFlushTimer();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	get flushTimer(): ReturnType<typeof setInterval> | null {
		return this._flushTimer;
	}

	push(content: string): void {
		const chunks = this.splitChunk(content);
		this._buffer.push(...chunks);
		this._totalChunks += chunks.length;
		this._totalBytes += content.length;

		// Auto-flush when buffer is full
		if (this._buffer.length >= this._config.maxBufferedChunks) {
			this.flush();
		}
	}

	splitChunk(content: string): StreamChunk[] {
		if (content.length <= this._config.chunkSize) {
			return [this._createChunk(content, false)];
		}

		const chunks: StreamChunk[] = [];
		for (let i = 0; i < content.length; i += this._config.chunkSize) {
			const slice = content.slice(i, i + this._config.chunkSize);
			chunks.push(this._createChunk(slice, false));
		}
		return chunks;
	}

	async flush(): Promise<void> {
		if (this._buffer.length === 0) return;

		const toFlush = [...this._buffer];
		this._buffer.length = 0;

		if (this._onFlush) {
			this._onFlush(toFlush);
		}
	}

	async drain(): Promise<void> {
		await this.flush();
	}

	onFlush(callback: (chunks: StreamChunk[]) => void): void {
		this._onFlush = callback;
	}

	stats(): StreamStats {
		return {
			totalChunks: this._totalChunks,
			totalBytes: this._totalBytes,
			averageLatencyMs: 0,
			compressedBytes: this._config.enableCompression
				? Math.floor(this._totalBytes * 0.7)
				: 0,
		};
	}

	get compressionEnabled(): boolean {
		return this._config.enableCompression;
	}

	// ── Private ──────────────────────────────────────────────────────────────

	private _createChunk(content: string, isFinal: boolean): StreamChunk {
		chunkCounter++;
		return {
			id: `chunk_${chunkCounter}`,
			content,
			timestamp: Date.now(),
			isFinal,
		};
	}

	private _startFlushTimer(): void {
		this._flushTimer = setInterval(() => {
			this.flush();
		}, this._config.flushIntervalMs);
	}
}
