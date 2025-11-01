# GitLab CI/CD Webhook Server

A Node.js webhook server to receive triggers from GitLab CI runners and execute CI/CD jobs with public/private key authentication.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Generate server keys
```bash
node scripts/generateKeys.js server
```

This creates:
- `keys/server_public.pem` - Server's public key (can be shared)
- `keys/server_private.pem` - Server's private key (keep secure!)

### 3. Generate client keys
```bash
node scripts/generateKeys.js client1
```

This creates client key pair in `keys/` directory.

### 4. Authorize client keys
Add client public keys to authorized list:
```bash
node scripts/addAuthorizedKey.js ./keys/client1_public.pem "GitLab CI Runner"
```

Or add the key directly:
```bash
node scripts/addAuthorizedKey.js "-----BEGIN PUBLIC KEY-----..." "My Client"
```

### 5. Configure environment
- Copy `.env.example` to `.env`
- Update paths if needed (defaults should work)

### 6. Start the server
```bash
npm start
```

## Authentication

The webhook uses public key authentication:

1. **Server** has a public/private key pair
2. **Clients** have their public keys registered in `config/authorized_keys.txt`
3. **Requests** must include the client's public key as a token

### Sending authenticated requests

Include the token in one of these ways:

**Query parameter:**
```bash
curl -X POST "http://localhost:3000/webhook?token=YOUR_PUBLIC_KEY"
```

**Request body:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_PUBLIC_KEY", "data": "..."}'
```

**Header:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "X-Webhook-Token: YOUR_PUBLIC_KEY"
```

## Endpoints

- `GET /health` - Health check endpoint (no auth required)
- `GET /public-key` - Fetch server's public key (no auth required)
- `POST /webhook` - Main webhook endpoint (requires authentication)
- `POST /admin/reload-keys` - Reload authorized keys without restart (requires authentication)

## GitLab CI Integration

In your `.gitlab-ci.yml`, use the client public key to authenticate:

```yaml
trigger-webhook:
  stage: deploy
  script:
    - 'curl -X POST "${WEBHOOK_URL}/webhook" -H "X-Webhook-Token: ${WEBHOOK_TOKEN}"'
  only:
    - main
```

Set `WEBHOOK_TOKEN` as a GitLab CI/CD variable with your client's public key.

## Logging

All requests are logged to:
- Console output (with colors)
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## Security Notes

- **Never commit private keys** to version control
- Store private keys securely on the server
- Use environment variables for sensitive configuration
- The `keys/` directory is gitignored by default
- Private keys are created with restricted permissions (600)

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `SERVER_PUBLIC_KEY_PATH` - Path to server's public key
- `SERVER_PRIVATE_KEY_PATH` - Path to server's private key
- `AUTHORIZED_KEYS_PATH` - Path to authorized client keys file
