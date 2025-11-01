/**
 * Request parameter extraction utilities
 */

/**
 * Extract a parameter from multiple request sources
 * @param {Object} req - Express request object
 * @param {string} name - Parameter name
 * @param {Array<string>} sources - Sources to check in order (e.g., ['body', 'query', 'header:x-custom'])
 * @returns {string|undefined} Parameter value or undefined
 */
function getParam(req, name, sources = ['body', 'query']) {
  for (const source of sources) {
    let value;

    if (source === 'body') {
      value = req.body?.[name];
    } else if (source === 'query') {
      value = req.query?.[name];
    } else if (source.startsWith('header:')) {
      const headerName = source.substring(7); // Remove 'header:' prefix
      value = req.headers?.[headerName.toLowerCase()];
    }

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

/**
 * Extract parameter from body or query (common pattern)
 * @param {Object} req - Express request object
 * @param {string} name - Parameter name
 * @returns {string|undefined} Parameter value or undefined
 */
function getBodyOrQuery(req, name) {
  return getParam(req, name, ['body', 'query']);
}

/**
 * Extract authentication token from multiple sources
 * Checks: body.token, query.token, X-Webhook-Token header, Authorization header
 * @param {Object} req - Express request object
 * @returns {string|undefined} Token value or undefined
 */
function getToken(req) {
  // Check body and query
  const token = getParam(req, 'token', ['body', 'query']);
  if (token) return token;

  // Check X-Webhook-Token header
  const webhookToken = req.headers['x-webhook-token'];
  if (webhookToken) return webhookToken;

  // Check Authorization header (Bearer token)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  return undefined;
}

module.exports = {
  getParam,
  getBodyOrQuery,
  getToken
};
