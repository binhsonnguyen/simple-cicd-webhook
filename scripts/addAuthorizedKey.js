#!/usr/bin/env node

const fs = require('fs');
const { addAuthorizedKey } = require('../utils/keyManager');

/**
 * CLI tool to add a client public key to authorized keys
 * Usage: node scripts/addAuthorizedKey.js <public_key_file_or_string> [comment]
 */

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: node scripts/addAuthorizedKey.js <public_key_file_or_string> [comment]');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/addAuthorizedKey.js ./keys/client_public.pem "GitLab CI Runner"');
  console.error('  node scripts/addAuthorizedKey.js "ssh-rsa AAAAB3..." "Client 1"');
  process.exit(1);
}

const keyInput = args[0];
const comment = args[1] || '';
const authorizedKeysPath = './config/authorized_keys.txt';

try {
  let publicKey;

  // Check if input is a file path
  if (fs.existsSync(keyInput)) {
    publicKey = fs.readFileSync(keyInput, 'utf8');
    console.log(`Reading public key from file: ${keyInput}`);
  } else {
    // Treat as direct key string
    publicKey = keyInput;
    console.log('Using provided key string');
  }

  addAuthorizedKey(publicKey, authorizedKeysPath, comment);
  console.log('✓ Key successfully added to authorized keys');
  console.log(`  Location: ${authorizedKeysPath}`);
  if (comment) {
    console.log(`  Comment: ${comment}`);
  }
} catch (error) {
  console.error('Error adding authorized key:', error.message);
  process.exit(1);
}
