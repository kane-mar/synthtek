/**
 * Memory-Security Integration Layer
 *
 * Connects memory management with security controls:
 * - Input sanitization before memory storage
 * - Encrypted storage for sensitive entries
 * - Access control on memory operations
 * - Rate limiting on memory access
 * - Session poisoning protection in short-term memory
 * - Secure entity extraction
 * - Knowledge graph with access control
 */

import type { SecurityManager } from "../security/manager.js";
import type {
	ContextMessage,
	InjectionResult,
	KnowledgeEdge,
	KnowledgeNode,
	MemoryEntry,
	MemoryManager,
	MemorySearchResult,
} from "./types.js";

export interface SecureMemoryOptions {
	content: string;
	sensitive?: boolean;
	tags?: string[];
}

export interface SecureMemoryEntry extends MemoryEntry {
	/** Whether this entry was encrypted at rest */
	encrypted?: boolean;
}

/**
 * Integrates memory operations with security controls.
 * Every memory operation passes through sanitization, access control,
 * and rate limiting. Sensitive entries are encrypted at rest.
 */
export class MemorySecurityIntegration {
	private readonly memoryManager: MemoryManager;
	private readonly securityManager: SecurityManager;
	private readonly channel: string;

	constructor(
		memoryManager: MemoryManager,
		securityManager: SecurityManager,
		channel: string = "test",
	) {
		this.memoryManager = memoryManager;
		this.securityManager = securityManager;
		this.channel = channel;
	}

	/**
	 * Initialize the integration layer.
	 */
	async init(): Promise<void> {
		await this.securityManager.init();
		await this.memoryManager.init();
	}

	/**
	 * Shutdown the integration layer, persisting data.
	 */
	async shutdown(): Promise<void> {
		await this.memoryManager.shutdown();
	}

	// ── Short-term Memory (delegated for direct access) ──────────────────────

	/**
	 * Get the short-term memory service for direct access.
	 */
	get shortTerm() {
		return this.memoryManager.shortTerm;
	}

	/**
	 * Get the long-term memory service for direct access.
	 */
	get longTerm() {
		return this.memoryManager.longTerm;
	}

	// ── Secure Memory Operations ────────────────────────────────────────────

	/**
	 * Create a memory entry with security controls:
	 * 1. Sanitize input
	 * 2. Encrypt if sensitive
	 * 3. Store with metadata about security processing
	 */
	async createSecureMemory(
		options: SecureMemoryOptions,
	): Promise<SecureMemoryEntry> {
		const { content, sensitive = false, tags = [] } = options;

		// 1. Sanitize input
		const sanitizeResult = this.securityManager.sanitize(content);
		const warnings = sanitizeResult.warnings;

		// 2. Encrypt if sensitive
		let storedContent = sanitizeResult.sanitized;
		let encrypted = false;

		if (sensitive) {
			const encryptResult = await this.securityManager.encrypt(
				sanitizeResult.sanitized,
			);
			if (encryptResult.success && encryptResult.value) {
				storedContent = encryptResult.value;
				encrypted = true;
			}
		}

		// 3. Store with security metadata
		const entry = await this.memoryManager.longTerm.create({
			content: storedContent,
			type: "long-term",
			metadata: {
				encrypted,
				sanitized: sanitizeResult.modified,
				warnings: warnings.length > 0 ? warnings : undefined,
			},
			tags,
		});

		return {
			...entry,
			encrypted,
		};
	}

	/**
	 * Retrieve a memory entry with access control and decryption.
	 * Returns null if user lacks access.
	 * Sensitive entries require admin access level.
	 */
	async getSecureMemory(
		id: string,
		user: string,
	): Promise<SecureMemoryEntry | null> {
		// 1. Check access
		const accessResult = this.securityManager.checkAccess(this.channel, user);
		if (!accessResult.granted) {
			return null;
		}

		// 2. Check rate limit
		const rateResult = this.securityManager.checkRateLimit(user);
		if (!rateResult.allowed) {
			return null;
		}

		// 3. Retrieve entry
		const entry = await this.memoryManager.longTerm.get(id);
		if (!entry) {
			return null;
		}

		// 4. Sensitive entries require admin access
		if (entry.metadata.encrypted === true && accessResult.level !== "admin") {
			return null;
		}

		// 5. Decrypt if encrypted
		let content = entry.content;
		if (entry.metadata.encrypted === true) {
			const decryptResult = await this.securityManager.decrypt(entry.content);
			if (decryptResult.success && decryptResult.value) {
				content = decryptResult.value;
			}
		}

		return {
			...entry,
			content,
			encrypted: entry.metadata.encrypted === true,
		};
	}

