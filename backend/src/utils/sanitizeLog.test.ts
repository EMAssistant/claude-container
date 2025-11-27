/**
 * Unit tests for sanitizeLog utility
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.5: Sensitive data filtering tested
 */

import { sanitizeLog, sanitizeEnv } from './sanitizeLog';

describe('sanitizeLog', () => {
  describe('primitive values', () => {
    it('should handle null and undefined', () => {
      expect(sanitizeLog(null)).toBeNull();
      expect(sanitizeLog(undefined)).toBeUndefined();
    });

    it('should handle primitive types unchanged', () => {
      expect(sanitizeLog(42)).toBe(42);
      expect(sanitizeLog('hello')).toBe('hello');
      expect(sanitizeLog(true)).toBe(true);
    });
  });

  describe('sensitive field detection', () => {
    it('should redact api_key field', () => {
      const log = { user: 'alice', api_key: 'secret123' };
      const result = sanitizeLog(log);
      expect(result.user).toBe('alice');
      expect(result.api_key).toBe('[REDACTED]');
    });

    it('should redact apiKey field (camelCase)', () => {
      const log = { user: 'alice', apiKey: 'secret123' };
      const result = sanitizeLog(log);
      expect(result.user).toBe('alice');
      expect(result.apiKey).toBe('[REDACTED]');
    });

    it('should redact token field', () => {
      const log = { session: 'abc', token: 'jwt-token-here' };
      const result = sanitizeLog(log);
      expect(result.session).toBe('abc');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should redact password field', () => {
      const log = { username: 'alice', password: 'secret123' };
      const result = sanitizeLog(log);
      expect(result.username).toBe('alice');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should redact secret field', () => {
      const log = { name: 'app', secret: 'my-secret' };
      const result = sanitizeLog(log);
      expect(result.name).toBe('app');
      expect(result.secret).toBe('[REDACTED]');
    });

    it('should redact credential field', () => {
      const log = { user: 'alice', credential: 'cred-123' };
      const result = sanitizeLog(log);
      expect(result.user).toBe('alice');
      expect(result.credential).toBe('[REDACTED]');
    });

    it('should redact authorization field', () => {
      const log = { request: 'GET /api', authorization: 'Bearer token123' };
      const result = sanitizeLog(log);
      expect(result.request).toBe('GET /api');
      expect(result.authorization).toBe('[REDACTED]');
    });

    it('should handle case-insensitive field names', () => {
      const log = {
        API_KEY: 'secret1',
        Token: 'secret2',
        PASSWORD: 'secret3',
        Secret: 'secret4'
      };
      const result = sanitizeLog(log);
      expect(result.API_KEY).toBe('[REDACTED]');
      expect(result.Token).toBe('[REDACTED]');
      expect(result.PASSWORD).toBe('[REDACTED]');
      expect(result.Secret).toBe('[REDACTED]');
    });
  });

  describe('nested objects', () => {
    it('should sanitize nested objects', () => {
      const log = {
        user: 'alice',
        auth: {
          token: 'secret-token',
          apiKey: 'secret-key'
        },
        metadata: {
          timestamp: '2025-11-25T10:00:00Z'
        }
      };
      const result = sanitizeLog(log);
      expect(result.user).toBe('alice');
      expect(result.auth.token).toBe('[REDACTED]');
      expect(result.auth.apiKey).toBe('[REDACTED]');
      expect(result.metadata.timestamp).toBe('2025-11-25T10:00:00Z');
    });

    it('should handle deeply nested objects', () => {
      const log = {
        level1: {
          level2: {
            level3: {
              password: 'deep-secret',
              safe: 'visible'
            }
          }
        }
      };
      const result = sanitizeLog(log);
      expect(result.level1.level2.level3.password).toBe('[REDACTED]');
      expect(result.level1.level2.level3.safe).toBe('visible');
    });
  });

  describe('arrays', () => {
    it('should sanitize objects in arrays', () => {
      const log = {
        users: [
          { name: 'alice', password: 'secret1' },
          { name: 'bob', password: 'secret2' }
        ]
      };
      const result = sanitizeLog(log);
      expect(result.users[0].name).toBe('alice');
      expect(result.users[0].password).toBe('[REDACTED]');
      expect(result.users[1].name).toBe('bob');
      expect(result.users[1].password).toBe('[REDACTED]');
    });

    it('should handle arrays of primitives', () => {
      const log = { tags: ['tag1', 'tag2', 'tag3'] };
      const result = sanitizeLog(log);
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('real-world log scenarios', () => {
    it('should sanitize Winston log object', () => {
      const log = {
        level: 'info',
        message: 'User login',
        timestamp: '2025-11-25T10:00:00Z',
        sessionId: 'abc-123',
        username: 'alice',
        password: 'secret123',
        apiKey: 'key-xyz'
      };
      const result = sanitizeLog(log);
      expect(result.level).toBe('info');
      expect(result.message).toBe('User login');
      expect(result.timestamp).toBe('2025-11-25T10:00:00Z');
      expect(result.sessionId).toBe('abc-123');
      expect(result.username).toBe('alice');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
    });

    it('should sanitize HTTP request log', () => {
      const log = {
        method: 'POST',
        url: '/api/login',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer secret-token'
        },
        body: {
          username: 'alice',
          password: 'secret123'
        }
      };
      const result = sanitizeLog(log);
      expect(result.method).toBe('POST');
      expect(result.url).toBe('/api/login');
      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers['authorization']).toBe('[REDACTED]');
      expect(result.body.username).toBe('alice');
      expect(result.body.password).toBe('[REDACTED]');
    });

    it('should sanitize error objects with sensitive data', () => {
      const error = new Error('Authentication failed');
      const log = {
        level: 'error',
        message: error.message,
        stack: error.stack,
        context: {
          apiKey: 'secret-key',
          attemptedUser: 'alice'
        }
      };
      const result = sanitizeLog(log);
      expect(result.level).toBe('error');
      expect(result.message).toBe('Authentication failed');
      expect(result.stack).toBeDefined();
      expect(result.context.apiKey).toBe('[REDACTED]');
      expect(result.context.attemptedUser).toBe('alice');
    });
  });
});

describe('sanitizeEnv', () => {
  it('should redact sensitive environment variables', () => {
    const env = {
      NODE_ENV: 'production',
      PORT: '3000',
      API_KEY: 'secret-key',
      DATABASE_PASSWORD: 'db-secret',
      JWT_SECRET: 'jwt-secret',
      NORMAL_VAR: 'visible'
    };
    const result = sanitizeEnv(env);
    expect(result.NODE_ENV).toBe('production');
    expect(result.PORT).toBe('3000');
    expect(result.API_KEY).toBe('[REDACTED]');
    expect(result.DATABASE_PASSWORD).toBe('[REDACTED]');
    expect(result.JWT_SECRET).toBe('[REDACTED]');
    expect(result.NORMAL_VAR).toBe('visible');
  });

  it('should handle undefined values in env', () => {
    const env = {
      DEFINED_VAR: 'value',
      UNDEFINED_VAR: undefined
    };
    const result = sanitizeEnv(env);
    expect(result.DEFINED_VAR).toBe('value');
    expect(result.UNDEFINED_VAR).toBeUndefined();
  });

  it('should redact common secret patterns in env vars', () => {
    const env = {
      CLAUDE_API_KEY: 'secret',
      GITHUB_TOKEN: 'secret',
      AWS_SECRET_ACCESS_KEY: 'secret',
      SESSION_SECRET: 'secret',
      AUTH_TOKEN: 'secret'
    };
    const result = sanitizeEnv(env);
    expect(result.CLAUDE_API_KEY).toBe('[REDACTED]');
    expect(result.GITHUB_TOKEN).toBe('[REDACTED]');
    expect(result.AWS_SECRET_ACCESS_KEY).toBe('[REDACTED]');
    expect(result.SESSION_SECRET).toBe('[REDACTED]');
    expect(result.AUTH_TOKEN).toBe('[REDACTED]');
  });
});
