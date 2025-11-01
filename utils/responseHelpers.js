/**
 * Response Helper Functions
 *
 * Provides consistent response formatting across all API endpoints
 */

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} extra - Additional fields to include in response
 */
function sendError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({
    status: 'error',
    message,
    ...extra
  });
}

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object} data - Data to include in response
 * @param {boolean} includeTimestamp - Whether to include timestamp (default: true)
 */
function sendSuccess(res, data = {}, includeTimestamp = true) {
  const response = {
    status: 'ok',
    ...data
  };

  if (includeTimestamp) {
    response.timestamp = new Date().toISOString();
  }

  return res.json(response);
}

/**
 * Send accepted response (for async operations)
 * @param {Object} res - Express response object
 * @param {string} message - Acceptance message
 * @param {Object} data - Additional data to include
 */
function sendAccepted(res, message, data = {}) {
  return res.json({
    status: 'accepted',
    message,
    ...data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Common error response helpers
 */

function sendUnauthorized(res, message = 'Unauthorized', extra = {}) {
  return sendError(res, 401, message, extra);
}

function sendForbidden(res, message = 'Forbidden', extra = {}) {
  return sendError(res, 403, message, extra);
}

function sendNotFound(res, message = 'Not found', extra = {}) {
  return sendError(res, 404, message, extra);
}

function sendBadRequest(res, message = 'Bad request', extra = {}) {
  return sendError(res, 400, message, extra);
}

function sendInternalError(res, message = 'Internal server error', extra = {}) {
  return sendError(res, 500, message, extra);
}

module.exports = {
  sendError,
  sendSuccess,
  sendAccepted,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
  sendInternalError
};
