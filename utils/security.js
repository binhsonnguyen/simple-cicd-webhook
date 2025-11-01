/**
 * Security Utilities
 *
 * Functions for sanitizing and handling sensitive data
 */

const { SECURITY } = require('../constants');

/**
 * Sanitize a token for logging purposes
 * Truncates long tokens to prevent log pollution
 *
 * @param {string} token - The token to sanitize
 * @param {number} maxLength - Maximum length to display (default from constants)
 * @returns {string} Sanitized token
 */
function sanitizeToken(token, maxLength = SECURITY.TOKEN_DISPLAY_LENGTH) {
  if (!token) return '';

  if (token.length <= maxLength) {
    return token;
  }

  return token.substring(0, maxLength) + '...';
}

/**
 * Sanitize a client key for logging purposes
 *
 * @param {string} clientKey - The client key to sanitize
 * @param {number} maxLength - Maximum length to display
 * @returns {string} Sanitized client key
 */
function sanitizeClientKey(clientKey, maxLength = SECURITY.CLIENT_KEY_DISPLAY_LENGTH) {
  if (!clientKey) return '';

  if (clientKey.length <= maxLength) {
    return clientKey;
  }

  return clientKey.substring(0, maxLength) + '...';
}

/**
 * Sanitize an object for logging
 * Truncates any fields that might contain sensitive data
 *
 * @param {Object} data - Data object to sanitize
 * @param {Array<string>} sensitiveFields - Field names to sanitize (default: common auth fields)
 * @returns {Object} Sanitized data object
 */
function sanitizeForLogs(data, sensitiveFields = ['token', 'clientKey', 'authorization']) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = sanitizeToken(sanitized[field]);
    }
  });

  return sanitized;
}

/**
 * Redact sensitive information completely
 * Replaces with a placeholder rather than truncating
 *
 * @param {string} value - Value to redact
 * @param {string} placeholder - Placeholder text (default: '[REDACTED]')
 * @returns {string} Redacted value
 */
function redact(value, placeholder = '[REDACTED]') {
  return value ? placeholder : '';
}

module.exports = {
  sanitizeToken,
  sanitizeClientKey,
  sanitizeForLogs,
  redact
};
