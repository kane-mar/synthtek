/**
 * Tests for Base Provider and Provider Config Validation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateProviderConfig,
  ProviderConfigError,
} from '../../src/providers/base-provider.js';
import type { ProviderConfig } from '../../src/providers/types.js';

describe('Provider Config Validation', () => {
  const validConfig: ProviderConfig = {
    provider: 'openai',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    timeout: 60000,
    retries: 3,
    retryDelay: 1000,
  };

  describe('valid configurations', () => {
    it('should accept valid OpenAI config', () => {
      validateProviderConfig(validConfig);
    });

    it('should accept Ollama config without API key', () => {
      validateProviderConfig({
        provider: 'ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
      });
    });

    it('should accept LMStudio config without API key', () => {
      validateProviderConfig({
        provider: 'lmstudio',
        apiKey: '',
        baseUrl: 'http://localhost:1234/v1',
      });
    });

    it('should accept config with minimal fields', () => {
      validateProviderConfig({
        provider: 'openai',
        apiKey: 'test-key',
      });
    });
  });

  describe('invalid provider name', () => {
    it('should reject empty provider name', () => {
      assert.throws(
        () => validateProviderConfig({ provider: '', apiKey: 'key' }),
        ProviderConfigError,
      );
    });

    it('should reject missing provider name', () => {
      assert.throws(
        () => validateProviderConfig({ apiKey: 'key' } as ProviderConfig),
        ProviderConfigError,
      );
    });
  });

  describe('API key validation', () => {
    it('should require API key for OpenAI', () => {
      assert.throws(
        () => validateProviderConfig({ provider: 'openai', apiKey: '' }),
        ProviderConfigError,
      );
    });

    it('should require API key for Anthropic', () => {
      assert.throws(
        () => validateProviderConfig({ provider: 'anthropic', apiKey: '' }),
        ProviderConfigError,
      );
    });

    it('should allow empty API key for Ollama', () => {
      validateProviderConfig({ provider: 'ollama', apiKey: '' });
    });
  });

  describe('timeout validation', () => {
    it('should reject zero timeout', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            timeout: 0,
          }),
        ProviderConfigError,
      );
    });

    it('should reject negative timeout', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            timeout: -1000,
          }),
        ProviderConfigError,
      );
    });

    it('should reject Infinity timeout', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            timeout: Infinity,
          }),
        ProviderConfigError,
      );
    });

    it('should reject timeout exceeding maximum', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            timeout: 600_001,
          }),
        ProviderConfigError,
      );
    });

    it('should accept valid timeout', () => {
      validateProviderConfig({ ...validConfig, timeout: 30000 });
    });
  });

  describe('retries validation', () => {
    it('should reject negative retries', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            retries: -1,
          }),
        ProviderConfigError,
      );
    });

    it('should reject non-integer retries', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            retries: 2.5,
          }),
        ProviderConfigError,
      );
    });

    it('should reject excessive retries', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            retries: 11,
          }),
        ProviderConfigError,
      );
    });

    it('should accept zero retries', () => {
      validateProviderConfig({ ...validConfig, retries: 0 });
    });

    it('should accept maximum retries', () => {
      validateProviderConfig({ ...validConfig, retries: 10 });
    });
  });

  describe('retry delay validation', () => {
    it('should reject zero retry delay', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            retryDelay: 0,
          }),
        ProviderConfigError,
      );
    });

    it('should reject negative retry delay', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            retryDelay: -500,
          }),
        ProviderConfigError,
      );
    });
  });

  describe('base URL validation', () => {
    it('should reject empty base URL', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            baseUrl: '',
          }),
        ProviderConfigError,
      );
    });

    it('should reject invalid URL format', () => {
      assert.throws(
        () =>
          validateProviderConfig({
            ...validConfig,
            baseUrl: 'not-a-url',
          }),
        ProviderConfigError,
      );
    });

    it('should accept valid HTTPS URL', () => {
      validateProviderConfig({
        ...validConfig,
        baseUrl: 'https://api.openai.com/v1',
      });
    });

    it('should accept valid HTTP URL for local providers', () => {
      validateProviderConfig({
        provider: 'ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
      });
    });
  });
});

describe('ProviderConfigError', () => {
  it('should have correct name', () => {
    const err = new ProviderConfigError('test error');
    assert.strictEqual(err.name, 'ProviderConfigError');
    assert.strictEqual(err.message, 'test error');
  });

  it('should be instance of Error', () => {
    const err = new ProviderConfigError('test error');
    assert.ok(err instanceof Error);
  });
});
