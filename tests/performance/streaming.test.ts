/**
 * Tests for StreamOptimizer (streaming optimization)
 */

import { describe, it, beforeEach } from 'node:test';
import { equal, ok } from 'node:assert';
import { StreamOptimizer } from '../../src/performance/streaming.js';
import type { StreamingConfig, StreamChunk } from '../../src/performance/types.js';

const defaultConfig: StreamingConfig = {
  chunkSize: 100,
  flushIntervalMs: 50,
  maxBufferedChunks: 10,
  enableCompression: false,
};

describe('StreamOptimizer', () => {
  let optimizer: StreamOptimizer;

  beforeEach(() => {
    optimizer = new StreamOptimizer(defaultConfig);
  });

  describe('buffer and flush', () => {
    it('buffers chunks before flushing', async () => {
      const flushed: StreamChunk[] = [];

      optimizer.onFlush((chunks) => {
        flushed.push(...chunks);
      });

      optimizer.push('Hello');
      optimizer.push('World');

      await optimizer.flush();

      ok(flushed.length >= 2, 'chunks flushed');
    });

    it('auto-flushes when buffer full', async () => {
      const smallOptimizer = new StreamOptimizer({
        ...defaultConfig,
        maxBufferedChunks: 3,
      });

      const flushed: StreamChunk[] = [];
      smallOptimizer.onFlush((chunks) => {
        flushed.push(...chunks);
      });

      smallOptimizer.push('chunk1');
      smallOptimizer.push('chunk2');
      smallOptimizer.push('chunk3'); // should trigger auto-flush

      ok(flushed.length > 0, 'auto-flush triggered');
    });
  });

  describe('chunk splitting', () => {
    it('splits large content into chunks', () => {
      const largeContent = 'x'.repeat(300);
      const chunks = optimizer.splitChunk(largeContent);

      ok(chunks.length > 1, 'content split into multiple chunks');
      for (const chunk of chunks) {
        ok(chunk.content.length <= defaultConfig.chunkSize, 'chunk within size limit');
      }
    });

    it('returns single chunk for small content', () => {
      const smallContent = 'Hello';
      const chunks = optimizer.splitChunk(smallContent);

      equal(chunks.length, 1, 'single chunk for small content');
    });
  });

  describe('stats', () => {
    it('tracks streaming stats', async () => {
      optimizer.push('test1');
      optimizer.push('test2');
      await optimizer.flush();

      const stats = optimizer.stats();
      ok(stats.totalChunks >= 2, 'chunks tracked');
      ok(stats.totalBytes > 0, 'bytes tracked');
    });
  });

  describe('compression', () => {
    it('enables compression when configured', () => {
      const compressedOptimizer = new StreamOptimizer({
        ...defaultConfig,
        enableCompression: true,
      });

      ok(compressedOptimizer.compressionEnabled, 'compression enabled');
    });
  });

  describe('drain', () => {
    it('drains all buffered chunks', async () => {
      const flushed: StreamChunk[] = [];
      optimizer.onFlush((chunks) => {
        flushed.push(...chunks);
      });

      optimizer.push('a');
      optimizer.push('b');
      optimizer.push('c');

      await optimizer.drain();

      ok(flushed.length >= 3, 'all chunks drained');
    });
  });
});
