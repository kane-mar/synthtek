/**
 * HashRouter — hash-based SPA navigation
 *
 * Manages URL hash fragments (#chat, #dashboard, etc.) for client-side
 * routing.  Listens for {@code hashchange} events so the browser back /
 * forward buttons work correctly.
 */

import type { PageName } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HashRouterConfig {
	/** Page to show when the hash is empty or invalid. */
	defaultPage: PageName;
	/** Pages that are considered valid targets. */
	validPages: PageName[];
}

export type PageChangeCallback = (page: PageName) => void;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strip the leading '#', trailing '/', and any query string. */
function normaliseHash(raw: string): string {
	return raw.replace(/^#/, "").replace(/\/$/, "").split("?")[0].toLowerCase();
}

// ── Router ─────────────────────────────────────────────────────────────────────

export class HashRouter {
	private readonly defaultPage: PageName;
	private readonly validPages: PageName[];
	private currentPage_: PageName;
	private callbacks: PageChangeCallback[] = [];
	private boundHandleHashChange: (() => void) | null = null;

	constructor(config: HashRouterConfig) {
		this.defaultPage = config.defaultPage;
		this.validPages = config.validPages;
		this.currentPage_ = this.parseHash(
			typeof window !== "undefined" ? window.location.hash : "",
		);
		this.bindHashChangeListener();
	}

	/* ── Public state ─────────────────────────────────────────────────────── */

	/** The currently active page. */
	public get currentPage(): PageName {
		return this.currentPage_;
	}

	/** Whether the given page is the current one. */
	public isActive(page: PageName): boolean {
		return page === this.currentPage_;
	}

	/* ── Hash parsing / generation ────────────────────────────────────────── */

	/** Parse a raw hash string and return the corresponding page name. */
	public parseHash(raw: string): PageName {
		const fragment = normaliseHash(raw);
		if (fragment && this.validPages.includes(fragment as PageName)) {
			return fragment as PageName;
		}
		return this.defaultPage;
	}

	/** Generate a hash fragment for the given page. */
	public hashForPage(page: PageName): string {
		return `#${page}`;
	}

	/* ── Navigation ───────────────────────────────────────────────────────── */

	/** Navigate to the given page.  Updates the URL hash (if in a browser). */
	public navigate(page: PageName): void {
		if (!this.validPages.includes(page)) {
			return;
		}
		if (page === this.currentPage_) {
			return;
		}

		this.currentPage_ = page;

		// Update URL hash without triggering a full page reload
		if (
			typeof window !== "undefined" &&
			typeof window.history !== "undefined"
		) {
			window.history.pushState(null, "", this.hashForPage(page));
		}

		this.fireCallbacks(page);
	}

	/* ── Callbacks ────────────────────────────────────────────────────────── */

	/** Register a callback that fires on every page change. */
	public onPageChange(callback: PageChangeCallback): void {
		this.callbacks.push(callback);
	}

	/* ── Rendering ────────────────────────────────────────────────────────── */

	/** Render navigation links as an HTML string. */
	public renderNavLinks(): string {
		const items: { page: PageName; label: string }[] = [
			{ page: "chat", label: "Chat" },
			{ page: "plugins", label: "Plugins" },
			{ page: "config", label: "Config" },
			{ page: "sessions", label: "Sessions" },
			{ page: "media", label: "Media" },
			{ page: "analytics", label: "Analytics" },
		];

		return items
			.map(
				(item) =>
					`<a href="${this.hashForPage(item.page)}" class="${this.isActive(item.page) ? "active" : ""}">${item.label}</a>`,
			)
			.join("");
	}

	/* ── Browser integration ──────────────────────────────────────────────── */

	/** Attach a listener for {@code hashchange} events. */
	private bindHashChangeListener(): void {
		if (typeof window === "undefined") {
			return;
		}

		this.boundHandleHashChange = () => {
			const page = this.parseHash(window.location.hash);
			if (page !== this.currentPage_) {
				this.currentPage_ = page;
				this.fireCallbacks(page);
			}
		};

		window.addEventListener("hashchange", this.boundHandleHashChange);
	}

	/** Detach the hashchange listener (useful for cleanup / testing). */
	public destroy(): void {
		if (typeof window !== "undefined" && this.boundHandleHashChange) {
			window.removeEventListener("hashchange", this.boundHandleHashChange);
		}
		this.callbacks = [];
	}

	/* ── Internal ─────────────────────────────────────────────────────────── */

	private fireCallbacks(page: PageName): void {
		for (const cb of this.callbacks) {
			cb(page);
		}
	}
}
