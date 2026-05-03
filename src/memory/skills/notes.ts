/**
 * Memory Notes Skill
 * 
 * Manages structured notes with titles, tags, and pinning.
 */

import type {
  LongTermMemoryService,
} from '../types.js';
import type {
  MemorySkill,
  NoteEntry,
  MemoryNotesConfig,
} from './types.js';

const DEFAULT_CONFIG: Required<MemoryNotesConfig> = {
  dataDir: './memory/skills/notes',
  enabled: true,
  maxNotes: 500,
};

function generateId(): string {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class MemoryNotesSkill implements MemorySkill {
  public name = 'memory-notes';
  private memory: LongTermMemoryService | null = null;
  private config: Required<MemoryNotesConfig>;
  private notes: Map<string, NoteEntry> = new Map();

  constructor(config?: Partial<MemoryNotesConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(memory: LongTermMemoryService): Promise<void> {
    this.memory = memory;
    await this.loadNotes();
  }

  async shutdown(): Promise<void> {
    await this.saveNotes();
  }

  /**
   * Create a new note.
   */
  async createNote(title: string, content: string, tags?: string[]): Promise<NoteEntry> {
    if (!this.memory) throw new Error('MemoryNotesSkill not initialized');

    const now = new Date();
    const note: NoteEntry = {
      id: generateId(),
      title,
      content,
      tags: tags ?? [],
      createdAt: now,
      updatedAt: now,
      pinned: false,
    };

    this.notes.set(note.id, note);

    // Also store in long-term memory
    await this.memory.create({
      content: `${title}: ${content}`,
      type: 'long-term',
      metadata: { source: 'notes', noteId: note.id, title },
      tags: ['note', ...(tags ?? [])],
    });

    return note;
  }

  /**
   * Get a note by ID.
   */
  async getNote(id: string): Promise<NoteEntry | null> {
    return this.notes.get(id) ?? null;
  }

  /**
   * Update a note.
   */
  async updateNote(id: string, updates: Partial<Pick<NoteEntry, 'title' | 'content' | 'tags' | 'pinned'>>): Promise<NoteEntry | null> {
    const note = this.notes.get(id);
    if (!note) return null;

    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;
    if (updates.tags !== undefined) note.tags = updates.tags;
    if (updates.pinned !== undefined) note.pinned = updates.pinned;
    note.updatedAt = new Date();

    this.notes.set(id, note);

    // Update in long-term memory
    if (this.memory) {
      await this.memory.update({
        id: (await this.findMemoryEntryForNote(id)) ?? '',
        content: `${note.title}: ${note.content}`,
        tags: ['note', ...note.tags],
      });
    }

    return note;
  }

  /**
   * Delete a note.
   */
  async deleteNote(id: string): Promise<boolean> {
    const deleted = this.notes.delete(id);
    if (deleted && this.memory) {
      const memoryEntry = await this.findMemoryEntryForNote(id);
      if (memoryEntry) {
        await this.memory.archive(memoryEntry);
      }
    }
    return deleted;
  }

  /**
   * List all notes, optionally filtered by tags.
   */
  async listNotes(tags?: string[]): Promise<NoteEntry[]> {
    let notes = Array.from(this.notes.values());

    if (tags) {
      notes = notes.filter((n) => tags.some((t) => n.tags.includes(t)));
    }

    // Pinned notes first, then by updatedAt
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return notes;
  }

  /**
   * Search notes by query.
   */
  async searchNotes(query: string): Promise<NoteEntry[]> {
    const lower = query.toLowerCase();
    return Array.from(this.notes.values()).filter(
      (n) =>
        n.title.toLowerCase().includes(lower) ||
        n.content.toLowerCase().includes(lower) ||
        n.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  // ── Private helpers ──

  private async loadNotes(): Promise<void> {
    if (!this.memory) return;

    const result = await this.memory.search({
      metadataFilter: { source: 'notes' },
      limit: this.config.maxNotes,
    });

    for (const entry of result.entries) {
      const noteId = entry.metadata.noteId as string;
      const title = (entry.metadata.title as string) ?? 'Untitled';
      const content = entry.content.replace(`${title}: `, '');

      if (noteId) {
        this.notes.set(noteId, {
          id: noteId,
          title,
          content,
          tags: (entry.metadata.tags as string[])?.filter((t: string) => t !== 'note') ?? [],
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          pinned: false,
        });
      }
    }
  }

  private async saveNotes(): Promise<void> {
    // Notes are persisted via long-term memory entries
  }

  private async findMemoryEntryForNote(noteId: string): Promise<string | null> {
    if (!this.memory) return null;
    const result = await this.memory.search({
      metadataFilter: { source: 'notes', noteId },
      limit: 1,
    });
    return result.entries[0]?.id ?? null;
  }
}
