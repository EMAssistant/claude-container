/**
 * Unit tests for logger utility
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.16: Backend logs include session context and timestamp
 * AC4.5: Sensitive data filtering in logs
 *
 * Note: These tests verify the logger API contracts and helpers.
 * Full output verification is done in integration tests.
 */

import { logger, createSessionLogger, logWithSession, logSessionEvent, logSessionError } from './logger';
import { sanitizeLog } from './sanitizeLog';

describe('logger', () => {
  describe('basic logging API', () => {
    it('should provide info method', () => {
      expect(typeof logger.info).toBe('function');
      expect(() => logger.info('Test message')).not.toThrow();
    });

    it('should provide error method', () => {
      expect(typeof logger.error).toBe('function');
      expect(() => logger.error('Error message')).not.toThrow();
    });

    it('should provide warn method', () => {
      expect(typeof logger.warn).toBe('function');
      expect(() => logger.warn('Warning message')).not.toThrow();
    });

    it('should provide debug method', () => {
      expect(typeof logger.debug).toBe('function');
      expect(() => logger.debug('Debug message')).not.toThrow();
    });
  });

  describe('structured logging with metadata', () => {
    it('should accept metadata object without throwing', () => {
      expect(() => {
        logger.info('Test message', { sessionId: 'abc-123', operation: 'create' });
      }).not.toThrow();
    });

    it('should accept error with stack traces', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error('Error occurred', { error: error.message, stack: error.stack });
      }).not.toThrow();
    });
  });

  describe('sensitive data filtering integration', () => {
    it('should sanitize sensitive fields correctly', () => {
      const logData = {
        message: 'User login',
        username: 'alice',
        password: 'secret123',
        api_key: 'secret-key'
      };
      const sanitized = sanitizeLog(logData);
      expect(sanitized.username).toBe('alice');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
    });

    it('should preserve sessionId when sanitizing', () => {
      const logData = {
        message: 'Session event',
        sessionId: 'session-123',
        token: 'secret-token'
      };
      const sanitized = sanitizeLog(logData);
      expect(sanitized.sessionId).toBe('session-123');
      expect(sanitized.token).toBe('[REDACTED]');
    });
  });

  describe('createSessionLogger', () => {
    it('should create child logger with sessionId', () => {
      const sessionLogger = createSessionLogger('session-123');
      expect(sessionLogger).toBeDefined();
      expect(typeof sessionLogger.info).toBe('function');
    });

    it('should not throw when logging with child logger', () => {
      const sessionLogger = createSessionLogger('session-456');
      expect(() => {
        sessionLogger.info('Session event');
        sessionLogger.warn('Warning');
        sessionLogger.error('Error');
      }).not.toThrow();
    });

    it('should accept additional metadata with child logger', () => {
      const sessionLogger = createSessionLogger('session-789');
      expect(() => {
        sessionLogger.info('Event with metadata', { operation: 'create', status: 'success' });
      }).not.toThrow();
    });
  });

  describe('logWithSession', () => {
    it('should log info with sessionId', () => {
      expect(() => {
        logWithSession('info', 'Status changed', 'session-abc', { from: 'idle', to: 'active' });
      }).not.toThrow();
    });

    it('should log error with sessionId', () => {
      expect(() => {
        logWithSession('error', 'PTY crashed', 'session-xyz', { exitCode: 1 });
      }).not.toThrow();
    });

    it('should log warn with sessionId', () => {
      expect(() => {
        logWithSession('warn', 'Session idle', 'session-123', { idleTime: 300 });
      }).not.toThrow();
    });

    it('should log debug with sessionId', () => {
      expect(() => {
        logWithSession('debug', 'Debug info', 'session-123', { detail: 'some detail' });
      }).not.toThrow();
    });

    it('should work without additional metadata', () => {
      expect(() => {
        logWithSession('info', 'Simple message', 'session-456');
      }).not.toThrow();
    });
  });

  describe('logSessionEvent', () => {
    it('should log session created event', () => {
      expect(() => {
        logSessionEvent('created', 'session-123', { name: 'feature-auth', branch: 'feature/auth' });
      }).not.toThrow();
    });

    it('should log session destroyed event', () => {
      expect(() => {
        logSessionEvent('destroyed', 'session-456', { cleanup: true });
      }).not.toThrow();
    });

    it('should work without metadata', () => {
      expect(() => {
        logSessionEvent('resumed', 'session-789');
      }).not.toThrow();
    });

    it('should handle various event types', () => {
      const events = ['created', 'destroyed', 'resumed', 'updated', 'crashed'];
      events.forEach(event => {
        expect(() => {
          logSessionEvent(event, 'session-test');
        }).not.toThrow();
      });
    });
  });

  describe('logSessionError', () => {
    it('should log session error with Error object', () => {
      const error = new Error('Connection failed');
      expect(() => {
        logSessionError('creation', 'session-123', error, { attemptNumber: 1 });
      }).not.toThrow();
    });

    it('should log session error with string message', () => {
      expect(() => {
        logSessionError('destruction', 'session-456', 'Cleanup failed');
      }).not.toThrow();
    });

    it('should handle undefined sessionId', () => {
      expect(() => {
        logSessionError('operation', undefined, 'Generic error');
      }).not.toThrow();
    });

    it('should work without additional metadata', () => {
      expect(() => {
        logSessionError('operation', 'session-123', 'Some error');
      }).not.toThrow();
    });

    it('should handle various error types', () => {
      const error1 = new Error('Error with stack');
      const error2 = new TypeError('Type error');
      const error3 = 'String error';

      expect(() => {
        logSessionError('test1', 'session-1', error1);
        logSessionError('test2', 'session-2', error2);
        logSessionError('test3', 'session-3', error3);
      }).not.toThrow();
    });
  });

  describe('log level configuration', () => {
    it('should have appropriate log level based on environment', () => {
      expect(logger.level).toBeDefined();
      expect(typeof logger.level).toBe('string');
      // In test environment, level should be 'debug' or 'info'
      expect(['debug', 'info', 'warn', 'error']).toContain(logger.level);
    });
  });

  describe('logger configuration', () => {
    it('should have default metadata with service name', () => {
      expect(logger.defaultMeta).toBeDefined();
      expect(logger.defaultMeta).toHaveProperty('service');
      expect(logger.defaultMeta.service).toBe('claude-container');
    });

    it('should have transports configured', () => {
      expect(logger.transports).toBeDefined();
      expect(logger.transports.length).toBeGreaterThan(0);
    });
  });

  describe('logger API compliance', () => {
    it('should implement Winston Logger interface', () => {
      // Verify essential Winston Logger methods exist
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.child).toBe('function');
    });

    it('should support log method with level parameter', () => {
      expect(() => {
        logger.log('info', 'Test message');
        logger.log('error', 'Error message');
        logger.log('warn', 'Warning message');
      }).not.toThrow();
    });
  });
});