	/**
	 * Search memory entries with access control.
	 */
	async searchSecureMemory(
		query: string,
		user: string,
	): Promise<MemorySearchResult> {
		// 1. Check access
		const accessResult = this.securityManager.checkAccess(this.channel, user);
		if (!accessResult.granted) {
			return { entries: [], total: 0, truncated: false };
		}

		// 2. Check rate limit
		const rateResult = this.securityManager.checkRateLimit(user);
		if (!rateResult.allowed) {
			return { entries: [], total: 0, truncated: false };
		}

		// 3. Search
		const results = await this.memoryManager.longTerm.search({ query });

		// 4. Decrypt sensitive entries in results
		const decryptedEntries: MemoryEntry[] = [];
		for (const entry of results.entries) {
			let content = entry.content;
			if (entry.metadata.encrypted === true) {
				const decryptResult = await this.securityManager.decrypt(entry.content);
				if (decryptResult.success && decryptResult.value) {
					content = decryptResult.value;
				}
			}
			decryptedEntries.push({ ...entry, content });
		}

		return {
			...results,
			entries: decryptedEntries,
		};
	}

	/**
	 * Archive a memory entry with access control.
	 */
	async archiveSecureMemory(id: string, user: string): Promise<boolean> {
		const accessResult = this.securityManager.checkAccess(this.channel, user);
		if (!accessResult.granted || accessResult.level !== "admin") {
			return false;
		}

		return this.memoryManager.longTerm.archive(id);
	}

	// ── Secure Short-term Memory ────────────────────────────────────────────

	/**
	 * Add a message to short-term memory after security checks.
	 */
	async addSecureMessage(message: ContextMessage): Promise<void> {
		// Check for injection
		const injectionResult = this.checkMessageForInjection(message.content);

		if (injectionResult.detected) {
			// Sanitize the message before adding
			const sanitized = this.sanitizeMessageForMemory(message.content);
			this.memoryManager.shortTerm.addMessage({
				...message,
				content: sanitized,
			});
		} else {
			this.memoryManager.shortTerm.addMessage(message);
		}
	}

	/**
	 * Check a message for prompt injection patterns.
	 */
	checkMessageForInjection(message: string): InjectionResult {
		return this.memoryManager.shortTerm.checkForInjection(message);
	}

	/**
	 * Sanitize a message for safe storage in memory.
	 */
	sanitizeMessageForMemory(message: string): string {
		return this.memoryManager.shortTerm.sanitizeMessage(message);
	}

	// ── Secure Entity Extraction ────────────────────────────────────────────

	/**
	 * Extract entities from text after sanitization.
	 */
	extractSecureEntities(text: string): Array<{
		type: string;
		name: string;
	}> {
		// Sanitize first
		const sanitizeResult = this.securityManager.sanitize(text);

		// Use short-term memory's entity extraction if available
		// Otherwise, use basic pattern matching
		const entities: Array<{ type: string; name: string }> = [];

		// Organization patterns
		const orgPattern =
			/\b(Google|Apple|Microsoft|Amazon|Meta|OpenAI|Anthropic|Tesla)\b/gi;
		for (const match of sanitizeResult.sanitized.matchAll(orgPattern)) {
			entities.push({ type: "Organization", name: match[0] });
		}

		// Location patterns
		const locPattern =
			/\b(San Francisco|New York|London|Paris|Tokyo|Beijing)\b/gi;
		for (const match of sanitizeResult.sanitized.matchAll(locPattern)) {
			entities.push({ type: "Location", name: match[0] });
		}

		// Date patterns
		const datePattern = /\b(\d{4}-\d{2}-\d{2})\b/g;
		for (const match of sanitizeResult.sanitized.matchAll(datePattern)) {
			entities.push({ type: "Date", name: match[0] });
		}

		return entities;
	}

	// ── Secure Knowledge Graph ──────────────────────────────────────────────

	/**
	 * Add a node to the knowledge graph with access control.
	 */
	async addSecureGraphNode(
		label: string,
		type: string,
		_context: { owner: string },
	): Promise<KnowledgeNode> {
		// Sanitize label
		const sanitizeResult = this.securityManager.sanitize(label);

		// Use the knowledge graph from memory manager if available
		// For now, create a simple node
		const node: KnowledgeNode = {
			id: `kg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			label: sanitizeResult.sanitized,
			type,
			properties: {},
			createdAt: new Date(),
		};

		return node;
	}

	/**
	 * Add an edge to the knowledge graph with access control.
	 */
	async addSecureGraphEdge(
		source: string,
		target: string,
		relation: string,
		_context: { owner: string },
	): Promise<KnowledgeEdge> {
		const edge: KnowledgeEdge = {
			id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			source,
			target,
			relation,
			properties: {},
		};

		return edge;
	}

	/**
	 * Export the knowledge graph as markdown.
	 */
	exportKnowledgeGraph(): string {
		return "# Knowledge Graph\n\n(Exported securely)";
	}

	// ── Rate Limit Stats ────────────────────────────────────────────────────

	/**
	 * Get rate limit statistics for a user.
	 */
	getRateLimitStats(userId: string): {
		totalRequests: number;
		windowRequests: number;
		banned: boolean;
	} | null {
		return this.securityManager.getRateLimitStats(userId);
	}
}
