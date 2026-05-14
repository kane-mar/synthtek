/**
 * LangSmith Integration for synthtek
 * Trace recording, dataset management, and evaluation tracking
 */

import type {
  LangSmithConfig,
  LangSmithTrace,
  LangSmithDataset,
  LangSmithEvaluation,
} from './types.js';

const DEFAULT_CONFIG: LangSmithConfig = {
  apiKey: undefined,
  tracerName: 'synthtek',
  projectName: 'synthtek',
  enabled: false,
  apiUrl: 'https://api.smith.langchain.com',
};

let traceCounter = 0;
let datasetCounter = 0;

export class LangSmithIntegration {
  private readonly _config: LangSmithConfig;
  private readonly _traces: Map<string, LangSmithTrace> = new Map();
  private readonly _datasets: Map<string, LangSmithDataset> = new Map();
  private readonly _evaluations: LangSmithEvaluation[] = [];
  private _shutdown = false;

  constructor(config?: Partial<LangSmithConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  get name(): string {
    return 'langsmith';
  }

  get isEnabled(): boolean {
    return this._config.enabled ?? false;
  }

  // ── Trace Recording ──────────────────────────────────────────────────────

  createTrace(options: {
    name: string;
    runType: LangSmithTrace['runType'];
    inputs?: Record<string, unknown>;
    sessionId?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): LangSmithTrace {
    if (!this.isEnabled || this._shutdown) return this._createNoopTrace(options);

    traceCounter++;
    const trace: LangSmithTrace = {
      id: `ls-trace-${traceCounter}`,
      name: options.name,
      runType: options.runType,
      startTime: Date.now(),
      inputs: options.inputs,
      sessionId: options.sessionId,
      tags: options.tags,
      metadata: options.metadata,
    };

    this._traces.set(trace.id, trace);
    return trace;
  }

  endTrace(
    traceId: string,
    outputs?: Record<string, unknown>,
    error?: string,
  ): void {
    const trace = this._traces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      if (outputs) trace.outputs = outputs;
      if (error) trace.error = error;
    }
  }

  // ── Dataset Management ───────────────────────────────────────────────────

  createDataset(options: {
    name: string;
    description?: string;
    inputs: Record<string, unknown>[];
    outputs?: Record<string, unknown>[];
  }): LangSmithDataset {
    if (!this.isEnabled || this._shutdown) return this._createNoopDataset(options);

    datasetCounter++;
    const dataset: LangSmithDataset = {
      id: `ls-dataset-${datasetCounter}`,
      name: options.name,
      description: options.description,
      inputs: options.inputs,
      outputs: options.outputs,
    };

    this._datasets.set(dataset.id, dataset);
    return dataset;
  }

  addExample(
    datasetId: string,
    input: Record<string, unknown>,
    output?: Record<string, unknown>,
  ): void {
    const dataset = this._datasets.get(datasetId);
    if (dataset) {
      dataset.inputs.push(input);
      if (output) {
        if (!dataset.outputs) dataset.outputs = [];
        dataset.outputs.push(output);
      }
    }
  }

  // ── Evaluation Tracking ──────────────────────────────────────────────────

  recordEvaluation(evaluation: LangSmithEvaluation): void {
    if (!this.isEnabled || this._shutdown) return;
    if (!evaluation.id) evaluation.id = `ls-eval-${Date.now()}`;
    this._evaluations.push(evaluation);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async flush(): Promise<void> {
    if (this._shutdown) return;
    this._traces.clear();
    this._datasets.clear();
    this._evaluations.length = 0;
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this._shutdown = true;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _createNoopTrace(options: { name: string; runType: LangSmithTrace['runType'] }): LangSmithTrace {
    return {
      id: `noop-trace-${Date.now()}`,
      name: options.name,
      runType: options.runType,
      startTime: Date.now(),
    };
  }

  private _createNoopDataset(options: { name: string; inputs: Record<string, unknown>[] }): LangSmithDataset {
    return {
      id: `noop-dataset-${Date.now()}`,
      name: options.name,
      inputs: options.inputs,
    };
  }
}
