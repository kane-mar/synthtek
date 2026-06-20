/**
 * Langfuse Integration for synthtek
 * Traces, spans, token usage, and cost tracking
 */

import type {
	CostRecord,
	LangfuseConfig,
	LangfuseSpan,
	LangfuseSpanOptions,
	LangfuseTrace,
	LangfuseTraceOptions,
	TokenUsage,
} from "./types.js";

const DEFAULT_CONFIG: LangfuseConfig = {
	publicKey: undefined,
	secretKey: undefined,
	baseUrl: "https://cloud.langfuse.com",
	enabled: false,
	release: undefined,
};

let traceCounter = 0;
let spanCounter = 0;

export class LangfuseIntegration {
	private readonly _config: LangfuseConfig;
	private readonly _traces: Map<string, LangfuseTrace> = new Map();
	private readonly _spans: Map<string, LangfuseSpan> = new Map();
	private readonly _tokenUsage: TokenUsage[] = [];
	private readonly _costs: CostRecord[] = [];
	private _shutdown = false;

	constructor(config?: Partial<LangfuseConfig>) {
		this._config = { ...DEFAULT_CONFIG, ...config };
	}

	get name(): string {
		return "langfuse";
	}

	get isEnabled(): boolean {
		return this._config.enabled ?? false;
	}

	// ── Trace Recording ──────────────────────────────────────────────────────

	createTrace(options: LangfuseTraceOptions): LangfuseTrace {
		if (!this.isEnabled || this._shutdown)
			return this._createNoopTrace(options);

		traceCounter++;
		const trace: LangfuseTrace = {
			id: `trace-${traceCounter}`,
			name: options.name,
			sessionId: options.sessionId,
			userId: options.userId,
			timestamp: Date.now(),
			metadata: options.metadata,
			tags: options.tags,
		};

		this._traces.set(trace.id, trace);
		return trace;
	}

	// ── Span Recording ───────────────────────────────────────────────────────

	createSpan(options: LangfuseSpanOptions): LangfuseSpan {
		if (!this.isEnabled || this._shutdown) return this._createNoopSpan(options);

		spanCounter++;
		const span: LangfuseSpan = {
			id: `span-${spanCounter}`,
			traceId: options.traceId,
			parentId: options.parentId,
			name: options.name,
			type: options.type,
			startTime: Date.now(),
			input: options.input,
			level: "DEFAULT",
		};

		this._spans.set(span.id, span);
		return span;
	}

	endSpan(
		spanId: string,
		options?: {
			output?: unknown;
			level?: LangfuseSpan["level"];
			statusMessage?: string;
		},
	): void {
		const span = this._spans.get(spanId);
		if (span) {
			span.endTime = Date.now();
			if (options?.output !== undefined) span.output = options.output;
			if (options?.level) span.level = options.level;
			if (options?.statusMessage) span.statusMessage = options.statusMessage;
		}
	}

	// ── Token Usage ──────────────────────────────────────────────────────────

	recordTokenUsage(usage: TokenUsage): void {
		if (!this.isEnabled || this._shutdown) return;
		this._tokenUsage.push(usage);
	}

	// ── Cost Tracking ────────────────────────────────────────────────────────

	recordCost(cost: CostRecord): void {
		if (!this.isEnabled || this._shutdown) return;
		this._costs.push(cost);
	}

	// ── Lifecycle ────────────────────────────────────────────────────────────

	async flush(): Promise<void> {
		if (this._shutdown) return;
		// In a real implementation, this would send buffered events to Langfuse API
		// For now, we just clear the buffers
		this._traces.clear();
		this._spans.clear();
		this._tokenUsage.length = 0;
		this._costs.length = 0;
	}

	async shutdown(): Promise<void> {
		await this.flush();
		this._shutdown = true;
	}

	// ── Private ──────────────────────────────────────────────────────────────

	private _createNoopTrace(options: LangfuseTraceOptions): LangfuseTrace {
		return {
			id: `noop-trace-${Date.now()}`,
			name: options.name,
			timestamp: Date.now(),
		};
	}

	private _createNoopSpan(options: LangfuseSpanOptions): LangfuseSpan {
		return {
			id: `noop-span-${Date.now()}`,
			traceId: options.traceId,
			name: options.name,
			type: options.type,
			startTime: Date.now(),
		};
	}
}
