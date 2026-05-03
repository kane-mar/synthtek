/**
 * Memory Manager Tests
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryManagerImpl } from '../../src/memory/manager.js';

describe('MemoryManagerImpl', () => {
  let manager: MemoryManagerImpl;
  let storagePath: string;

  before(async () => {
    storagePath = join(tmpdir(), `synthtek-manager-test-${Date.now()}`);
    await mkdir(storagePath, { recursive: true });

    manager = new MemoryManagerImpl({
      shortTerm: {
        maxMessages: 50,
        maxTokens: 64000,
        summarizationThreshold: 25,
      },
      longTerm: {
        storagePath,
        maxEntries: 500,
        autoConsolidate: false,
        consolidationThreshold: 250,
        searchIndexEnabled: true,
      },
    });

    await manager.init();
  });

  after(async () => {
    await manager.shutdown();
    await rm(storagePath, { recursive: true, force: true });
  });

  test('has both short-term and long-term memory', () => {
    assert.ok(manager.shortTerm);
    assert.ok(manager.longTerm);
  });

  test('short-term memory works after init', () => {
    manager.shortTerm.addMessage({
      role: 'user',
      content: 'Hello manager',
      timestamp: new Date(),
    });

    const messages = manager.shortTerm.getMessages();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, 'Hello manager');
  });

  test('long-term memory works after init', async () => {
    const entry = await manager.longTerm.create({
      content: 'Manager persistence test',
    });

    assert.ok(entry.id);
    assert.equal(entry.content, 'Manager persistence test');
  });

  test('shutdown saves long-term data', async () => {
    const entry = await manager.longTerm.create({
      content: 'Before shutdown',
    });

    await manager.shutdown();

    // Create new manager and verify data persists
    const newManager = new MemoryManagerImpl({
      longTerm: {
        storagePath,
        autoConsolidate: false,
        maxEntries: 500,
        consolidationThreshold: 250,
        searchIndexEnabled: true,
      },
    });
    await newManager.init();

    const reloaded = await newManager.longTerm.get(entry.id);
    assert.ok(reloaded);
    assert.equal(reloaded.content, 'Before shutdown');

    await newManager.shutdown();
  });

  test('short-term stats work', () => {
    const stats = manager.shortTerm.getStats();
    assert.ok('messageCount' in stats);
    assert.ok('totalTokens' in stats);
    assert.ok('summaryCount' in stats);
  });

  test('long-term stats work', async () => {
    const stats = await manager.longTerm.getStats();
    assert.ok('totalEntries' in stats);
    assert.ok('activeEntries' in stats);
    assert.ok('archivedEntries' in stats);
    assert.ok('storageSize' in stats);
  });
});
