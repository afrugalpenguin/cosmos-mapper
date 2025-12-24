import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Reset to normal level before each test
    logger.setLevel('normal');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('setLevel', () => {
    it('should set level to quiet', () => {
      logger.setLevel('quiet');
      expect(logger.getLevel()).toBe('quiet');
    });

    it('should set level to verbose', () => {
      logger.setLevel('verbose');
      expect(logger.getLevel()).toBe('verbose');
    });

    it('should set level to normal by default', () => {
      logger.setLevel('anything');
      expect(logger.getLevel()).toBe('normal');
    });
  });

  describe('quiet mode', () => {
    beforeEach(() => {
      logger.setLevel('quiet');
    });

    it('should suppress info messages', () => {
      logger.info('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress success messages', () => {
      logger.success('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress section headers', () => {
      logger.section('Test Section');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress items', () => {
      logger.item('test item');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress container progress', () => {
      logger.container('orders', 100, 'ok');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress stats', () => {
      logger.stat('Containers', 5);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress done message', () => {
      logger.done('./output');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should still show error messages', () => {
      logger.error('error message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should suppress debug messages', () => {
      logger.debug('debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('normal mode', () => {
    beforeEach(() => {
      logger.setLevel('normal');
    });

    it('should show info messages', () => {
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show success messages', () => {
      logger.success('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show error messages', () => {
      logger.error('error message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should suppress debug messages', () => {
      logger.debug('debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('verbose mode', () => {
    beforeEach(() => {
      logger.setLevel('verbose');
    });

    it('should show info messages', () => {
      logger.info('test message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show debug messages', () => {
      logger.debug('debug message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show error messages', () => {
      logger.error('error message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('watch mode logging', () => {
    it('should always show watch messages regardless of level', () => {
      logger.setLevel('quiet');
      logger.watch('watching...');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
