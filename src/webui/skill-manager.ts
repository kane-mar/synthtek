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
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import * as os from "node:os";
import { join, relative } from "node:path";
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
			// Accept real directories OR symlinks to directories
			const isDir =
				entry.isDirectory() ||
				(entry.isSymbolicLink() &&
					statSync(join(this.skillsDir, entry.name)).isDirectory());
			if (!isDir) continue;
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

	// ── INSTALL ─────────────────────────────────────────────────────────

	install(source: string): { success: boolean; error?: string } {
		try {
			const parsed = this.parseSourceUrl(source);

			// Split owner/repo from optional @skill-path
			const atIdx = parsed.indexOf("@");
			const repoPath = atIdx >= 0 ? parsed.substring(0, atIdx) : parsed;
			const skillPath = atIdx >= 0 ? parsed.substring(atIdx + 1) : "";

			// Also handle owner/repo/skill-name format (3+ segments without @)
			const segments = repoPath.split("/");
			const hasDirectSkillPath = segments.length >= 3;
			const finalSkillPath =
				skillPath || (hasDirectSkillPath ? segments.slice(2).join("/") : "");
			const finalRepoPath =
				hasDirectSkillPath && !skillPath
					? segments.slice(0, 2).join("/")
					: repoPath;
			const finalSegments = finalRepoPath.split("/");

			if (finalSegments.length >= 2 && finalSkillPath) {
				// Specific skill → direct install (avoids buggy skills CLI @filter)
				return this.installDirect(
					finalSegments[0],
					finalSegments[1],
					finalSkillPath,
				);
			}

			// For bare owner/repo, use the skills CLI (it works for bulk installs)
			return this.installViaCli(parsed);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Unknown installation error";
			return { success: false, error: message };
		}
	}

	/**
	 * Install a specific skill directly by cloning the repo and copying the
	 * SKILL.md directory — avoids the buggy @filter in skills CLI v1.5.x.
	 */
	private installDirect(
		owner: string,
		repo: string,
		skillPath: string,
	): { success: boolean; error?: string } {
		const tmpDir = join(os.tmpdir(), `synthtek-skill-${Date.now()}`);
		try {
			const cloneUrl = `https://github.com/${owner}/${repo}.git`;
			mkdirSync(tmpDir, { recursive: true });

			execSync(`git clone --depth 1 "${cloneUrl}" "${tmpDir}" 2>&1`, {
				encoding: "utf-8",
				timeout: 120_000,
			});

			// Search for SKILL.md matching the requested skill name
			const skillDirs = this.findSkillDir(tmpDir, skillPath);
			if (!skillDirs.length) {
				// Fall back to searching within a `skills/` subdirectory
				const nested = this.findSkillDir(join(tmpDir, "skills"), skillPath);
				if (!nested.length) {
					rmSync(tmpDir, { recursive: true, force: true });
					return {
						success: false,
						error: `Skill "${skillPath}" not found in ${owner}/${repo}. Check the skill name and path.`,
					};
				}
				return this.copySkill(nested[0], skillPath);
			}

			return this.copySkill(skillDirs[0], skillPath);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			return { success: false, error: message };
		} finally {
			try {
				rmSync(tmpDir, { recursive: true, force: true });
			} catch {
				console.warn(
					`[SkillManager] Failed to clean up temp directory: ${tmpDir}`,
				);
			}
		}
	}

	/**
	 * Find a skill directory by name under a root directory.
	 * Supports nested paths like "skills/debugger" or simple names like "debugger".
	 */
	private findSkillDir(root: string, skillName: string): string[] {
		const results: string[] = [];

		// Handle nested paths like "skills/debugger" — join root with the path
		const searchRoot = join(root, skillName);
		if (existsSync(searchRoot) && existsSync(join(searchRoot, "SKILL.md"))) {
			results.push(searchRoot);
			return results;
		}

		// Also try just the last segment of the path (e.g. "debugger" from "skills/debugger")
		const lastSegment = skillName.split("/").pop() || skillName;
		if (lastSegment !== skillName) {
			return this.findSkillDir(root, lastSegment);
		}

		if (!existsSync(root)) return results;

		const scan = (dir: string) => {
			let entries: string[];
			try {
				entries = readdirSync(dir);
			} catch {
				return;
			}
			for (const entry of entries) {
				const full = join(dir, entry);
				try {
					const st = statSync(full);
					if (st.isDirectory()) {
						if (entry === skillName && existsSync(join(full, "SKILL.md"))) {
							results.push(full);
						} else {
							scan(full);
						}
					}
				} catch {
					/* skip unreadable */
				}
			}
		};
		scan(root);
		return results;
	}

	/**
	 * Copy a skill directory into the agents skills directory and create a symlink.
	 */
	private copySkill(
		skillDir: string,
		skillName: string,
	): { success: boolean; error?: string } {
		const targetDir = join(
			this.skillsDir,
			"..",
			".agents",
			"skills",
			skillName,
		);
		mkdirSync(targetDir, { recursive: true });

		// Copy all files from the skill directory
		const copyFiles = (src: string, dst: string) => {
			mkdirSync(dst, { recursive: true });
			const entries = readdirSync(src, { withFileTypes: true });
			for (const entry of entries) {
				const s = join(src, entry.name);
				const d = join(dst, entry.name);
				if (entry.isDirectory()) {
					copyFiles(s, d);
				} else {
					writeFileSync(d, readFileSync(s));
				}
			}
		};
		copyFiles(skillDir, targetDir);

		// Create symlink in skills/ dir
		const agentsSkillsDir = join(this.skillsDir, "..", ".agents", "skills");
		const linkPath = join(this.skillsDir, skillName);
		const relativeTarget = relative(
			this.skillsDir,
			join(agentsSkillsDir, skillName),
		);
		if (!existsSync(linkPath)) {
			try {
				mkdirSync(this.skillsDir, { recursive: true });
				symlinkSync(relativeTarget, linkPath);
			} catch (_e) {
				// If symlink fails, that's OK — the install still works
			}
		}

		// Mark as enabled
		this.state.set(skillName, true);
		this.saveState();

		return { success: true };
	}

	/**
	 * Install via the skills.sh CLI (for bare owner/repo sources).
	 */
	private installViaCli(parsed: string): { success: boolean; error?: string } {
		try {
			const cmd = existsSync("/usr/local/bin/skills")
				? `skills add "${parsed}" -y --all 2>&1`
				: `npx --yes skills@latest add "${parsed}" -y --all 2>&1`;

			execSync(cmd, {
				encoding: "utf-8",
				timeout: 600_000,
			});

			// After installation, mark as enabled
			const name = this.extractSkillName(parsed);
			if (name) {
				this.state.set(name, true);
				this.saveState();
			}

			return { success: true };
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Unknown installation error";
			const stderr = (err as { stderr?: string })?.stderr || "";
			const stdout = (err as { stdout?: string })?.stdout || "";
			const ansiEscape = String.fromCharCode(27);
			const raw = (stderr || stdout || "")
				.replace(new RegExp(`${ansiEscape}\\[[0-9;?]*[a-zA-Z]`, "g"), "")
				.replace(new RegExp(`${ansiEscape}\\][0-9;]*[a-zA-Z]?`, "g"), "")
				.replace(/[■◒◓◑◐◌]/g, "")
				.trim();
			const lines = raw
				.split("\n")
				.filter(
					(l: string) =>
						l.trim() && !l.includes("?25") && !l.match(/^[│└┌├─━┃┏┗┓┛]*$/),
				);
			const fatal = lines.find((l: string) => /fatal|error|✗/i.test(l));
			const summary = fatal || lines.slice(-3).join(" • ");
			const display = message + (summary ? ` — ${summary}` : "");
			return { success: false, error: display.slice(0, 500) };
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
						return `${owner}/${repo}@${parts.slice(treeIdx + 2).join("/")}`;
					}
					return `${owner}/${repo}`;
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
			const isDir =
				entry.isDirectory() ||
				(entry.isSymbolicLink() &&
					statSync(join(this.skillsDir, entry.name)).isDirectory());
			if (!isDir) continue;

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
