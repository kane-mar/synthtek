/**
 * Media Processing Module
 *
 * Handles image, audio, video, and document processing with
 * format validation, size limits, and preview generation.
 */

import type {
	AudioInfo,
	DocumentInfo,
	ImageInfo,
	MediaConfig,
	VideoInfo,
} from "./types.js";

const MIME_FORMAT_MAP: Record<string, string> = {
	"image/jpeg": "jpeg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"audio/mpeg": "mp3",
	"audio/wav": "wav",
	"audio/ogg": "ogg",
	"audio/amr": "amr",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"video/avi": "avi",
	"application/pdf": "pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"docx",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation":
		"pptx",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export class MediaProcessor {
	private readonly config: MediaConfig;

	constructor(config: MediaConfig) {
		this.config = config;
	}

	// ── Image Handling ─────────────────────────────────────────────────────────

	identifyImage(filename: string, mimeType: string): ImageInfo | null {
		const format = this.extractFormat(filename, mimeType);
		if (!format || !this.config.supportedImageFormats.includes(format)) {
			return null;
		}

		return {
			type: "image",
			format,
		};
	}

	generatePreviewUrl(filename: string): string {
		return `http://localhost/media/preview/${encodeURIComponent(filename)}`;
	}

	// ── Audio Handling ─────────────────────────────────────────────────────────

	identifyAudio(filename: string, mimeType: string): AudioInfo | null {
		const format = this.extractFormat(filename, mimeType);
		if (!format || !this.config.supportedAudioFormats.includes(format)) {
			return null;
		}

		return {
			type: "audio",
			format,
		};
	}

	estimateAudioDuration(metadata: {
		format: string;
		bitrate: number;
		size: number;
	}): number {
		// duration = (size * 8) / bitrate
		return (metadata.size * 8) / metadata.bitrate;
	}

	// ── Video Handling ─────────────────────────────────────────────────────────

	identifyVideo(filename: string, mimeType: string): VideoInfo | null {
		const format = this.extractFormat(filename, mimeType);
		if (!format || !this.config.supportedVideoFormats.includes(format)) {
			return null;
		}

		return {
			type: "video",
			format,
		};
	}

	generateThumbnailUrl(filename: string): string {
		return `http://localhost/media/thumbnail/${encodeURIComponent(filename)}`;
	}

	// ── Document Handling ──────────────────────────────────────────────────────

	identifyDocument(filename: string, mimeType: string): DocumentInfo | null {
		const format = this.extractFormat(filename, mimeType);
		if (!format || !this.config.supportedDocumentFormats.includes(format)) {
			return null;
		}

		return {
			type: "document",
			format,
		};
	}

	// ── File Validation ────────────────────────────────────────────────────────

	validateFileSize(size: number): boolean {
		return size <= this.config.maxFileSize;
	}

	isSupported(filename: string): boolean {
		const ext = this.getFileExtension(filename);
		const allFormats = [
			...this.config.supportedImageFormats,
			...this.config.supportedAudioFormats,
			...this.config.supportedVideoFormats,
			...this.config.supportedDocumentFormats,
		];
		return allFormats.includes(ext);
	}

	// ── Upload Handling ────────────────────────────────────────────────────────

	generateUploadUrl(filename: string, mimeType: string): string {
		return `http://localhost/media/upload/${encodeURIComponent(filename)}?mime=${encodeURIComponent(mimeType)}`;
	}

	validateUpload(filename: string, mimeType: string): boolean {
		const format = this.extractFormat(filename, mimeType);
		if (!format) return false;

		const allFormats = [
			...this.config.supportedImageFormats,
			...this.config.supportedAudioFormats,
			...this.config.supportedVideoFormats,
			...this.config.supportedDocumentFormats,
		];
		return allFormats.includes(format);
	}

	// ── Download Handling ──────────────────────────────────────────────────────

	generateDownloadUrl(filename: string): string {
		return `http://localhost/media/download/${encodeURIComponent(filename)}`;
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	private extractFormat(filename: string, mimeType: string): string | null {
		// Try MIME type first
		if (MIME_FORMAT_MAP[mimeType]) {
			return MIME_FORMAT_MAP[mimeType];
		}

		// Fall back to file extension
		const ext = this.getFileExtension(filename);
		if (ext) {
			return ext;
		}

		return null;
	}

	private getFileExtension(filename: string): string {
		const parts = filename.split(".");
		return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
	}
}
