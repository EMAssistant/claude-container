/**
 * Centralized logger utility using Winston
 * Story 2.1: Session Manager Module with State Persistence
 * Story 4.5: Enhanced Error Messages and Logging
 *
 * Provides structured JSON logging with timestamps, session context,
 * and sensitive data filtering for all backend modules
 */

import { createLogger, format, transports } from 'winston';
import { sanitizeLog } from './sanitizeLog';

/**
 * Log metadata interface for structured logging
 */
export interface LogMetadata {
  sessionId?: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

/**
 * Custom format for Winston that applies sensitive data filtering
 * Story 4.5 AC4.5: No secrets or credentials appear in logs
 */
const sanitizeFormat = format((info) => {
  // Sanitize the entire log object to remove sensitive data
  return sanitizeLog(info);
});

/**
 * Winston logger instance configured for session management
 *
 * Configuration:
 * - JSON format for structured logging
 * - ISO 8601 timestamps
 * - Error stack traces
 * - Sensitive data filtering (AC4.5)
 * - Production log level: info (AC4.7 - no debug logs)
 * - Development log level: debug (verbose logging)
 * - Colorized console output for development
 */
export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : (process.env.LOG_LEVEL || 'debug'),
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    sanitizeFormat(),
    format.json()
  ),
  defaultMeta: { service: 'claude-container' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          const filteredMetadata = { ...metadata };
          // Remove internal Winston fields from console output
          delete filteredMetadata.service;
          delete filteredMetadata.timestamp;
          delete filteredMetadata.level;
          delete filteredMetadata.message;

          if (Object.keys(filteredMetadata).length > 0) {
            msg += ` ${JSON.stringify(filteredMetadata)}`;
          }
          return msg;
        })
      )
    })
  ]
});

/**
 * Helper function to log session lifecycle events
 * Standardizes session event logging format across the application
 *
 * @param event Event type (e.g., 'created', 'destroyed', 'updated')
 * @param sessionId Session identifier
 * @param metadata Additional event metadata
 */
export function logSessionEvent(
  event: string,
  sessionId: string,
  metadata?: Record<string, unknown>
): void {
  logger.info(`Session ${event}`, {
    sessionId,
    event,
    ...metadata
  });
}

/**
 * Helper function to log session errors
 * Standardizes session error logging format across the application
 *
 * @param action Action that failed (e.g., 'creation', 'destruction')
 * @param sessionId Session identifier
 * @param error Error object or message
 * @param metadata Additional error metadata
 */
export function logSessionError(
  action: string,
  sessionId: string | undefined,
  error: Error | string,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`Session ${action} failed`, {
    sessionId,
    action,
    error: errorMessage,
    stack: errorStack,
    ...metadata
  });
}

/**
 * Helper function to create a child logger with session context
 * Story 4.5 AC4.16: Backend logs include session context
 *
 * This ensures all logs from a session include the sessionId automatically
 *
 * @param sessionId Session identifier to include in all logs
 * @returns Child logger with sessionId in default metadata
 *
 * @example
 * const sessionLogger = createSessionLogger('abc-123');
 * sessionLogger.info('Session started'); // Automatically includes sessionId: 'abc-123'
 */
export function createSessionLogger(sessionId: string): typeof logger {
  return logger.child({ sessionId });
}

/**
 * Helper function to log with session context without creating a child logger
 * Useful for one-off logs where creating a child logger is overkill
 *
 * @param level Log level (error, warn, info, debug)
 * @param message Log message
 * @param sessionId Session identifier
 * @param metadata Additional metadata
 *
 * @example
 * logWithSession('info', 'Status changed', 'abc-123', { from: 'idle', to: 'active' });
 */
export function logWithSession(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  sessionId: string,
  metadata?: LogMetadata
): void {
  logger.log(level, message, { ...metadata, sessionId });
}
