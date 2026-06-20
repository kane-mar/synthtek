/**
 * WebUI Media Preview Component
 *
 * Manages media registration, type detection, filtering, and rendering.
 */

import type { MediaPreviewInfo } from "./types.js";

export class MediaPreviewComponent {
	public mediaItems: MediaPreviewInfo[] = [];

	// ── Registration ───────────────────────────────────────────────────────────

	registerMedia(item: MediaPreviewInfo): void {
		if (!this.mediaItems.find((m) => m.filename === item.filename)) {
			this.mediaItems.push({ ...item });
		}
	}

	// ── Type Detection ─────────────────────────────────────────────────────────

	isImage(filename: string): boolean {
		const item = this.mediaItems.find((m) => m.filename === filename);
		return item ? item.mimeType.startsWith("image/") : false;
	}

	isAudio(filename: string): boolean {
		const item = this.mediaItems.find((m) => m.filename === filename);
		return item ? item.mimeType.startsWith("audio/") : false;
	}

	isVideo(filename: string): boolean {
		const item = this.mediaItems.find((m) => m.filename === filename);
		return item ? item.mimeType.startsWith("video/") : false;
	}

	isDocument(filename: string): boolean {
		const item = this.mediaItems.find((m) => m.filename === filename);
		return item
			? item.mimeType === "application/pdf" ||
					item.mimeType.includes("vnd.openxmlformats") ||
					item.mimeType.includes("wordprocessingml") ||
					item.mimeType.includes("spreadsheetml")
			: false;
	}

	// ── Filtering ──────────────────────────────────────────────────────────────

	filterByType(
		type: "image" | "audio" | "video" | "document",
	): MediaPreviewInfo[] {
		return this.mediaItems.filter((item) =>
			item.mimeType.startsWith(`${type}/`),
		);
	}

	filterBySize(min: number, max: number): MediaPreviewInfo[] {
		return this.mediaItems.filter(
			(item) => item.size >= min && item.size <= max,
		);
	}

	getAll(): MediaPreviewInfo[] {
		return [...this.mediaItems];
	}

	// ── Removal ────────────────────────────────────────────────────────────────

	removeMedia(filename: string): boolean {
		const index = this.mediaItems.findIndex((m) => m.filename === filename);
		if (index === -1) return false;
		this.mediaItems.splice(index, 1);
		return true;
	}

	clearAll(): void {
		this.mediaItems = [];
	}

	// ── Size Formatting ────────────────────────────────────────────────────────

	formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024)
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}

	// ── Thumbnail ──────────────────────────────────────────────────────────────

	generateThumbnailUrl(filename: string): string {
		return `http://localhost/media/thumbnail/${encodeURIComponent(filename)}`;
	}

	// ── Stats ──────────────────────────────────────────────────────────────────

	getTotalCount(): number {
		return this.mediaItems.length;
	}

	getTotalSize(): number {
		return this.mediaItems.reduce((sum, item) => sum + item.size, 0);
	}

	getFormattedTotalSize(): string {
		return this.formatSize(this.getTotalSize());
	}

	// ── Rendering ──────────────────────────────────────────────────────────────

	render(): string {
		if (this.mediaItems.length === 0) {
			return `<div class="media-preview">
        <h2>Media</h2>
        <div class="empty-state">No media</div>
      </div>`;
		}

		const itemsHtml = this.mediaItems
			.map((item) => {
				const typeClass = this.getMediaClass(item.mimeType);
				return `<div class="media-item ${typeClass}">
          <div class="media-info">
            <span class="media-filename">${item.filename}</span>
            <span class="media-size">${this.formatSize(item.size)}</span>
          </div>
          <div class="media-preview-area">
            ${this.renderPreview(item)}
          </div>
        </div>`;
			})
			.join("\n");

		return `<div class="media-preview">
      <h2>Media (${this.getTotalCount()} items, ${this.getFormattedTotalSize()})</h2>
      <div class="media-grid">${itemsHtml}</div>
    </div>`;
	}

	private getMediaClass(mimeType: string): string {
		if (mimeType.startsWith("image/")) return "media-image";
		if (mimeType.startsWith("audio/")) return "media-audio";
		if (mimeType.startsWith("video/")) return "media-video";
		return "media-document";
	}

	private renderPreview(item: MediaPreviewInfo): string {
		if (item.mimeType.startsWith("image/")) {
			return `<img src="${item.url}" alt="${item.filename}" class="preview-image" />`;
		}
		if (item.mimeType.startsWith("audio/")) {
			return `<audio controls src="${item.url}"></audio>`;
		}
		if (item.mimeType.startsWith("video/")) {
			return `<video controls src="${item.url}"></video>`;
		}
		return `<a href="${item.url}" class="document-link" target="_blank">Open ${item.filename}</a>`;
	}
}
