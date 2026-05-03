/**
 * Heartbeat Manager
 * Provides a reliable keep-alive mechanism for long-running operations.
 */

import {
  HeartbeatConfig,
  HeartbeatState,
} from './types.js';

const DEFAULT_INTERVAL = 30_000; // 30 seconds

export class HeartbeatManager {
  private config: Required<HeartbeatConfig>;
  private timer: ReturnType<typeof setInterval> | null;
  private state: HeartbeatState;

  constructor(config: HeartbeatConfig) {
    this.config = {
      interval: config.interval || DEFAULT_INTERVAL,
      onTick: config.onTick,
      startImmediately: config.startImmediately ?? true,
    };
    this.timer = null;
    this.state = {
      running: false,
      ticks: 0,
      errors: [],
    };
  }

  /** Start the heartbeat */
  start(): void {
    if (this.state.running) return;

    this.state.running = true;

    if (this.config.startImmediately) {
      this.tick();
    }

    this.timer = setInterval(() => this.tick(), this.config.interval);
  }

  /** Stop the heartbeat */
  stop(): void {
    if (!this.state.running) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.state.running = false;
  }

  /** Check if the heartbeat is running */
  isRunning(): boolean {
    return this.state.running;
  }

  /** Get the current state */
  getState(): HeartbeatState {
    return { ...this.state };
  }

  /** Get the interval in ms */
  getInterval(): number {
    return this.config.interval;
  }

  /** Update the interval (resets the timer) */
  setInterval(interval: number): void {
    this.config.interval = interval;
    this.stop();
    this.start();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    this.state.ticks++;
    this.state.lastTickAt = new Date();

    try {
      await this.config.onTick();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.state.errors.push(errorMsg);
      // Keep only last 100 errors
      if (this.state.errors.length > 100) {
        this.state.errors = this.state.errors.slice(-100);
      }
    }
  }
}
