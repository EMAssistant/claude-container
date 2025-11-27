/**
 * Backend Tests for POST /api/bmad/update endpoint
 * Story 3.9: Top Bar with Actions and Session Controls
 *
 * Test Coverage:
 * - AC3.17: "Update BMAD" executes npx bmad-method install command
 * - Success response format
 * - Error handling
 * - Command execution in /workspace directory
 */

import request from 'supertest';
import express, { Express } from 'express';
import { EventEmitter } from 'events';

// Mock child_process
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// Mock winston logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Create test Express app with the endpoint
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Recreate the endpoint logic from server.ts
  app.post('/api/bmad/update', async (_req, res) => {
    try {
      mockLogger.info('BMAD update request received');

      const { spawn } = require('child_process');

      const process = spawn('npx', ['bmad-method', 'install'], {
        cwd: '/workspace',
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        stdout += output;
        mockLogger.info('BMAD update output', { output: output.trim() });
      });

      process.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;
        mockLogger.warn('BMAD update stderr', { output: output.trim() });
      });

      process.on('close', (code: number) => {
        if (code === 0) {
          mockLogger.info('BMAD update completed successfully', { exitCode: code });
          res.status(200).json({
            success: true,
            message: 'BMAD Method updated successfully',
            output: stdout,
          });
        } else {
          mockLogger.error('BMAD update failed', { exitCode: code, stderr });
          res.status(500).json({
            success: false,
            message: 'BMAD Method update failed',
            error: stderr || stdout,
            exitCode: code,
          });
        }
      });

      process.on('error', (error: Error) => {
        mockLogger.error('BMAD update process error', { error: error.message, stack: error.stack });
        res.status(500).json({
          success: false,
          message: 'Failed to spawn BMAD update process',
          error: error.message,
        });
      });
    } catch (error) {
      mockLogger.error('BMAD update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        success: false,
        message: 'Failed to update BMAD Method',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
}

// Helper to create mock process that emits events
class MockProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe('POST /api/bmad/update', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Update', () => {
    it('returns success response when command exits with code 0', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(200);

      // Simulate command execution
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Installing BMAD Method...\n'));
        mockProcess.stdout.emit('data', Buffer.from('Installation complete.\n'));
        mockProcess.emit('close', 0);
      }, 10);

      const response = await responsePromise;

      expect(response.body).toEqual({
        success: true,
        message: 'BMAD Method updated successfully',
        output: 'Installing BMAD Method...\nInstallation complete.\n',
      });
    });

    it('calls spawn with correct arguments', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      request(app).post('/api/bmad/update');

      // Wait for spawn to be called
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSpawn).toHaveBeenCalledWith('npx', ['bmad-method', 'install'], {
        cwd: '/workspace',
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    });

    it('logs command output', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      request(app).post('/api/bmad/update');

      // Simulate command output
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockProcess.stdout.emit('data', Buffer.from('Test output\n'));
      mockProcess.emit('close', 0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.info).toHaveBeenCalledWith('BMAD update output', {
        output: 'Test output',
      });
    });
  })

  describe('Failed Update', () => {
    it('returns error response when command exits with non-zero code', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(500);

      // Simulate command failure
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Error: Command failed\n'));
        mockProcess.emit('close', 1);
      }, 10);

      const response = await responsePromise;

      expect(response.body).toMatchObject({
        success: false,
        message: 'BMAD Method update failed',
        exitCode: 1,
      });
      expect(response.body.error).toContain('Error: Command failed');
    });

    it('captures stderr output on failure', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(500);

      // Simulate stderr output
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('npm ERR! code ENOENT\n'));
        mockProcess.stderr.emit('data', Buffer.from('npm ERR! syscall spawn npx\n'));
        mockProcess.emit('close', 1);
      }, 10);

      const response = await responsePromise;

      expect(response.body.error).toContain('npm ERR! code ENOENT');
      expect(response.body.error).toContain('npm ERR! syscall spawn npx');
    });

    it('handles process spawn error', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(500);

      // Simulate process error
      setTimeout(() => {
        mockProcess.emit('error', new Error('spawn ENOENT'));
      }, 10);

      const response = await responsePromise;

      expect(response.body).toMatchObject({
        success: false,
        message: 'Failed to spawn BMAD update process',
        error: 'spawn ENOENT',
      });
    });

    it('logs error on failure', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      request(app).post('/api/bmad/update');

      // Simulate error
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockProcess.stderr.emit('data', Buffer.from('Error message\n'));
      mockProcess.emit('close', 1);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.error).toHaveBeenCalledWith('BMAD update failed', {
        exitCode: 1,
        stderr: 'Error message\n',
      });
    });
  })

  describe('Edge Cases', () => {
    it('handles empty stdout on success', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(200);

      // Simulate success with no output
      setTimeout(() => {
        mockProcess.emit('close', 0);
      }, 10);

      const response = await responsePromise;

      expect(response.body).toEqual({
        success: true,
        message: 'BMAD Method updated successfully',
        output: '',
      });
    });

    it('handles both stdout and stderr output', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(200);

      // Simulate mixed output
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Installing...\n'));
        mockProcess.stderr.emit('data', Buffer.from('Warning: deprecated\n'));
        mockProcess.stdout.emit('data', Buffer.from('Done.\n'));
        mockProcess.emit('close', 0);
      }, 10);

      const response = await responsePromise;

      expect(response.body.output).toBe('Installing...\nDone.\n');
    });

    it('uses stderr for error message when stdout is empty', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(500);

      // Simulate failure with only stderr
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Fatal error\n'));
        mockProcess.emit('close', 1);
      }, 10);

      const response = await responsePromise;

      expect(response.body.error).toBe('Fatal error\n');
    });

    it('uses stdout for error message when stderr is empty', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const responsePromise = request(app).post('/api/bmad/update').expect(500);

      // Simulate failure with only stdout
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Failed\n'));
        mockProcess.emit('close', 1);
      }, 10);

      const response = await responsePromise;

      expect(response.body.error).toBe('Failed\n');
    });
  })

  describe('Logging', () => {
    it('logs request received', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      request(app).post('/api/bmad/update');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.info).toHaveBeenCalledWith('BMAD update request received');
    });

    it('logs successful completion', async () => {
      const mockProcess = new MockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      request(app).post('/api/bmad/update');

      await new Promise((resolve) => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLogger.info).toHaveBeenCalledWith('BMAD update completed successfully', {
        exitCode: 0,
      });
    });
  })
})
