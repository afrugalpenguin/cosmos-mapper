import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchesPattern, shouldIncludeContainer, loadConfig, getDefaultConfig } from '../../src/config/index.js';

describe('config', () => {
  describe('matchesPattern', () => {
    it('should return false for empty patterns', () => {
      expect(matchesPattern('orders', [])).toBe(false);
      expect(matchesPattern('orders', null)).toBe(false);
      expect(matchesPattern('orders', undefined)).toBe(false);
    });

    it('should match exact names', () => {
      expect(matchesPattern('orders', ['orders'])).toBe(true);
      expect(matchesPattern('orders', ['products'])).toBe(false);
    });

    it('should match wildcard prefix (*-archive)', () => {
      expect(matchesPattern('orders-archive', ['*-archive'])).toBe(true);
      expect(matchesPattern('products-archive', ['*-archive'])).toBe(true);
      expect(matchesPattern('orders', ['*-archive'])).toBe(false);
    });

    it('should match wildcard suffix (test-*)', () => {
      expect(matchesPattern('test-orders', ['test-*'])).toBe(true);
      expect(matchesPattern('test-products', ['test-*'])).toBe(true);
      expect(matchesPattern('orders', ['test-*'])).toBe(false);
    });

    it('should match multiple patterns', () => {
      expect(matchesPattern('orders-archive', ['test-*', '*-archive'])).toBe(true);
      expect(matchesPattern('test-data', ['test-*', '*-archive'])).toBe(true);
      expect(matchesPattern('orders', ['test-*', '*-archive'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(matchesPattern('Orders', ['orders'])).toBe(true);
      expect(matchesPattern('ORDERS', ['orders'])).toBe(true);
      expect(matchesPattern('orders', ['ORDERS'])).toBe(true);
    });

    it('should match single character wildcard (?)', () => {
      expect(matchesPattern('order1', ['order?'])).toBe(true);
      expect(matchesPattern('orders', ['order?'])).toBe(true);
      expect(matchesPattern('order12', ['order?'])).toBe(false);
    });
  });

  describe('shouldIncludeContainer', () => {
    it('should include all containers when no patterns specified', () => {
      const config = { containers: { include: [], exclude: [] } };
      expect(shouldIncludeContainer('orders', config)).toBe(true);
      expect(shouldIncludeContainer('products', config)).toBe(true);
    });

    it('should exclude containers matching exclude patterns', () => {
      const config = { containers: { include: [], exclude: ['*-archive'] } };
      expect(shouldIncludeContainer('orders', config)).toBe(true);
      expect(shouldIncludeContainer('orders-archive', config)).toBe(false);
    });

    it('should only include containers matching include patterns when specified', () => {
      const config = { containers: { include: ['orders', 'products'], exclude: [] } };
      expect(shouldIncludeContainer('orders', config)).toBe(true);
      expect(shouldIncludeContainer('products', config)).toBe(true);
      expect(shouldIncludeContainer('customers', config)).toBe(false);
    });

    it('should apply exclude patterns even when include patterns match', () => {
      const config = { containers: { include: ['*'], exclude: ['*-archive'] } };
      expect(shouldIncludeContainer('orders', config)).toBe(true);
      expect(shouldIncludeContainer('orders-archive', config)).toBe(false);
    });

    it('should handle missing containers config', () => {
      expect(shouldIncludeContainer('orders', {})).toBe(true);
      expect(shouldIncludeContainer('orders', { containers: {} })).toBe(true);
      expect(shouldIncludeContainer('orders', { containers: null })).toBe(true);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const defaults = getDefaultConfig();

      expect(defaults.output).toBe('./output');
      expect(defaults.sampleSize).toBe(100);
      expect(defaults.databases).toEqual([]);
      expect(defaults.containers.include).toEqual([]);
      expect(defaults.containers.exclude).toEqual([]);
      expect(defaults.formats).toContain('markdown');
      expect(defaults.formats).toContain('html');
    });

    it('should return a copy (not the original)', () => {
      const defaults1 = getDefaultConfig();
      const defaults2 = getDefaultConfig();

      defaults1.output = '/changed';

      expect(defaults2.output).toBe('./output');
    });
  });

  describe('loadConfig', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Set required env var
      process.env.COSMOS_ENDPOINT = 'https://test.cosmos.azure.com';
      process.env.COSMOS_KEY = 'test-key';
    });

    afterEach(() => {
      // Restore original env
      process.env = { ...originalEnv };
    });

    it('should load defaults when no config file exists', async () => {
      const config = await loadConfig(['--config', 'nonexistent.json']);

      expect(config.output).toBe('./output');
      expect(config.sampleSize).toBe(100);
      expect(config.formats).toContain('markdown');
    });

    it('should parse CLI arguments', async () => {
      const config = await loadConfig([
        '--output', './docs',
        '--sample-size', '50',
        '--databases', 'db1,db2'
      ]);

      expect(config.output).toBe('./docs');
      expect(config.sampleSize).toBe(50);
      expect(config.databases).toEqual(['db1', 'db2']);
    });

    it('should parse format CLI argument', async () => {
      const config = await loadConfig(['--format', 'markdown']);

      expect(config.formats).toEqual(['markdown']);
    });

    it('should use environment variables', async () => {
      process.env.DATABASES = 'envdb1, envdb2';
      process.env.SAMPLE_SIZE = '200';
      process.env.OUTPUT_DIR = './env-output';

      const config = await loadConfig([]);

      expect(config.databases).toEqual(['envdb1', 'envdb2']);
      expect(config.sampleSize).toBe(200);
      expect(config.output).toBe('./env-output');
    });

    it('should give CLI args precedence over env vars', async () => {
      process.env.SAMPLE_SIZE = '200';

      const config = await loadConfig(['--sample-size', '50']);

      expect(config.sampleSize).toBe(50);
    });

    it('should throw on missing endpoint', async () => {
      delete process.env.COSMOS_ENDPOINT;

      await expect(loadConfig([])).rejects.toThrow('endpoint is required');
    });

    it('should throw on invalid sample size', async () => {
      await expect(loadConfig(['--sample-size', '-5'])).rejects.toThrow('sampleSize must be a positive number');
    });

    it('should throw on invalid format', async () => {
      await expect(loadConfig(['--format', 'pdf'])).rejects.toThrow('invalid formats: pdf');
    });

    it('should parse --quiet flag', async () => {
      const config = await loadConfig(['--quiet']);
      expect(config.logLevel).toBe('quiet');
    });

    it('should parse -q shorthand for quiet', async () => {
      const config = await loadConfig(['-q']);
      expect(config.logLevel).toBe('quiet');
    });

    it('should parse --verbose flag', async () => {
      const config = await loadConfig(['--verbose']);
      expect(config.logLevel).toBe('verbose');
    });

    it('should parse -v shorthand for verbose', async () => {
      const config = await loadConfig(['-v']);
      expect(config.logLevel).toBe('verbose');
    });

    it('should parse --watch flag', async () => {
      const config = await loadConfig(['--watch']);
      expect(config.watch).toBe(true);
    });

    it('should parse -w shorthand for watch', async () => {
      const config = await loadConfig(['-w']);
      expect(config.watch).toBe(true);
    });

    it('should parse --container flag', async () => {
      const config = await loadConfig(['--container', 'orders']);
      expect(config.container).toBe('orders');
    });

    it('should default logLevel to normal', async () => {
      const config = await loadConfig([]);
      expect(config.logLevel).toBe('normal');
    });

    it('should default watch to false', async () => {
      const config = await loadConfig([]);
      expect(config.watch).toBe(false);
    });

    it('should default container to null', async () => {
      const config = await loadConfig([]);
      expect(config.container).toBeNull();
    });
  });
});
