/**
 * Tests for SystemdServiceManager (Linux service management via systemd)
 */

import { describe, it, beforeEach } from 'node:test';
import { ok, strictEqual, throws } from 'node:assert';
import { SystemdServiceManager } from '../../src/linux-service/service-manager.js';
import type {
  ServiceConfig,
  LogConfig,
  ResourceLimits,
} from '../../src/linux-service/types.js';

const defaultConfig: ServiceConfig = {
  name: 'synthtek-agent',
  description: 'Synthtek AI Agent Service',
  user: 'synthtek',
  group: 'synthtek',
  workingDirectory: '/opt/synthtek',
  execStart: '/usr/bin/node /opt/synthtek/dist/cli.js',
  restart: 'on-failure',
  restartSec: 5,
};

describe('SystemdServiceManager', () => {
  let manager: SystemdServiceManager;

  beforeEach(() => {
    manager = new SystemdServiceManager();
  });

  // ── generateServiceFile ────────────────────────────────────────────────────

  describe('generateServiceFile', () => {
    it('generates a valid systemd unit file with minimal config', () => {
      const content = manager.generateServiceFile(defaultConfig);

      ok(content.includes('[Unit]'), 'contains Unit section');
      ok(content.includes('[Service]'), 'contains Service section');
      ok(content.includes('[Install]'), 'contains Install section');
      ok(content.includes('Description=Synthtek AI Agent Service'), 'contains description');
      ok(content.includes('ExecStart=/usr/bin/node /opt/synthtek/dist/cli.js'), 'contains ExecStart');
      ok(content.includes('User=synthtek'), 'contains user');
      ok(content.includes('Group=synthtek'), 'contains group');
      ok(content.includes('WorkingDirectory=/opt/synthtek'), 'contains working directory');
    });

    it('includes Restart=on-failure when configured', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('Restart=on-failure'), 'contains restart policy');
    });

    it('includes RestartSec when configured', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('RestartSec=5'), 'contains restartSec');
    });

    it('includes EnvironmentFile when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        environmentFile: '/etc/synthtek/env',
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('EnvironmentFile=/etc/synthtek/env'), 'contains environment file');
    });

    it('includes Type=simple by default', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('Type=simple'), 'contains service type');
    });

    it('includes WantedBy=multi-user.target in Install section', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('WantedBy=multi-user.target'), 'contains WantedBy');
    });

    it('includes After=network.target in Unit section', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('After=network.target'), 'contains After directive');
    });

    it('includes StandardOutput=journal when journal forwarding enabled', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        logConfig: { journalForwarding: true },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('StandardOutput=journal'), 'contains StandardOutput=journal');
      ok(content.includes('StandardError=journal'), 'contains StandardError=journal');
    });

    it('includes SyslogIdentifier when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        logConfig: { journalForwarding: true },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('SyslogIdentifier=synthtek-agent'), 'contains SyslogIdentifier');
    });

    it('includes custom systemd options', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        systemdOptions: {
          TimeoutStartSec: 30,
          TimeoutStopSec: 10,
          PrivateTmp: 'true',
        },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('TimeoutStartSec=30'), 'contains custom TimeoutStartSec');
      ok(content.includes('TimeoutStopSec=10'), 'contains custom TimeoutStopSec');
      ok(content.includes('PrivateTmp=true'), 'contains custom PrivateTmp');
    });

    it('generates with minimal required fields', () => {
      const minimalConfig: ServiceConfig = {
        name: 'minimal-service',
        execStart: '/usr/bin/minimal',
      };
      const content = manager.generateServiceFile(minimalConfig);
      ok(content.includes('Description=minimal-service'), 'auto-generates description');
      ok(content.includes('ExecStart=/usr/bin/minimal'), 'contains ExecStart');
    });

    it('includes ExecStop when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        execStop: '/usr/bin/node /opt/synthtek/dist/cli.js --stop',
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('ExecStop=/usr/bin/node /opt/synthtek/dist/cli.js --stop'), 'contains ExecStop');
    });

    it('includes KillMode=mixed by default', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('KillMode=mixed'), 'contains KillMode');
    });

    it('includes RemainAfterExit=no by default', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('RemainAfterExit=no'), 'contains RemainAfterExit');
    });
  });

  // ── Resource Limits ────────────────────────────────────────────────────────

  describe('resource limits in service file', () => {
    it('includes MemoryMax when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        resourceLimits: { memoryMax: '512M' },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('MemoryMax=512M'), 'contains MemoryMax');
    });

    it('includes CPUQuota when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        resourceLimits: { cpuQuota: '50%' },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('CPUQuota=50%'), 'contains CPUQuota');
    });

    it('includes LimitNOFILE when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        resourceLimits: { limitNOFILE: 65536 },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('LimitNOFILE=65536'), 'contains LimitNOFILE');
    });

    it('includes LimitNPROC when configured', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        resourceLimits: { limitNPROC: 4096 },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('LimitNPROC=4096'), 'contains LimitNPROC');
    });

    it('includes all resource limits together', () => {
      const config: ServiceConfig = {
        ...defaultConfig,
        resourceLimits: {
          memoryMax: '1G',
          cpuQuota: '200%',
          limitNOFILE: 65536,
          limitNPROC: 4096,
        },
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('MemoryMax=1G'), 'contains MemoryMax');
      ok(content.includes('CPUQuota=200%'), 'contains CPUQuota');
      ok(content.includes('LimitNOFILE=65536'), 'contains LimitNOFILE');
      ok(content.includes('LimitNPROC=4096'), 'contains LimitNPROC');
    });
  });

  // ── configureResourceLimits ────────────────────────────────────────────────

  describe('configureResourceLimits', () => {
    it('returns resource limits configuration', () => {
      const limits: ResourceLimits = {
        memoryMax: '512M',
        cpuQuota: '50%',
        limitNOFILE: 65536,
      };
      const result = manager.configureResourceLimits(limits);

      ok(result.memoryMax === '512M', 'memoryMax set');
      ok(result.cpuQuota === '50%', 'cpuQuota set');
      ok(result.limitNOFILE === 65536, 'limitNOFILE set');
    });

    it('handles partial resource limits', () => {
      const limits: ResourceLimits = { memoryMax: '256M' };
      const result = manager.configureResourceLimits(limits);

      ok(result.memoryMax === '256M', 'memoryMax set');
      ok(result.cpuQuota === undefined, 'cpuQuota not set');
    });
  });

  // ── Log Management ─────────────────────────────────────────────────────────

  describe('log management', () => {
    it('generates log rotation config', () => {
      const logConfig: LogConfig = {
        directory: '/var/log/synthtek',
        maxFileSize: 10485760, // 10MB
        maxFiles: 5,
        compress: true,
      };
      const result = manager.configureLogging(logConfig);

      ok(result.directory === '/var/log/synthtek', 'log directory set');
      ok(result.maxFileSize === 10485760, 'maxFileSize set');
      ok(result.maxFiles === 5, 'maxFiles set');
      ok(result.compress === true, 'compress enabled');
    });

    it('uses default values for log config', () => {
      const logConfig: LogConfig = { directory: '/var/log/synthtek' };
      const result = manager.configureLogging(logConfig);

      ok(result.maxFileSize === 10485760, 'default maxFileSize');
      ok(result.maxFiles === 5, 'default maxFiles');
      ok(result.compress === true, 'default compress');
      ok(result.journalForwarding === true, 'default journalForwarding');
    });

    it('generates log rotation config content', () => {
      const logConfig: LogConfig = {
        directory: '/var/log/synthtek',
        maxFileSize: 5242880,
        maxFiles: 10,
        compress: true,
      };
      const rotationConfig = manager.generateLogRotationConfig('synthtek-agent', logConfig);

      ok(rotationConfig.path !== undefined, 'has path');
      ok(rotationConfig.content !== undefined, 'has content');
      ok(rotationConfig.content.includes('/var/log/synthtek'), 'includes log directory');
      ok(rotationConfig.content.includes('rotate 10'), 'includes rotate count');
      ok(rotationConfig.content.includes('compress'), 'includes compress directive');
    });

    it('generates log rotation without compression', () => {
      const logConfig: LogConfig = {
        directory: '/var/log/synthtek',
        compress: false,
      };
      const rotationConfig = manager.generateLogRotationConfig('synthtek-agent', logConfig);

      ok(!rotationConfig.content.includes('    compress'), 'no compress directive');
      ok(rotationConfig.content.includes('nocompress'), 'includes nocompress');
    });
  });

  // ── Environment File Generation ────────────────────────────────────────────

  describe('generateEnvFile', () => {
    it('generates environment file content from key-value pairs', () => {
      const envVars = {
        NODE_ENV: 'production',
        PORT: '3000',
        LOG_LEVEL: 'info',
      };
      const content = manager.generateEnvFile(envVars);

      ok(content.includes('NODE_ENV=production'), 'contains NODE_ENV');
      ok(content.includes('PORT=3000'), 'contains PORT');
      ok(content.includes('LOG_LEVEL=info'), 'contains LOG_LEVEL');
    });

    it('includes a header comment', () => {
      const envVars = { KEY: 'value' };
      const content = manager.generateEnvFile(envVars);

      ok(content.includes('# Environment file'), 'contains header comment');
    });

    it('handles empty environment variables', () => {
      const content = manager.generateEnvFile({});
      ok(content.includes('# Environment file'), 'still has header');
    });

    it('quotes values with spaces', () => {
      const envVars = {
        PATH: '/usr/local/bin:/usr/bin',
        GREETING: 'hello world',
      };
      const content = manager.generateEnvFile(envVars);

      ok(content.includes('GREETING="hello world"'), 'quotes values with spaces');
    });
  });

  // ── Service State Monitoring ───────────────────────────────────────────────

  describe('parseServiceState', () => {
    it('parses active state from systemctl output', () => {
      const output = `● synthtek-agent.service - Synthtek AI Agent Service
     Loaded: loaded (/etc/systemd/system/synthtek-agent.service; enabled; preset: disabled)
     Active: active (running) since Mon 2024-01-01 00:00:00 UTC; 1h ago
   Main PID: 12345 (node)
      Memory: 45.2M
         CPU: 1.500s
     CGroup: /system.slice/synthtek-agent.service`;

      const state = manager.parseServiceState(output);

      strictEqual(state.state, 'active');
      strictEqual(state.subState, 'running');
      strictEqual(state.pid, 12345);
      ok(state.memory !== undefined, 'has memory');
      ok(state.cpu !== undefined, 'has cpu');
    });

    it('parses inactive state', () => {
      const output = `● synthtek-agent.service - Synthtek AI Agent Service
     Loaded: loaded (/etc/systemd/system/synthtek-agent.service; disabled; preset: disabled)
     Active: inactive (dead)`;

      const state = manager.parseServiceState(output);

      strictEqual(state.state, 'inactive');
      strictEqual(state.subState, 'dead');
    });

    it('parses failed state', () => {
      const output = `● synthtek-agent.service - Synthtek AI Agent Service
     Loaded: loaded (/etc/systemd/system/synthtek-agent.service; enabled; preset: disabled)
     Active: failed (Result: exit-code) since Mon 2024-01-01 00:00:00 UTC; 1h ago
   Main PID: 12345 (code=exited, status=1/FAILURE)`;

      const state = manager.parseServiceState(output);

      strictEqual(state.state, 'failed');
    });

    it('parses activating state', () => {
      const output = `● synthtek-agent.service - Synthtek AI Agent Service
     Active: activating (start) since Mon 2024-01-01 00:00:00 UTC`;

      const state = manager.parseServiceState(output);

      strictEqual(state.state, 'activating');
    });

    it('returns unknown state for unrecognized output', () => {
      const state = manager.parseServiceState('some random output');

      strictEqual(state.state, 'unknown');
    });

    it('includes service name in parsed state', () => {
      const output = `● synthtek-agent.service - Synthtek AI Agent Service
     Active: active (running) since Mon 2024-01-01 00:00:00 UTC; 1h ago`;

      const state = manager.parseServiceState(output);

      strictEqual(state.name, 'synthtek-agent');
    });
  });

  // ── Service Name Helpers ───────────────────────────────────────────────────

  describe('service name helpers', () => {
    it('appends .service suffix', () => {
      const managerWithName = new SystemdServiceManager({ serviceName: 'my-service' });
      strictEqual(managerWithName.serviceUnitName, 'my-service.service');
    });

    it('uses default service name', () => {
      strictEqual(manager.serviceUnitName, 'synthtek-agent.service');
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws on missing execStart in config', () => {
      const invalidConfig: ServiceConfig = {
        name: 'broken-service',
      } as ServiceConfig;

      throws(
        () => manager.generateServiceFile(invalidConfig),
        /execStart is required/
      );
    });

    it('throws on empty service name', () => {
      const invalidConfig: ServiceConfig = {
        name: '',
        execStart: '/usr/bin/test',
      };

      throws(
        () => manager.generateServiceFile(invalidConfig),
        /name is required/
      );
    });

    it('throws on missing execStart for install', () => {
      const invalidConfig: ServiceConfig = {
        name: 'broken-service',
      } as ServiceConfig;

      // install calls generateServiceFile internally which should throw
      // We test via generateServiceFile since install requires filesystem access
      throws(
        () => manager.generateServiceFile(invalidConfig),
        /execStart is required/
      );
    });
  });

  // ── Service File Path ──────────────────────────────────────────────────────

  describe('service file path', () => {
    it('returns correct systemd path', () => {
      const managerWithName = new SystemdServiceManager({ serviceName: 'my-service' });
      strictEqual(managerWithName.serviceFilePath, '/etc/systemd/system/my-service.service');
    });

    it('uses custom systemd path when provided', () => {
      const managerWithCustomPath = new SystemdServiceManager({
        serviceName: 'my-service',
        systemdPath: '/custom/systemd/path',
      });
      strictEqual(managerWithCustomPath.serviceFilePath, '/custom/systemd/path/my-service.service');
    });
  });

  // ── Restart Policy Validation ──────────────────────────────────────────────

  describe('restart policy', () => {
    const policies: Array<'no' | 'always' | 'on-failure' | 'on-abnormal' | 'on-abort' | 'on-watchdog'> = [
      'no',
      'always',
      'on-failure',
      'on-abnormal',
      'on-abort',
      'on-watchdog',
    ];

    it('accepts all valid restart policies', () => {
      for (const policy of policies) {
        const config: ServiceConfig = {
          ...defaultConfig,
          restart: policy,
        };
        const content = manager.generateServiceFile(config);
        ok(content.includes(`Restart=${policy}`), `accepts restart policy: ${policy}`);
      }
    });

    it('defaults to no restart when not specified', () => {
      const config: ServiceConfig = {
        name: 'test-service',
        execStart: '/usr/bin/test',
      };
      const content = manager.generateServiceFile(config);
      ok(content.includes('Restart=no'), 'defaults to Restart=no');
    });
  });

  // ── Service File Structure ─────────────────────────────────────────────────

  describe('service file structure', () => {
    it('has proper section ordering: Unit, Service, Install', () => {
      const content = manager.generateServiceFile(defaultConfig);
      const unitIndex = content.indexOf('[Unit]');
      const serviceIndex = content.indexOf('[Service]');
      const installIndex = content.indexOf('[Install]');

      ok(unitIndex < serviceIndex, 'Unit before Service');
      ok(serviceIndex < installIndex, 'Service before Install');
    });

    it('includes documentation link in Unit section', () => {
      const content = manager.generateServiceFile(defaultConfig);
      ok(content.includes('Documentation='), 'contains Documentation directive');
    });
  });
});
