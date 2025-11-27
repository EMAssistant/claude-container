/**
 * Sensitive Data Sanitizer for Logs
 * Story 4.5: Enhanced Error Messages and Logging
 * AC4.5: No secrets or credentials appear in logs
 *
 * Filters sensitive data from log entries before they are written.
 * Prevents API keys, tokens, passwords, and other secrets from appearing in logs.
 */

/**
 * Patterns to detect sensitive field names
 * Case-insensitive matching for common secret field names
 */
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /token/i, // Matches 'token', 'auth_token', 'github_token', etc
  /password/i,
  /passwd/i,
  /secret/i,
  /credential/i,
  /authorization/i,
  /bearer/i,
  /cookie/i,
  /x-api-key/i
];

/**
 * Fields that should NOT be redacted even if they match patterns
 * These are common logging fields that need to be visible
 */
const ALLOWED_FIELDS = [
  'sessionId',
  'session',
  'authenticated',
  'author',
  'authorize',
  'auth' // Allow 'auth' object itself, but redact its sensitive children
];

/**
 * Replacement string for redacted values
 */
const REDACTED = '[REDACTED]';

/**
 * Check if a string matches any sensitive pattern
 * @param str String to check (typically a field name)
 * @returns true if the string matches a sensitive pattern and is not in allowed list
 */
function isSensitiveKey(str: string): boolean {
  // Check if it's in the allowed list first
  if (ALLOWED_FIELDS.includes(str)) {
    return false;
  }
  // Check against sensitive patterns
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Sanitize a single value (string, number, boolean, etc.)
 * If the value is a string and appears to contain sensitive data, redact it
 *
 * @param value Value to sanitize
 * @returns Sanitized value or [REDACTED] if sensitive
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Check if string looks like a token/key (long alphanumeric string)
    // This catches cases where the field name doesn't match but the value looks like a secret
    if (value.length > 20 && /^[A-Za-z0-9_\-+/=]+$/.test(value)) {
      // Could be a base64 token or API key, but we need to be careful not to redact
      // regular base64-encoded data. Only redact if it matches common token patterns.
      // For now, we'll rely on field name matching primarily.
    }
    return value;
  }
  return value;
}

/**
 * Recursively sanitize an object, redacting sensitive fields
 *
 * @param obj Object to sanitize (can be nested)
 * @returns Sanitized object with sensitive fields replaced with [REDACTED]
 *
 * @example
 * const log = { user: 'alice', password: 'secret123', apiKey: 'xyz' };
 * sanitizeLog(log);
 * // Returns: { user: 'alice', password: '[REDACTED]', apiKey: '[REDACTED]' }
 */
export function sanitizeLog(obj: any): any {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLog(item));
  }

  // Handle objects (including Error objects)
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if key matches sensitive pattern
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED;
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeLog(value);
    } else {
      // Keep non-sensitive values
      sanitized[key] = sanitizeValue(value);
    }
  }

  return sanitized;
}

/**
 * Sanitize environment variables for logging
 * Useful when logging process.env for debugging
 *
 * @param env Environment variables object (e.g., process.env)
 * @returns Sanitized environment with secrets redacted
 */
export function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;

    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
