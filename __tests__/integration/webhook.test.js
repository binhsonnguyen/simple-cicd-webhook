const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock modules before requiring server components
jest.mock('../../utils/keyManager', () => ({
  loadAuthorizedKeys: jest.fn(() => ['valid-key-123', 'project-a-key', 'project-b-key']),
  verifyToken: jest.fn((token, keys) => keys.includes(token)),
  loadKey: jest.fn(() => 'server-public-key-content')
}));

jest.mock('../../utils/projectManager', () => ({
  loadClientProjects: jest.fn(),
  getClientProject: jest.fn((clientKey) => {
    const projectMap = {
      'project-a-key': 'project-a',
      'project-b-key': 'project-b',
      'valid-key-123': 'project-a'
    };
    return projectMap[clientKey] || null;
  }),
  getProjectJobs: jest.fn((project) => {
    const jobsMap = {
      'project-a': ['deploy', 'test', 'build'],
      'project-b': ['deploy', 'rollback']
    };
    return jobsMap[project] || [];
  }),
  jobExists: jest.fn((project, job) => {
    const jobsMap = {
      'project-a': ['deploy', 'test', 'build'],
      'project-b': ['deploy', 'rollback']
    };
    return (jobsMap[project] || []).includes(job);
  }),
  executeJob: jest.fn((project, job, options) => {
    // Simulate successful job execution
    return Promise.resolve({
      projectName: project,
      jobName: job,
      exitCode: 0,
      success: true,
      duration: 1234,
      stdout: 'Job completed successfully',
      stderr: '',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    });
  })
}));

// Mock winston to avoid file logging in tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    splat: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Now require the middleware and app components
const { authenticateWebhook } = require('../../middleware/auth');
const { validateProjectAccess, validateJobAccess } = require('../../middleware/projectAuth');
const { executeJob } = require('../../utils/projectManager');

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Webhook endpoint - same middleware chain as server.js
  app.post('/webhook',
    authenticateWebhook,
    validateProjectAccess,
    validateJobAccess,
    async (req, res) => {
      const clientKey = req.clientKey;
      const project = req.project;
      const jobName = req.jobName;

      res.json({
        status: 'accepted',
        message: 'Job started',
        project,
        job: jobName,
        timestamp: new Date().toISOString()
      });

      // Execute job asynchronously (in tests, this is mocked)
      try {
        await executeJob(project, jobName, {
          env: {
            WEBHOOK_CLIENT: clientKey.substring(0, 50),
            WEBHOOK_TIMESTAMP: new Date().toISOString(),
            ...(req.body.env || {})
          }
        });
      } catch (error) {
        // In real server, this is logged
      }
    }
  );

  return app;
}

describe('Webhook Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('Successful webhook execution', () => {
    test('should execute job successfully with all valid parameters', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'deploy'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'accepted',
        message: 'Job started',
        project: 'project-a',
        job: 'deploy'
      });
      expect(response.body.timestamp).toBeDefined();
    });

    test('should accept parameters from query string', async () => {
      const response = await request(app)
        .post('/webhook?token=project-a-key&project=project-a&job=test')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'accepted',
        project: 'project-a',
        job: 'test'
      });
    });

    test('should accept token from X-Webhook-Token header', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('X-Webhook-Token', 'project-a-key')
        .send({
          project: 'project-a',
          job: 'build'
        });

      expect(response.status).toBe(200);
      expect(response.body.job).toBe('build');
    });

    test('should accept token from Authorization Bearer header', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('Authorization', 'Bearer project-b-key')
        .send({
          project: 'project-b',
          job: 'rollback'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        project: 'project-b',
        job: 'rollback'
      });
    });

    test('should call executeJob with correct parameters', async () => {
      await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'deploy',
          env: {
            CUSTOM_VAR: 'test-value'
          }
        });

      // Give a moment for async execution
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(executeJob).toHaveBeenCalledWith(
        'project-a',
        'deploy',
        expect.objectContaining({
          env: expect.objectContaining({
            CUSTOM_VAR: 'test-value',
            WEBHOOK_CLIENT: expect.any(String),
            WEBHOOK_TIMESTAMP: expect.any(String)
          })
        })
      );
    });
  });

  describe('Authentication failures', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          project: 'project-a',
          job: 'deploy'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Unauthorized: No token provided',
        hint: 'Include token in query param, body, or X-Webhook-Token header'
      });
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'invalid-token',
          project: 'project-a',
          job: 'deploy'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Forbidden: Invalid or unauthorized token'
      });
    });
  });

  describe('Project validation failures', () => {
    test('should reject request without project parameter', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          job: 'deploy'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'No project specified',
        hint: 'Include "project" parameter in request body or query string'
      });
    });

    test('should reject client with no assigned project', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'valid-key-123',
          project: 'unassigned-project',
          job: 'deploy'
        });

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    test('should reject access to different project', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',  // Assigned to project-a
          project: 'project-b',    // Trying to access project-b
          job: 'deploy'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Not authorized for project: project-b',
        assignedProject: 'project-a'
      });
    });
  });

  describe('Job validation failures', () => {
    test('should reject request without job parameter', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-a'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'No job specified',
        hint: 'Include "job" parameter in request body or query string'
      });
    });

    test('should reject non-existent job', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'nonexistent-job'
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Job not found: nonexistent-job',
        project: 'project-a',
        availableJobs: ['deploy', 'test', 'build']
      });
    });

    test('should reject job from different project', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-b-key',
          project: 'project-b',
          job: 'build'  // exists in project-a but not project-b
        });

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Job not found');
    });
  });

  describe('Parameter prioritization', () => {
    test('should prioritize body over query for all parameters', async () => {
      const response = await request(app)
        .post('/webhook?token=wrong-key&project=project-b&job=rollback')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'deploy'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        project: 'project-a',
        job: 'deploy'
      });
    });

    test('should prioritize body token over headers', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('X-Webhook-Token', 'project-b-key')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'test'
        });

      expect(response.status).toBe(200);
      expect(response.body.project).toBe('project-a');
    });
  });

  describe('Middleware chain integration', () => {
    test('should pass through all middleware in correct order', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'deploy'
        });

      // If we get 200, all middleware passed
      expect(response.status).toBe(200);

      // Verify the request object was enriched by middleware
      expect(response.body.project).toBe('project-a');
      expect(response.body.job).toBe('deploy');
    });

    test('should stop at first middleware failure (auth)', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'invalid-token',
          project: 'project-a',
          job: 'deploy'
        });

      // Should fail at authenticateWebhook middleware
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Invalid or unauthorized token');

      // Should not reach executeJob
      expect(executeJob).not.toHaveBeenCalled();
    });

    test('should stop at second middleware failure (project)', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-b',  // Wrong project
          job: 'deploy'
        });

      // Should fail at validateProjectAccess middleware
      expect(response.status).toBe(403);

      // Should not reach executeJob
      expect(executeJob).not.toHaveBeenCalled();
    });

    test('should stop at third middleware failure (job)', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          token: 'project-a-key',
          project: 'project-a',
          job: 'nonexistent'  // Invalid job
        });

      // Should fail at validateJobAccess middleware
      expect(response.status).toBe(404);

      // Should not reach executeJob
      expect(executeJob).not.toHaveBeenCalled();
    });
  });
});
