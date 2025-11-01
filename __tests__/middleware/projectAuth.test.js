const { validateProjectAccess, validateJobAccess } = require('../../middleware/projectAuth');

// Mock the projectManager module
jest.mock('../../utils/projectManager', () => ({
  getClientProject: jest.fn((clientKey) => {
    const projectMap = {
      'client-a-key': 'project-a',
      'client-b-key': 'project-b'
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
  })
}));

describe('Project Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      clientKey: null,
      body: {},
      query: {},
      headers: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('validateProjectAccess', () => {
    test('should allow access to assigned project', () => {
      req.clientKey = 'client-a-key';
      req.body.project = 'project-a';

      validateProjectAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.project).toBe('project-a');
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow project from query parameter', () => {
      req.clientKey = 'client-a-key';
      req.query.project = 'project-a';

      validateProjectAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.project).toBe('project-a');
    });

    test('should reject client with no assigned project', () => {
      req.clientKey = 'unknown-client-key';
      req.body.project = 'project-a';

      validateProjectAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'No project assigned to this client',
        hint: 'Contact administrator to assign this client to a project'
      });
    });

    test('should reject request without project parameter', () => {
      req.clientKey = 'client-a-key';
      // No project in body or query

      validateProjectAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'No project specified',
        hint: 'Include "project" parameter in request body or query string'
      });
    });

    test('should reject access to different project', () => {
      req.clientKey = 'client-a-key'; // Assigned to project-a
      req.body.project = 'project-b';   // Trying to access project-b

      validateProjectAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Not authorized for project: project-b',
        assignedProject: 'project-a'
      });
    });

    test('should prioritize body over query for project', () => {
      req.clientKey = 'client-a-key';
      req.body.project = 'project-a';
      req.query.project = 'project-b';

      validateProjectAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.project).toBe('project-a');
    });
  });

  describe('validateJobAccess', () => {
    beforeEach(() => {
      req.project = 'project-a'; // Set by validateProjectAccess
    });

    test('should allow access to existing job', () => {
      req.body.job = 'deploy';

      validateJobAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.jobName).toBe('deploy');
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow job from query parameter', () => {
      req.query.job = 'test';

      validateJobAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.jobName).toBe('test');
    });

    test('should reject request without job parameter', () => {
      // No job in body or query

      validateJobAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'No job specified',
        hint: 'Include "job" parameter in request body or query string'
      });
    });

    test('should reject non-existent job', () => {
      req.body.job = 'nonexistent-job';

      validateJobAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Job not found: nonexistent-job',
        project: 'project-a',
        availableJobs: ['deploy', 'test', 'build']
      });
    });

    test('should prioritize body over query for job', () => {
      req.body.job = 'deploy';
      req.query.job = 'test';

      validateJobAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.jobName).toBe('deploy');
    });

    test('should validate job against correct project', () => {
      req.project = 'project-b';
      req.body.job = 'rollback'; // exists in project-b

      validateJobAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.jobName).toBe('rollback');
    });

    test('should reject job from different project', () => {
      req.project = 'project-b';
      req.body.job = 'build'; // exists in project-a but not project-b

      validateJobAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
