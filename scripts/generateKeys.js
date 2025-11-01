#!/usr/bin/env node

const { generateKeyPair, saveKeyPair } = require('../utils/keyManager');

/**
 * CLI tool to generate RSA key pairs
 * Usage: node scripts/generateKeys.js [name] [keySize]
 */

const args = process.argv.slice(2);
const name = args[0] || 'server';
const keySize = parseInt(args[1]) || 2048;

console.log(`Generating ${keySize}-bit RSA key pair for: ${name}`);
console.log('---');

try {
  const { publicKey, privateKey } = generateKeyPair(keySize);
  const { publicKeyPath, privateKeyPath } = saveKeyPair(publicKey, privateKey, './keys', name);

  console.log('---');
  console.log('Public key content:');
  console.log(publicKey);
  console.log('---');
  console.log('IMPORTANT: Keep the private key secure!');
  console.log('The private key has been saved with restricted permissions (600).');

  if (name === 'server') {
    console.log('\nTo add this public key to .env:');
    console.log(`SERVER_PUBLIC_KEY_PATH=${publicKeyPath}`);
    console.log(`SERVER_PRIVATE_KEY_PATH=${privateKeyPath}`);
  } else {
    console.log('\nTo authorize this client key, run:');
    console.log(`node scripts/addAuthorizedKey.js ${publicKeyPath} "Description for ${name}"`);
  }
} catch (error) {
  console.error('Error generating keys:', error.message);
  process.exit(1);
}
