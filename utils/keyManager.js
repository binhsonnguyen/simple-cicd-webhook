const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate RSA key pair
 * @param {number} modulusLength - Key size in bits (default: 2048)
 * @returns {Object} Object containing publicKey and privateKey
 */
function generateKeyPair(modulusLength = 2048) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return { publicKey, privateKey };
}

/**
 * Save key pair to files
 * @param {string} publicKey - Public key in PEM format
 * @param {string} privateKey - Private key in PEM format
 * @param {string} dir - Directory to save keys (default: ./keys)
 * @param {string} name - Key file name prefix (default: server)
 */
function saveKeyPair(publicKey, privateKey, dir = './keys', name = 'server') {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const publicKeyPath = path.join(dir, `${name}_public.pem`);
  const privateKeyPath = path.join(dir, `${name}_private.pem`);

  fs.writeFileSync(publicKeyPath, publicKey, 'utf8');
  fs.writeFileSync(privateKeyPath, privateKey, 'utf8');

  // Set restrictive permissions on private key
  fs.chmodSync(privateKeyPath, 0o600);

  console.log(`Keys saved to ${dir}/`);
  console.log(`  Public key: ${publicKeyPath}`);
  console.log(`  Private key: ${privateKeyPath}`);

  return { publicKeyPath, privateKeyPath };
}

/**
 * Load key from file
 * @param {string} keyPath - Path to key file
 * @returns {string} Key content
 */
function loadKey(keyPath) {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Key file not found: ${keyPath}`);
  }
  return fs.readFileSync(keyPath, 'utf8');
}

/**
 * Load authorized client keys from file
 * @param {string} filePath - Path to authorized keys file
 * @returns {Array} Array of authorized public keys
 */
function loadAuthorizedKeys(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/**
 * Add a client public key to authorized keys
 * @param {string} publicKey - Client public key
 * @param {string} filePath - Path to authorized keys file
 * @param {string} comment - Optional comment for this key
 */
function addAuthorizedKey(publicKey, filePath, comment = '') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const keyWithComment = comment
    ? `# ${comment}\n${publicKey.trim()}\n\n`
    : `${publicKey.trim()}\n\n`;

  fs.appendFileSync(filePath, keyWithComment, 'utf8');
  console.log(`Key added to ${filePath}`);
}

/**
 * Verify if a token exists in authorized keys
 * @param {string} token - Token to verify
 * @param {Array} authorizedKeys - Array of authorized keys
 * @returns {boolean} True if token is authorized
 */
function verifyToken(token, authorizedKeys) {
  if (!token) return false;

  // Normalize the token for comparison
  const normalizedToken = token.trim();

  return authorizedKeys.some(key => {
    const normalizedKey = key.trim();
    return normalizedKey === normalizedToken;
  });
}

module.exports = {
  generateKeyPair,
  saveKeyPair,
  loadKey,
  loadAuthorizedKeys,
  addAuthorizedKey,
  verifyToken
};
