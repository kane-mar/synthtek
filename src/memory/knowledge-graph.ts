/**
 * Knowledge Graph — stores and queries knowledge as a graph of nodes and edges
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphConfig,
  KnowledgeGraphService,
} from './types.js';

export class KnowledgeGraphImpl implements KnowledgeGraphService {
  private readonly config: KnowledgeGraphConfig;
  private readonly nodes: Map<string, KnowledgeNode> = new Map();
  private readonly edges: Map<string, KnowledgeEdge> = new Map();
  // Adjacency list: nodeId -> edgeId[]
  private readonly adjacency: Map<string, string[]> = new Map();

  constructor(config: KnowledgeGraphConfig) {
    this.config = config;
  }

  /**
   * Add a node to the graph.
   */
  addNode(label: string, type: string, properties?: Record<string, string>): KnowledgeNode {
    const id = randomUUID();
    const node: KnowledgeNode = {
      id,
      label,
      type,
      properties: properties ?? {},
      createdAt: new Date(),
    };

    this.nodes.set(id, node);
    this.adjacency.set(id, []);
    return node;
  }

  /**
   * Add an edge between two nodes.
   */
  addEdge(
    source: string,
    target: string,
    relation: string,
    properties?: Record<string, string>,
  ): KnowledgeEdge {
    const id = randomUUID();
    const edge: KnowledgeEdge = {
      id,
      source,
      target,
      relation,
      properties: properties ?? {},
    };

    this.edges.set(id, edge);

    // Update adjacency list
    const sourceEdges = this.adjacency.get(source) ?? [];
    sourceEdges.push(id);
    this.adjacency.set(source, sourceEdges);

    return edge;
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): KnowledgeNode | null {
    return this.nodes.get(id) ?? null;
  }

  /**
   * Get neighboring nodes connected to a given node.
   */
  getNeighbors(nodeId: string, relation?: string): KnowledgeNode[] {
    const edgeIds = this.adjacency.get(nodeId) ?? [];
    const neighbors: KnowledgeNode[] = [];

    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;

      if (relation && edge.relation !== relation) continue;

      const neighbor = this.nodes.get(edge.target);
      if (neighbor && !neighbors.some((n) => n.id === neighbor.id)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  /**
   * Query the graph by traversing a path pattern.
   * Path format: "NodeType1->Relation->NodeType2->Relation->NodeType3"
   */
  query(path: string): KnowledgeNode[] {
    const segments = path.split('->').map((s) => s.trim());
    if (segments.length < 1) return [];

    // Start with all nodes matching the first type
    let currentNodes = this.filterNodesByType(segments[0]);

    // Traverse the path
    for (let i = 1; i < segments.length; i += 2) {
      const relation = segments[i];
      const nextType = segments[i + 1];

      const nextNodes: KnowledgeNode[] = [];
      for (const node of currentNodes) {
        const neighbors = this.getNeighbors(node.id, relation);
        for (const neighbor of neighbors) {
          if (!nextType || neighbor.type === nextType) {
            if (!nextNodes.some((n) => n.id === neighbor.id)) {
              nextNodes.push(neighbor);
            }
          }
        }
      }

      currentNodes = nextNodes;
    }

    return currentNodes;
  }

  /**
   * Export the graph as a markdown representation.
   */
  toMarkdown(): string {
    const lines: string[] = [];
    lines.push('# Knowledge Graph');
    lines.push('');

    // Nodes
    lines.push('## Nodes');
    lines.push('');
    for (const node of this.nodes.values()) {
      lines.push(`- **${node.label}** (${node.type})`);
      if (Object.keys(node.properties).length > 0) {
        for (const [key, value] of Object.entries(node.properties)) {
          lines.push(`  - ${key}: ${value}`);
        }
      }
    }
    lines.push('');

    // Edges
    lines.push('## Edges');
    lines.push('');
    for (const edge of this.edges.values()) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      const sourceLabel = sourceNode?.label ?? edge.source;
      const targetLabel = targetNode?.label ?? edge.target;
      lines.push(`- ${sourceLabel} --[${edge.relation}]--> ${targetLabel}`);
    }
    lines.push('');

    // Stats
    lines.push('## Statistics');
    lines.push('');
    lines.push(`- Nodes: ${this.nodes.size}`);
    lines.push(`- Edges: ${this.edges.size}`);

    return lines.join('\n');
  }

  /**
   * Save the graph to disk.
   */
  async save(): Promise<void> {
    const data = {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };

    await writeFile(
      this.config.storagePath + '/knowledge-graph.json',
      JSON.stringify(data, null, 2),
    );
  }

  /**
   * Load the graph from disk.
   */
  async load(): Promise<void> {
    try {
      const data = JSON.parse(
        await readFile(this.config.storagePath + '/knowledge-graph.json', 'utf-8'),
      ) as { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };

      for (const node of data.nodes) {
        node.createdAt = new Date(node.createdAt);
        this.nodes.set(node.id, node);
        this.adjacency.set(node.id, []);
      }

      for (const edge of data.edges) {
        this.edges.set(edge.id, edge);
        const sourceEdges = this.adjacency.get(edge.source) ?? [];
        sourceEdges.push(edge.id);
        this.adjacency.set(edge.source, sourceEdges);
      }
    } catch {
      // No existing data, start fresh
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private filterNodesByType(type: string): KnowledgeNode[] {
    if (!type) return Array.from(this.nodes.values());
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }
}
