/**
 * Entity Extractor — extracts named entities from text and stores them
 *
 * Supports: Person, Organization, Location, Date, Event, Concept, Task
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type {
  Entity,
  EntityType,
  EntityExtractorConfig,
  EntityExtractorService,
} from './types.js';

const ENTITY_PATTERNS: Array<{ type: EntityType; regex: RegExp; group?: number }> = [
  // Organizations (common company names)
  { type: 'Organization', regex: /\b(Google|Apple|Microsoft|Amazon|Meta|OpenAI|Anthropic|Tesla|Netflix|IBM|Intel|NVIDIA|Oracle|Salesforce|Adobe|Cisco|Cisco|Uber|Airbnb|Spotify|Twitter|Facebook|Instagram|LinkedIn|Reddit|Discord|Slack|GitHub|GitLab|Docker|Kubernetes)\b/i },

  // Dates
  { type: 'Date', regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i },
  { type: 'Date', regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/ },
  { type: 'Date', regex: /\b\d{4}-\d{2}-\d{2}\b/ },
  { type: 'Date', regex: /\b(today|tomorrow|yesterday|next\s+week|last\s+week|this\s+month)\b/i },

  // Locations (common city/country names)
  { type: 'Location', regex: /\b(San Francisco|New York|Los Angeles|Chicago|Seattle|Boston|London|Paris|Berlin|Tokyo|Beijing|Shanghai|Sydney|Toronto|Singapore|Dubai|Moscow|Madrid|Rome|Amsterdam|Stockholm|Oslo|Helsinki|Zurich|Vienna|Prague|Warsaw|Budapest|Athens|Lisbon|Dublin|Edinburgh|Manchester|Liverpool|Birmingham|San Jose|Austin|Denver|Portland|Miami|Atlanta|Dallas|Houston|Phoenix|Philadelphia|Washington)\b/i },
  { type: 'Location', regex: /\b(United States|United Kingdom|Canada|Germany|France|Japan|China|India|Australia|Brazil|Russia|Italy|Spain|Netherlands|Sweden|Norway|Finland|Switzerland|Austria|Czech Republic|Poland|Greece|Portugal|Ireland|Mexico|Argentina|South Korea|Singapore|UAE|Saudi Arabia)\b/i },

  // Tasks (TODO, FIXME, HACK patterns)
  { type: 'Task', regex: /\b(TODO|FIXME|HACK|XXX|NOTE):\s*([^\n]+)/gi, group: 2 },

  // Events (conference, meeting, deadline patterns)
  { type: 'Event', regex: /\b(conference|meeting|deadline|launch|release|event|workshop|seminar|webinar|hackathon|summit|forum|symposium)\b/i },

  // Concepts (abstract ideas, technologies)
  { type: 'Concept', regex: /\b(AI|machine learning|deep learning|neural network|blockchain|cryptocurrency|cloud computing|microservices|DevOps|CI\/CD|Kubernetes|Docker|TypeScript|JavaScript|Python|Rust|Go|React|Vue|Angular|Node\.js|REST|GraphQL|WebSocket|OAuth|JWT|API|database|serverless|edge computing)\b/i },
];

// Person detection: capitalized words that look like names (heuristic)
const PERSON_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

// Words that are NOT person names
const NON_PERSON_WORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'All', 'An', 'And', 'Are', 'As',
  'At', 'Be', 'But', 'By', 'For', 'From', 'Had', 'Has', 'Have', 'He', 'Her',
  'His', 'How', 'I', 'If', 'In', 'Is', 'It', 'Its', 'Let', 'May', 'No', 'Not',
  'Of', 'On', 'Or', 'Our', 'Out', 'She', 'So', 'Such', 'Than', 'The', 'Their',
  'Them', 'Then', 'There', 'They', 'To', 'Up', 'Us', 'Was', 'We', 'Were', 'What',
  'When', 'Which', 'Who', 'Will', 'With', 'You', 'Your', 'About', 'After',
  'Before', 'Between', 'During', 'Each', 'Few', 'More', 'Most', 'Other',
  'Over', 'Same', 'Some', 'Still', 'Very', 'Also', 'Just', 'Only', 'Even',
  'Both', 'Every', 'Many', 'Much', 'Never', 'Once', 'Quite', 'Rather',
  'Several', 'Several', 'Several', 'Several',
]);

export class EntityExtractorImpl implements EntityExtractorService {
  private readonly config: EntityExtractorConfig;
  private readonly entities: Map<string, Entity> = new Map();

  constructor(config: EntityExtractorConfig) {
    this.config = config;
  }

  /**
   * Extract entities from text using pattern matching.
   */
  extractEntities(text: string): Entity[] {
    const foundEntities: Entity[] = [];
    const seenNames = new Set<string>();

    // Extract using predefined patterns
    for (const pattern of ENTITY_PATTERNS) {
      const flags = pattern.regex.flags.includes('g')
        ? pattern.regex.flags
        : pattern.regex.flags + 'g';
      const matches = text.matchAll(new RegExp(pattern.regex.source, flags));
      for (const match of matches) {
        const entityText = pattern.group ? match[pattern.group] : match[0];
        const normalized = entityText.trim().toLowerCase();

        if (seenNames.has(normalized)) continue;
        seenNames.add(normalized);

        const entity: Entity = {
          id: randomUUID(),
          type: pattern.type,
          name: entityText.trim(),
          mentions: [{
            text: entityText.trim(),
            position: match.index ?? 0,
            length: entityText.length,
            context: this.extractContext(text, match.index ?? 0, entityText.length),
          }],
          firstSeen: new Date(),
          lastSeen: new Date(),
          attributes: {},
        };

        foundEntities.push(entity);
        this.entities.set(entity.id, entity);
      }
    }

    // Extract person names (heuristic)
    const personMatches = text.matchAll(PERSON_PATTERN);
    for (const match of personMatches) {
      const name = match[1];
      const normalized = name.toLowerCase();

      if (NON_PERSON_WORDS.has(name) || seenNames.has(normalized)) continue;
      seenNames.add(normalized);

      const entity: Entity = {
        id: randomUUID(),
        type: 'Person',
        name,
        mentions: [{
          text: name,
          position: match.index ?? 0,
          length: name.length,
          context: this.extractContext(text, match.index ?? 0, name.length),
        }],
        firstSeen: new Date(),
        lastSeen: new Date(),
        attributes: {},
      };

      foundEntities.push(entity);
      this.entities.set(entity.id, entity);
    }

    return foundEntities;
  }

  /**
   * Get an entity by ID.
   */
  getEntity(id: string): Entity | null {
    return this.entities.get(id) ?? null;
  }

  /**
   * List entities, optionally filtered by type.
   */
  listEntities(type?: EntityType): Entity[] {
    if (type) {
      return Array.from(this.entities.values()).filter((e) => e.type === type);
    }
    return Array.from(this.entities.values());
  }

  /**
   * Update an entity with new data.
   */
  updateEntity(id: string, updates: Partial<Entity>): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    Object.assign(entity, updates);
    entity.lastSeen = new Date();
  }

  /**
   * Save entities to disk.
   */
  async save(): Promise<void> {
    const data = Array.from(this.entities.values());
    await writeFile(
      this.config.storagePath + '/entities.json',
      JSON.stringify(data, null, 2),
    );
  }

  /**
   * Load entities from disk.
   */
  async load(): Promise<void> {
    try {
      const data = JSON.parse(
        await readFile(this.config.storagePath + '/entities.json', 'utf-8'),
      ) as Entity[];

      for (const entity of data) {
        // Restore Date objects
        entity.firstSeen = new Date(entity.firstSeen);
        entity.lastSeen = new Date(entity.lastSeen);
        // Mentions don't have Date fields, so no conversion needed
        this.entities.set(entity.id, entity);
      }
    } catch {
      // No existing data, start fresh
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private extractContext(text: string, position: number, length: number): string {
    const start = Math.max(0, position - 30);
    const end = Math.min(text.length, position + length + 30);
    let context = text.slice(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    return context;
  }
}
