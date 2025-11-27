/**
 * Atomic file write utility
 * Story 2.1: Session Manager Module with State Persistence (AC #2)
 *
 * Implements atomic write pattern to prevent JSON corruption on container crash:
 * 1. Write to temporary file (unique name to prevent race conditions)
 * 2. Rename temp file to target (atomic operation)
 * 3. Uses mutex lock to serialize concurrent writes to the same file
 *
 * This ensures that the target file is never in a partially-written state
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from './logger';

/**
 * Simple async mutex for serializing writes to the same file
 * Prevents race conditions when multiple writes happen concurrently
 */
class WriteLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(path: string): Promise<() => void> {
    // Wait for any existing write to complete
    const existingLock = this.locks.get(path);
    if (existingLock) {
      try {
        await existingLock;
      } catch {
        // Ignore errors from previous writes
      }
    }

    // Create a new lock
    let release: () => void;
    const newLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(path, newLock);

    return () => {
      release!();
      // Clean up lock if this is still the current one
      if (this.locks.get(path) === newLock) {
        this.locks.delete(path);
      }
    };
  }
}

const writeLock = new WriteLock();

/**
 * Atomically write data to a file
 *
 * Implementation:
 * 1. Acquire mutex lock for the target path
 * 2. Write content to a temporary file (unique name with timestamp+random)
 * 3. Use fs.rename to atomically replace the target file
 * 4. Release mutex lock
 *
 * The rename operation is atomic on POSIX-compliant filesystems (Linux, macOS)
 *
 * @param targetPath Path to the target file
 * @param content Content to write
 * @throws Error if write or rename fails
 *
 * @example
 * ```typescript
 * await atomicWrite('/workspace/.claude-container-sessions.json', JSON.stringify(data, null, 2));
 * ```
 */
export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  // Acquire lock for this file path to prevent concurrent writes
  const release = await writeLock.acquire(targetPath);

  // Use unique temp file name to prevent collisions
  const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  try {
    // Ensure the directory exists
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    // Write to temporary file
    await fs.writeFile(tempPath, content, { encoding: 'utf-8' });

    logger.debug('Temporary file written', { tempPath, bytes: content.length });

    // Atomically rename temp file to target
    // This is atomic on POSIX-compliant filesystems (Linux, macOS)
    await fs.rename(tempPath, targetPath);

    logger.debug('Atomic write completed', { targetPath, bytes: content.length });
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch (unlinkError) {
      // Ignore unlink errors (file might not exist)
    }

    logger.error('Atomic write failed', {
      targetPath,
      tempPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    throw error;
  } finally {
    // Always release the lock
    release();
  }
}

/**
 * Atomically write JSON data to a file
 *
 * Convenience wrapper around atomicWrite that handles JSON serialization
 *
 * @param targetPath Path to the target JSON file
 * @param data Data to serialize and write
 * @param pretty If true, pretty-print with 2-space indentation (default: true)
 * @throws Error if serialization, write, or rename fails
 *
 * @example
 * ```typescript
 * await atomicWriteJson('/workspace/.claude-container-sessions.json', { version: '1.0', sessions: [] });
 * ```
 */
export async function atomicWriteJson(
  targetPath: string,
  data: unknown,
  pretty: boolean = true
): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await atomicWrite(targetPath, content);
}
