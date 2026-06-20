/**
 * WebUI Analytics Component
 *
 * Displays system metrics, plugin status, and channel health.
 */

import type { ChannelInfo, DashboardMetrics, PluginInfo } from "./types.js";

const DEFAULT_METRICS: DashboardMetrics = {
	activeSessions: 0,
	totalMessages: 0,
	uptime: 0,
	pluginsLoaded: 0,
	channelsConnected: 0,
	cpuUsage: 0,
	memoryUsage: 0,
};

export class AnalyticsComponent {
	public metrics: DashboardMetrics;
	public readonly plugins: PluginInfo[] = [];
	public readonly channels: ChannelInfo[] = [];

	constructor() {
		this.metrics = { ...DEFAULT_METRICS };
	}

	// ── Metrics ────────────────────────────────────────────────────────────────

	updateMetrics(newMetrics: Partial<DashboardMetrics>): void {
		this.metrics = { ...this.metrics, ...newMetrics };
	}

	formatUptime(): string {
		const ms = this.metrics.uptime;
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h ${minutes % 60}m`;
		}
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}

	// ── Plugins ────────────────────────────────────────────────────────────────

	addPlugin(plugin: PluginInfo): void {
		const existing = this.plugins.find((p) => p.name === plugin.name);
		if (existing) {
			Object.assign(existing, plugin);
		} else {
			this.plugins.push(plugin);
		}
	}

	togglePlugin(name: string): boolean {
		const plugin = this.plugins.find((p) => p.name === name);
		if (!plugin) return false;
		plugin.enabled = !plugin.enabled;
		plugin.status = plugin.enabled ? "loaded" : "disabled";
		return true;
	}

	getPluginCount(): number {
		return this.plugins.length;
	}

	getLoadedPluginCount(): number {
		return this.plugins.filter((p) => p.status === "loaded").length;
	}

	// ── Channels ───────────────────────────────────────────────────────────────

	addChannel(channel: ChannelInfo): void {
		const existing = this.channels.find((c) => c.name === channel.name);
		if (existing) {
			Object.assign(existing, channel);
		} else {
			this.channels.push(channel);
		}
	}

	getConnectedChannelCount(): number {
		return this.channels.filter((c) => c.status === "connected").length;
	}

	getTotalMessages(): number {
		return this.channels.reduce(
			(sum, c) => sum + c.messagesReceived + c.messagesSent,
			0,
		);
	}

	// ── Health ─────────────────────────────────────────────────────────────────

	isHealthy(): boolean {
		if (this.channels.length === 0) return true;
		return this.channels.every((c) => c.status === "connected");
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	render(): string {
		const healthClass = this.isHealthy() ? "healthy" : "unhealthy";

		const metricsHtml = `
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-value">${this.metrics.activeSessions}</span>
          <span class="metric-label">Active Sessions</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${this.metrics.totalMessages}</span>
          <span class="metric-label">Total Messages</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${this.formatUptime()}</span>
          <span class="metric-label">Uptime</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${this.metrics.cpuUsage}%</span>
          <span class="metric-label">CPU Usage</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${this.metrics.memoryUsage}%</span>
          <span class="metric-label">Memory Usage</span>
        </div>
      </div>`;

		const pluginsHtml = this.plugins
			.map(
				(p) => `
        <div class="plugin-item status-${p.status}">
          <span class="plugin-name">${p.name}</span>
          <span class="plugin-version">v${p.version}</span>
          <span class="plugin-status">${p.status}</span>
        </div>`,
			)
			.join("\n");

		const channelsHtml = this.channels
			.map(
				(c) => `
        <div class="channel-item status-${c.status}">
          <span class="channel-name">${c.name}</span>
          <span class="channel-status">${c.status}</span>
          <span class="channel-msgs">Rx: ${c.messagesReceived} / Tx: ${c.messagesSent}</span>
        </div>`,
			)
			.join("\n");

		return `<div class="analytics ${healthClass}">
      <h2>Analytics</h2>
      ${metricsHtml}
      <section class="plugins-section">
        <h3>Plugins (${this.getLoadedPluginCount()}/${this.getPluginCount()})</h3>
        ${pluginsHtml || "<p>No plugins loaded</p>"}
      </section>
      <section class="channels-section">
        <h3>Channels (${this.getConnectedChannelCount()}/${this.channels.length})</h3>
        ${channelsHtml || "<p>No channels connected</p>"}
      </section>
    </div>`;
	}
}
