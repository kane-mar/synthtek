/**
 * WebUI Plugin Manager Component
 * 
 * Manages plugin registration, enable/disable, search, and rendering.
 */

import type { PluginInfo } from './types.js';

export class PluginManagerComponent {
  public readonly plugins: PluginInfo[] = [];

  // ── Registration ───────────────────────────────────────────────────────────

  registerPlugin(plugin: PluginInfo): void {
    const existing = this.plugins.find((p) => p.name === plugin.name);
    if (existing) {
      Object.assign(existing, plugin);
    } else {
      this.plugins.push({ ...plugin });
    }
  }

  // ── Enable/Disable ─────────────────────────────────────────────────────────

  enablePlugin(name: string): boolean {
    const plugin = this.plugins.find((p) => p.name === name);
    if (!plugin) return false;
    plugin.enabled = true;
    plugin.status = 'loaded';
    return true;
  }

  disablePlugin(name: string): boolean {
    const plugin = this.plugins.find((p) => p.name === name);
    if (!plugin) return false;
    plugin.enabled = false;
    plugin.status = 'disabled';
    return true;
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  findPlugin(name: string): PluginInfo | null {
    return this.plugins.find((p) => p.name === name) ?? null;
  }

  filterByStatus(status: PluginInfo['status']): PluginInfo[] {
    return this.plugins.filter((p) => p.status === status);
  }

  filterByEnabled(enabled: boolean): PluginInfo[] {
    return this.plugins.filter((p) => p.enabled === enabled);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getTotalCount(): number {
    return this.plugins.length;
  }

  getEnabledCount(): number {
    return this.plugins.filter((p) => p.enabled).length;
  }

  getErrorCount(): number {
    return this.plugins.filter((p) => p.status === 'error').length;
  }

  // ── Removal ────────────────────────────────────────────────────────────────

  removePlugin(name: string): boolean {
    const index = this.plugins.findIndex((p) => p.name === name);
    if (index === -1) return false;
    this.plugins.splice(index, 1);
    return true;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): string {
    if (this.plugins.length === 0) {
      return `<div class="plugin-manager">
        <h2>Plugins</h2>
        <div class="empty-state">No plugins</div>
      </div>`;
    }

    const pluginsHtml = this.plugins
      .map(
        (p) => `
        <div class="plugin-card status-${p.status} ${p.enabled ? 'enabled' : 'disabled'}">
          <div class="plugin-header">
            <span class="plugin-name">${p.name}</span>
            <span class="plugin-version">v${p.version}</span>
          </div>
          <div class="plugin-body">
            <span class="plugin-status-badge status-${p.status}">${p.status}</span>
            <label class="plugin-toggle">
              <input type="checkbox" ${p.enabled ? 'checked' : ''} disabled />
              ${p.enabled ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        </div>`,
      )
      .join('\n');

    return `<div class="plugin-manager">
      <h2>Plugins (${this.getEnabledCount()}/${this.getTotalCount()} enabled)</h2>
      <div class="plugin-list">${pluginsHtml}</div>
    </div>`;
  }
}
