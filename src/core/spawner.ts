/**
 * Agent spawner service for running background tasks
 */

import { SpawnerService, SpawnOptions, SpawnedAgent } from './types.js';
import { spawn as spawnChild } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export class AgentSpawner implements SpawnerService {
  private runningAgents: Map<string, SpawnedAgent> = new Map();

  async spawn(options: SpawnOptions): Promise<SpawnedAgent> {
    const { name, task, workspace = process.cwd(), timeout = 300 } = options;
    const id = randomUUID();

    const agent: SpawnedAgent = {
      id,
      name: name ?? `agent-${id.slice(0, 8)}`,
      pid: null,
      status: 'running',
      task,
      output: '',
      startTime: new Date(),
    };

    this.runningAgents.set(id, agent);

    return new Promise((resolve) => {
      const child = spawnChild('node', ['src/cli.ts', '--task', task], {
        cwd: workspace,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NANOBOT_AGENT_ID: id },
      });

      agent.pid = child.pid ?? null;

      let output = '';
      const maxOutput = 100000;

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        if (output.length > maxOutput) {
          output = output.slice(-maxOutput);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.on('close', (code: number | null) => {
        agent.output = output;
        agent.endTime = new Date();

        if (code === 0) {
          agent.status = 'completed';
        } else if (code === null) {
          agent.status = 'failed';
          agent.error = 'Process terminated unexpectedly';
        } else {
          agent.status = 'failed';
          agent.error = `Exit code: ${code}`;
        }

        this.runningAgents.delete(id);
        resolve(agent);
      });

      // Timeout handling
      setTimeout(() => {
        if (agent.status === 'running') {
          agent.status = 'timeout';
          agent.error = `Task timed out after ${timeout}s`;
          child.kill('SIGTERM');
          resolve(agent);
        }
      }, timeout * 1000);
    });
  }

  getAgent(id: string): SpawnedAgent | undefined {
    return this.runningAgents.get(id);
  }

  listAgents(): SpawnedAgent[] {
    return Array.from(this.runningAgents.values());
  }
}
