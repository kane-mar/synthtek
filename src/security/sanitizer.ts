/**
 * Input sanitizer for synthtek
 * Sanitizes user input to prevent XSS, shell injection, and prompt injection
 */

import type { SanitizeResult, SanitizerConfig } from "./types.js";

const DEFAULT_SANITIZER_CONFIG: SanitizerConfig = {
	maxLength: 10000,
	stripHtml: true,
	escapeShell: true,
	blockPromptInjection: true,
	normalizeUnicode: true,
};

const PROMPT_INJECTION_PATTERNS = [
	/ignore\s+previous\s+instructions/i,
	/disregard\s+all\s+prior/i,
	/you\s+are\s+now\s+free/i,
	/jailbreak/i,
	/dan\s+mode/i,
	/developer\s+mode/i,
	/system\s+prompt/i,
	/override\s+security/i,
];

const SHELL_METACHARACTERS = [
	";",
	"|",
	"&",
	"`",
	"$",
	"(",
	")",
	"{",
	"}",
	"<",
	">",
	"#",
	"~",
];

export class InputSanitizer {
	private readonly config: SanitizerConfig;

	constructor(config?: Partial<SanitizerConfig>) {
		this.config = { ...DEFAULT_SANITIZER_CONFIG, ...config };
	}

	sanitize(input: string): SanitizeResult {
		const warnings: string[] = [];
		let result = input;
		let modified = false;

		const truncResult = this.applyMaxLength(result, warnings);
		if (truncResult !== result) {
			result = truncResult;
			modified = true;
		}

		const strippedResult = this.applyStripHtml(result, warnings);
		if (strippedResult !== result) {
			result = strippedResult;
			modified = true;
		}

		const escapedResult = this.applyShellEscape(result, warnings);
		if (escapedResult !== result) {
			result = escapedResult;
			modified = true;
		}

		modified = this.applyPromptInjectionCheck(result, warnings) || modified;
		modified = this.applyCustomPatternCheck(result, warnings) || modified;

		result = this.applyUnicodeNormalization(result);

		return { sanitized: result, modified, warnings };
	}

	// ── Private sanitization steps ──────────────────────────────────────────

	private applyMaxLength(input: string, warnings: string[]): string {
		const maxLength = this.config.maxLength ?? 10000;
		if (input.length > maxLength) {
			warnings.push(`Input truncated to ${this.config.maxLength} characters`);
			return input.slice(0, maxLength);
		}
		return input;
	}

	private applyStripHtml(input: string, warnings: string[]): string {
		if (!this.config.stripHtml) return input;
		const htmlPattern = /<[^>]*>/g;
		if (htmlPattern.test(input)) {
			warnings.push("HTML tags removed");
			return input.replace(htmlPattern, "");
		}
		return input;
	}

	private applyShellEscape(input: string, warnings: string[]): string {
		if (!this.config.escapeShell) return input;
		let result = input;
		let escaped = false;
		for (const char of SHELL_METACHARACTERS) {
			if (result.includes(char)) {
				result = result.replace(new RegExp(`\\${char}`, "g"), `\\${char}`);
				escaped = true;
			}
		}
		if (escaped) {
			warnings.push("Shell metacharacters escaped");
		}
		return result;
	}

	private applyPromptInjectionCheck(
		input: string,
		warnings: string[],
	): boolean {
		if (!this.config.blockPromptInjection) return false;
		for (const pattern of PROMPT_INJECTION_PATTERNS) {
			if (pattern.test(input)) {
				warnings.push(`Prompt injection pattern detected: ${pattern.source}`);
				return true;
			}
		}
		return false;
	}

	private applyCustomPatternCheck(input: string, warnings: string[]): boolean {
		if (!this.config.blockPatterns) return false;
		for (const pattern of this.config.blockPatterns) {
			if (pattern.test(input)) {
				warnings.push(`Custom block pattern matched: ${pattern.source}`);
				return true;
			}
		}
		return false;
	}

	private applyUnicodeNormalization(input: string): string {
		if (!this.config.normalizeUnicode) return input;
		try {
			return input.normalize("NFC");
		} catch {
			return input;
		}
	}

	isSafe(input: string): boolean {
		const result = this.sanitize(input);
		return !result.modified && result.warnings.length === 0;
	}
}
