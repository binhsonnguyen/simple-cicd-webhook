const { loadAuthorizedKeys, verifyToken } = require('../utils/keyManager');
const path = require('path');

// Load authorized keys at startup
const AUTHORIZED_KEYS_PATH = process.env.AUTHORIZED_KEYS_PATH ||
  path.join(__dirname, '../config/authorized_keys.txt');

let authorizedKeys = [];

/**
 * Reload authorized keys from file
 */
function reloadAuthorizedKeys() {
  try {
    authorizedKeys = loadAuthorizedKeys(AUTHORIZED_KEYS_PATH);
    console.log(`Loaded ${authorizedKeys.length} authorized keys from ${AUTHORIZED_KEYS_PATH}`);
  } catch (error) {
    console.error('Error loading authorized keys:', error.message);
    authorizedKeys = [];
  }
}

// Initial load
reloadAuthorizedKeys();

/**
 * Authentication middleware for webhook endpoints
 * Expects token in:
 * - Query parameter: ?token=xxx
 * - Request body: { token: "xxx" }
 * - Header: X-Webhook-Token: xxx
 */
function authenticateWebhook(req, res, next) {
  // Extract token from multiple possible sources
  const token =
    req.query.token ||
    req.body?.token ||
    req.headers['x-webhook-token'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: No token provided',
      hint: 'Include token in query param, body, or X-Webhook-Token header'
    });
  }

  // Verify token against authorized keys
  if (!verifyToken(token, authorizedKeys)) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden: Invalid or unauthorized token'
    });
  }

  // Token is valid, proceed
  next();
}

/**
 * Optional middleware that logs auth attempts but doesn't block
 */
function logAuthAttempt(req, res, next) {
  const token =
    req.query.token ||
    req.body?.token ||
    req.headers['x-webhook-token'];

  if (token) {
    req.authAttempted = true;
    req.tokenProvided = token.substring(0, 20) + '...'; // Log partial token for debugging
  }

  next();
}

module.exports = {
  authenticateWebhook,
  logAuthAttempt,
  reloadAuthorizedKeys
};
