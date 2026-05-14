/**
 * Tests for Knowledge Graph
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { KnowledgeGraphImpl } from '../../src/memory/knowledge-graph.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('KnowledgeGraphImpl', () => {
  let tempDir: string;
  let graph: KnowledgeGraphImpl;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'synthtek-graph-test-'));
    graph = new KnowledgeGraphImpl({ storagePath: tempDir });
    await graph.load();
  });

  after(async () => {
    await graph.save();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('addNode', () => {
    it('should add a node with label and type', () => {
      const node = graph.addNode('John', 'Person');
      assert.ok(node.id);
      assert.strictEqual(node.label, 'John');
      assert.strictEqual(node.type, 'Person');
      assert.ok(node.createdAt);
    });

    it('should add a node with properties', () => {
      const node = graph.addNode('Google', 'Organization', { industry: 'Technology' });
      assert.strictEqual(node.properties.industry, 'Technology');
    });
  });

  describe('addEdge', () => {
    it('should add an edge between two nodes', () => {
      const person = graph.addNode('Alice', 'Person');
      const org = graph.addNode('Microsoft', 'Organization');

      const edge = graph.addEdge(person.id, org.id, 'works_at');
      assert.ok(edge.id);
      assert.strictEqual(edge.source, person.id);
      assert.strictEqual(edge.target, org.id);
      assert.strictEqual(edge.relation, 'works_at');
    });
  });

  describe('getNode', () => {
    it('should retrieve a node by ID', () => {
      const node = graph.addNode('Test', 'Concept');
      const retrieved = graph.getNode(node.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.id, node.id);
    });

    it('should return null for non-existent node', () => {
      const retrieved = graph.getNode('non-existent-id');
      assert.strictEqual(retrieved, null);
    });
  });

  describe('getNeighbors', () => {
    it('should return connected nodes', () => {
      const person = graph.addNode('Bob', 'Person');
      const location = graph.addNode('London', 'Location');
      graph.addEdge(person.id, location.id, 'lives_in');

      const neighbors = graph.getNeighbors(person.id);
      assert.strictEqual(neighbors.length, 1);
      assert.strictEqual(neighbors[0].id, location.id);
    });

    it('should filter by relation', () => {
      const person = graph.addNode('Charlie', 'Person');
      const org1 = graph.addNode('Apple', 'Organization');
      const org2 = graph.addNode('Amazon', 'Organization');
      graph.addEdge(person.id, org1.id, 'works_at');
      graph.addEdge(person.id, org2.id, 'invested_in');

      const workNeighbors = graph.getNeighbors(person.id, 'works_at');
      assert.strictEqual(workNeighbors.length, 1);
      assert.strictEqual(workNeighbors[0].id, org1.id);
    });
  });

  describe('query', () => {
    it('should query by path pattern', () => {
      const person = graph.addNode('David', 'Person');
      const org = graph.addNode('Netflix', 'Organization');
      const location = graph.addNode('Los Angeles', 'Location');
      graph.addEdge(person.id, org.id, 'works_at');
      graph.addEdge(org.id, location.id, 'located_in');

      const results = graph.query('Person->works_at->Organization->located_in->Location');
      assert.ok(results.length > 0);
      assert.strictEqual(results[0].id, location.id);
    });

    it('should return empty array for non-matching path', () => {
      const results = graph.query('Person->nonexistent->Organization');
      assert.strictEqual(results.length, 0);
    });
  });

  describe('toMarkdown', () => {
    it('should generate markdown representation', () => {
      graph.addNode('Test Node', 'TestType');
      const markdown = graph.toMarkdown();
      assert.ok(markdown.includes('# Knowledge Graph'));
      assert.ok(markdown.includes('## Nodes'));
      assert.ok(markdown.includes('## Edges'));
      assert.ok(markdown.includes('## Statistics'));
    });
  });

  describe('persistence', () => {
    it('should save and load the graph', async () => {
      const node = graph.addNode('Persisted', 'TestType');
      const node2 = graph.addNode('Persisted2', 'TestType');
      graph.addEdge(node.id, node2.id, 'related_to');
      await graph.save();

      const newGraph = new KnowledgeGraphImpl({ storagePath: tempDir });
      await newGraph.load();

      const loaded = newGraph.getNode(node.id);
      assert.ok(loaded);
      assert.strictEqual(loaded.label, 'Persisted');
    });
  });
});
