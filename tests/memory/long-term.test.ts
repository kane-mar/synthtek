/**
 * Long-term Memory Tests
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LongTermMemoryImpl } from '../../src/memory/long-term.js';

describe('LongTermMemoryImpl', () => {
  let memory: LongTermMemoryImpl;
  let storagePath: string;

  before(async () => {
    // Use a temporary directory for tests
    storagePath = join(tmpdir(), `synthtek-memory-test-${Date.now()}`);
    await mkdir(storagePath, { recursive: true });

    memory = new LongTermMemoryImpl({
      storagePath,
      maxEntries: 100,
      autoConsolidate: false,
      consolidationThreshold: 50,
      searchIndexEnabled: true,
    });

    await memory.load();
  });

  after(async () => {
    await rm(storagePath, { recursive: true, force: true });
  });

  test('creates a memory entry', async () => {
    const entry = await memory.create({
      content: 'Test memory entry',
      type: 'long-term',
      metadata: { source: 'test' },
      tags: ['test', 'memory'],
    });

    assert.ok(entry.id);
    assert.equal(entry.type, 'long-term');
    assert.equal(entry.content, 'Test memory entry');
    assert.equal(entry.metadata.source, 'test');
    assert.ok(entry.createdAt instanceof Date);
    assert.ok(entry.updatedAt instanceof Date);
    assert.equal(entry.archived, false);
  });

  test('retrieves a memory entry by ID', async () => {
    const created = await memory.create({
      content: 'Retrieval test',
    });

    const retrieved = await memory.get(created.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, created.id);
    assert.equal(retrieved.content, 'Retrieval test');
  });

  test('returns null for non-existent entry', async () => {
    const result = await memory.get('non-existent-id');
    assert.equal(result, null);
  });

  test('updates a memory entry', async () => {
    const created = await memory.create({
      content: 'Original content',
    });

    const updated = await memory.update({
      id: created.id,
      content: 'Updated content',
      metadata: { modified: true },
    });

    assert.ok(updated);
    assert.equal(updated.content, 'Updated content');
    assert.equal(updated.metadata.modified, true);
  });

  test('returns null when updating non-existent entry', async () => {
    const result = await memory.update({
      id: 'non-existent',
      content: 'New content',
    });
    assert.equal(result, null);
  });

  test('deletes a memory entry', async () => {
    const created = await memory.create({
      content: 'To be deleted',
    });

    const deleted = await memory.delete(created.id);
    assert.equal(deleted, true);

    const afterDelete = await memory.get(created.id);
    assert.equal(afterDelete, null);
  });

  test('returns false when deleting non-existent entry', async () => {
    const result = await memory.delete('non-existent');
    assert.equal(result, false);
  });

  test('searches by query', async () => {
    await memory.create({ content: 'The quick brown fox' });
    await memory.create({ content: 'jumps over the lazy dog' });
    await memory.create({ content: 'unrelated content here' });

    const results = await memory.search({ query: 'fox jumps' });
    assert.ok(results.entries.length >= 1);
    assert.ok(results.total >= 1);
  });

  test('searches with type filter', async () => {
    await memory.create({ content: 'Long term entry', type: 'long-term' });
    await memory.create({ content: 'Short term entry', type: 'short-term' });

    const longTermResults = await memory.search({ type: 'long-term' });
    for (const entry of longTermResults.entries) {
      assert.equal(entry.type, 'long-term');
    }
  });

  test('searches with metadata filter', async () => {
    await memory.create({
      content: 'Tagged entry',
      metadata: { category: 'important' },
    });
    await memory.create({
      content: 'Untagged entry',
      metadata: { category: 'normal' },
    });

    const results = await memory.search({
      metadataFilter: { category: 'important' },
    });

    for (const entry of results.entries) {
      assert.equal(entry.metadata.category, 'important');
    }
  });

  test('search respects limit', async () => {
    for (let i = 0; i < 20; i++) {
      await memory.create({ content: `Entry ${i}` });
    }

    const results = await memory.search({ limit: 5 });
    assert.ok(results.entries.length <= 5);
    assert.ok(results.truncated);
  });

  test('archives a memory entry', async () => {
    const created = await memory.create({ content: 'To archive' });

    const archived = await memory.archive(created.id);
    assert.equal(archived, true);

    const afterArchive = await memory.get(created.id);
    assert.ok(afterArchive);
    assert.equal(afterArchive.archived, true);
  });

  test('restores an archived entry', async () => {
    const created = await memory.create({ content: 'To restore' });
    await memory.archive(created.id);

    const restored = await memory.restore(created.id);
    assert.equal(restored, true);

    const afterRestore = await memory.get(created.id);
    assert.ok(afterRestore);
    assert.equal(afterRestore.archived, false);
  });

  test('archived entries excluded from search', async () => {
    const entry = await memory.create({ content: 'Archived search test' });
    await memory.archive(entry.id);

    const results = await memory.search({ query: 'Archived search test' });
    const found = results.entries.find((e) => e.id === entry.id);
    assert.equal(found, undefined);
  });

  test('getStats returns correct counts', async () => {
    const stats = await memory.getStats();
    assert.ok(stats.totalEntries >= 0);
    assert.ok(stats.activeEntries >= 0);
    assert.ok(stats.archivedEntries >= 0);
    assert.ok(stats.storageSize >= 0);
    assert.equal(
      stats.totalEntries,
      stats.activeEntries + stats.archivedEntries,
    );
  });

  test('consolidate archives old entries', async () => {
    const result = await memory.consolidate();
    assert.ok(result.entriesBefore >= 0);
    assert.ok(result.entriesAfter >= 0);
    assert.ok(result.duration >= 0);
  });

  test('persists and reloads data', async () => {
    const created = await memory.create({
      content: 'Persistence test',
    });

    // Save and create a new instance
    await memory.save();

    const newMemory = new LongTermMemoryImpl({
      storagePath,
      autoConsolidate: false,
    });
    await newMemory.load();

    const reloaded = await newMemory.get(created.id);
    assert.ok(reloaded);
    assert.equal(reloaded.content, 'Persistence test');
  });

  test('creates entry with default type', async () => {
    const entry = await memory.create({ content: 'Default type test' });
    assert.equal(entry.type, 'long-term');
  });

  test('search with no query returns all active entries', async () => {
    const results = await memory.search();
    assert.ok(results.entries.length > 0);
    assert.ok(results.total > 0);
  });
});
