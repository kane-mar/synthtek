/**
 * Frontend Navigation Module
 *
 * Pure navigation logic extracted from the embedded frontend script.
 * Testable without a browser by injecting DOM/window mocks.
 */

export const VALID_PAGES = [
	"chat",
	"tools",
	"cron",
	"config",
	"analytics", // Added analytics page
] as const;

export type PageId = (typeof VALID_PAGES)[number];

export const PAGE_TITLES: Record<PageId, string> = {
	chat: "Chat",
	tools: "Tools",
	cron: "Cron Jobs",
	config: "System Config",
	analytics: "Analytics", // Renamed dashboard to Analytics
};

/**
 * Parse the current hash into a page id.
 * Strips the leading '#' and validates against known pages.
 */
export function pageFromHash(
	hash: string,
	validPages: readonly string[],
): string {
	const page = hash.replace("#", "");
	// If the hash matches a known page, use it. Otherwise, default to 'chat'.
	return validPages.includes(page) ? page : "chat";
}

/**
 * Navigation controller that prevents double-navigation from
 * hashchange events firing when we programmatically set the hash.
 */
export class NavigationController {
	private currentPage: string;
	private navigating = false;

	constructor(
		private validPages: readonly string[],
		private titles: Record<string, string>,
		private dom: NavigationDOM,
		private renderPage: (page: string) => Promise<void>,
	) {
		this.currentPage = "chat";
	}

	/**
	 * Navigate to a page. Safe to call multiple times with the same page
	 * — only the first call will trigger rendering.
	 */
	async navigate(page: string): Promise<void> {
		// Guard: ignore if already on this page
		if (page === this.currentPage) {
			return;
		}

		// Guard: ignore if a navigation is already in progress
		if (this.navigating) {
			return;
		}

		this.navigating = true;
		this.currentPage = page;

		try {
			// Update hash
			this.dom.setHash(page);

			// Update active sidebar link
			this.dom.updateActiveLink(page);

			// Update page title
			this.dom.setTitle(this.titles[page] || page);

			// Render page content
			await this.renderPage(page);
		} finally {
			this.navigating = false;
		}
	}

	/**
	 * Get the current page id.
	 */
	getCurrentPage(): string {
		return this.currentPage;
	}

	/**
	 * Parse hash and navigate. Used by hashchange listener.
	 */
	handleHashChange(hash: string): void {
		const page = pageFromHash(hash, this.validPages);
		void this.navigate(page);
	}

	/**
	 * Initialize: parse initial hash and navigate.
	 */
	async init(initialHash: string): Promise<void> {
		const page = pageFromHash(initialHash, this.validPages);
		await this.navigate(page);
	}
}

/**
 * Minimal DOM abstraction for testing.
 * In the browser, this is implemented with real DOM calls.
 * In tests, we mock this interface.
 */
export interface NavigationDOM {
	setHash(page: string): void;
	updateActiveLink(page: string): void;
	setTitle(title: string): void;
}

/**
 * Create a real DOM implementation of NavigationDOM.
 */
export function createRealDOM(): NavigationDOM {
	return {
		setHash(page: string): void {
			// eslint-disable-next-line no-restricted-globals
			window.location.hash = page;
		},
		updateActiveLink(page: string): void {
			// eslint-disable-next-line no-restricted-globals
			const links = document.querySelectorAll("#sidebar nav a");
			links.forEach((a) => {
				const link = a as HTMLAnchorElement;
				link.classList.toggle("active", link.dataset.page === page);
			});
		},
		setTitle(title: string): void {
			// eslint-disable-next-line no-restricted-globals
			const el = document.getElementById("page-title");
			if (el) {
				el.textContent = title;
			}
		},
	};
}
