const path = require('path');
const { loadAuthorizedKeys, verifyToken } = require('../utils/keyManager');
const { getToken } = require('../utils/requestHelpers');
const { sendUnauthorized, sendForbidden } = require('../utils/responseHelpers');
const { sanitizeToken } = require('../utils/security');
const { ERROR_MESSAGES, ERROR_HINTS, PATHS } = require('../constants');

// Load authorized keys at startup
const AUTHORIZED_KEYS_PATH = process.env.AUTHORIZED_KEYS_PATH ||
  path.join(__dirname, '..', PATHS.AUTHORIZED_KEYS_FILE);

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
  const token = getToken(req);

  if (!token) {
    return sendUnauthorized(res, ERROR_MESSAGES.NO_TOKEN_PROVIDED, {
      hint: ERROR_HINTS.INCLUDE_TOKEN
    });
  }

  // Verify token against authorized keys
  if (!verifyToken(token, authorizedKeys)) {
    return sendForbidden(res, ERROR_MESSAGES.INVALID_TOKEN);
  }

  // Token is valid, attach client key to request for later use
  req.clientKey = token;
  next();
}

/**
 * Optional middleware that logs auth attempts but doesn't block
 */
function logAuthAttempt(req, res, next) {
  const token = getToken(req);

  if (token) {
    req.authAttempted = true;
    req.tokenProvided = sanitizeToken(token); // Log partial token for debugging
  }

  next();
}

module.exports = {
  authenticateWebhook,
  logAuthAttempt,
  reloadAuthorizedKeys
};
