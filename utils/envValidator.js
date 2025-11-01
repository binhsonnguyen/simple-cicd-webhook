/**
 * Environment Variable Validator
 *
 * Validates required environment variables and configuration at startup
 */

const fs = require('fs');
const path = require('path');
const { DEFAULTS, PATHS } = require('../constants');
const { isValidPort } = require('./validators');
const { ConfigurationError } = require('./errors');

/**
 * Validate environment variables
 * Throws ConfigurationError if validation fails
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Validate PORT
  const port = process.env.PORT || DEFAULTS.PORT;
  if (!isValidPort(port)) {
    errors.push(`Invalid PORT: ${port}. Must be between 1 and 65535.`);
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV || DEFAULTS.NODE_ENV;
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(nodeEnv)) {
    warnings.push(`NODE_ENV '${nodeEnv}' is not standard. Expected: ${validEnvs.join(', ')}`);
  }

  // Check key paths exist (if specified)
  const serverPublicKeyPath = process.env.SERVER_PUBLIC_KEY_PATH ||
    path.join(process.cwd(), PATHS.SERVER_PUBLIC_KEY);
  const serverPrivateKeyPath = process.env.SERVER_PRIVATE_KEY_PATH ||
    path.join(process.cwd(), PATHS.SERVER_PRIVATE_KEY);

  if (!fs.existsSync(serverPublicKeyPath)) {
    warnings.push(`Server public key not found at: ${serverPublicKeyPath}`);
  }

  if (!fs.existsSync(serverPrivateKeyPath)) {
    warnings.push(`Server private key not found at: ${serverPrivateKeyPath}`);
  }

  // Check authorized keys file exists
  const authorizedKeysPath = process.env.AUTHORIZED_KEYS_PATH ||
    path.join(process.cwd(), PATHS.AUTHORIZED_KEYS_FILE);

  if (!fs.existsSync(authorizedKeysPath)) {
    warnings.push(`Authorized keys file not found at: ${authorizedKeysPath}`);
  }

  // Check required directories exist
  const requiredDirs = [
    { name: 'Jobs', path: path.join(process.cwd(), PATHS.JOBS_DIR) },
    { name: 'Config', path: path.join(process.cwd(), PATHS.CONFIG_DIR) },
    { name: 'Logs', path: path.join(process.cwd(), PATHS.LOGS_DIR) }
  ];

  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir.path)) {
      warnings.push(`${dir.name} directory not found at: ${dir.path}`);
    }
  });

  // If there are errors, throw ConfigurationError
  if (errors.length > 0) {
    throw new ConfigurationError(
      `Environment validation failed:\n${errors.join('\n')}`,
      errors
    );
  }

  return {
    valid: true,
    warnings,
    config: {
      port,
      nodeEnv,
      serverPublicKeyPath,
      serverPrivateKeyPath,
      authorizedKeysPath
    }
  };
}

/**
 * Get validated configuration
 * Returns validated config or throws error
 */
function getValidatedConfig() {
  const result = validateEnvironment();
  return result.config;
}

module.exports = {
  validateEnvironment,
  getValidatedConfig
};
