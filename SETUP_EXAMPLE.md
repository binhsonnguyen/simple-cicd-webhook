# Quick Setup Example

This guide walks through a complete setup example.

## Step 1: Install and Generate Keys

```bash
# Install dependencies
npm install

# Generate server keys
node scripts/generateKeys.js server
# Output: keys/server_public.pem and keys/server_private.pem created

# Generate client key for GitLab CI
node scripts/generateKeys.js gitlab-ci
# Output: keys/gitlab-ci_public.pem and keys/gitlab-ci_private.pem created
```

## Step 2: Authorize the Client

```bash
# Add client public key to authorized keys
node scripts/addAuthorizedKey.js ./keys/gitlab-ci_public.pem "GitLab CI Runner"
# Output: Key successfully added to config/authorized_keys.txt
```

## Step 3: Configure Job Permissions

```bash
# List available jobs
node scripts/manageJobPermissions.js list-jobs
# Output: Shows all jobs in jobs/ directory

# Grant GitLab CI permission to run specific jobs
node scripts/manageJobPermissions.js add \
  ./keys/gitlab-ci_public.pem \
  "deploy-staging,run-tests" \
  "GitLab CI Runner"
# Output: Permissions updated successfully

# Verify permissions
node scripts/manageJobPermissions.js list-clients
```

## Step 4: Start the Server

```bash
# Start server
npm start
# Output: Server running on port 3000
```

## Step 5: Test the Setup

In another terminal:

```bash
# Save the client public key to a variable
CLIENT_KEY=$(cat keys/gitlab-ci_public.pem)

# Test authentication
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: $CLIENT_KEY" \
  -d '{"job": "run-tests"}'

# Expected response:
# {
#   "status": "accepted",
#   "message": "Job started",
#   "jobName": "run-tests",
#   "timestamp": "..."
# }

# Check what jobs you can run
curl http://localhost:3000/jobs \
  -H "X-Webhook-Token: $CLIENT_KEY"

# Expected response:
# {
#   "status": "ok",
#   "availableJobs": ["deploy-staging", "deploy-production", "run-tests", "rebuild-cache"],
#   "allowedJobs": ["deploy-staging", "run-tests"]
# }
```

## Step 6: Configure GitLab CI

In your GitLab project:

1. Go to **Settings** > **CI/CD** > **Variables**

2. Add these variables:
   - `WEBHOOK_URL` = `https://your-server.com` (your webhook server URL)
   - `WEBHOOK_TOKEN` = (paste content of `keys/gitlab-ci_public.pem`)
     - Mark as **Protected** and **Masked**

3. Update your `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - deploy

run-tests:
  stage: test
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d '{"job": "run-tests"}'

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
```

## Step 7: Monitor Logs

```bash
# Watch the logs
tail -f logs/combined.log

# Or check server console output for real-time job execution
```

## Creating Additional Clients

For each new client (e.g., different GitLab projects):

```bash
# 1. Generate new client keys
node scripts/generateKeys.js client-project-2

# 2. Authorize the client
node scripts/addAuthorizedKey.js ./keys/client-project-2_public.pem "Project 2 CI"

# 3. Set job permissions
node scripts/manageJobPermissions.js add \
  ./keys/client-project-2_public.pem \
  "deploy-production" \
  "Project 2 - Production Only"

# 4. Use client-project-2_public.pem as WEBHOOK_TOKEN in that project's GitLab CI
```

## Security Checklist

- [ ] Server private key is secured with 600 permissions
- [ ] `.env` file is not committed to git
- [ ] Client public keys are properly authorized in `config/authorized_keys.txt`
- [ ] Job permissions are configured in `config/job_permissions.json`
- [ ] GitLab CI variables are marked as protected and masked
- [ ] Server is running behind HTTPS in production
- [ ] Only necessary jobs are granted to each client
