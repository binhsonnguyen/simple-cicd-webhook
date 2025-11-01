const { authenticateWebhook, logAuthAttempt } = require('../../middleware/auth');

// Mock the keyManager module
jest.mock('../../utils/keyManager', () => ({
  loadAuthorizedKeys: jest.fn(() => ['valid-key-123', 'another-valid-key']),
  verifyToken: jest.fn((token, keys) => keys.includes(token))
}));

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
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

  describe('authenticateWebhook', () => {
    test('should authenticate with valid token in body', () => {
      req.body.token = 'valid-key-123';

      authenticateWebhook(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.clientKey).toBe('valid-key-123');
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should authenticate with valid token in query', () => {
      req.query.token = 'valid-key-123';

      authenticateWebhook(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.clientKey).toBe('valid-key-123');
    });

    test('should authenticate with valid token in X-Webhook-Token header', () => {
      req.headers['x-webhook-token'] = 'valid-key-123';

      authenticateWebhook(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.clientKey).toBe('valid-key-123');
    });

    test('should authenticate with valid Bearer token', () => {
      req.headers['authorization'] = 'Bearer valid-key-123';

      authenticateWebhook(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.clientKey).toBe('valid-key-123');
    });

    test('should reject request with no token', () => {
      authenticateWebhook(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Unauthorized: No token provided',
        hint: 'Include token in query param, body, or X-Webhook-Token header'
      });
    });

    test('should reject request with invalid token', () => {
      req.body.token = 'invalid-token';

      authenticateWebhook(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Forbidden: Invalid or unauthorized token'
      });
    });

    test('should prioritize body token over headers', () => {
      req.body.token = 'valid-key-123';
      req.headers['x-webhook-token'] = 'another-valid-key';

      authenticateWebhook(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.clientKey).toBe('valid-key-123');
    });
  });

  describe('logAuthAttempt', () => {
    test('should log auth attempt with token', () => {
      req.body.token = 'test-token-123456789012345678901234567890';

      logAuthAttempt(req, res, next);

      expect(req.authAttempted).toBe(true);
      expect(req.tokenProvided).toBe('test-token-123456789...');
      expect(next).toHaveBeenCalled();
    });

    test('should not set auth flags when no token provided', () => {
      logAuthAttempt(req, res, next);

      expect(req.authAttempted).toBeUndefined();
      expect(req.tokenProvided).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('should truncate long tokens', () => {
      const longToken = 'a'.repeat(100);
      req.query.token = longToken;

      logAuthAttempt(req, res, next);

      expect(req.tokenProvided).toBe('a'.repeat(20) + '...');
    });
  });
});
