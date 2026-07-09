/**
 * Frontend utility functions — pure functions extracted from frontend.html.
 * These are shared between the inline SPA and any testing infrastructure.
 */

/**
 * Escape HTML special characters.
 * Uses DOM-based escaping (browser-safe) or regex fallback.
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Format a number for display (e.g. 1234 → "1.2K").
 */
export function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function fmtDuration(ms: number): string {
	if (!ms) return "0s";
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	if (ms < 3_600_000)
		return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
	return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/**
 * Format a timestamp (epoch ms) to a short time string (HH:MM).
 */
export function fmtTime(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

/**
 * Render a stat card HTML block.
 */
export function statCard(label: string, value: string | number): string {
	return `<div class="card stat-card"><div class="value">${value}</div><div class="label">${escapeHtml(label)}</div></div>`;
}

/**
 * Parse a skill source string (GitHub repo URL or shorthand).
 */
export function parseSkillSource(src: string): {
	type: "github";
	owner: string;
	name: string;
	url: string;
} | null {
	if (!src || typeof src !== "string") return null;
	const trimmed = src.trim();
	if (!trimmed) return null;

	// GitHub: https://github.com/owner/name or owner/name
	const ghMatch = trimmed.match(
		/^(?:https:\/\/github\.com\/)?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/,
	);
	if (ghMatch) {
		return {
			type: "github",
			owner: ghMatch[1],
			name: ghMatch[2],
			url: `https://github.com/${ghMatch[1]}/${ghMatch[2]}`,
		};
	}

	return null;
}

/**
 * Render markdown text to safe HTML.
 * Supports: bold, italic, code, links, paragraphs, headings, lists, blockquotes.
 */
export function renderMarkdown(text: string): string {
	let h = escapeHtml(text);

	// Code blocks
	h = h.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
	// Inline code
	h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
	// Bold
	h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	// Italic
	h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
	// Strikethrough
	h = h.replace(/~~([^~]+)~~/g, "<del>$1</del>");
	// Links
	h = h.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
	);
	// Blockquotes
	h = h.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
	// Unordered lists
	h = h.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
	h = h.replace(/((?:<li>.*<\/li>)+)/g, "<ul>$1</ul>");
	// Ordered lists
	h = h.replace(/^(\d+)\. (.+)$/gm, (_match, _num, text) => `<li>${text}</li>`);
	h = h.replace(/((?:<li>.*<\/li>)+)/g, "<ol>$1</ol>");
	// Horizontal rule
	h = h.replace(/^---+$/gm, "<hr>");
	// Paragraphs (double newlines)
	h = h.replace(/\n\n/g, "</p><p>");
	h = `<p>${h}</p>`;

	return h;
}
