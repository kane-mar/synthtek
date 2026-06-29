/**
 * Skill Manager
 *
 * Manages installed skills — listing, installing, toggling, and deleting.
 * Skills are stored as SKILL.md files with YAML frontmatter in a skills directory.
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { SkillInfo } from "./types.js";

/** Name of the state file that tracks enabled/disabled status */
const SKILLS_CONFIG_FILE = "skills-config.json";

/** Default emoji when skill has none defined */
const DEFAULT_EMOJI = "🧩";

export class SkillManager {
	private skillsDir: string;
	private configFile: string;
	private state: Map<string, boolean>;

	constructor(skillsDir: string, configDir: string) {
		this.skillsDir = skillsDir;
		this.configFile = join(configDir, SKILLS_CONFIG_FILE);
		this.state = new Map();
		this.loadState();
	}

	// ── State persistence ───────────────────────────────────────────────

	private loadState(): void {
		try {
			if (existsSync(this.configFile)) {
				const raw = readFileSync(this.configFile, "utf-8");
				const data = JSON.parse(raw) as Record<string, boolean>;
				for (const [name, enabled] of Object.entries(data)) {
					this.state.set(name, enabled);
				}
			}
		} catch {
			// Corrupt state file — start fresh
			this.state.clear();
		}
	}

	private saveState(): void {
		try {
			mkdirSync(join(this.configFile, ".."), { recursive: true });
			const obj: Record<string, boolean> = {};
			for (const [name, enabled] of this.state) {
				obj[name] = enabled;
			}
			writeFileSync(this.configFile, JSON.stringify(obj, null, 2));
		} catch (err) {
			console.error("[skills] Failed to save state:", err);
		}
	}

	// ── FRONTMATTER PARSING ─────────────────────────────────────────────

	/**
	 * Minimal YAML frontmatter parser for SKILL.md files.
	 * Extracts only the fields we need: name, description, homepage, metadata.
	 */
	private parseFrontmatter(content: string): {
		name: string;
		description: string;
		homepage?: string;
		emoji?: string;
	} {
		const result = {
			name: "",
			description: "",
			homepage: undefined as string | undefined,
			emoji: undefined as string | undefined,
		};

		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return result;

		const fm = match[1];
		const lines = fm.split("\n");

		for (const line of lines) {
			const nameMatch = line.match(/^name:\s*(.+)/);
			if (nameMatch) {
				result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
				continue;
			}

			const descMatch = line.match(/^description:\s*(.+)/);
			if (descMatch) {
				result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");
				continue;
			}

			const homeMatch = line.match(/^homepage:\s*(.+)/);
			if (homeMatch) {
				result.homepage = homeMatch[1].trim();
				continue;
			}

			// Extract emoji from metadata JSON
			const metaMatch = line.match(/^metadata:\s*(.+)/);
			if (metaMatch) {
				try {
					const meta = JSON.parse(metaMatch[1].trim());
					result.emoji = meta?.nanobot?.emoji || meta?.emoji || undefined;
				} catch {
					// ignore parse errors
				}
			}
		}

		return result;
	}

	// ── LIST SKILLS ─────────────────────────────────────────────────────

	list(): SkillInfo[] {
		const skills: SkillInfo[] = [];

		if (!existsSync(this.skillsDir)) {
			return skills;
		}

		const entries = readdirSync(this.skillsDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const skillPath = join(this.skillsDir, entry.name, "SKILL.md");

			if (!existsSync(skillPath)) continue;

			try {
				const content = readFileSync(skillPath, "utf-8");
				const meta = this.parseFrontmatter(content);

				const name = meta.name || entry.name;

				// Default new skills to enabled
				if (!this.state.has(name)) {
					this.state.set(name, true);
				}

				skills.push({
					name,
					description: meta.description || "",
					homepage: meta.homepage,
					emoji: meta.emoji || DEFAULT_EMOJI,
					enabled: this.state.get(name) ?? true,
					installedAt: 0,
				});
			} catch (err) {
				console.error(`[skills] Failed to read ${entry.name}:`, err);
			}
		}

		// Persist any new defaults
		this.saveState();

		return skills.sort((a, b) => a.name.localeCompare(b.name));
	}

