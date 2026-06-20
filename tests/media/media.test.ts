/**
 * Tests for Media Processing Module
 */

import { ok, strictEqual } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { MediaProcessor } from "../../src/media/processor.js";
import type { MediaConfig, MediaResult } from "../../src/media/types.js";

const defaultConfig: MediaConfig = {
	maxFileSize: 10 * 1024 * 1024, // 10MB
	supportedImageFormats: ["jpeg", "png", "gif", "webp"],
	supportedAudioFormats: ["mp3", "wav", "ogg", "amr"],
	supportedVideoFormats: ["mp4", "webm", "avi"],
	supportedDocumentFormats: ["pdf", "docx", "pptx", "xlsx"],
	tempDir: "/tmp/synthtek-media",
};

describe("MediaProcessor", () => {
	let processor: MediaProcessor;

	beforeEach(() => {
		processor = new MediaProcessor(defaultConfig);
	});

	describe("constructor", () => {
		it("creates processor with config", () => {
			ok(processor, "processor created");
		});
	});

	describe("image handling", () => {
		it("identifies JPEG image", () => {
			const info = processor.identifyImage("photo.jpg", "image/jpeg");
			strictEqual(info?.format, "jpeg");
			strictEqual(info?.type, "image");
		});

		it("identifies PNG image", () => {
			const info = processor.identifyImage("screenshot.png", "image/png");
			strictEqual(info?.format, "png");
			strictEqual(info?.type, "image");
		});

		it("identifies GIF image", () => {
			const info = processor.identifyImage("animation.gif", "image/gif");
			strictEqual(info?.format, "gif");
			strictEqual(info?.type, "image");
		});

		it("identifies WebP image", () => {
			const info = processor.identifyImage("modern.webp", "image/webp");
			strictEqual(info?.format, "webp");
			strictEqual(info?.type, "image");
		});

		it("rejects unsupported image format", () => {
			const info = processor.identifyImage("photo.bmp", "image/bmp");
			strictEqual(info, null);
		});

		it("generates preview URL for image", () => {
			const preview = processor.generatePreviewUrl("photo.jpg");
			ok(typeof preview === "string", "preview URL is string");
			ok(preview.includes("photo.jpg"), "includes filename");
		});
	});

	describe("audio handling", () => {
		it("identifies MP3 audio", () => {
			const info = processor.identifyAudio("recording.mp3", "audio/mpeg");
			strictEqual(info?.format, "mp3");
			strictEqual(info?.type, "audio");
		});

		it("identifies WAV audio", () => {
			const info = processor.identifyAudio("sound.wav", "audio/wav");
			strictEqual(info?.format, "wav");
			strictEqual(info?.type, "audio");
		});

		it("identifies AMR audio", () => {
			const info = processor.identifyAudio("voice.amr", "audio/amr");
			strictEqual(info?.format, "amr");
			strictEqual(info?.type, "audio");
		});

		it("rejects unsupported audio format", () => {
			const info = processor.identifyAudio("sound.flac", "audio/flac");
			strictEqual(info, null);
		});

		it("estimates audio duration from metadata", () => {
			const duration = processor.estimateAudioDuration({
				format: "mp3",
				bitrate: 128000,
				size: 1024000,
			});
			ok(duration > 0, "duration is positive");
		});
	});

	describe("video handling", () => {
		it("identifies MP4 video", () => {
			const info = processor.identifyVideo("clip.mp4", "video/mp4");
			strictEqual(info?.format, "mp4");
			strictEqual(info?.type, "video");
		});

		it("identifies WebM video", () => {
			const info = processor.identifyVideo("clip.webm", "video/webm");
			strictEqual(info?.format, "webm");
			strictEqual(info?.type, "video");
		});

		it("rejects unsupported video format", () => {
			const info = processor.identifyVideo("clip.mov", "video/quicktime");
			strictEqual(info, null);
		});

		it("generates thumbnail URL for video", () => {
			const thumb = processor.generateThumbnailUrl("clip.mp4");
			ok(typeof thumb === "string", "thumbnail URL is string");
			ok(thumb.includes("clip.mp4"), "includes filename");
		});
	});

	describe("document handling", () => {
		it("identifies PDF document", () => {
			const info = processor.identifyDocument("report.pdf", "application/pdf");
			strictEqual(info?.format, "pdf");
			strictEqual(info?.type, "document");
		});

		it("identifies DOCX document", () => {
			const info = processor.identifyDocument(
				"doc.docx",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			);
			strictEqual(info?.format, "docx");
			strictEqual(info?.type, "document");
		});

		it("identifies XLSX document", () => {
			const info = processor.identifyDocument(
				"spreadsheet.xlsx",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			);
			strictEqual(info?.format, "xlsx");
			strictEqual(info?.type, "document");
		});

		it("rejects unsupported document format", () => {
			const info = processor.identifyDocument("file.txt", "text/plain");
			strictEqual(info, null);
		});
	});

	describe("file validation", () => {
		it("validates file size within limit", () => {
			const valid = processor.validateFileSize(1024 * 1024); // 1MB
			ok(valid, "1MB file is valid");
		});

		it("rejects file exceeding size limit", () => {
			const valid = processor.validateFileSize(20 * 1024 * 1024); // 20MB
			ok(!valid, "20MB file rejected");
		});

		it("validates supported media type", () => {
			ok(processor.isSupported("photo.jpeg"), "JPEG supported");
			ok(processor.isSupported("recording.mp3"), "MP3 supported");
			ok(processor.isSupported("clip.mp4"), "MP4 supported");
			ok(processor.isSupported("report.pdf"), "PDF supported");
			ok(!processor.isSupported("file.xyz"), "XYZ not supported");
		});
	});

	describe("media result", () => {
		it("creates media result with metadata", () => {
			const result: MediaResult = {
				success: true,
				type: "image",
				format: "jpeg",
				filename: "photo.jpg",
				size: 102400,
				url: "http://localhost/media/photo.jpg",
			};

			ok(result.success, "result is successful");
			strictEqual(result.type, "image");
			strictEqual(result.format, "jpeg");
		});

		it("creates failed media result", () => {
			const result: MediaResult = {
				success: false,
				error: "Unsupported format",
			};

			ok(!result.success, "result failed");
			strictEqual(result.error, "Unsupported format");
		});
	});

	describe("upload handling", () => {
		it("generates upload URL", () => {
			const url = processor.generateUploadUrl("photo.jpg", "image/jpeg");
			ok(typeof url === "string", "upload URL is string");
			ok(url.includes("photo.jpg"), "includes filename");
		});

		it("validates upload content type", () => {
			ok(
				processor.validateUpload("photo.jpg", "image/jpeg"),
				"JPEG upload valid",
			);
			ok(
				!processor.validateUpload("file.xyz", "application/octet-stream"),
				"XYZ upload invalid",
			);
		});
	});

	describe("download handling", () => {
		it("generates download URL", () => {
			const url = processor.generateDownloadUrl("photo.jpg");
			ok(typeof url === "string", "download URL is string");
			ok(url.includes("photo.jpg"), "includes filename");
		});
	});
});
