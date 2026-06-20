/**
 * BaseChannel — Abstract base class for all channel implementations.
 *
 * Provides common lifecycle management, config handling, message handler
 * registration, stats tracking, and health check infrastructure.
 *
 * Subclasses implement platform-specific connect/disconnect, message sending,
 * and health checking logic.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Channel lifecycle state */
export enum ChannelState {
	/** Channel is constructed but not yet connected */
	Idle = "idle",
	/** Channel is actively connected and processing messages */
	Connected = "connected",
	/** Channel encountered an error and needs attention */
	Error = "error",
	/** Channel has been explicitly disconnected */
	Disconnected = "disconnected",
}

/** Stats reported by getStats() */
export interface ChannelStats {
	/** Whether the channel is currently connected */
	connected: boolean;
	/** Number of messages sent */
	messagesSent: number;
	/** Number of messages received */
	messagesReceived: number;
	/** Timestamp of last activity (send or receive), or undefined */
	lastActivity?: number;
	/** Platform-specific stats (optional) */
	[key: string]: unknown;
}

/** Error event emitted by channels */
export interface ChannelErrorEvent {
	/** The error that occurred */
	error: Error;
	/** Timestamp of the error */
	timestamp: number;
	/** Whether the channel will attempt to recover */
	recoverable: boolean;
}

// ─── Abstract Base Class ─────────────────────────────────────────────────────

export abstract class BaseChannel<
	ConfigType extends object = object,
	MessageType extends object = object,
> {
	// ── Protected state (accessible to subclasses) ────────────────────────────

	/** Channel configuration */
	protected config: ConfigType;

	/** Current lifecycle state */
	protected state: ChannelState = ChannelState.Idle;

	/** Messages sent counter */
	protected messagesSent = 0;

	/** Messages received counter */
	protected messagesReceived = 0;

	/** Error counter */
	protected errorCount = 0;

	/** Timestamp of last activity */
	protected lastActivity: number | undefined;

	/** Registered message handlers */
	protected messageHandlers: Array<(msg: MessageType) => Promise<void>> = [];

	/** Error event listeners */
	protected errorListeners: Array<(event: ChannelErrorEvent) => void> = [];

	// ── Constructor ───────────────────────────────────────────────────────────

	constructor(config: ConfigType) {
		this.config = config;
	}

	// ── Config Management ─────────────────────────────────────────────────────

	/** Get a copy of the current configuration */
	getConfig(): ConfigType {
		return { ...this.config };
	}

	/** Update configuration with partial changes */
	updateConfig(partial: Partial<ConfigType>): void {
		this.config = { ...this.config, ...partial };
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	/**
	 * Connect to the platform.
	 * Subclasses must implement this to establish the connection.
	 */
	abstract connect(): Promise<void>;

	/**
	 * Disconnect from the platform.
	 * Subclasses must implement this to clean up resources.
	 */
	abstract disconnect(): Promise<void>;

	/** Check if the channel is currently connected */
	isConnected(): boolean {
		return this.state === ChannelState.Connected;
	}

	/** Get the current channel state */
	getState(): ChannelState {
		return this.state;
	}

	// ── Message Handling ──────────────────────────────────────────────────────

	/**
	 * Register a handler for incoming messages.
	 * Handlers are called in registration order.
	 */
	onMessage(handler: (msg: MessageType) => Promise<void>): void {
		this.messageHandlers.push(handler);
	}

	/**
	 * Remove a previously registered message handler.
	 */
	offMessage(handler: (msg: MessageType) => Promise<void>): void {
		const idx = this.messageHandlers.indexOf(handler);
		if (idx !== -1) {
			this.messageHandlers.splice(idx, 1);
		}
	}

	/**
	 * Dispatch an incoming message to all registered handlers.
	 * Call this from your platform-specific message receive logic.
	 */
	protected async dispatchMessage(msg: MessageType): Promise<void> {
		this.messagesReceived++;
		this.lastActivity = Date.now();

		for (const handler of this.messageHandlers) {
			try {
				await handler(msg);
			} catch (err) {
				this.emitError(
					err instanceof Error ? err : new Error(String(err)),
					true,
				);
			}
		}
	}

	// ── Error Handling ────────────────────────────────────────────────────────

	/**
	 * Register a listener for error events.
	 */
	onError(listener: (event: ChannelErrorEvent) => void): void {
		this.errorListeners.push(listener);
	}

	/**
	 * Emit an error event to all listeners.
	 * Call this when the channel encounters an error.
	 */
	protected emitError(error: Error, recoverable = true): void {
		this.errorCount++;

		const event: ChannelErrorEvent = {
			error,
			timestamp: Date.now(),
			recoverable,
		};

		for (const listener of this.errorListeners) {
			try {
				listener(event);
			} catch {
				// Error listeners should never throw
			}
		}

		if (!recoverable) {
			this.state = ChannelState.Error;
		}
	}

	// ── Stats ─────────────────────────────────────────────────────────────────

	/**
	 * Get channel statistics.
	 * Subclasses can override to add platform-specific stats.
	 */
	getStats(): ChannelStats {
		return {
			connected: this.isConnected(),
			messagesSent: this.messagesSent,
			messagesReceived: this.messagesReceived,
			errors: this.errorCount,
			lastActivity: this.lastActivity,
		};
	}

	// ── Health Check ──────────────────────────────────────────────────────────

	/**
	 * Check if the channel is healthy.
	 * Subclasses should override to perform platform-specific health checks.
	 * Default implementation checks connection state.
	 */
	async healthCheck(): Promise<boolean> {
		return this.isConnected();
	}

	// ── Activity Tracking Helpers ─────────────────────────────────────────────

	/**
	 * Record that a message was sent.
	 * Call this after successfully sending a message.
	 */
	protected recordSent(): void {
		this.messagesSent++;
		this.lastActivity = Date.now();
	}

	/**
	 * Record that a message was received.
	 * Call this after receiving a message from the platform.
	 */
	protected recordReceived(): void {
		this.messagesReceived++;
		this.lastActivity = Date.now();
	}

	/**
	 * Transition to connected state.
	 * Call this after successfully connecting.
	 */
	protected markConnected(): void {
		this.state = ChannelState.Connected;
	}

	/**
	 * Transition to disconnected state.
	 * Call this after disconnecting.
	 */
	protected markDisconnected(): void {
		this.state = ChannelState.Disconnected;
	}
}