	// ── TOGGLE ENABLE/DISABLE ───────────────────────────────────────────

	toggle(name: string): SkillInfo | null {
		const skills = this.list();
		const skill = skills.find((s) => s.name === name);
		if (!skill) return null;

		this.state.set(name, !skill.enabled);
		this.saveState();
		return { ...skill, enabled: !skill.enabled };
	}

	// ── INSTALL FROM SKILLS.SH ──────────────────────────────────────────

	install(source: string): { success: boolean; error?: string } {
		try {
			// Parse full URLs into owner/repo format
			const parsed = this.parseSourceUrl(source);

			// Install skill via skills.sh CLI (skip prompts with -y --all)
			execSync(`npx --yes skills@latest add "${parsed}" -y --all 2>&1`, {
				encoding: "utf-8",
				timeout: 120_000,
			});

			// After installation, mark as enabled
			const name = this.extractSkillName(parsed);
			if (name) {
				this.state.set(name, true);
				this.saveState();
			}

			return { success: true };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown installation error";
			// Try to get the stderr/stdout for better diagnostics
			const stderr = (err as { stderr?: string })?.stderr || "";
			const stdout = (err as { stdout?: string })?.stdout || "";
			const detail = stderr || stdout || "";
			const cleaned = detail
				? message.replace(detail, "").trim() + " — " + detail.split("\n").slice(-3).join("; ").trim()
				: message;
			return { success: false, error: cleaned.slice(0, 500) };
		}
	}

	/**
	 * Parse a full GitHub/skills.sh URL into owner/repo format.
	 * Falls through to the raw source if it's already in the right format.
	 */
	private parseSourceUrl(src: string): string {
		const s = src.trim();
		try {
			const url = new URL(s);
			// GitHub: https://github.com/owner/repo or /owner/repo/tree/branch/path
			if (/github\.com$/i.test(url.hostname)) {
				const parts = url.pathname.replace(/^\//, "").split("/");
				if (parts.length >= 2) {
					const owner = parts[0],
						repo = parts[1];
					const treeIdx = parts.indexOf("tree");
					if (treeIdx !== -1 && parts.length > treeIdx + 2) {
						return (
							owner + "/" + repo + "@" + parts.slice(treeIdx + 2).join("/")
						);
					}
					return owner + "/" + repo;
				}
			}
			// skills.sh: https://skills.sh/owner/repo or /owner/repo@skill
			if (/skills\.sh$/i.test(url.hostname)) {
				const parts = url.pathname.replace(/^\//, "").split("/");
				if (parts.length >= 2) return parts.join("/");
			}
		} catch {
			// Not a URL — pass through as-is
		}
		return s;
	}

	/**
	 * Try to extract a skill name from an install source string.
	 * Examples: "owner/repo@skill" → "skill", "owner/repo" → "repo"
	 */
	private extractSkillName(source: string): string | null {
		const atMatch = source.match(/@([^/]+)$/);
		if (atMatch) return atMatch[1];
		// For owner/repo format, the last path segment
		const parts = source.split("/");
		return parts[parts.length - 1] || null;
	}

	// ── DELETE SKILL ────────────────────────────────────────────────────

	delete(name: string): { success: boolean; error?: string } {
		const entries = readdirSync(this.skillsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const skillPath = join(this.skillsDir, entry.name, "SKILL.md");
			if (!existsSync(skillPath)) continue;

			try {
				const content = readFileSync(skillPath, "utf-8");
				const meta = this.parseFrontmatter(content);
				const skillName = meta.name || entry.name;

				if (skillName === name) {
					// Remove the entire skill directory
					rmSync(join(this.skillsDir, entry.name), {
						recursive: true,
						force: true,
					});
					this.state.delete(name);
					this.saveState();
					return { success: true };
				}
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Unknown error";
				return { success: false, error: message };
			}
		}

		return { success: false, error: `Skill "${name}" not found` };
	}
}
