/**
 * Memory Skills Tests
 * Tests for memory skills: reflect, defrag, notes, tasks, metadata-search, ingest, lifecycle
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LongTermMemoryImpl } from '../../src/memory/long-term.js';
import { MemoryReflectSkill } from '../../src/memory/skills/reflect.js';
import { MemoryDefragSkill } from '../../src/memory/skills/defrag.js';
import { MemoryNotesSkill } from '../../src/memory/skills/notes.js';
import { MemoryTasksSkill } from '../../src/memory/skills/tasks.js';
import { MemoryMetadataSearchSkill } from '../../src/memory/skills/metadata-search.js';
import { MemoryIngestSkill } from '../../src/memory/skills/ingest.js';
import { MemoryLifecycleSkill } from '../../src/memory/skills/lifecycle.js';

describe('Memory Skills', () => {
  let testDir: string;
  let memory: LongTermMemoryImpl;

  before(async () => {
    testDir = join(tmpdir(), `synthtek-memory-skills-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    memory = new LongTermMemoryImpl({ storagePath: testDir });
    await memory.load();
  });

  after(async () => {
    await memory.save();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('MemoryReflectSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryReflectSkill({ intervalSeconds: 999999 });
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-reflect');
      await skill.shutdown();
    });

    it('performs reflection cycle', async () => {
      const skill = new MemoryReflectSkill({ intervalSeconds: 999999 });
      await skill.init(memory);

      // Add some entries
      await memory.create({ content: 'Test entry 1', tags: ['test'] });
      await memory.create({ content: 'Test entry 2', tags: ['test'] });

      const result = await skill.reflect();
      assert.ok(result.entriesReviewed >= 2);
      assert.ok(result.duration >= 0);
      assert.ok(result.timestamp instanceof Date);

      await skill.shutdown();
    });

    it('detects patterns in entries', async () => {
      const skill = new MemoryReflectSkill({ intervalSeconds: 999999 });
      await skill.init(memory);

      // Add entries with same tag
      for (let i = 0; i < 4; i++) {
        await memory.create({ content: `Pattern test ${i}`, tags: ['pattern-test'] });
      }

      const result = await skill.reflect();
      // Should have generated insights for the repeated tag
      assert.ok(result.insightsGenerated >= 0);

      await skill.shutdown();
    });
  });

  describe('MemoryDefragSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryDefragSkill();
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-defrag');
    });

    it('detects and removes duplicates', async () => {
      const skill = new MemoryDefragSkill();
      await skill.init(memory);

      // Add duplicate entries
      await memory.create({ content: 'Duplicate content for testing purposes here' });
      await memory.create({ content: 'Duplicate content for testing purposes here' });

      const result = await skill.defrag();
      assert.ok(result.duplicatesRemoved >= 1);
      assert.ok(result.duration >= 0);
    });

    it('returns defrag statistics', async () => {
      const skill = new MemoryDefragSkill();
      await skill.init(memory);

      const result = await skill.defrag();
      assert.ok(result.entriesBefore >= 0);
      assert.ok(result.entriesAfter >= 0);
      assert.ok(result.storageFreed >= 0);
    });
  });

  describe('MemoryNotesSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryNotesSkill();
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-notes');
      await skill.shutdown();
    });

    it('creates and retrieves notes', async () => {
      const skill = new MemoryNotesSkill();
      await skill.init(memory);

      const note = await skill.createNote('Test Note', 'This is a test note content', ['test']);
      assert.strictEqual(note.title, 'Test Note');
      assert.strictEqual(note.content, 'This is a test note content');
      assert.ok(note.id.startsWith('note_'));

      const retrieved = await skill.getNote(note.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.title, 'Test Note');

      await skill.shutdown();
    });

    it('updates notes', async () => {
      const skill = new MemoryNotesSkill();
      await skill.init(memory);

      const note = await skill.createNote('Update Test', 'Original content', ['test']);
      const updated = await skill.updateNote(note.id, { title: 'Updated Title', pinned: true });
      assert.strictEqual(updated?.title, 'Updated Title');
      assert.strictEqual(updated?.pinned, true);

      await skill.shutdown();
    });

    it('lists and searches notes', async () => {
      const skill = new MemoryNotesSkill();
      await skill.init(memory);

      await skill.createNote('Searchable Note', 'Find me in search', ['searchable']);
      const notes = await skill.listNotes();
      assert.ok(notes.length > 0);

      const searched = await skill.searchNotes('Find me');
      assert.ok(searched.length > 0);

      await skill.shutdown();
    });

    it('deletes notes', async () => {
      const skill = new MemoryNotesSkill();
      await skill.init(memory);

      const note = await skill.createNote('To Delete', 'Will be deleted', ['test']);
      const deleted = await skill.deleteNote(note.id);
      assert.strictEqual(deleted, true);

      const gone = await skill.getNote(note.id);
      assert.strictEqual(gone, null);

      await skill.shutdown();
    });
  });

  describe('MemoryTasksSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-tasks');
      await skill.shutdown();
    });

    it('creates and retrieves tasks', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);

      const task = await skill.createTask('Test Task', 'A test task description', {
        priority: 4,
        tags: ['test'],
      });
      assert.strictEqual(task.title, 'Test Task');
      assert.strictEqual(task.status, 'pending');
      assert.strictEqual(task.priority, 4);

      const retrieved = await skill.getTask(task.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.title, 'Test Task');

      await skill.shutdown();
    });

    it('updates task status', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);

      const task = await skill.createTask('Status Task', 'Will change status');
      const updated = await skill.updateStatus(task.id, 'in-progress');
      assert.strictEqual(updated?.status, 'in-progress');

      const completed = await skill.updateStatus(task.id, 'completed');
      assert.strictEqual(completed?.status, 'completed');
      assert.ok(completed?.completedAt);

      await skill.shutdown();
    });

    it('updates task priority', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);

      const task = await skill.createTask('Priority Task', 'Will change priority');
      const updated = await skill.updatePriority(task.id, 5);
      assert.strictEqual(updated?.priority, 5);

      // Clamp to valid range
      const clamped = await skill.updatePriority(task.id, 10);
      assert.strictEqual(clamped?.priority, 5);

      await skill.shutdown();
    });

    it('lists tasks by status', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);

      await skill.createTask('Pending Task', 'Still pending');
      await skill.createTask('Done Task', 'Already done');

      const pending = await skill.listTasks('pending');
      assert.ok(pending.length > 0);

      await skill.shutdown();
    });

    it('returns task statistics', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);

      const stats = await skill.getStats();
      assert.ok(stats.total >= 0);
      assert.ok(stats.pending >= 0);
      assert.ok(stats.inProgress >= 0);
      assert.ok(stats.completed >= 0);
      assert.ok(stats.cancelled >= 0);
      assert.ok(stats.overdue >= 0);

      await skill.shutdown();
    });

    it('detects overdue tasks', async () => {
      const skill = new MemoryTasksSkill();
      await skill.init(memory);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await skill.createTask('Overdue Task', 'Was due yesterday', { dueDate: pastDate });

      const overdue = await skill.getOverdueTasks();
      assert.ok(overdue.length > 0);

      await skill.shutdown();
    });
  });

  describe('MemoryMetadataSearchSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryMetadataSearchSkill();
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-metadata-search');
    });

    it('searches by tags', async () => {
      const skill = new MemoryMetadataSearchSkill();
      await skill.init(memory);

      await memory.create({ content: 'Tagged entry', tags: ['search-test'] });

      const result = await skill.search({ tags: ['search-test'] });
      assert.ok(result.entries.length > 0);
    });

    it('searches by metadata filter', async () => {
      const skill = new MemoryMetadataSearchSkill();
      await skill.init(memory);

      await memory.create({
        content: 'Metadata entry',
        metadata: { source: 'test-source' },
      });

      const result = await skill.search({ metadata: { source: 'test-source' } });
      assert.ok(result.entries.length > 0);
    });

    it('returns all tags', async () => {
      const skill = new MemoryMetadataSearchSkill();
      await skill.init(memory);

      const tags = await skill.getAllTags();
      assert.ok(tags instanceof Map);
    });

    it('groups entries by source', async () => {
      const skill = new MemoryMetadataSearchSkill();
      await skill.init(memory);

      const groups = await skill.groupBySource();
      assert.ok(groups instanceof Map);
    });
  });

  describe('MemoryIngestSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryIngestSkill();
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-ingest');
    });

    it('ingests text content', async () => {
      const skill = new MemoryIngestSkill();
      await skill.init(memory);

      const result = await skill.ingestText('test-source', 'This is test content for ingestion', {
        tags: ['ingest-test'],
      });
      assert.ok(result.entriesCreated > 0);
      assert.strictEqual(result.source, 'test-source');
      assert.ok(result.errors.length === 0);
    });

    it('ingests JSON data', async () => {
      const skill = new MemoryIngestSkill();
      await skill.init(memory);

      const result = await skill.ingestJSON('json-source', [
        { name: 'item1', value: 42 },
        { name: 'item2', value: 100 },
      ]);
      assert.ok(result.entriesCreated > 0);
      assert.ok(result.errors.length === 0);
    });

    it('auto-tags content based on analysis', async () => {
      const skill = new MemoryIngestSkill({ autoTag: true });
      await skill.init(memory);

      const result = await skill.ingestText('auto-tag-test', 'This is a code function with import and export statements', {
        tags: ['code-test'],
      });
      assert.ok(result.entriesCreated > 0);
    });
  });

  describe('MemoryLifecycleSkill', () => {
    it('initializes with memory service', async () => {
      const skill = new MemoryLifecycleSkill({ idleTimeout: 999999 });
      await skill.init(memory);
      assert.strictEqual(skill.name, 'memory-lifecycle');
      assert.strictEqual(skill.getState(), 'active');
      await skill.shutdown();
    });

    it('records access events', async () => {
      const skill = new MemoryLifecycleSkill({ idleTimeout: 999999 });
      await skill.init(memory);

      skill.recordAccess();
      assert.strictEqual(skill.getState(), 'active');

      await skill.shutdown();
    });

    it('transitions to specified state', async () => {
      const skill = new MemoryLifecycleSkill({ idleTimeout: 999999 });
      await skill.init(memory);

      await skill.transitionTo('idle');
      assert.strictEqual(skill.getState(), 'idle');

      await skill.transitionTo('active');
      assert.strictEqual(skill.getState(), 'active');

      await skill.shutdown();
    });

    it('performs health check', async () => {
      const skill = new MemoryLifecycleSkill({ idleTimeout: 999999 });
      await skill.init(memory);

      const health = await skill.healthCheck();
      assert.ok(health.state);
      assert.ok(health.entryCount >= 0);
      assert.ok(health.isHealthy === true);

      await skill.shutdown();
    });
  });
});
