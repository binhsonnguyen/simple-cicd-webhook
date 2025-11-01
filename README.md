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

### 6. Configure job permissions
Assign jobs to clients:
```bash
# List available jobs
node scripts/manageJobPermissions.js list-jobs

# Grant client permission to run specific jobs
node scripts/manageJobPermissions.js add ./keys/client1_public.pem "deploy-staging,run-tests" "GitLab CI Staging"
```

### 7. Start the server
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

## Jobs

Jobs are shell scripts stored in the `jobs/` directory. Each client can only execute jobs they're authorized for.

### Creating Jobs

Create a new job by adding a `.sh` file to the `jobs/` directory:

```bash
#!/bin/bash
# Job: my-job
# Description: Description of what this job does

echo "Running my job..."
# Your CI/CD commands here
exit 0
```

Make it executable:
```bash
chmod +x jobs/my-job.sh
```

### Managing Job Permissions

Use the job permissions management tool:

```bash
# List all available jobs
node scripts/manageJobPermissions.js list-jobs

# List configured clients and their permissions
node scripts/manageJobPermissions.js list-clients

# Grant permissions to a client
node scripts/manageJobPermissions.js add ./keys/client_public.pem "job1,job2" "Client Description"

# Remove client permissions
node scripts/manageJobPermissions.js remove ./keys/client_public.pem
```

### Built-in Jobs

The server includes these sample jobs:

- **deploy-staging** - Deploy application to staging environment
- **deploy-production** - Deploy application to production environment
- **run-tests** - Run automated test suite
- **rebuild-cache** - Clear and rebuild application cache

### Running Jobs via Webhook

Specify the job name in your webhook request:

**Via query parameter:**
```bash
curl -X POST "http://localhost:3000/webhook?job=deploy-staging" \
  -H "X-Webhook-Token: YOUR_PUBLIC_KEY"
```

**Via request body:**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: YOUR_PUBLIC_KEY" \
  -d '{"job": "deploy-staging"}'
```

### Listing Available Jobs

Check which jobs you can run:
```bash
curl http://localhost:3000/jobs \
  -H "X-Webhook-Token: YOUR_PUBLIC_KEY"
```

Response:
```json
{
  "status": "ok",
  "availableJobs": ["deploy-staging", "deploy-production", "run-tests", "rebuild-cache"],
  "allowedJobs": ["deploy-staging", "run-tests"]
}
```

## Endpoints

- `GET /health` - Health check endpoint (no auth required)
- `GET /public-key` - Fetch server's public key (no auth required)
- `GET /jobs` - List available and allowed jobs (requires authentication)
- `POST /webhook` - Execute a CI/CD job (requires authentication)
- `POST /admin/reload-keys` - Reload authorized keys without restart (requires authentication)

## GitLab CI Integration

In your `.gitlab-ci.yml`, trigger specific jobs via webhook:

```yaml
deploy-staging:
  stage: deploy
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d '{"job": "deploy-staging"}'
  only:
    - develop

deploy-production:
  stage: deploy
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d '{"job": "deploy-production"}'
  only:
    - main
  when: manual

run-tests:
  stage: test
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d '{"job": "run-tests"}'
```

**GitLab CI/CD Variables to set:**
- `WEBHOOK_URL` - Your webhook server URL (e.g., `https://your-server.com`)
- `WEBHOOK_TOKEN` - Your client's public key (mark as protected and masked)

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
- **Job permissions** are enforced - clients can only run jobs they're authorized for
- Job scripts are validated to prevent directory traversal attacks
- All job execution is logged with client identification

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `SERVER_PUBLIC_KEY_PATH` - Path to server's public key
- `SERVER_PRIVATE_KEY_PATH` - Path to server's private key
- `AUTHORIZED_KEYS_PATH` - Path to authorized client keys file
