#!/usr/bin/env node

const fs = require('fs');
const http = require('http');

/**
 * Simple test script to verify webhook authentication
 * Usage: node scripts/testWebhook.js <public_key_file> [port]
 */

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: node scripts/testWebhook.js <public_key_file> [port]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/testWebhook.js ./keys/client1_public.pem 3000');
  process.exit(1);
}

const keyFile = args[0];
const port = args[1] || process.env.PORT || 3000;

if (!fs.existsSync(keyFile)) {
  console.error(`Error: Key file not found: ${keyFile}`);
  process.exit(1);
}

const token = fs.readFileSync(keyFile, 'utf8').trim();

const testData = JSON.stringify({
  token: token,
  event: 'test',
  message: 'Testing webhook authentication',
  timestamp: new Date().toISOString()
});

const options = {
  hostname: 'localhost',
  port: port,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

console.log(`Testing webhook at http://localhost:${port}/webhook`);
console.log(`Using token from: ${keyFile}`);
console.log('---');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);
  console.log('---');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }

    if (res.statusCode === 200) {
      console.log('\n✓ Authentication successful!');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('\n✗ Authentication failed!');
      console.log('Make sure the public key is added to authorized_keys.txt');
    } else {
      console.log('\n? Unexpected response');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.error('\nMake sure the server is running:');
  console.error('  npm start');
});

req.write(testData);
req.end();
