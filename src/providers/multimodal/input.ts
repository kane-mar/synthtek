/**
 * Multimodal Image Input Module
 *
 * Handles image encoding (base64), format detection, size validation,
 * and conversion to ContentPart format for provider messages.
 */

import type { ContentPart, ProviderMessage } from "../types.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MultimodalConfig {
	/** Maximum image size in bytes (default 20MB) */
	maxImageSize?: number;
	/** Supported image formats (default: png, jpeg, webp, gif) */
	supportedFormats?: string[];
	/** Default detail level for images (default: auto) */
	defaultDetail?: "low" | "auto" | "high";
}

export interface ImageSource {
	/** Raw image buffer */
	buffer?: Buffer;
	/** MIME type of the buffer */
	mimeType?: string;
	/** Base64 data URL */
	dataUrl?: string;
	/** HTTP(S) URL to the image */
	httpUrl?: string;
}

export interface MultimodalMessageOptions {
	/** Text content accompanying the images */
	text: string;
	/** Array of image sources */
	images: ImageSource[];
	/** Detail level for images */
	detail?: "low" | "auto" | "high";
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const DEFAULT_SUPPORTED_FORMATS = ["png", "jpeg", "webp", "gif"];
const DEFAULT_DETAIL: "low" | "auto" | "high" = "auto";

/** Magic bytes for image format detection */
const FORMAT_MAGIC: Record<string, string[]> = {
	png: ["89504e47"],
	jpeg: ["ffd8ff"],
	webp: ["52494646"], // RIFF header, WebP has WEBP after size
	gif: ["47494638"],
};

/** Extension to format mapping */
const EXT_TO_FORMAT: Record<string, string> = {
	png: "png",
	jpg: "jpeg",
	jpeg: "jpeg",
	webp: "webp",
	gif: "gif",
};

// ─── Class ──────────────────────────────────────────────────────────────────

export class MultimodalInput {
	private readonly maxImageSize: number;
	private readonly supportedFormats: string[];
	private readonly defaultDetail: "low" | "auto" | "high";

	constructor(config: MultimodalConfig = {}) {
		this.maxImageSize = config.maxImageSize ?? DEFAULT_MAX_IMAGE_SIZE;
		this.supportedFormats =
			config.supportedFormats ?? DEFAULT_SUPPORTED_FORMATS;
		this.defaultDetail = config.defaultDetail ?? DEFAULT_DETAIL;
	}

	// ── Encoding ─────────────────────────────────────────────────────────────

	/**
	 * Encode a buffer to a base64 data URL.
	 */
	encodeBufferToDataUrl(buffer: Buffer, mimeType: string): string {
		const base64 = buffer.toString("base64");
		return `data:${mimeType};base64,${base64}`;
	}

	// ── ContentPart Conversion ───────────────────────────────────────────────

	/**
	 * Convert a data URL to a ContentPart.
	 */
	dataUrlToContentPart(dataUrl: string): ContentPart {
		return {
			type: "image_url",
			imageUrl: {
				url: dataUrl,
				detail: this.defaultDetail,
			},
		};
	}

	/**
	 * Convert an HTTP URL to a ContentPart.
	 */
	httpUrlToContentPart(
		httpUrl: string,
		detail?: "low" | "auto" | "high",
	): ContentPart {
		return {
			type: "image_url",
			imageUrl: {
				url: httpUrl,
				detail: detail ?? this.defaultDetail,
			},
		};
	}

	// ── Message Creation ─────────────────────────────────────────────────────

	/**
	 * Create a multimodal ProviderMessage from text and image sources.
	 */
	createMultimodalMessage(
		text: string,
		images: ImageSource[],
	): ProviderMessage {
		const parts = this.buildContentParts(text, images);
		return {
			role: "user",
			content: text,
			contentParts: parts,
		};
	}

	/**
	 * Build an array of ContentParts from text and image sources.
	 */
	buildContentParts(text: string, images: ImageSource[]): ContentPart[] {
		const parts: ContentPart[] = [];

		// Add text part if non-empty
		if (text?.trim()) {
			parts.push({ type: "text", text: text.trim() });
		}

		// Add image parts
		for (const image of images) {
			if (image.buffer && image.mimeType) {
				const dataUrl = this.encodeBufferToDataUrl(
					image.buffer,
					image.mimeType,
				);
				parts.push(this.dataUrlToContentPart(dataUrl));
			} else if (image.dataUrl) {
				parts.push(this.dataUrlToContentPart(image.dataUrl));
			} else if (image.httpUrl) {
				parts.push(this.httpUrlToContentPart(image.httpUrl));
			}
		}

		return parts;
	}

	// ── Format Detection ─────────────────────────────────────────────────────

	/**
	 * Detect image format from buffer magic bytes.
	 */
	detectFormat(buffer: Buffer): string | null {
		const hex = buffer.subarray(0, 8).toString("hex");

		for (const [format, magics] of Object.entries(FORMAT_MAGIC)) {
			for (const magic of magics) {
				if (hex.startsWith(magic)) {
					return format;
				}
			}
		}

		return null;
	}

	/**
	 * Detect image format from filename extension.
	 */
	detectFormatFromFilename(filename: string): string | null {
		const ext = filename.split(".").pop()?.toLowerCase();
		return ext ? (EXT_TO_FORMAT[ext] ?? null) : null;
	}

	/**
	 * Detect MIME type from buffer.
	 */
	detectMimeType(buffer: Buffer): string | null {
		const format = this.detectFormat(buffer);
		if (!format) return null;

		const formatToMime: Record<string, string> = {
			png: "image/png",
			jpeg: "image/jpeg",
			webp: "image/webp",
			gif: "image/gif",
		};

		return formatToMime[format] ?? null;
	}

	// ── Validation ───────────────────────────────────────────────────────────

	/**
	 * Validate that a buffer size is within the configured limit.
	 */
	validateSize(buffer: Buffer): boolean {
		return buffer.byteLength <= this.maxImageSize;
	}

	/**
	 * Check if a format is supported.
	 */
	isFormatSupported(format: string): boolean {
		return this.supportedFormats.includes(format);
	}

	// ── Analysis ─────────────────────────────────────────────────────────────

	/**
	 * Check if a ProviderMessage contains multimodal content.
	 */
	hasMultimodalContent(message: ProviderMessage): boolean {
		if (!message.contentParts || message.contentParts.length === 0) {
			return false;
		}
		return message.contentParts.some((part) => part.type === "image_url");
	}

	/**
	 * Extract all image URLs from a ProviderMessage's content parts.
	 */
	extractImageUrls(message: ProviderMessage): string[] {
		if (!message.contentParts) return [];

		return message.contentParts
			.filter((part): part is ContentPart => part.type === "image_url")
			.map((part) => part.imageUrl?.url ?? "");
	}

	/**
	 * Estimate total image size in bytes from a ProviderMessage.
	 * For data URLs, decodes base64. For HTTP URLs, returns 0 (unknown).
	 */
	estimateTotalImageSize(message: ProviderMessage): number {
		if (!message.contentParts) return 0;

		let total = 0;
		for (const part of message.contentParts) {
			if (part.type === "image_url" && part.imageUrl?.url) {
				if (part.imageUrl.url.startsWith("data:")) {
					// Extract base64 portion and estimate decoded size
					const base64Data = part.imageUrl.url.split(",").pop() || "";
					total += Math.ceil((base64Data.length * 3) / 4);
				}
				// HTTP URLs: size unknown, skip
			}
		}

		return total;
	}
}
