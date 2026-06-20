/**
 * Async file system service
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type {
	FileEditOptions,
	FileEditResult,
	FileListEntry,
	FileListResult,
	FileReadOptions,
	FileReadResult,
	FileStatResult,
	FileSystemService,
	FileWriteOptions,
	FileWriteResult,
} from "./types.js";

export class AsyncFileService implements FileSystemService {
	async read(options: FileReadOptions): Promise<FileReadResult> {
		try {
			const { path, offset = 0, limit = 2000, encoding = "utf-8" } = options;

			if (!existsSync(path)) {
				return {
					success: false,
					content: "",
					lines: [],
					totalLines: 0,
					offset,
					limit,
					truncated: false,
					error: `File not found: ${path}`,
				};
			}

			const content = readFileSync(path, { encoding });
			const lines = content.split("\n");
			const totalLines = lines.length;

			const start = Math.min(offset, totalLines);
			const end = Math.min(start + limit, totalLines);
			const selectedLines = lines.slice(start, end);
			const truncated = end < totalLines;

			return {
				success: true,
				content: selectedLines.join("\n"),
				lines: selectedLines,
				totalLines,
				offset: start,
				limit: end - start,
				truncated,
			};
		} catch (err) {
			return {
				success: false,
				content: "",
				lines: [],
				totalLines: 0,
				offset: options.offset ?? 0,
				limit: options.limit ?? 2000,
				truncated: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async write(options: FileWriteOptions): Promise<FileWriteResult> {
		try {
			const {
				path,
				content,
				createDirectories = true,
				overwrite = true,
			} = options;

			if (!overwrite && existsSync(path)) {
				return {
					success: false,
					path,
					error: `File already exists: ${path}`,
				};
			}

			if (createDirectories) {
				const dir = dirname(path);
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true });
				}
			}

			writeFileSync(path, content, { encoding: "utf-8" });

			return { success: true, path };
		} catch (err) {
			return {
				success: false,
				path: options.path,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async edit(options: FileEditOptions): Promise<FileEditResult> {
		try {
			const { path, oldText, newText, replaceAll = false } = options;

			if (!existsSync(path)) {
				return {
					success: false,
					replacements: 0,
					error: `File not found: ${path}`,
				};
			}

			const content = readFileSync(path, { encoding: "utf-8" });
			const regex = new RegExp(
				oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
				replaceAll ? "g" : "",
			);
			const matches = content.match(regex);
			const replacements = matches ? matches.length : 0;

			if (replacements === 0) {
				return {
					success: false,
					replacements: 0,
					error: `Pattern not found in file: ${path}`,
				};
			}

			const updatedContent = content.replace(regex, newText);
			writeFileSync(path, updatedContent, { encoding: "utf-8" });

			return { success: true, replacements };
		} catch (err) {
			return {
				success: false,
				replacements: 0,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async exists(path: string): Promise<boolean> {
		return existsSync(path);
	}

	async stat(path: string): Promise<FileStatResult | null> {
		try {
			if (!existsSync(path)) return null;
			const s = statSync(path);
			return {
				isFile: s.isFile(),
				isDirectory: s.isDirectory(),
				size: s.size,
				mtime: s.mtime,
			};
		} catch {
			return null;
		}
	}

	async list(path: string, _recursive = false): Promise<FileListResult> {
		try {
			if (!existsSync(path)) {
				return {
					success: false,
					path,
					entries: [],
					error: `Directory not found: ${path}`,
				};
			}

			const entries: FileListEntry[] = [];
			const items = readdirSync(path, { withFileTypes: true });

			for (const item of items) {
				entries.push({
					name: item.name,
					isDirectory: item.isDirectory(),
					isFile: item.isFile(),
					isSymbolicLink: item.isSymbolicLink(),
				});
			}

			return { success: true, path, entries };
		} catch (err) {
			return {
				success: false,
				path,
				entries: [],
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}
}
