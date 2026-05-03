/**
 * WebUI Session Manager Component
 * 
 * Manages session creation, retrieval, deletion, filtering, and rendering.
 */

import type { SessionInfo } from './types.js';

function generateId(): string {
  return `session_${Math.random().toString(36).slice(2, 11)}`;
}

export class SessionManagerComponent {
  public sessions: SessionInfo[] = [];

  // ── Creation ───────────────────────────────────────────────────────────────

  createSession(userId: string): SessionInfo {
    const session: SessionInfo = {
      id: generateId(),
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
    };
    this.sessions.push(session);
    return session;
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  getSession(id: string): SessionInfo | null {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  listSessions(): SessionInfo[] {
    return [...this.sessions];
  }

  // ── Deletion ───────────────────────────────────────────────────────────────

  deleteSession(id: string): boolean {
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.sessions.splice(index, 1);
    return true;
  }

  clearAllSessions(): void {
    this.sessions = [];
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  filterByUserId(userId: string): SessionInfo[] {
    return this.sessions.filter((s) => s.userId === userId);
  }

  filterActive(thresholdMs: number): SessionInfo[] {
    const cutoff = Date.now() - thresholdMs;
    return this.sessions.filter((s) => s.lastActivity >= cutoff);
  }

  sortByActivity(): SessionInfo[] {
    return [...this.sessions].sort((a, b) => b.lastActivity - a.lastActivity);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  getTotalCount(): number {
    return this.sessions.length;
  }

  getTotalMessageCount(): number {
    return this.sessions.reduce((sum, s) => sum + s.messageCount, 0);
  }

  getUniqueUserCount(): number {
    const userIds = new Set(this.sessions.map((s) => s.userId));
    return userIds.size;
  }

  // ── Timeout ────────────────────────────────────────────────────────────────

  expireOldSessions(thresholdMs: number): void {
    const cutoff = Date.now() - thresholdMs;
    this.sessions = this.sessions.filter((s) => s.lastActivity >= cutoff);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  searchSessions(query: string): SessionInfo[] {
    const lower = query.toLowerCase();
    return this.sessions.filter(
      (s) =>
        s.userId.toLowerCase().includes(lower) ||
        s.id.toLowerCase().includes(lower),
    );
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): string {
    if (this.sessions.length === 0) {
      return `<div class="session-manager">
        <h2>Sessions</h2>
        <div class="empty-state">No sessions</div>
      </div>`;
    }

    const sessionsHtml = this.sessions
      .map(
        (s) => `
        <div class="session-card">
          <div class="session-header">
            <span class="session-id">${s.id}</span>
            <span class="session-user">${s.userId}</span>
          </div>
          <div class="session-body">
            <span class="session-activity">Last activity: ${new Date(s.lastActivity).toLocaleString()}</span>
            <span class="session-messages">Messages: ${s.messageCount}</span>
          </div>
        </div>`,
      )
      .join('\n');

    return `<div class="session-manager">
      <h2>Sessions (${this.getTotalCount()} active)</h2>
      <div class="session-list">${sessionsHtml}</div>
    </div>`;
  }
}
