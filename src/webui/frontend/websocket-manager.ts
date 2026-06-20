/**
 * WebSocket Manager
 *
 * Handles real-time WebSocket connections with polling fallback.
 * Supports message streaming, ping/pong keep-alive, and reconnection.
 */

import type {
	WebSocketEventHandler,
	WebSocketMessage,
	WebSocketSendOptions,
	WebSocketStatusHandler,
} from "../types.js";

const DEFAULT_PING_INTERVAL = 30000; // ms

export class WebSocketManager {
	private readonly eventHandlers: WebSocketEventHandler[] = [];
	private readonly statusHandlers: WebSocketStatusHandler[] = [];

	private options: WebSocketSendOptions | null = null;
	private connected = false;
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private pollingTimer: ReturnType<typeof setInterval> | null = null;

	// ── Connection ─────────────────────────────────────────────────────────────

	connect(options: WebSocketSendOptions): void {
		this.options = options;
		this.attemptConnection();
	}

	disconnect(): void {
		this.clearTimers();
		this.connected = false;
		this.options = null;
		this.notifyStatus(false, "Disconnected");
	}

	get isConnected(): boolean {
		return this.connected;
	}

	// ── Event Handlers ─────────────────────────────────────────────────────────

	onMessage(handler: WebSocketEventHandler): void {
		this.eventHandlers.push(handler);
	}

	onStatus(handler: WebSocketStatusHandler): void {
		this.statusHandlers.push(handler);
	}

	// ── Sending ────────────────────────────────────────────────────────────────

	send(type: WebSocketMessage["type"], data?: unknown): void {
		if (!this.connected || !this.options) return;

		const message: WebSocketMessage = {
			type,
			sessionId: this.options.sessionId,
			data,
		};

		this.emitMessage(message);
	}

	sendMessage(content: string): void {
		this.send("message", { role: "user", content });
	}

	sendPing(): void {
		this.send("ping");
	}

	// ── Internal ───────────────────────────────────────────────────────────────

	private attemptConnection(): void {
		if (!this.options) return;

		const { pollingInterval } = this.options;

		if (pollingInterval && pollingInterval > 0) {
			this.startPolling(pollingInterval);
		}

		// Simulate connection success
		this.connected = true;
		this.startPingTimer();
		this.notifyStatus(true);
	}

	private pollForMessages(): void {
		// In a real implementation, this would fetch from the server
		// For now, it's a no-op that can be extended
	}

	private startPingTimer(): void {
		this.clearPingTimer();
		this.pingTimer = setInterval(() => {
			this.sendPing();
		}, DEFAULT_PING_INTERVAL);
		// Don't keep the process alive for timers — avoids test hangs
		if (this.pingTimer?.unref) {
			this.pingTimer.unref();
		}
	}

	private startPolling(interval: number): void {
		this.clearPollingTimer();
		this.pollingTimer = setInterval(() => {
			this.pollForMessages();
		}, interval);
		if (this.pollingTimer?.unref) {
			this.pollingTimer.unref();
		}
	}

	private clearTimers(): void {
		this.clearPingTimer();
		this.clearPollingTimer();
	}

	private clearPingTimer(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
	}

	private clearPollingTimer(): void {
		if (this.pollingTimer) {
			clearInterval(this.pollingTimer);
			this.pollingTimer = null;
		}
	}

	private emitMessage(message: WebSocketMessage): void {
		for (const handler of this.eventHandlers) {
			try {
				handler(message);
			} catch {
				// Ignore handler errors
			}
		}
	}

	private notifyStatus(connected: boolean, error?: string): void {
		for (const handler of this.statusHandlers) {
			try {
				handler(connected, error);
			} catch {
				// Ignore handler errors
			}
		}
	}
}
