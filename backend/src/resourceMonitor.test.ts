/**
 * Unit tests for ResourceMonitor
 * Story 4.8: Resource Monitoring and Limits
 * AC #9: Backend unit tests for resource monitor logic
 */

import { ResourceMonitor, createResourceMonitor } from './resourceMonitor';
import { WebSocketServer } from 'ws';
import type { SessionManager } from './sessionManager';

// Mock logger
jest.mock('./utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ResourceMonitor', () => {
  let wss: WebSocketServer;
  let sessionManager: SessionManager;
  let resourceMonitor: ResourceMonitor;
  let originalMemoryUsage: typeof process.memoryUsage;

  beforeEach(() => {
    // Mock WebSocketServer
    wss = {
      clients: new Set()
    } as any;

    // Mock SessionManager
    sessionManager = {
      getSessionCount: jest.fn().mockReturnValue(2)
    } as any;

    // Save original memoryUsage
    originalMemoryUsage = process.memoryUsage;

    // Create ResourceMonitor instance
    resourceMonitor = createResourceMonitor(wss, sessionManager);
  });

  afterEach(() => {
    // Restore original memoryUsage
    process.memoryUsage = originalMemoryUsage;

    // Stop monitoring
    resourceMonitor.stopMonitoring();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Memory percentage calculation', () => {
    it('should calculate memory usage correctly for various heap sizes', () => {
      // Test 50% usage (4GB)
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 4 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      resourceMonitor.startMonitoring();
      let state = resourceMonitor.getResourceState();
      expect(state.memoryUsagePercent).toBeCloseTo(50, 1);
      resourceMonitor.stopMonitoring();

      // Test 87% usage (7GB)
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 7 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      resourceMonitor = createResourceMonitor(wss, sessionManager);
      resourceMonitor.startMonitoring();
      state = resourceMonitor.getResourceState();
      expect(state.memoryUsagePercent).toBeCloseTo(87.5, 1);
      resourceMonitor.stopMonitoring();

      // Test 93% usage (7.5GB)
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 7.5 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      resourceMonitor = createResourceMonitor(wss, sessionManager);
      resourceMonitor.startMonitoring();
      state = resourceMonitor.getResourceState();
      expect(state.memoryUsagePercent).toBeCloseTo(93.75, 1);
    });
  });

  describe('87% threshold triggers warning', () => {
    it('should trigger warning when memory reaches 87%', () => {
      // Mock 87% usage
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 7 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      // Mock WebSocket client
      const mockClient = {
        readyState: 1, // OPEN
        send: jest.fn()
      };
      wss.clients.add(mockClient as any);

      resourceMonitor.startMonitoring();

      // Verify warning was broadcast
      expect(mockClient.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('resource.warning');
      expect(sentMessage.memoryUsagePercent).toBeGreaterThanOrEqual(87);
      expect(sentMessage.isAcceptingNewSessions).toBe(true);
    });

    it('should not trigger warning when memory is below 87%', () => {
      // Mock 86% usage
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 6.9 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      // Mock WebSocket client
      const mockClient = {
        readyState: 1, // OPEN
        send: jest.fn()
      };
      wss.clients.add(mockClient as any);

      resourceMonitor.startMonitoring();

      // Verify no warning was broadcast
      expect(mockClient.send).not.toHaveBeenCalled();
    });
  });

  describe('93% threshold blocks new sessions', () => {
    it('should block new sessions when memory reaches 93%', () => {
      // Mock 93% usage
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 7.5 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      resourceMonitor.startMonitoring();

      // Verify isAcceptingNewSessions is false
      expect(resourceMonitor.isAcceptingNewSessions).toBe(false);

      const state = resourceMonitor.getResourceState();
      expect(state.isAcceptingNewSessions).toBe(false);
    });

    it('should broadcast critical warning with isAcceptingNewSessions: false', () => {
      // Mock 93% usage
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 7.5 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      // Mock WebSocket client
      const mockClient = {
        readyState: 1, // OPEN
        send: jest.fn()
      };
      wss.clients.add(mockClient as any);

      resourceMonitor.startMonitoring();

      // Verify critical warning was broadcast
      expect(mockClient.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('resource.warning');
      expect(sentMessage.isAcceptingNewSessions).toBe(false);
      expect(sentMessage.message).toContain('critical');
    });
  });

  describe('stopMonitoring', () => {
    it('should clear interval and stop monitoring', () => {
      resourceMonitor.startMonitoring();
      resourceMonitor.stopMonitoring();

      // Verify logger was called with stopped message
      const { logger } = require('./utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Resource monitoring stopped'
      );
    });
  });

  describe('Resource state broadcast', () => {
    it('should broadcast to all open WebSocket clients', () => {
      // Mock 90% usage
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 7.25 * 1024 * 1024 * 1024,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0
      })) as any;

      // Mock multiple WebSocket clients
      const mockClient1 = { readyState: 1, send: jest.fn() };
      const mockClient2 = { readyState: 1, send: jest.fn() };
      const mockClient3 = { readyState: 0, send: jest.fn() }; // Closed
      wss.clients.add(mockClient1 as any);
      wss.clients.add(mockClient2 as any);
      wss.clients.add(mockClient3 as any);

      resourceMonitor.startMonitoring();

      // Verify only open clients received message
      expect(mockClient1.send).toHaveBeenCalled();
      expect(mockClient2.send).toHaveBeenCalled();
      expect(mockClient3.send).not.toHaveBeenCalled();
    });
  });
});
