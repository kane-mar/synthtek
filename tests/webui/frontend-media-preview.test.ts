/**
 * Tests for WebUI Media Preview Component
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { MediaPreviewComponent } from "../../src/webui/frontend/media-preview.js";
import type { MediaPreviewInfo } from "../../src/webui/frontend/types.js";

describe("MediaPreviewComponent", () => {
	let preview: MediaPreviewComponent;

	beforeEach(() => {
		preview = new MediaPreviewComponent();
	});

	describe("constructor", () => {
		it("creates media preview component", () => {
			ok(preview, "preview created");
		});

		it("starts with empty media list", () => {
			strictEqual(preview.mediaItems.length, 0);
		});
	});

	describe("media registration", () => {
		it("registers an image", () => {
			const item: MediaPreviewInfo = {
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			};
			preview.registerMedia(item);
			strictEqual(preview.mediaItems.length, 1);
		});

		it("registers an audio file", () => {
			const item: MediaPreviewInfo = {
				filename: "recording.mp3",
				mimeType: "audio/mpeg",
				size: 512000,
				url: "http://localhost/media/recording.mp3",
			};
			preview.registerMedia(item);
			strictEqual(preview.mediaItems[0].mimeType, "audio/mpeg");
		});

		it("registers a video file", () => {
			const item: MediaPreviewInfo = {
				filename: "clip.mp4",
				mimeType: "video/mp4",
				size: 10240000,
				url: "http://localhost/media/clip.mp4",
			};
			preview.registerMedia(item);
			strictEqual(preview.mediaItems[0].mimeType, "video/mp4");
		});

		it("registers a document", () => {
			const item: MediaPreviewInfo = {
				filename: "report.pdf",
				mimeType: "application/pdf",
				size: 204800,
				url: "http://localhost/media/report.pdf",
			};
			preview.registerMedia(item);
			strictEqual(preview.mediaItems[0].mimeType, "application/pdf");
		});

		it("prevents duplicate registration", () => {
			const item: MediaPreviewInfo = {
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			};
			preview.registerMedia(item);
			preview.registerMedia(item);
			strictEqual(preview.mediaItems.length, 1);
		});
	});

	describe("media type detection", () => {
		it("detects image type", () => {
			preview.registerMedia({
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			});
			ok(preview.isImage("photo.jpg"), "detected as image");
		});

		it("detects audio type", () => {
			preview.registerMedia({
				filename: "recording.mp3",
				mimeType: "audio/mpeg",
				size: 512000,
				url: "http://localhost/media/recording.mp3",
			});
			ok(preview.isAudio("recording.mp3"), "detected as audio");
		});

		it("detects video type", () => {
			preview.registerMedia({
				filename: "clip.mp4",
				mimeType: "video/mp4",
				size: 10240000,
				url: "http://localhost/media/clip.mp4",
			});
			ok(preview.isVideo("clip.mp4"), "detected as video");
		});

		it("detects document type", () => {
			preview.registerMedia({
				filename: "report.pdf",
				mimeType: "application/pdf",
				size: 204800,
				url: "http://localhost/media/report.pdf",
			});
			ok(preview.isDocument("report.pdf"), "detected as document");
		});

		it("returns false for unknown file", () => {
			ok(!preview.isImage("unknown.xyz"), "unknown file not detected");
		});
	});

	describe("media filtering", () => {
		it("filters by type", () => {
			preview.registerMedia({
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 100,
				url: "http://x",
			});
			preview.registerMedia({
				filename: "rec.mp3",
				mimeType: "audio/mpeg",
				size: 200,
				url: "http://x",
			});
			const images = preview.filterByType("image");
			strictEqual(images.length, 1);
		});

		it("filters by size range", () => {
			preview.registerMedia({
				filename: "small.jpg",
				mimeType: "image/jpeg",
				size: 1000,
				url: "http://x",
			});
			preview.registerMedia({
				filename: "large.jpg",
				mimeType: "image/jpeg",
				size: 1000000,
				url: "http://x",
			});
			const small = preview.filterBySize(0, 5000);
			strictEqual(small.length, 1);
		});

		it("returns all when no filter", () => {
			preview.registerMedia({
				filename: "a.jpg",
				mimeType: "image/jpeg",
				size: 100,
				url: "http://x",
			});
			preview.registerMedia({
				filename: "b.mp3",
				mimeType: "audio/mpeg",
				size: 200,
				url: "http://x",
			});
			strictEqual(preview.getAll().length, 2);
		});
	});

	describe("media removal", () => {
		it("removes media by filename", () => {
			preview.registerMedia({
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 100,
				url: "http://x",
			});
			preview.removeMedia("photo.jpg");
			strictEqual(preview.mediaItems.length, 0);
		});

		it("clears all media", () => {
			preview.registerMedia({
				filename: "a.jpg",
				mimeType: "image/jpeg",
				size: 100,
				url: "http://x",
			});
			preview.registerMedia({
				filename: "b.mp3",
				mimeType: "audio/mpeg",
				size: 200,
				url: "http://x",
			});
			preview.clearAll();
			strictEqual(preview.mediaItems.length, 0);
		});
	});

	describe("size formatting", () => {
		it("formats bytes", () => {
			strictEqual(preview.formatSize(500), "500 B");
		});

		it("formats kilobytes", () => {
			strictEqual(preview.formatSize(1024), "1.0 KB");
		});

		it("formats megabytes", () => {
			strictEqual(preview.formatSize(1048576), "1.0 MB");
		});

		it("formats gigabytes", () => {
			strictEqual(preview.formatSize(1073741824), "1.0 GB");
		});
	});

	describe("thumbnail generation", () => {
		it("generates thumbnail URL for image", () => {
			const thumb = preview.generateThumbnailUrl("photo.jpg");
			ok(typeof thumb === "string", "returns string");
			ok(thumb.includes("photo.jpg"), "includes filename");
		});

		it("generates thumbnail URL for video", () => {
			const thumb = preview.generateThumbnailUrl("clip.mp4");
			ok(typeof thumb === "string", "returns string");
			ok(thumb.includes("clip.mp4"), "includes filename");
		});
	});

	describe("render", () => {
		it("renders media preview HTML", () => {
			preview.registerMedia({
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			});
			const html = preview.render();
			ok(typeof html === "string", "renders string");
			ok(html.includes("photo.jpg"), "includes filename");
		});

		it("renders empty state", () => {
			const html = preview.render();
			ok(html.includes("No media"), "shows empty state");
		});

		it("renders image preview", () => {
			preview.registerMedia({
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			});
			const html = preview.render();
			ok(html.includes("media-image"), "includes image class");
		});

		it("renders audio preview", () => {
			preview.registerMedia({
				filename: "rec.mp3",
				mimeType: "audio/mpeg",
				size: 512000,
				url: "http://localhost/media/rec.mp3",
			});
			const html = preview.render();
			ok(html.includes("media-audio"), "includes audio class");
		});

		it("renders video preview", () => {
			preview.registerMedia({
				filename: "clip.mp4",
				mimeType: "video/mp4",
				size: 10240000,
				url: "http://localhost/media/clip.mp4",
			});
			const html = preview.render();
			ok(html.includes("media-video"), "includes video class");
		});

		it("renders document preview", () => {
			preview.registerMedia({
				filename: "report.pdf",
				mimeType: "application/pdf",
				size: 204800,
				url: "http://localhost/media/report.pdf",
			});
			const html = preview.render();
			ok(html.includes("media-document"), "includes document class");
		});

		it("renders file size", () => {
			preview.registerMedia({
				filename: "photo.jpg",
				mimeType: "image/jpeg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			});
			const html = preview.render();
			ok(html.includes("100"), "includes size info");
		});
	});

	describe("media stats", () => {
		it("returns total media count", () => {
			preview.registerMedia({
				filename: "a.jpg",
				mimeType: "image/jpeg",
				size: 100,
				url: "http://x",
			});
			preview.registerMedia({
				filename: "b.mp3",
				mimeType: "audio/mpeg",
				size: 200,
				url: "http://x",
			});
			strictEqual(preview.getTotalCount(), 2);
		});

		it("returns total media size", () => {
			preview.registerMedia({
				filename: "a.jpg",
				mimeType: "image/jpeg",
				size: 1000,
				url: "http://x",
			});
			preview.registerMedia({
				filename: "b.mp3",
				mimeType: "audio/mpeg",
				size: 2000,
				url: "http://x",
			});
			strictEqual(preview.getTotalSize(), 3000);
		});

		it("returns formatted total size", () => {
			preview.registerMedia({
				filename: "a.jpg",
				mimeType: "image/jpeg",
				size: 1024,
				url: "http://x",
			});
			const formatted = preview.getFormattedTotalSize();
			ok(formatted.includes("KB"), "includes unit");
		});
	});
});
