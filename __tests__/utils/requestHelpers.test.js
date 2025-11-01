const { getParam, getBodyOrQuery, getToken } = require('../../utils/requestHelpers');

describe('requestHelpers', () => {
  describe('getParam', () => {
    test('should extract parameter from body', () => {
      const req = {
        body: { name: 'test-value' },
        query: {},
        headers: {}
      };

      expect(getParam(req, 'name', ['body'])).toBe('test-value');
    });

    test('should extract parameter from query', () => {
      const req = {
        body: {},
        query: { name: 'query-value' },
        headers: {}
      };

      expect(getParam(req, 'name', ['query'])).toBe('query-value');
    });

    test('should extract parameter from header', () => {
      const req = {
        body: {},
        query: {},
        headers: { 'x-custom-header': 'header-value' }
      };

      expect(getParam(req, 'name', ['header:x-custom-header'])).toBe('header-value');
    });

    test('should prioritize sources in order', () => {
      const req = {
        body: { name: 'body-value' },
        query: { name: 'query-value' },
        headers: { 'x-name': 'header-value' }
      };

      // Body first
      expect(getParam(req, 'name', ['body', 'query'])).toBe('body-value');

      // Query first
      expect(getParam(req, 'name', ['query', 'body'])).toBe('query-value');
    });

    test('should return undefined if parameter not found', () => {
      const req = {
        body: {},
        query: {},
        headers: {}
      };

      expect(getParam(req, 'missing', ['body', 'query'])).toBeUndefined();
    });

    test('should skip empty values', () => {
      const req = {
        body: { name: '' },
        query: { name: 'query-value' },
        headers: {}
      };

      expect(getParam(req, 'name', ['body', 'query'])).toBe('query-value');
    });

    test('should handle null values', () => {
      const req = {
        body: { name: null },
        query: { name: 'query-value' },
        headers: {}
      };

      expect(getParam(req, 'name', ['body', 'query'])).toBe('query-value');
    });

    test('should handle undefined body', () => {
      const req = {
        query: { name: 'query-value' },
        headers: {}
      };

      expect(getParam(req, 'name', ['body', 'query'])).toBe('query-value');
    });
  });

  describe('getBodyOrQuery', () => {
    test('should extract from body first', () => {
      const req = {
        body: { project: 'body-project' },
        query: { project: 'query-project' }
      };

      expect(getBodyOrQuery(req, 'project')).toBe('body-project');
    });

    test('should fallback to query if body is empty', () => {
      const req = {
        body: {},
        query: { project: 'query-project' }
      };

      expect(getBodyOrQuery(req, 'project')).toBe('query-project');
    });

    test('should return undefined if not found', () => {
      const req = {
        body: {},
        query: {}
      };

      expect(getBodyOrQuery(req, 'project')).toBeUndefined();
    });
  });

  describe('getToken', () => {
    test('should extract token from body', () => {
      const req = {
        body: { token: 'body-token' },
        query: {},
        headers: {}
      };

      expect(getToken(req)).toBe('body-token');
    });

    test('should extract token from query', () => {
      const req = {
        body: {},
        query: { token: 'query-token' },
        headers: {}
      };

      expect(getToken(req)).toBe('query-token');
    });

    test('should extract token from X-Webhook-Token header', () => {
      const req = {
        body: {},
        query: {},
        headers: { 'x-webhook-token': 'header-token' }
      };

      expect(getToken(req)).toBe('header-token');
    });

    test('should extract token from Authorization Bearer header', () => {
      const req = {
        body: {},
        query: {},
        headers: { 'authorization': 'Bearer bearer-token' }
      };

      expect(getToken(req)).toBe('bearer-token');
    });

    test('should prioritize body over headers', () => {
      const req = {
        body: { token: 'body-token' },
        query: {},
        headers: {
          'x-webhook-token': 'header-token',
          'authorization': 'Bearer bearer-token'
        }
      };

      expect(getToken(req)).toBe('body-token');
    });

    test('should prioritize query over headers', () => {
      const req = {
        body: {},
        query: { token: 'query-token' },
        headers: {
          'x-webhook-token': 'header-token',
          'authorization': 'Bearer bearer-token'
        }
      };

      expect(getToken(req)).toBe('query-token');
    });

    test('should prioritize X-Webhook-Token over Authorization header', () => {
      const req = {
        body: {},
        query: {},
        headers: {
          'x-webhook-token': 'webhook-token',
          'authorization': 'Bearer bearer-token'
        }
      };

      expect(getToken(req)).toBe('webhook-token');
    });

    test('should return undefined if no token found', () => {
      const req = {
        body: {},
        query: {},
        headers: {}
      };

      expect(getToken(req)).toBeUndefined();
    });

    test('should ignore malformed Authorization header', () => {
      const req = {
        body: {},
        query: {},
        headers: { 'authorization': 'InvalidFormat token' }
      };

      expect(getToken(req)).toBeUndefined();
    });

    test('should handle Authorization header without Bearer prefix', () => {
      const req = {
        body: {},
        query: {},
        headers: { 'authorization': 'just-a-token' }
      };

      expect(getToken(req)).toBeUndefined();
    });
  });
});
